"""Offline research views over complete Brinson analysis snapshots."""

import math

RESIDUAL_PARTS = {"fit_residual": "主动调仓", "benchmark_bridge": "基准桥接"}


def numeric(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        value = float(value)
    except (ValueError, TypeError):
        return None
    return value if math.isfinite(value) else None


def required(value, field):
    result = numeric(value)
    if result is None:
        raise ValueError(f"Incomplete {field}; not zero")
    return result


def sum_known(values):
    values = [numeric(value) for value in values]
    return None if any(value is None for value in values) else math.fsum(values)


def stock_weights(row):
    """Stock API legacy market_weight is scaled NAV weight, unlike industry rows."""
    holding = numeric(row.get("portfolio_nav_weight", row.get("holding_nav_weight")))
    attribution = numeric(row.get("portfolio_market_weight", row.get("attribution_nav_weight")))
    return {
        "holding_nav_weight": holding if holding is not None and holding >= 0 else None,
        "attribution_nav_weight": (
            attribution
            if row.get("included_in_attribution") and attribution is not None and attribution >= 0
            else None
        ),
    }


def normalize_detail(detail):
    if detail is None or not isinstance(detail.get("securities"), list):
        return detail
    return {
        **detail,
        "securities": [{**row, **stock_weights(row)} for row in detail.get("securities", [])],
    }


def stability(rows, field):
    values = [required(row.get(field), field) for row in rows]
    return {
        "positive_periods": sum(value > 0 for value in values),
        "negative_periods": sum(value < 0 for value in values),
        "zero_periods": sum(value == 0 for value in values),
        "total_periods": len(values),
    }


def segment_rows(payload, segment):
    if payload.get("schema") != "brinson-analysis-v1":
        raise ValueError("Use the complete analyze.py result")
    if not 0 <= segment < len(payload["segments"]):
        raise ValueError("Select an existing continuous segment")
    scope = payload["segments"][segment]
    rows = [p for p in payload["periods"] if p["period_end"] in scope["link_factors"]]
    if len(rows) != len(scope["link_factors"]) or not rows:
        raise ValueError("Incomplete period history")
    return scope, sorted(rows, key=lambda row: row["period_end"])


def scope_info(scope):
    return {key: scope[key] for key in ("period_start", "period_end", "period_count")}


def effect_history(payload, field="fit_residual", segment=0):
    scope, periods = segment_rows(payload, segment)
    labels = {**payload.get("effect_labels", {}), **RESIDUAL_PARTS}
    if field not in labels:
        raise ValueError(f"Unknown effect: {field}")
    rows = []
    for period in periods:
        raw = required(period.get(field), field)
        rows.append(
            {
                **{k: period[k] for k in ("period_start", "period_end")},
                **{
                    k: required(period.get(k), k)
                    for k in (
                        "fund_return",
                        "fitted_portfolio_return",
                        "benchmark_return",
                        "fit_residual",
                        "benchmark_bridge",
                    )
                },
                "raw_contribution": raw,
                "linked_contribution": raw * scope["link_factors"][period["period_end"]],
            }
        )
    total = math.fsum(row["linked_contribution"] for row in rows)
    absolute_total = math.fsum(abs(row["linked_contribution"]) for row in rows)
    dominant = max(rows, key=lambda row: abs(row["linked_contribution"]))
    return {
        "scope": scope_info(scope),
        "field": field,
        "label": labels[field],
        "summary": {
            "linked_contribution": total,
            **stability(periods, field),
            "dominant_period": dominant["period_end"] if absolute_total else None,
            "dominant_linked_contribution": dominant["linked_contribution"],
            "dominant_share_of_net": dominant["linked_contribution"] / total if total else None,
            "dominant_share_of_absolute": (
                abs(dominant["linked_contribution"]) / absolute_total if absolute_total else None
            ),
        },
        "rows": rows,
    }


def period_detail(payload, period, level):
    detail = payload.get("period_details", {}).get(period["period_end"])
    if not detail or not isinstance(detail.get(level), list):
        raise ValueError(f"{period['period_end']}: {level} detail unavailable")
    if detail.get("period", {}).get("fund_code") != period["fund_code"]:
        raise ValueError("Detail fund identity mismatch")
    rows = detail[level]
    keys = [
        (r.get("market_code"), r.get("security_code"))
        if level == "securities"
        else (r.get("market_code"), r.get("industry_standard"), r.get("industry_code"))
        for r in rows
    ]
    if len(keys) != len(set(keys)):
        raise ValueError(f"{period['period_end']}: duplicate {level} identity")
    return rows


def security_history(payload, codes, *, market="A_SHARE", segment=0):
    scope, periods = segment_rows(payload, segment)
    codes = list(dict.fromkeys(codes or []))
    if not codes:
        raise ValueError("Specify --codes using exact security codes")
    seen, result = set(), []
    for period in periods:
        by_code = {
            r["security_code"]: r
            for r in period_detail(payload, period, "securities")
            if r.get("market_code") == market
        }
        for code in codes:
            row = by_code.get(code)
            base = {
                "period_start": period["period_start"],
                "period_end": period["period_end"],
                "market_code": market,
                "security_code": code,
            }
            if row is None:
                result.append({**base, "status": "not_reported"})
                continue
            seen.add(code)
            included = bool(row.get("included_in_attribution"))
            weight = stock_weights(row)
            stock, benchmark = (
                numeric(row.get("security_return")),
                numeric(row.get("comparison_return")),
            )
            contribution = numeric(row.get("excess_selection_contribution")) if included else None
            result.append(
                {
                    **base,
                    **weight,
                    **{
                        k: row.get(k)
                        for k in (
                            "security_name",
                            "industry_standard",
                            "industry_code",
                            "industry_name",
                        )
                    },
                    "status": "included" if included else "excluded",
                    "security_return": stock,
                    "comparison_return": benchmark,
                    "excess_return": stock - benchmark
                    if stock is not None and benchmark is not None
                    else None,
                    "selection_contribution": contribution,
                    "linked_selection_contribution": (
                        contribution * scope["link_factors"][period["period_end"]]
                        if contribution is not None
                        else None
                    ),
                }
            )
    if missing := set(codes) - seen:
        raise ValueError(
            f"Codes not found in selected market/segment: {', '.join(sorted(missing))}"
        )
    return {"scope": scope_info(scope), "market": market, "rows": result}


def industry_history(payload, industry, *, standard=None, market="A_SHARE", segment=0):
    scope, periods = segment_rows(payload, segment)
    all_rows = [(p, period_detail(payload, p, "industries")) for p in periods]
    identities = {
        (r.get("industry_standard"), r.get("industry_code"))
        for _, rows in all_rows
        for r in rows
        if r.get("market_code") == market
        and industry in (r.get("industry_code"), r.get("industry_name"))
        and (standard is None or r.get("industry_standard") == standard)
    }
    if len(identities) != 1:
        raise ValueError(
            "Industry must match one market/standard/code; specify --standard and exact --industry"
        )
    standard, code = next(iter(identities))
    result = []
    for period, rows in all_rows:
        market_rows = [r for r in rows if r.get("market_code") == market]
        row = next(
            (
                r
                for r in market_rows
                if (r.get("industry_standard"), r.get("industry_code")) == (standard, code)
            ),
            None,
        )
        base = {
            "period_start": period["period_start"],
            "period_end": period["period_end"],
            "market_code": market,
            "industry_standard": standard,
            "industry_code": code,
        }
        if row is None:
            status = (
                "not_reported"
                if any(r.get("industry_standard") == standard for r in market_rows)
                else "classification_unavailable"
            )
            result.append({**base, "status": status})
            continue
        values = {
            k: numeric(row.get(k))
            for k in (
                "portfolio_nav_weight",
                "portfolio_market_weight",
                "benchmark_market_weight",
                "portfolio_industry_return",
                "benchmark_industry_return",
                "allocation_effect",
                "selection_effect",
            )
        }
        result.append(
            {
                **base,
                **values,
                "industry_name": row.get("industry_name"),
                "status": "reported",
                **{
                    f"linked_{k}": value * scope["link_factors"][period["period_end"]]
                    if value is not None
                    else None
                    for k, value in values.items()
                    if k in ("allocation_effect", "selection_effect")
                },
            }
        )
    return {"scope": scope_info(scope), "market": market, "rows": result}


def group_values(rows):
    weights = [stock_weights(row) for row in rows]
    weight = sum_known(w["attribution_nav_weight"] for w in weights)
    absolute = sum_known(row.get("actual_return_contribution") for row in rows)
    selection = math.fsum(
        required(row.get("excess_selection_contribution"), "selection contribution") for row in rows
    )
    matched = sum_known(
        w["attribution_nav_weight"] * r
        if w["attribution_nav_weight"] is not None and r is not None
        else None
        for w, r in zip(
            weights, (numeric(row.get("comparison_return")) for row in rows), strict=True
        )
    )
    if (
        absolute is not None
        and matched is not None
        and not math.isclose(absolute - matched, selection, abs_tol=1e-8)
    ):
        raise ValueError("Stock group absolute/industry/selection contributions do not reconcile")
    return {
        "security_count": len(rows),
        "holding_nav_weight": sum_known(w["holding_nav_weight"] for w in weights),
        "attribution_nav_weight": weight,
        "selection_contribution": selection,
        "positive_selection": math.fsum(
            max(0, float(r["excess_selection_contribution"])) for r in rows
        ),
        "negative_selection": math.fsum(
            min(0, float(r["excess_selection_contribution"])) for r in rows
        ),
        "absolute_contribution": absolute,
        "static_basket_return": absolute / weight if weight and absolute is not None else None,
        "industry_basket_return": matched / weight if weight and matched is not None else None,
        "basket_excess": selection / weight if weight else None,
    }


def security_groups(payload, codes, *, market="A_SHARE", segment=0):
    scope, periods = segment_rows(payload, segment)
    codes = set(codes or [])
    if not codes:
        raise ValueError("Specify --codes using exact security codes")
    if scope["drilldown"]["securities"]["status"] != "complete":
        raise ValueError("Complete securities drilldown is required for selected/rest comparison")
    seen, result, excluded = set(), [], []
    for period in periods:
        entries = [
            r
            for r in period_detail(payload, period, "securities")
            if r.get("market_code") == market
        ]
        seen.update(r["security_code"] for r in entries)
        excluded.extend(
            {"period_end": period["period_end"], "security_code": r["security_code"]}
            for r in entries
            if not r.get("included_in_attribution")
        )
        universe = [r for r in entries if r.get("included_in_attribution")]
        buckets = {
            "selected": [r for r in universe if r["security_code"] in codes],
            "rest": [r for r in universe if r["security_code"] not in codes],
            "all": universe,
        }
        for group, rows in buckets.items():
            values = group_values(rows)
            result.append(
                {
                    "period_start": period["period_start"],
                    "period_end": period["period_end"],
                    "group": group,
                    **values,
                    "linked_selection_contribution": values["selection_contribution"]
                    * scope["link_factors"][period["period_end"]],
                }
            )
    if missing := codes - seen:
        raise ValueError(
            f"Codes not found in selected market/segment: {', '.join(sorted(missing))}"
        )
    summary = []
    for group in ("selected", "rest", "all"):
        rows = [r for r in result if r["group"] == group]
        weight = sum_known(r["attribution_nav_weight"] for r in rows)
        summary.append(
            {
                "group": group,
                "linked_selection_contribution": math.fsum(
                    r["linked_selection_contribution"] for r in rows
                ),
                "average_attribution_nav_weight": weight / len(periods)
                if weight is not None
                else None,
            }
        )
    return {
        "scope": scope_info(scope),
        "market": market,
        "selected_codes": sorted(codes),
        "summary": summary,
        "rows": result,
        "excluded_records": excluded,
    }
