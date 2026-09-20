#!/usr/bin/env python3
"""Reproducible half-year Brinson analysis. Derived results never write to the API.

Online: --fund-code CODE [--start DATE --end DATE] --output analysis.json
MCP export: --history-json history.json --details-json periods.json --navs-json navs.json
Offline: --input raw.json [--start DATE --end DATE] --output analysis.json
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import tempfile
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from brinson_data import BASE_URL, fetch, normalize_code

SCHEMA = "brinson-analysis-v1"
RAW_SCHEMA = "brinson-source-v1"
TOLERANCE = 1e-8
EFFECTS = {
    "market_allocation_effect": "四资产配置",
    "industry_allocation_effect": "股票行业配置",
    "security_selection_effect": "股票选择",
    "convertible_bond_industry_allocation_effect": "转债正股行业配置",
    "convertible_bond_stock_selection_contribution": "转债正股选择",
    "convertible_bond_other_excess_effect": "转债其他超额",
    "residual_effect": "残差（含基准桥接）",
}
NAV_FIELDS = {
    "fund_nav_index": "fund_return",
    "fitted_nav_index": "fitted_portfolio_return",
    "benchmark_nav_index": "benchmark_return",
}
DOC_URL = (
    "https://api.delirium.com.cn/llms.mdx/docs/models/"
    "fund-brinson-attribution/construction/content.md"
)


def number(value, label="value"):
    if value is None or isinstance(value, bool) or value == "":
        raise ValueError(f"{label}: missing numeric value (not zero)")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{label}: non-finite value")
    return result


def close(a, b, label):
    if not math.isclose(a, b, abs_tol=TOLERANCE, rel_tol=TOLERANCE):
        raise ValueError(f"{label}: inconsistent values {a:.12g} / {b:.12g}")


def next_half(start):
    if (start.month, start.day) == (12, 31):
        return date(start.year + 1, 6, 30)
    if (start.month, start.day) == (6, 30):
        return date(start.year, 12, 31)
    raise ValueError("period boundaries must be June 30 or December 31")


def canonical_start(value):
    start = date.fromisoformat(value)
    # Calendar-year/half-year requests include their immediately preceding NAV anchor.
    return start - timedelta(days=1) if (start.month, start.day) in {(1, 1), (7, 1)} else start


def select_periods(rows, code, start=None, end=None):
    ordered = sorted(rows, key=lambda r: r["period_start"])
    seen = set()
    previous_end = None
    for row in ordered:
        if normalize_code(row["fund_code"]) != code:
            raise ValueError("history fund_code mismatch")
        a, b = date.fromisoformat(row["period_start"]), date.fromisoformat(row["period_end"])
        if next_half(a) != b or b in seen or (previous_end and a < previous_end):
            raise ValueError("duplicate, overlapping or non-half-year history")
        seen.add(b)
        previous_end = b
    left = (
        canonical_start(start)
        if start
        else (date.fromisoformat(ordered[0]["period_start"]) if ordered else None)
    )
    right = (
        date.fromisoformat(end)
        if end
        else (date.fromisoformat(ordered[-1]["period_end"]) if ordered else None)
    )
    if left and right and left >= right:
        raise ValueError("start must precede end")
    selected = [
        r
        for r in ordered
        if left <= date.fromisoformat(r["period_start"])
        and date.fromisoformat(r["period_end"]) <= right
    ]
    expected = []
    if left and right:
        cursor = date(left.year - 1, 12, 31)
        while next_half(cursor) <= right:
            stop = next_half(cursor)
            if cursor >= left:
                expected.append((cursor.isoformat(), stop.isoformat()))
            cursor = stop
            if len(expected) > 40:
                raise ValueError("analysis window exceeds the public 40-half-year bound")
    partial = bool(
        left
        and right
        and (
            not expected
            or expected[0][0] != left.isoformat()
            or expected[-1][1] != right.isoformat()
        )
    )
    return selected, expected, partial, left, right


def validate_period(row):
    if row.get("quality_status") != "passed":
        raise ValueError("not a published passed period")
    if not row.get("method_id"):
        raise ValueError("missing method_id")
    rf, rb = number(row.get("fund_return")), number(row.get("benchmark_return"))
    fit = number(row.get("fitted_portfolio_return"), "fitted_portfolio_return")
    if min(rf, rb, fit) <= -1:
        raise ValueError("returns must be greater than -100% for logarithmic linking")
    effects = {key: number(row.get(key), key) for key in EFFECTS}
    close(rf - rb, number(row.get("active_return")), "arithmetic active return")
    close(math.fsum(effects.values()), rf - rb, "single-period attribution closure")
    close(rf - fit, number(row.get("fit_residual")), "fit residual")
    close(
        number(row.get("fit_residual")) + number(row.get("benchmark_bridge")),
        effects["residual_effect"],
        "final residual bridge",
    )
    close(
        number(row.get("convertible_bond_selection_effect")),
        math.fsum(
            effects[key]
            for key in (
                "convertible_bond_industry_allocation_effect",
                "convertible_bond_stock_selection_contribution",
                "convertible_bond_other_excess_effect",
            )
        ),
        "CB total excess vs three constituent effects",
    )
    return effects


def carino_coefficient(rf, rb):
    if min(rf, rb) <= -1:
        raise ValueError("Carino requires returns greater than -100%")
    delta = rf - rb
    # log1p of a ratio avoids subtracting two almost equal logarithms.
    return math.log1p(delta / (1 + rb)) / delta if delta else 1 / (1 + rf)


def compounded(values):
    return math.expm1(math.fsum(math.log1p(v) for v in values))


def link_periods(rows):
    raw = [validate_period(row) for row in rows]
    for prev, cur in zip(rows, rows[1:], strict=False):
        if prev["period_end"] != cur["period_start"] or prev["method_id"] != cur["method_id"]:
            raise ValueError("cannot link across missing periods or unverified method changes")
    rf = compounded(number(r["fund_return"]) for r in rows)
    rb = compounded(number(r["benchmark_return"]) for r in rows)
    fit = compounded(number(r["fitted_portfolio_return"]) for r in rows)
    k = carino_coefficient(rf, rb)
    factors = [
        carino_coefficient(number(r["fund_return"]), number(r["benchmark_return"])) / k
        for r in rows
    ]
    effects = {
        key: math.fsum(value[key] * factor for value, factor in zip(raw, factors, strict=True))
        for key in EFFECTS
    }
    close(math.fsum(effects.values()), rf - rb, "multi-period attribution closure")
    return {
        "fund_return": rf,
        "benchmark_return": rb,
        "fitted_portfolio_return": fit,
        "active_return": rf - rb,
        "relative_return": (1 + rf) / (1 + rb) - 1,
        "effects": effects,
        "link_factors": dict(zip((r["period_end"] for r in rows), factors, strict=True)),
        "closure_error": math.fsum(effects.values()) - (rf - rb),
    }


def validate_nav(payload, row):
    if not payload:
        raise ValueError("daily NAV payload unavailable; not fetched or no published data")
    if payload.get("fund_code") != row["fund_code"]:
        raise ValueError("NAV fund_code mismatch")
    points = payload.get("points")
    if not isinstance(points, list) or len(points) < 2:
        raise ValueError("daily NAV missing or too short")
    if payload.get("period_end", row["period_end"]) != row["period_end"]:
        raise ValueError("NAV period_end mismatch")
    previous = None
    for point in points:
        day = date.fromisoformat(point["trade_date"])
        if previous and day <= previous:
            raise ValueError("NAV dates must be strictly increasing")
        previous = day
        for key in NAV_FIELDS:
            if number(point.get(key), key) <= 0:
                raise ValueError("NAV index must be positive")
    # The API uses the last actual trading day at/before each report boundary.
    for point, boundary in ((points[0], row["period_start"]), (points[-1], row["period_end"])):
        lag = (date.fromisoformat(boundary) - date.fromisoformat(point["trade_date"])).days
        if not 0 <= lag <= 10:
            raise ValueError("NAV boundary does not match the published half-year")
    for key, return_key in NAV_FIELDS.items():
        close(number(points[0][key]), 1, f"{key} initial normalization")
        close(number(points[-1][key]) - 1, number(row[return_key]), f"{key} terminal return")
    return points


def stitch_nav(rows, nav):
    """Return separate paths if a daily payload is unavailable; never bridge a gap."""
    paths, issues = [], []
    current = None
    for row in rows:
        end = row["period_end"]
        try:
            points = validate_nav(nav.get(end, {}), row)
        except (ValueError, KeyError, TypeError) as exc:
            issues.append({"period_end": end, "detail": str(exc)})
            current = None
            continue
        if current and current["points"][-1]["trade_date"] != points[0]["trade_date"]:
            issues.append({"period_end": end, "detail": "adjacent NAV boundary dates differ"})
            current = None
        if current is None:
            current = {"period_start": row["period_start"], "period_end": end, "points": []}
            paths.append(current)
        scales = {key: current["points"][-1][key] if current["points"] else 1 for key in NAV_FIELDS}
        for point in points[1:] if current["points"] else points:
            current["points"].append(
                {
                    "trade_date": point["trade_date"],
                    **{key: number(point[key]) * scales[key] for key in NAV_FIELDS},
                }
            )
        current["period_end"] = end
    return paths, issues


def aggregate_level(rows, details, factors, level):
    """One hierarchy at a time. Never sum assets + industries + securities."""
    key_fields = {
        "markets": ("market_code",),
        "industries": ("market_code", "industry_standard", "industry_code"),
        "securities": ("market_code", "industry_standard", "industry_code", "security_code"),
        "convertible_bonds": (
            "security_code",
            "underlying_code",
            "industry_standard",
            "industry_code",
        ),
    }[level]
    value_field = (
        "excess_selection_contribution" if level == "securities" else "active_contribution"
    )
    result = {}
    try:
        for row in rows:
            if row["period_end"] not in details:
                raise ValueError(f"{row['period_end']}: period detail payload unavailable")
            payload = details[row["period_end"]]
            detail_period = payload["period"]
            for key in ("fund_code", "period_start", "period_end", "method_id"):
                if detail_period.get(key) != row[key]:
                    raise ValueError(f"period detail {key} differs from history")
            for key in ("fund_return", "benchmark_return", *EFFECTS):
                close(number(detail_period.get(key)), number(row[key]), "detail/history snapshot")
            entries = payload[level]
            total = 0
            for entry in entries:
                if level in {"securities", "convertible_bonds"} and not entry.get(
                    "included_in_attribution"
                ):
                    continue
                key = tuple(entry.get(field) for field in key_fields)
                if any(item is None for item in key):
                    raise ValueError(f"{level} missing grouping identity")
                if level == "convertible_bonds":
                    value = math.fsum(
                        number(entry.get(field), field)
                        for field in (
                            "industry_allocation_contribution",
                            "stock_selection_contribution",
                            "other_excess_contribution",
                        )
                    )
                else:
                    value = number(entry.get(value_field), value_field)
                total += value
                item = result.setdefault(
                    key,
                    {
                        **dict(zip(key_fields, key, strict=True)),
                        "name": entry.get("security_name")
                        or entry.get("industry_name")
                        or entry.get("market_code"),
                        "linked_contribution": 0,
                        "observed_periods": 0,
                        **({
                            "industry_name": entry.get("industry_name"),
                            "cumulative_holding_weight": 0,
                            "average_period_holding_weight": 0,
                        } if level == "securities" else {}),
                    },
                )
                item["linked_contribution"] += value * factors[row["period_end"]]
                item["observed_periods"] += 1
                if level == "securities":
                    # Disclosure weights are not contributions: no Cariño factor.
                    try:
                        weight = number(entry.get("portfolio_nav_weight"))
                    except (ValueError, TypeError):
                        weight = None
                    total_weight = item["cumulative_holding_weight"]
                    item["cumulative_holding_weight"] = (
                        None if total_weight is None or weight is None or weight < 0
                        else total_weight + weight
                    )
                    item["average_period_holding_weight"] = (
                        None if item["cumulative_holding_weight"] is None
                        else item["cumulative_holding_weight"] / len(rows)
                    )
            target = {
                "markets": number(row["active_return"]) - number(row["residual_effect"]),
                "industries": number(row["industry_allocation_effect"])
                + number(row["security_selection_effect"]),
                "securities": number(row["security_selection_effect"]),
                "convertible_bonds": number(row["convertible_bond_selection_effect"]),
            }[level]
            close(total, target, f"{level} detail/parent contribution")
            if level == "markets":
                close(
                    math.fsum(number(e["allocation_effect"]) for e in entries),
                    number(row["market_allocation_effect"]),
                    "four-asset allocation aggregate",
                )
        if level == "convertible_bonds":
            value_field = "industry_allocation + stock_selection + other_excess"
        return {
            "status": "complete",
            "value_field": value_field,
            "rows": sorted(result.values(), key=lambda r: -r["linked_contribution"]),
        }
    except (KeyError, ValueError, TypeError) as exc:
        return {"status": "unavailable", "value_field": value_field, "rows": [], "detail": str(exc)}


def build_analysis(bundle, start=None, end=None):
    if bundle.get("schema") != RAW_SCHEMA:
        raise ValueError("input must be a brinson-source-v1 bundle")
    code = normalize_code(bundle["fund_code"])
    start = start or bundle.get("requested", {}).get("start")
    end = end or bundle.get("requested", {}).get("end")
    history = bundle["history"]["rows"]
    selected, expected, partial, left, right = select_periods(history, code, start, end)
    rejected, valid = [], []
    for row in selected:
        try:
            validate_period(row)
            valid.append(row)
        except (ValueError, KeyError, TypeError) as exc:
            rejected.append({"period_end": row["period_end"], "detail": str(exc)})
    available = {r["period_end"] for r in selected}
    missing = [{"period_start": a, "period_end": b} for a, b in expected if b not in available]
    groups = []
    for row in valid:
        if (
            not groups
            or groups[-1][-1]["period_end"] != row["period_start"]
            or (groups[-1][-1]["method_id"] != row["method_id"])
        ):
            groups.append([])
        groups[-1].append(row)
    segments = []
    for rows in groups:
        linked = link_periods(rows)
        paths, issues = stitch_nav(rows, bundle.get("nav", {}))
        levels = {
            level: aggregate_level(rows, bundle.get("details", {}), linked["link_factors"], level)
            for level in ("markets", "industries", "securities", "convertible_bonds")
        }
        segments.append(
            {
                "period_start": rows[0]["period_start"],
                "period_end": rows[-1]["period_end"],
                "period_count": len(rows),
                "method_id": rows[0]["method_id"],
                "model_versions": sorted({r["model_version"] for r in rows}),
                **linked,
                "nav_paths": paths,
                "nav_issues": issues,
                "drilldown": levels,
                "best_period": max(rows, key=lambda r: number(r["active_return"]))["period_end"],
                "worst_period": min(rows, key=lambda r: number(r["active_return"]))["period_end"],
                "effect_stability": {
                    key: {
                        "positive_periods": sum(number(r[key]) > 0 for r in rows),
                        "negative_periods": sum(number(r[key]) < 0 for r in rows),
                        "total_periods": len(rows),
                    }
                    for key in EFFECTS
                },
            }
        )
    warnings = []
    if partial:
        warnings.append("请求边缘包含不足一个半年期的日期，未按天数分摊归因；结果仅含完整半年期。")
    if missing:
        warnings.append(
            "历史接口存在缺期：分段汇总，不跨缺口连接净值或归因。缺期原因无法由公开接口确定。"
        )
    if len({r["method_id"] for r in valid}) > 1:
        warnings.append("方法标识不同的期分别汇总，尚未确认可比性；同方法的修复版本不拆段。")
    if len(history) == 40:
        warnings.append("历史达到接口 40 期上限；不能断言更早没有结果。")
    if rejected:
        warnings.append(
            "部分返回期缺少当前字段或未通过一致性检查，已列入 rejected_periods，未当作零。"
        )
    incomplete_detail = any(
        s["nav_issues"] or any(d["status"] != "complete" for d in s["drilldown"].values())
        for s in segments
    )
    if incomplete_detail:
        warnings.append("部分净值或下钻明细不完整；可用的单期/跨期总归因仍保留，详见对应诊断。")
    complete = bool(valid) and not (missing or rejected or partial or incomplete_detail)
    return {
        "schema": SCHEMA,
        "fund_code": code,
        "fund_name": selected[-1].get("fund_name") if selected else None,
        "generated_at": datetime.now(UTC).isoformat(),
        "provenance": {
            "api": BASE_URL,
            "model_documentation": DOC_URL,
            "fetched_at": bundle.get("fetched_at"),
            "derivation": "client-side Carino linking; not a new production model",
        },
        "status": "complete" if complete else "partial" if valid else "empty",
        "requested": {"start": start, "end": end},
        "coverage": {
            "anchor_start": left.isoformat() if left else None,
            "end": right.isoformat() if right else None,
            "expected_periods": len(expected),
            "available_periods": len(valid),
            "missing_periods": missing,
            "rejected_periods": rejected,
            "history_limit_reached": len(history) == 40,
        },
        "warnings": warnings,
        "fetch_errors": bundle.get("errors", []),
        "effect_labels": EFFECTS,
        "periods": valid,
        "segments": segments,
        # Never manufacture an overall return by concatenating disjoint segments.
        "overall": (
            {
                key: segments[0][key]
                for key in (
                    "fund_return",
                    "benchmark_return",
                    "active_return",
                    "relative_return",
                    "effects",
                )
            }
            if len(segments) == 1 and not (missing or rejected or partial)
            else None
        ),
        "period_details": {
            r["period_end"]: bundle.get("details", {}).get(r["period_end"]) for r in valid
        },
    }


def mcp_payload(value, label):
    """Accept the API object or a complete MCP structured-result envelope."""
    if not isinstance(value, dict):
        raise ValueError(f"{label}: expected a JSON object")
    if value.get("isError") or value.get("is_error"):
        raise ValueError(f"{label}: MCP returned an error, not model data")
    for key in ("structuredContent", "structured_content"):
        if key in value:
            value = value[key]
            break
    if not isinstance(value, dict):
        raise ValueError(f"{label}: export the complete structuredContent object")
    return value


def imported_period_end(value):
    if not isinstance(value, str) or date.fromisoformat(value).isoformat() != value:
        raise ValueError("imported period_end must use YYYY-MM-DD")
    if value[5:] not in {"06-30", "12-31"}:
        raise ValueError("imported period_end must be June 30 or December 31")
    return value


def import_mcp(history, details, navs, start=None, end=None):
    """Normalize three exports without fetching or changing attribution calculations."""
    history = mcp_payload(history, "history")
    details = mcp_payload(details, "details")
    navs = mcp_payload(navs, "navs")
    code = details.get("fund_code")
    if not isinstance(code, str):
        raise ValueError("details: missing fund_code")
    code = normalize_code(code)
    rows = history.get("rows")
    if not isinstance(rows, list) or len(rows) > 40 or any(not isinstance(r, dict) for r in rows):
        raise ValueError("history: expected rows containing at most 40 period objects")
    if any(not isinstance(row.get("fund_code"), str) for row in rows):
        raise ValueError("history: missing fund_code")
    selected, _, _, _, _ = select_periods(rows, code, start, end)
    expected = {row["period_end"] for row in selected}
    history_ends = {row["period_end"] for row in rows}
    bundle = {
        "schema": RAW_SCHEMA,
        "fund_code": code,
        "history": history,
        "requested": {"start": start, "end": end},
        # Import time is not the time the upstream model snapshot was fetched.
        "imported_at": datetime.now(UTC).isoformat(),
        "errors": [],
        "missing_periods": {},
    }
    for target, payload in (("details", details), ("nav", navs)):
        batch_code = payload.get("fund_code")
        if not isinstance(batch_code, str) or normalize_code(batch_code) != code:
            raise ValueError(f"{target}: fund_code mismatch")
        periods, missing = payload.get("periods"), payload.get("missing_periods")
        if not isinstance(periods, list) or not isinstance(missing, list):
            raise ValueError(f"{target}: expected periods and missing_periods lists")
        if len(periods) + len(missing) > 40:
            raise ValueError(f"{target}: batch exceeds the 40-half-year bound")
        missing = [imported_period_end(value) for value in missing]
        if len(missing) != len(set(missing)):
            raise ValueError(f"{target}: duplicate missing_periods")
        indexed = {}
        for item in periods:
            if not isinstance(item, dict):
                raise ValueError(f"{target}: expected period objects")
            identity = item.get("period") if target == "details" else item
            if not isinstance(identity, dict) or identity.get("fund_code") != code:
                raise ValueError(f"{target}: period fund_code mismatch")
            end_date = imported_period_end(identity.get("period_end"))
            if end_date in indexed or end_date in missing:
                raise ValueError(f"{target}: duplicate or both returned and missing period")
            if end_date not in history_ends:
                raise ValueError(f"{target}: {end_date} is absent from history")
            fields = (
                ("markets", "industries", "securities", "convertible_bonds")
                if target == "details"
                else ("points",)
            )
            for field in fields:
                entries = item.get(field)
                if not isinstance(entries, list) or any(not isinstance(e, dict) for e in entries):
                    raise ValueError(f"{target}: {end_date} requires a complete {field} list")
            indexed[end_date] = item
        omitted = expected - indexed.keys() - set(missing)
        if omitted:
            raise ValueError(
                f"{target}: export does not account for requested periods: "
                + ", ".join(sorted(omitted))
            )
        bundle[target] = indexed
        bundle["missing_periods"][target] = missing
        bundle["errors"].extend(
            {"endpoint": target, "period_end": value, "detail": "MCP reported missing_periods"}
            for value in missing
        )
    return bundle


def collect(code, start=None, end=None):
    history = fetch("history", code)
    rows, _, _, _, _ = select_periods(history["rows"], code, start, end)
    bundle = {
        "schema": RAW_SCHEMA,
        "fund_code": code,
        "history": history,
        "requested": {"start": start, "end": end},
        "fetched_at": datetime.now(UTC).isoformat(),
        "details": {},
        "nav": {},
        "errors": [],
    }
    for index, row in enumerate(rows, 1):
        print(f"Brinson {index}/{len(rows)} {row['period_end']}", file=sys.stderr)
        for endpoint, target in (("period", "details"), ("nav-comparison", "nav")):
            try:
                bundle[target][row["period_end"]] = fetch(
                    endpoint, code, period_end=row["period_end"]
                )
            except ValueError as exc:
                bundle["errors"].append(
                    {"endpoint": endpoint, "period_end": row["period_end"], "detail": str(exc)}
                )
    return bundle


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    source = result.add_mutually_exclusive_group(required=True)
    source.add_argument("--fund-code", type=normalize_code, help="resolved initial share code")
    source.add_argument("--input", type=Path, help="offline raw bundle; makes no network requests")
    source.add_argument("--history-json", type=Path, help="complete get_brinson_history export")
    result.add_argument("--details-json", type=Path, help="complete get_brinson_periods export")
    result.add_argument("--navs-json", type=Path, help="complete get_brinson_navs export")
    result.add_argument("--start", type=date.fromisoformat)
    result.add_argument("--end", type=date.fromisoformat)
    result.add_argument(
        "--output", type=Path, help="derived analysis JSON, outside the Git checkout"
    )
    return result


def main():
    cli = parser()
    args = cli.parse_args()
    if args.history_json:
        if not args.details_json or not args.navs_json:
            cli.error("--history-json requires --details-json and --navs-json")
    elif args.details_json or args.navs_json:
        cli.error("--details-json and --navs-json require --history-json")
    start, end = (
        args.start.isoformat() if args.start else None,
        args.end.isoformat() if args.end else None,
    )
    try:
        if args.history_json:
            bundle = import_mcp(
                *(
                    json.loads(path.read_text())
                    for path in (args.history_json, args.details_json, args.navs_json)
                ),
                start=start,
                end=end,
            )
        elif args.input:
            bundle = json.loads(args.input.read_text())
        else:
            bundle = collect(args.fund_code, start, end)
        analysis = build_analysis(bundle, start, end)
        output = args.output or Path(tempfile.mkdtemp(prefix="brinson-")) / "analysis.json"
        raw_path = output.with_suffix(".raw.json")
        inputs = {
            path.resolve()
            for path in (args.input, args.history_json, args.details_json, args.navs_json)
            if path
        }
        outputs = {output.resolve()} | ({raw_path.resolve()} if not args.input else set())
        if inputs & outputs:
            raise ValueError("output must not overwrite raw input")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(analysis, ensure_ascii=False, indent=2, allow_nan=False))
        if not args.input:
            raw_path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2, allow_nan=False))
        print(
            json.dumps(
                {
                    "ok": True,
                    "status": analysis["status"],
                    "output": str(output.resolve()),
                    "raw": str((args.input or raw_path).resolve()),
                    "periods": len(analysis["periods"]),
                    "segments": len(analysis["segments"]),
                    "warnings": analysis["warnings"],
                },
                ensure_ascii=False,
            )
        )
        return 0
    except (ValueError, KeyError, TypeError, OSError, OverflowError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
