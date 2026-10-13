#!/usr/bin/env python3
"""Calculate capital scenarios from the three consumer tables, entirely offline."""

import argparse
import json
import sqlite3
import sys
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import load_json

MARKETS = ("hs", "bse", "reits")
PRICE_FIELDS = {
    "open": "first_day_open",
    "close": "first_day_close",
    "average": "first_day_average",
}
CAPITAL_PRESETS = json.loads(
    (Path(__file__).resolve().parents[1] / "assets/capital-presets.json").read_text(
        encoding="utf-8"
    )
)


def default_capitals(market, scope="sh"):
    if market == "hs":
        return CAPITAL_PRESETS[market]["dual" if scope == "dual" else "single"]
    return CAPITAL_PRESETS[market]


def number(value):
    if isinstance(value, bool):
        raise ValueError("Boolean is not a number")
    try:
        result = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError("Invalid numeric input") from exc
    if not result.is_finite():
        raise ValueError("Non-finite numeric input")
    return result


def load_tables(path):
    path = Path(path).resolve()
    if path.suffix in (".sqlite", ".db"):
        with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as connection:
            connection.row_factory = sqlite3.Row
            return {
                market: [dict(row) for row in connection.execute(f"SELECT * FROM {market}")]
                for market in MARKETS
            }
    payload = load_json(path)
    tables = payload.get("tables", payload)
    if not isinstance(tables, dict) or any(not isinstance(tables.get(m), list) for m in MARKETS):
        raise ValueError("Input must contain hs, bse and reits arrays")
    return tables


