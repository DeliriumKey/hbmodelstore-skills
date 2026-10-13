#!/usr/bin/env python3
"""Summarize IPO price, allocation and contribution facts; no predictive risk score."""

import argparse
import calendar
import json
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from statistics import median
from zoneinfo import ZoneInfo

PRICE_FIELDS = {
    "open": "first_day_open",
    "average": "first_day_average",
    "close": "first_day_close",
}


def decimal(value):
    if isinstance(value, bool):
        raise ValueError("Boolean is not a number")
    try:
        result = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError("Invalid numeric input") from exc
    if not result.is_finite():
        raise ValueError("Non-finite numeric input")
    return result


def iso_date(value):
    parsed = date.fromisoformat(value)
    if parsed.isoformat() != value:
        raise ValueError("Dates must use YYYY-MM-DD")
    return parsed


def optional_median(values):
    return float(median(values)) if values else None


def batches(rows, window):
    ordered = sorted(rows, key=lambda r: (r["listing_date"], r["issue_id"]))

    def tail(group):
        if len(group) <= window:
            return group
        boundary = group[-window]["listing_date"]
        return [r for r in group if r["listing_date"] >= boundary]

    recent = tail(ordered)
    previous = (
        tail([r for r in ordered if r["listing_date"] < recent[0]["listing_date"]])
        if recent
        else []
    )
    return recent, previous


def summarize(rows):
    price_rows = [r for r in rows if r["first_day_return_pct"] is not None]
    allocations = [r["allocation_rate_pct"] for r in rows if r["allocation_rate_pct"] is not None]
    known = [r for r in rows if r["contribution_pp"] is not None]
    breaks = [r for r in price_rows if r["first_day_return_pct"] < 0]
    complete = len(known) == len(rows)
    net = sum((r["contribution_pp"] for r in known), Decimal(0))
    positive = sorted(
        [r for r in known if r["contribution_pp"] > 0],
        key=lambda r: r["contribution_pp"],
        reverse=True,
    )
    negative = sorted(
        [r for r in known if r["contribution_pp"] < 0], key=lambda r: r["contribution_pp"]
    )

    def examples(items):
        return [
            {k: float(v) if isinstance(v, Decimal) else v for k, v in r.items()} for r in items[:3]
        ]

    return {
        "sample_count": len(rows),
        "first_listing_date": min((r["listing_date"] for r in rows), default=None),
        "last_listing_date": max((r["listing_date"] for r in rows), default=None),
        "issue_ids": [r["issue_id"] for r in rows],
        "price_count": len(price_rows),
        "break_count": len(breaks),
        "break_rate_pct": len(breaks) / len(price_rows) * 100 if price_rows else None,
        "median_first_day_return_pct": optional_median(
            [r["first_day_return_pct"] for r in price_rows]
        ),
        "mean_break_return_pct": float(sum(r["first_day_return_pct"] for r in breaks) / len(breaks))
        if breaks
        else None,
        "allocation_count": len(allocations),
        "median_allocation_rate_pct": optional_median(allocations),
        "contribution_count": len(known),
        "contribution_complete": complete,
        "contribution_pp": float(net) if complete else None,
        "known_contribution_pp": float(net),
        "contribution_per_issue_pp": float(net / len(rows)) if complete and rows else None,
        "known_profit_yuan": float(sum((r["profit_yuan"] for r in known), Decimal(0))),
        "known_positive_contribution_pp": float(
            sum((r["contribution_pp"] for r in positive), Decimal(0))
        ),
        "known_negative_contribution_pp": float(
            sum((r["contribution_pp"] for r in negative), Decimal(0))
        ),
        "known_allocated_amount_yuan": float(
            sum((r["allocated_amount_yuan"] for r in known), Decimal(0))
        ),
        "top_positive": examples(positive),
        "top_negative": examples(negative),
        "missing_price_ids": [r["issue_id"] for r in rows if r["first_day_return_pct"] is None],
        "missing_allocation_ids": [r["issue_id"] for r in rows if r["allocation_rate_pct"] is None],
        "missing_contribution_ids": [r["issue_id"] for r in rows if r["contribution_pp"] is None],
    }


