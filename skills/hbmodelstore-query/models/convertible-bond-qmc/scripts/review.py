"""Render QMC analysis tables as Markdown from complete public query results.

Offline, standard library only. Reads a JSON file or stdin; prints Markdown without
creating intermediate files. It formats evidence, not investment conclusions.
"""

import argparse
import json
import math
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from statistics import mean, median

from public_data import unwrap as unwrap_export

PREMIUM = "market_vs_theoretical_pct"
GAP = "market_minus_theoretical"
PRICE_BREAKS = (110, 130, 160)
PARITY_BREAKS = (70, 90, 110)


def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (ValueError, TypeError):
        return None
    return result if math.isfinite(result) else None


def fmt(value, digits=2, *, signed=False, suffix=""):
    value = number(value)
    if value is None:
        return "—"
    # Round only for display; never sort or aggregate rounded values.
    value = round(value, digits)
    if value == 0:
        value = 0.0
    sign = "+" if signed and value > 0 else ""
    return f"{sign}{value:.{digits}f}{suffix}"


def cell(value):
    if value is None or value == "":
        return "—"
    return (str(value).replace("&", "&amp;").replace("\\", "&#92;")
            .replace("*", "&#42;").replace("_", "&#95;").replace("`", "&#96;")
            .replace("[", "&#91;").replace("]", "&#93;").replace("<", "&lt;")
            .replace(">", "&gt;").replace("|", "&#124;").replace("\n", " ")
            .replace("\r", " "))


def table(headers, rows):
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for row in rows:
        if len(row) != len(headers):
            raise ValueError("Table row does not match its columns")
        lines.append("| " + " | ".join(cell(value) for value in row) + " |")
    return "\n".join(lines)


def unwrap(payload):
    return unwrap_export(payload)


def read_payload(path):
    text = sys.stdin.read() if str(path) == "-" else Path(path).read_text(encoding="utf-8")
    return unwrap(json.loads(text))


def cross_rows(payload):
    rows = payload["rows"]
    if payload.get("total") != len(rows) or payload.get("offset", 0) != 0:
        raise ValueError("Merge all cross-section pages first (rows must equal total, offset=0)")
    codes = [row.get("bond_code") for row in rows]
    if any(not code for code in codes) or len(set(codes)) != len(codes):
        raise ValueError("Cross-section bond codes must be present and unique")
    day = payload.get("model_date")
    if not day or any(row.get("model_date") != day for row in rows):
        raise ValueError("Use one common model_date for the cross-section")
    return rows


def values(rows, key):
    return [v for row in rows if (v := number(row.get(key))) is not None]


def aggregate(rows, key, operation):
    found = values(rows, key)
    return operation(found) if found else None


def discount_share(rows, key=GAP):
    found = values(rows, key)
    return 100 * sum(value < 0 for value in found) / len(found) if found else None


def interval_rows(rows, key, breaks):
    bounds = [-math.inf, *breaks, math.inf]
    output = []
    for lower, upper in zip(bounds[:-1], bounds[1:], strict=True):
        group = [row for row in rows if (v := number(row.get(key))) is not None
                 and lower <= v < upper]
        label = (f"< {upper:g}" if lower == -math.inf else f"≥ {lower:g}"
                 if upper == math.inf else f"{lower:g}–{upper:g}")
        output.append([label, len(group), fmt(aggregate(group, PREMIUM, median), signed=True,
                                             suffix="%"),
                       fmt(aggregate(group, PREMIUM, mean), signed=True, suffix="%"),
                       fmt(discount_share(group), 1, suffix="%")])
    missing = [row for row in rows if number(row.get(key)) is None]
    if missing:
        output.append(["缺失", len(missing), fmt(aggregate(missing, PREMIUM, median), signed=True,
                                                 suffix="%"),
                       fmt(aggregate(missing, PREMIUM, mean), signed=True, suffix="%"),
                       fmt(discount_share(missing), 1, suffix="%")])
    return output