def analyze(
    tables,
    *,
    market,
    capitals=None,
    start,
    end,
    scope="sh",
    investor_class="A",
    budget_ratio="0.9",
    price_basis=None,
):
    if market not in MARKETS or scope not in ("sh", "sz", "dual"):
        raise ValueError("Invalid market or Shanghai/Shenzhen scope")
    if price_basis is None:
        price_basis = "average" if market == "reits" else "open"
    if investor_class not in ("A", "B") or price_basis not in PRICE_FIELDS:
        raise ValueError("Invalid investor class or price basis")
    start_date, end_date = date.fromisoformat(start), date.fromisoformat(end)
    if start_date.isoformat() != start or end_date.isoformat() != end:
        raise ValueError("Dates must use YYYY-MM-DD")
    if start_date > end_date:
        raise ValueError("Start must not exceed end")
    ratio = number(budget_ratio)
    if not 0 < ratio <= 1:
        raise ValueError("Budget ratio must be in (0,1]")
    amounts = sorted(
        {number(c) for c in (default_capitals(market, scope) if capitals is None else capitals)}
    )
    if not 1 <= len(amounts) <= 8 or any(c <= 0 or c > Decimal("1e12") for c in amounts):
        raise ValueError("Use 1–8 positive capital amounts up to 1 trillion yuan")
    minimum = Decimal("200000000" if scope == "dual" else "100000000")
    if market == "hs" and any(c < minimum for c in amounts):
        raise ValueError(f"{scope} preview requires capital of at least {minimum} yuan")
    rows = tables[market]
    if not isinstance(rows, list) or len(rows) > 10500:
        raise ValueError("Invalid or oversized table")
    ids = [row["issue_id"] for row in rows]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate issuance identity")
    selected = sorted(
        (
            r
            for r in rows
            if start <= (r.get("listing_date") or r.get("subscription_date") or "") <= end
            and (
                market != "hs"
                or scope == "dual"
                or r["code"].endswith(".SH" if scope == "sh" else ".SZ")
            )
        ),
        key=lambda r: (r.get("listing_date") or r.get("subscription_date"), r["issue_id"]),
    )
    rate_field = (
        f"offline_rate_{investor_class.lower()}"
        if market == "hs"
        else "online_rate"
        if market == "bse"
        else "offline_rate"
    )
    cap_field = "online_cap" if market == "bse" else "offline_cap"
    price_field = PRICE_FIELDS[price_basis]
    valid, omitted = [], []
    for row in selected:
        reason = None
        missing = []
        if market == "hs" and row.get("has_offline") in (False, 0):
            reason = "no_offline"
        elif not row.get("listing_date"):
            reason = "pending"
        else:
            missing = [
                f for f in ("issue_price", price_field, rate_field, cap_field) if row.get(f) is None
            ]
            if market == "hs" and row.get("has_offline") not in (True, 1):
                missing.append("has_offline")
            if missing:
                reason = "missing_data"
        if reason:
            omitted.append(
                {
                    "issue_id": row["issue_id"],
                    "code": row["code"],
                    "reason": reason,
                    "missing": missing,
                }
            )
            continue
        issue, sell, rate, cap = (
            number(row[f]) for f in ("issue_price", price_field, rate_field, cap_field)
        )
        if issue <= 0 or sell <= 0 or cap <= 0 or not 0 <= rate <= 1:
            raise ValueError(f"Invalid financial values for {row['code']}")
        valid.append((row, issue, sell, rate, cap))
    scenarios = []
    for capital in amounts:
        total = Decimal(0)
        history, details = [], []
        for row, issue, sell, rate, cap in valid:
            requested = min(capital * ratio / issue, cap)
            allocated = requested * rate
            profit = allocated * (sell - issue)
            total += profit
            point = {
                "date": row["listing_date"],
                "profit_yuan": float(total),
                "return_pct": float(total / capital * 100),
            }
            if history and history[-1]["date"] == point["date"]:
                history[-1] = point
            else:
                history.append(point)
            details.append(
                {
                    "issue_id": row["issue_id"],
                    "code": row["code"],
                    "name": row["name"],
                    "listing_date": row["listing_date"],
                    "issue_price": str(issue),
                    "sell_price": str(sell),
                    "first_day_return_pct": float((sell - issue) / issue * 100),
                    "subscription_cap": str(cap),
                    "allocation_rate": str(rate),
                    "subscription_units": str(requested),
                    "allocated_units": str(allocated),
                    "profit_yuan": str(profit),
                    "return_pct": float(profit / capital * 100),
                }
            )
        scenarios.append(
            {
                "capital_yuan": float(capital),
                "profit_yuan": float(total),
                "return_pct": float(total / capital * 100),
                "included": len(valid),
                "history": history,
                "details": details,
            }
        )
    return {
        "model_key": "new-issue-return",
        "market": market,
        "scope": scope if market == "hs" else None,
        "start": start,
        "end": end,
        "price_basis": price_basis,
        "investor_class": investor_class if market == "hs" else None,
        "budget_ratio": float(ratio),
        "sample_count": len(selected),
        "included": len(valid),
        "omitted": omitted,
        "source_rows": selected,
        "scenarios": scenarios,
        "updated_at": max((r.get("updated_at", "") for r in selected), default=None),
        "method": (
            "Independent continuous first-day gross contribution; "
            "no cash ledger or base-asset return."
        ),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--market", choices=MARKETS, required=True)
    parser.add_argument("--scope", choices=("sh", "sz", "dual"), default="sh")
    parser.add_argument(
        "--capitals",
        help="Comma-separated yuan; defaults to web presets; dual is total account size",
    )
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--investor-class", choices=("A", "B"), default="A")
    parser.add_argument("--budget-ratio", default="0.9")
    parser.add_argument(
        "--price-basis", choices=PRICE_FIELDS, help="Default: REITs average; HS/BSE open"
    )
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("Output must not overwrite the input")
    try:
        result = analyze(
            load_tables(args.input),
            market=args.market,
            scope=args.scope,
            capitals=args.capitals.split(",") if args.capitals is not None else None,
            start=args.start,
            end=args.end,
            investor_class=args.investor_class,
            budget_ratio=args.budget_ratio,
            price_basis=args.price_basis,
        )
    except (ValueError, KeyError, sqlite3.Error) as exc:
        parser.error(str(exc))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, allow_nan=False), encoding="utf-8"
    )
    print(args.output.resolve())


if __name__ == "__main__":
    main()