def entries(source, details, price_field, rate_field):
    result = []
    for row in source:
        detail = details.get(row["issue_id"])
        issue, sell, rate = row.get("issue_price"), row.get(price_field), row.get(rate_field)
        ret = None
        if issue is not None and sell is not None:
            issue, sell = decimal(issue), decimal(sell)
            if issue <= 0 or sell <= 0:
                raise ValueError("Prices must be positive")
            ret = (sell / issue - 1) * 100
        if rate is not None:
            rate = decimal(rate)
            if not 0 <= rate <= 1:
                raise ValueError("Allocation rate must be between 0 and 1")
        result.append(
            {
                "issue_id": row["issue_id"],
                "code": row["code"],
                "name": row["name"],
                "listing_date": row["listing_date"],
                "first_day_return_pct": ret,
                "allocation_rate_pct": rate * 100 if rate is not None else None,
                "contribution_pp": decimal(detail["return_pct"]) if detail else None,
                "profit_yuan": decimal(detail["profit_yuan"]) if detail else None,
                "subscription_amount_yuan": decimal(detail["subscription_units"])
                * decimal(detail["issue_price"])
                if detail
                else None,
                "allocated_amount_yuan": decimal(detail["allocated_units"])
                * decimal(detail["issue_price"])
                if detail
                else None,
            }
        )
    return result


def changes(recent, previous):
    pairs = {
        "median_price_change_pp": "median_first_day_return_pct",
        "break_rate_change_pp": "break_rate_pct",
        "median_allocation_change_pp": "median_allocation_rate_pct",
        "contribution_sum_change_pp": "contribution_pp",
        "contribution_per_issue_change_pp": "contribution_per_issue_pp",
    }
    return {
        name: recent[key] - previous[key]
        if recent[key] is not None
        and previous[key] is not None
        and recent["sample_count"]
        and previous["sample_count"]
        else None
        for name, key in pairs.items()
    }


def month_groups(rows, start, end):
    first, last = iso_date(start), iso_date(end)
    span = (last.year - first.year) * 12 + last.month - first.month + 1
    if not 1 <= span <= 1200:
        raise ValueError("Review interval must span 1–1200 calendar months")
    months = []
    for i in range(span):
        year, month = divmod(first.year * 12 + first.month - 1 + i, 12)
        month += 1
        key = f"{year:04}-{month:02}"
        month_end = date(year, month, calendar.monthrange(year, month)[1])
        a, b = max(first, date(year, month, 1)), min(last, month_end)
        months.append(
            {
                "month": key,
                "start": a.isoformat(),
                "end": b.isoformat(),
                "partial_month": a.day != 1 or b != month_end,
                **summarize([r for r in rows if r["listing_date"].startswith(key)]),
            }
        )
    return months


def shift_month(day, offset):
    year, month = divmod(day.year * 12 + day.month - 1 + offset, 12)
    return date(year, month + 1, 1)


def period_summary(rows, first, count, coverage_start, coverage_end):
    """Keep observed facts separate from full-calendar-month reference values."""
    last = shift_month(first, count) - timedelta(days=1)
    a, b = max(first, coverage_start), min(last, coverage_end)
    group = summarize([r for r in rows if a.isoformat() <= r["listing_date"] <= b.isoformat()])
    covered = a <= b
    full = a == first and b == last and covered
    complete_months = sum(
        coverage_start <= shift_month(first, i)
        and shift_month(first, i + 1) - timedelta(days=1) <= coverage_end
        for i in range(count)
    )
    return {
        "start": first.isoformat(),
        "end": last.isoformat(),
        "covered_start": a.isoformat() if covered else None,
        "covered_end": b.isoformat() if covered else None,
        "month_count": count,
        "complete_month_count": complete_months,
        "coverage_complete": full,
        **group,
        "monthly_issue_count": group["sample_count"] / count if full else None,
        "monthly_contribution_pp": group["contribution_pp"] / count
        if full and group["contribution_complete"]
        else None,
        "monthly_allocated_amount_yuan": group["known_allocated_amount_yuan"] / count
        if full and group["contribution_complete"]
        else None,
    }