def render_intervals(payload, price_breaks=PRICE_BREAKS, parity_breaks=PARITY_BREAKS):
    rows = cross_rows(payload)
    stats = ["券数", "理论溢价率中位数", "理论溢价率均值", "低于理论价占比"]
    return ("### 市价区间\n\n" + table(["市价区间（元）", *stats],
                                     interval_rows(rows, "market_price", price_breaks))
            + "\n\n### 平价区间\n\n" + table(["平价区间（元）", *stats],
                                          interval_rows(rows, "conversion_value", parity_breaks)))


def industry_key(row):
    day = date.fromisoformat(row["model_date"])
    quarter = day.replace(month=(day.month - 1) // 3 * 3 + 1, day=1) - timedelta(days=1)
    key = (row.get("industry_standard"), row.get("industry_code"))
    if (key[0] not in {"SW2014", "SW2021"} or not key[1] or not row.get("industry_name")
            or row.get("industry_as_of_date") != quarter.isoformat()):
        return (None, None)
    return key


def industry_stats(rows):
    groups = defaultdict(list)
    for row in rows:
        groups[industry_key(row)].append(row)
    result = []
    for (standard, code), group in groups.items():
        names = sorted({row["industry_name"] for row in group if row.get("industry_name")})
        result.append({"standard": standard, "code": code,
                       "name": names[0] if code and names else "未分类", "count": len(group),
                       "gap": aggregate(group, GAP, median), "discount": discount_share(group),
                       "premium": aggregate(group, PREMIUM, median),
                       "parity": aggregate(group, "conversion_value", median)})
    return sorted(result, key=lambda item: (item["gap"] is None,
                                           item["gap"] if item["gap"] is not None else math.inf,
                                           item["standard"] or "", item["code"] or ""))


def render_industries(payload, limit=10, min_count=1):
    selected = [item for item in industry_stats(cross_rows(payload)) if item["count"] >= min_count]
    selected = selected[:limit] if limit else selected
    return table(["行业", "行业分类", "券数", "价差中位数（元）", "低于理论价占比",
                  "理论溢价率中位数", "平价中位数（元）"],
                 [[item["name"], item["standard"], item["count"], fmt(item["gap"], signed=True),
                   fmt(item["discount"], 1, suffix="%"), fmt(item["premium"], signed=True,
                                                          suffix="%"), fmt(item["parity"])]
                  for item in selected])


def render_bonds(payload, limit=10, codes=None):
    rows = cross_rows(payload)
    if codes:
        missing = set(codes) - {row["bond_code"] for row in rows}
        if missing:
            raise ValueError(f"Bond codes absent from input: {', '.join(sorted(missing))}")
        rows = [row for row in rows if row["bond_code"] in codes]
    rows = sorted(rows, key=lambda row: (
        number(row.get(PREMIUM)) is None,
        number(row.get(PREMIUM)) if number(row.get(PREMIUM)) is not None else math.inf,
        row["bond_code"]))
    if not codes and limit:
        rows = rows[:limit]
    return table(["转债代码", "转债名称", "券种", "行业", "市场价（元）", "理论价（元）",
                  "价差（元）", "理论溢价率", "平价（元）", "纯债价值（元）"],
                 [[row["bond_code"], row.get("bond_name"),
                   {"cb": "可转债", "eb": "可交债"}.get(row.get("bond_type")),
                   row.get("industry_name"), fmt(row.get("market_price")),
                   fmt(row.get("theoretical_price")), fmt(row.get(GAP), signed=True),
                   fmt(row.get(PREMIUM), signed=True, suffix="%"), fmt(row.get("conversion_value")),
                   fmt(row.get("pure_bond_value"))] for row in rows])


def history_rows(payload):
    rows = sorted(payload["rows"], key=lambda row: row["model_date"])
    dates = [row["model_date"] for row in rows]
    if len(dates) != len(set(dates)):
        raise ValueError("History contains duplicate model dates")
    return rows


def momentum(rows, key):
    recent = rows[-20:]
    if len(recent) < 20 or len(values(recent, key)) < 20:
        return None
    return mean(values(recent[-10:], key)) - mean(values(recent[:10], key))


def render_groups(payload, as_of=None):
    if "groups" in payload:
        payload = unwrap(payload["groups"])
    rows = history_rows(payload)
    if as_of:
        rows = [row for row in rows if row["model_date"] <= as_of]
    if not rows:
        raise ValueError("No group history on or before the requested date")
    latest = rows[-1]
    return table(["平价／纯债价值分组", "模型日", "券数", "理论溢价率", "相对历史", "估值动量"],
                 [[label, latest["model_date"], latest.get(f"{key}_count"),
                   fmt(latest.get(f"{key}_pct"), signed=True, suffix="%"),
                   fmt(latest.get(f"{key}_relative_pp"), signed=True, suffix="%"),
                   fmt(momentum(rows, f"{key}_pct"), signed=True, suffix="%")]
                  for key, label in (("low", "低平底比组"), ("mid", "中平底比组"),
                                     ("high", "高平底比组"))])


def render_history(payloads):
    output = []
    seen = set()
    for payload in payloads:
        rows = history_rows(payload)
        codes = {row.get("bond_code") for row in rows}
        if len(codes) != 1 or None in codes:
            raise ValueError("Each history input must contain one bond and non-empty rows")
        latest = rows[-1]
        code = latest["bond_code"]
        if code in seen:
            raise ValueError("Duplicate bond history input")
        seen.add(code)
        recent = rows[-60:]
        average = mean(values(recent, PREMIUM)) if len(values(recent, PREMIUM)) == 60 else None
        output.append([code, latest.get("bond_name"), rows[0]["model_date"], latest["model_date"],
                       fmt(latest.get(PREMIUM), signed=True, suffix="%"),
                       fmt(average, signed=True, suffix="%"),
                       fmt(discount_share(rows, PREMIUM), 1, suffix="%")])
    return table(["转债代码", "转债名称", "区间起日", "区间止日", "理论溢价率",
                  "近60模型日均值", "区间低于理论价占比"], sorted(output))


def breaks(value):
    try:
        result = tuple(float(part) for part in value.split(","))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Use comma-separated increasing numbers") from exc
    if (not result or any(not math.isfinite(v) for v in result)
            or list(result) != sorted(set(result))):
        raise argparse.ArgumentTypeError("Use finite, unique, increasing numbers")
    return result


def nonnegative(value):
    parsed = int(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError("Use a non-negative integer")
    return parsed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for command in ("intervals", "industries", "bonds", "groups", "history"):
        entry = sub.add_parser(command)
        entry.add_argument("--input", required=True, nargs="+" if command == "history" else None,
                           help="Complete API/MCP JSON; use - for stdin")
        entry.add_argument("--output", type=Path, help="Optional Markdown file; default stdout")
        if command in ("industries", "bonds"):
            entry.add_argument("--limit", type=nonnegative, default=10,
                               help="Default 10; 0 for all")
        if command == "industries":
            entry.add_argument("--min-count", type=nonnegative, default=1)
        elif command == "bonds":
            entry.add_argument("--codes", nargs="+", help="Selected full bond codes; ignores limit")
        elif command == "intervals":
            entry.add_argument("--price-breaks", type=breaks, default=PRICE_BREAKS,
                               help="Default 110,130,160; lower-inclusive bins")
            entry.add_argument("--parity-breaks", type=breaks, default=PARITY_BREAKS,
                               help="Default 70,90,110; lower-inclusive bins")
        elif command == "groups":
            entry.add_argument("--as-of", type=date.fromisoformat, help="Default latest model date")
    args = parser.parse_args()
    try:
        if args.command == "history":
            if args.input.count("-") > 1:
                raise ValueError("stdin can only be read once")
            rendered = render_history([read_payload(path) for path in args.input])
        else:
            payload = read_payload(args.input)
            if args.command == "intervals":
                rendered = render_intervals(payload, args.price_breaks, args.parity_breaks)
            elif args.command == "industries":
                rendered = render_industries(payload, args.limit, args.min_count)
            elif args.command == "bonds":
                rendered = render_bonds(payload, args.limit, args.codes)
            else:
                rendered = render_groups(payload, args.as_of.isoformat() if args.as_of else None)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(rendered + "\n", encoding="utf-8")
        else:
            print(rendered)
    except (ValueError, KeyError, TypeError, OSError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