def monthly_changes(target, baseline):
    pairs = {
        "median_price_change_pp": "median_first_day_return_pct",
        "break_rate_change_pp": "break_rate_pct",
        "median_allocation_change_pp": "median_allocation_rate_pct",
        "monthly_contribution_change_pp": "monthly_contribution_pp",
        "monthly_issue_count_change": "monthly_issue_count",
        "contribution_per_issue_change_pp": "contribution_per_issue_pp",
        "monthly_allocated_amount_change_yuan": "monthly_allocated_amount_yuan",
    }
    return {
        name: target[key] - baseline[key]
        if target["coverage_complete"]
        and baseline["coverage_complete"]
        and target[key] is not None
        and baseline[key] is not None
        else None
        for name, key in pairs.items()
    }


def monthly_tracking(rows, start, end, as_of, month):
    first, last = iso_date(start), min(iso_date(end), as_of)
    if first > last:
        raise ValueError("As-of date precedes the input interval")
    latest = last.replace(day=1)
    last_day = shift_month(latest, 1) - timedelta(days=1)
    target_start = latest if last == last_day else shift_month(latest, -1)
    if month is not None:
        target_start = iso_date(f"{month}-01")
        if target_start > last or shift_month(target_start, 1) <= first:
            raise ValueError("Selected month is outside the observed interval")
    target = None
    if month is not None or target_start >= first:
        target = {
            "month": target_start.strftime("%Y-%m"),
            **period_summary(rows, target_start, 1, first, last),
        }
    baselines = (
        {
            label: period_summary(rows, shift_month(target_start, -count), count, first, last)
            for label, count in [
                ("previous_month", 1),
                ("prior_3_months", 3),
                ("prior_12_months", 12),
            ]
        }
        if target
        else {}
    )
    partial = None
    if month is None and (last != last_day or first > latest):
        partial = {
            "month": latest.strftime("%Y-%m"),
            **period_summary(rows, latest, 1, first, last),
        }
    return {
        "as_of": as_of.isoformat(),
        "coverage_end": last.isoformat(),
        "selection": "explicit_month" if month else "latest_complete_calendar_month",
        "target": target,
        "baselines": baselines,
        "comparisons": {key: monthly_changes(target, value) for key, value in baselines.items()},
        "month_to_date": partial,
    }


def review(payload, *, window=10, capital=None, month=None, as_of=None):
    if payload.get("model_key") != "new-issue-return" or payload.get("market") not in (
        "hs",
        "bse",
        "reits",
    ):
        raise ValueError("Expected a new-issue-return analysis result")
    if isinstance(window, bool) or not isinstance(window, int) or not 2 <= window <= 100:
        raise ValueError("Window must be an integer from 2 to 100")
    source = payload.get("source_rows")
    if not isinstance(source, list) or len(source) > 10500:
        raise ValueError(
            "Complete source_rows required; rerun analyze.py from the saved issue tables"
        )
    if len({r["issue_id"] for r in source}) != len(source):
        raise ValueError("Duplicate issuance identity")
    start, end = payload["start"], payload["end"]
    if iso_date(start) > iso_date(end):
        raise ValueError("Start must not exceed end")
    observed_on = iso_date(as_of) if as_of else datetime.now(ZoneInfo("Asia/Shanghai")).date()
    market = payload["market"]
    price_field = PRICE_FIELDS[payload["price_basis"]]
    rate_field = (
        f"offline_rate_{payload['investor_class'].lower()}"
        if market == "hs"
        else "online_rate"
        if market == "bse"
        else "offline_rate"
    )
    listed, pending, excluded = [], [], []
    for row in source:
        if market == "hs" and row.get("has_offline") in (False, 0):
            excluded.append(row["issue_id"])
            continue
        if not row.get("listing_date") or row["listing_date"] > end:
            pending.append(row["issue_id"])
            continue
        iso_date(row["listing_date"])
        if start <= row["listing_date"] <= end:
            listed.append(row)
    scenarios = payload["scenarios"]
    if capital is not None:
        scenarios = [s for s in scenarios if decimal(s["capital_yuan"]) == decimal(capital)]
        if not scenarios:
            raise ValueError(
                "Capital is absent from the input scenarios; rerun analyze.py for that capital"
            )
    if not scenarios:
        raise ValueError("No scenarios to review")
    outputs = []
    for scenario in scenarios:
        detail_rows = scenario["details"]
        detail_map = {r["issue_id"]: r for r in detail_rows}
        if len(detail_map) != len(detail_rows) or not set(detail_map) <= {
            r["issue_id"] for r in listed
        }:
            raise ValueError("Scenario details do not match the source issuance identities")
        rows = entries(listed, detail_map, price_field, rate_field)
        recent_rows, previous_rows = batches(rows, window)
        recent, previous = summarize(recent_rows), summarize(previous_rows)
        cautions = []
        for label, group in [("recent", recent), ("previous", previous)]:
            if group["sample_count"] < window:
                cautions.append(f"{label}_sample_shortfall")
            if group["price_count"] < group["sample_count"]:
                cautions.append(f"{label}_price_incomplete")
            if group["allocation_count"] < group["sample_count"]:
                cautions.append(f"{label}_allocation_incomplete")
            if not group["contribution_complete"]:
                cautions.append(f"{label}_contribution_incomplete")
        last_listing = recent["last_listing_date"]
        age = (iso_date(end) - iso_date(last_listing)).days if last_listing else None
        span_start = previous["first_listing_date"] or recent["first_listing_date"]
        span = (iso_date(last_listing) - iso_date(span_start)).days + 1 if last_listing else None
        if age is not None and age > 60:
            cautions.append("latest_listing_over_60_days_old")
        if span is not None and span > 180:
            cautions.append("comparison_spans_over_180_days")
        outputs.append(
            {
                "capital_yuan": float(decimal(scenario["capital_yuan"])),
                "overall": summarize(rows),
                "recent": recent,
                "previous": previous,
                "comparison": changes(recent, previous),
                "months": month_groups(rows, start, end),
                "monthly_tracking": monthly_tracking(rows, start, end, observed_on, month),
                "latest_listing_age_days": age,
                "comparison_span_days": span,
                "cautions": cautions,
            }
        )
    return {
        "model_key": "new-issue-return",
        "analysis_kind": "review-and-tracking",
        **{
            key: payload.get(key)
            for key in (
                "market",
                "scope",
                "start",
                "end",
                "price_basis",
                "investor_class",
                "budget_ratio",
                "updated_at",
            )
        },
        "window_target": window,
        "primary_comparison": "calendar_month",
        "listed_sample_count": len(listed),
        "pending_ids": pending,
        "excluded_no_offline_ids": excluded,
        "source_omitted": payload.get("omitted", []),
        "scenarios": outputs,
        "method": "Descriptive scenario facts; no risk score or forecast probability.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Complete analyze.py JSON")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--window", type=int, default=10, help="Issues in each secondary batch (default: 10)"
    )
    parser.add_argument("--month", help="Target YYYY-MM; default: latest complete calendar month")
    parser.add_argument(
        "--as-of", help="Monthly observation cutoff YYYY-MM-DD; default: today in Shanghai"
    )
    parser.add_argument(
        "--capital", help="Select an existing capital scenario in yuan; default: all"
    )
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("Output must not overwrite the input")
    try:
        result = review(
            json.loads(args.input.read_text(encoding="utf-8")),
            window=args.window,
            capital=args.capital,
            month=args.month,
            as_of=args.as_of,
        )
    except (ValueError, KeyError, TypeError) as exc:
        parser.error(str(exc))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, allow_nan=False), encoding="utf-8"
    )
    print(args.output.resolve())


if __name__ == "__main__":
    main()
