#!/usr/bin/env python3
# ruff: noqa: E501
from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
import urllib.parse
from datetime import date
from html import escape
from pathlib import Path

from bond_fund_data import (
    ApiRequestError,
    fetch_alpha_history,
    fetch_json,
    is_numeric,
    load_alpha_history,
    response_error,
)
from chart_assets import inline_chart_style
from public_data import api_url, load_json, single_series

MODEL_ROOT_URL = api_url("/models/bond-fund-timeseries-factor")
MODEL_URL = f"{MODEL_ROOT_URL}/modified-duration"
ALPHA_URL = f"{MODEL_ROOT_URL}/alpha"
DISCLOSED_DURATION_URL = f"{MODEL_ROOT_URL}/disclosed-duration"
FUND_CODE = re.compile(r"^[0-9]{6}(?:\.OF)?$", re.IGNORECASE)
SAMPLE_TYPES = frozenset(("信用债基金", "利率债基金"))
TERM_EXPOSURE_FIELDS = (
    "sample_type",
    "beta_0",
    "beta_1",
    "beta_3",
    "beta_10",
    "beta_30",
)
SPREAD_EXPOSURE_FIELDS = (
    "sample_type",
    "gamma_policy",
    "gamma_secondary",
    "gamma_high_grade_credit",
    "gamma_low_grade_credit",
)
EXPOSURE_FIELDS = tuple(dict.fromkeys((*TERM_EXPOSURE_FIELDS, *SPREAD_EXPOSURE_FIELDS)))
ECHARTS_PATH = Path(__file__).resolve().parents[3] / "assets" / "echarts-6.1.0.min.js"
CHART_RENDERER_PATH = Path(__file__).resolve().parents[1] / "assets" / "chart-renderer.mjs"
MARKET_DURATION_RENDERER_PATH = (
    Path(__file__).resolve().parents[1] / "assets" / "market-duration-renderer.mjs"
)
ALPHA_HISTORY_RENDERER_PATH = (
    Path(__file__).resolve().parents[1] / "assets" / "alpha-history-renderer.mjs"
)
ALPHA_CROSS_SECTION_RENDERER_PATH = (
    Path(__file__).resolve().parents[1] / "assets" / "alpha-cross-section-renderer.mjs"
)
ALPHA_SAMPLE_TYPES = {"rate": "利率债基金", "credit": "信用债基金"}
MARKET_SERIES = {
    "rate": ("sample_type", "rate"),
    "credit": ("sample_type", "credit"),
    "long-term": ("fund_invest_type", "long_term"),
    "short-term": ("fund_invest_type", "short_term"),
    "long-term-rate": (
        "sample_type_and_fund_invest_type",
        "long_term_rate",
    ),
    "long-term-credit": (
        "sample_type_and_fund_invest_type",
        "long_term_credit",
    ),
    "short-term-credit": (
        "sample_type_and_fund_invest_type",
        "short_term_credit",
    ),
}


def iso_date(value: str) -> str:
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise argparse.ArgumentTypeError("date must use YYYY-MM-DD") from exc


def unit_weight(value: str) -> float:
    try:
        weight = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("weight must be one of 0, 0.25, 0.5, 0.75, 1") from exc
    if weight not in {0.0, 0.25, 0.5, 0.75, 1.0}:
        raise argparse.ArgumentTypeError("weight must be one of 0, 0.25, 0.5, 0.75, 1")
    return weight


def normalized_fund_code(value: str) -> str:
    candidate = value.strip()
    if not FUND_CODE.fullmatch(candidate):
        raise argparse.ArgumentTypeError(
            "fund code must be six digits with optional .OF"
        )
    return f"{candidate[:6]}.OF"


def history_url(
    fund_code: str,
    *,
    start: str | None,
    end: str | None,
    fields: tuple[str, ...],
    model_url: str = MODEL_URL,
) -> str:
    params: list[tuple[str, str]] = [("fund_code", fund_code)]
    if start is not None:
        params.append(("start", start))
    if end is not None:
        params.append(("end", end))
    params.extend(("fields", field) for field in fields)
    return f"{model_url}/history?{urllib.parse.urlencode(params)}"


def validate_history_payload(
    payload: object,
    *,
    expected_fund_code: str | None,
    fields: tuple[str, ...],
) -> dict[str, object]:
    if not isinstance(payload, dict):
        raise response_error("top-level value must be an object")

    fund_code = payload.get("fund_code")
    if not isinstance(fund_code, str) or not FUND_CODE.fullmatch(fund_code):
        raise response_error("fund_code must be a six-digit code with .OF suffix")
    normalized_code = normalized_fund_code(fund_code)
    if fund_code != normalized_code:
        raise response_error("fund_code must use the normalized uppercase .OF suffix")
    if expected_fund_code is not None and fund_code != expected_fund_code:
        raise response_error(
            f"fund_code mismatch: expected {expected_fund_code}, received {fund_code}"
        )

    fund_name = payload.get("fund_name")
    if fund_name is not None and not isinstance(fund_name, str):
        raise response_error("fund_name must be a string or null")
    points = payload.get("points")
    if not isinstance(points, list):
        raise response_error("points must be an array")

    previous_date: date | None = None
    for index, point in enumerate(points):
        if not isinstance(point, dict):
            raise response_error(f"points[{index}] must be an object")
        raw_date = point.get("model_date")
        if not isinstance(raw_date, str):
            raise response_error(f"points[{index}].model_date must be YYYY-MM-DD")
        try:
            model_date = date.fromisoformat(raw_date)
        except ValueError as exc:
            raise response_error(
                f"points[{index}].model_date must be YYYY-MM-DD"
            ) from exc
        if previous_date is not None and model_date <= previous_date:
            raise response_error("points must be strictly ordered by model_date")
        previous_date = model_date

        for field in fields:
            if field not in point:
                raise response_error(f"points[{index}] is missing requested field {field}")
            value = point[field]
            if field == "sample_type":
                if value not in SAMPLE_TYPES:
                    raise response_error(
                        f"points[{index}].sample_type must be 信用债基金 or 利率债基金"
                    )
            elif value is not None and not is_numeric(value):
                raise response_error(f"points[{index}].{field} must be numeric or null")
    return payload


def validate_disclosed_duration_payload(
    payload: object,
    *,
    expected_fund_code: str | None,
) -> dict[str, object]:
    if not isinstance(payload, dict):
        raise response_error("disclosed-duration response must be an object")
    fund_code = payload.get("fund_code")
    if not isinstance(fund_code, str) or fund_code != normalized_fund_code(fund_code):
        raise response_error("disclosed-duration fund_code must use the .OF suffix")
    if expected_fund_code is not None and fund_code != expected_fund_code:
        raise response_error(
            f"disclosed-duration fund_code mismatch: expected {expected_fund_code}, received {fund_code}"
        )
    points = payload.get("points")
    if not isinstance(points, list):
        raise response_error("disclosed-duration points must be an array")
    previous_date: date | None = None
    for index, point in enumerate(points):
        if not isinstance(point, dict):
            raise response_error(f"disclosed-duration points[{index}] must be an object")
        raw_date = point.get("report_date")
        try:
            report_date = date.fromisoformat(str(raw_date))
        except ValueError as exc:
            raise response_error(
                f"disclosed-duration points[{index}].report_date must be YYYY-MM-DD"
            ) from exc
        if previous_date is not None and report_date <= previous_date:
            raise response_error("disclosed-duration points must be ordered by report_date")
        previous_date = report_date
        if not is_numeric(point.get("disclosed_duration")):
            raise response_error(
                f"disclosed-duration points[{index}].disclosed_duration must be numeric"
            )
        if point.get("sample_type") not in SAMPLE_TYPES:
            raise response_error(
                f"disclosed-duration points[{index}].sample_type is invalid"
            )
        if not isinstance(point.get("anomaly_flag"), bool):
            raise response_error(
                f"disclosed-duration points[{index}].anomaly_flag must be boolean"
            )
    return payload


def fetch_history(
    fund_code: str,
    *,
    start: str | None,
    end: str | None,
    fields: tuple[str, ...],
    model_url: str = MODEL_URL,
) -> dict[str, object]:
    url = history_url(
        fund_code,
        start=start,
        end=end,
        fields=fields,
        model_url=model_url,
    )
    payload = fetch_json(url)
    return validate_history_payload(
        payload,
        expected_fund_code=fund_code,
        fields=fields,
    )


def fetch_disclosed_duration_history(
    fund_code: str,
    *,
    start: str | None,
    end: str | None,
    model_url: str = DISCLOSED_DURATION_URL,
) -> dict[str, object]:
    params: list[tuple[str, str]] = [("fund_code", fund_code)]
    if start is not None:
        params.append(("start", start))
    if end is not None:
        params.append(("end", end))
    url = f"{model_url}/history?{urllib.parse.urlencode(params)}"
    payload = fetch_json(url)
    return validate_disclosed_duration_payload(
        payload,
        expected_fund_code=fund_code,
    )


def api_url(base_url: str, endpoint: str, params: list[tuple[str, str]]) -> str:
    query = urllib.parse.urlencode(params)
    suffix = f"?{query}" if query else ""
    return f"{base_url}/{endpoint}{suffix}"


def fetch_market_duration(
    series_name: str,
    *,
    start: str | None,
    end: str | None,
) -> tuple[dict[str, object], dict[str, object]]:
    breakdown, series_key = MARKET_SERIES[series_name]
    params = [("breakdown", breakdown)]
    if start is not None:
        params.append(("start", start))
    if end is not None:
        params.append(("end", end))
    payload = fetch_json(api_url(MODEL_URL, "median-history", params))
    if not isinstance(payload, dict) or not isinstance(payload.get("series"), list):
        raise response_error("market-duration response must contain a series array")
    selected = next(
        (
            item
            for item in payload["series"]
            if isinstance(item, dict) and item.get("series_key") == series_key
        ),
        None,
    )
    if selected is None:
        raise response_error(f"market-duration response is missing series {series_key}")
    if not isinstance(selected.get("points"), list) or not isinstance(
        selected.get("disclosed_points"), list
    ):
        raise response_error("market-duration series must contain points arrays")
    return payload, selected


def fetch_alpha_cross_section(
    *,
    model_date: str | None,
    sample_type: str | None,
    duration_bucket: int | None,
) -> dict[str, object]:
    params: list[tuple[str, str]] = []
    if model_date is not None:
        params.append(("date", model_date))
    if sample_type is not None:
        params.append(("sample_type", ALPHA_SAMPLE_TYPES[sample_type]))
    if duration_bucket is not None:
        params.append(("duration_bucket", str(duration_bucket)))
    payload = fetch_json(api_url(ALPHA_URL, "cross-section", params))
    if not isinstance(payload, dict) or not isinstance(payload.get("rows"), list):
        raise response_error("Alpha cross-section response must contain rows")
    return payload


def safe_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace(
        "<", "\\u003c"
    )


def echarts_source() -> str:
    try:
        source = ECHARTS_PATH.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise RuntimeError(f"bundled ECharts asset not found: {ECHARTS_PATH}") from exc
    return source.replace("</script", "<\\/script")


def asset_source(path: Path, label: str) -> str:
    try:
        return inline_chart_style(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError(f"{label} not found: {path}") from exc


def chart_renderer_source() -> str:
    return asset_source(CHART_RENDERER_PATH, "shared chart renderer")


def source_note(start: str | None, end: str | None) -> str:
    if not start or not end:
        return ""
    label = (
        f"截止日期：{end.replace('-', '/')}"
        if start == end
        else f"时间区间：{start.replace('-', '/')}~{end.replace('-', '/')}"
    )
    return (
        '<p class="source-note">数据来源：好买基金研究中心，'
        f"{escape(label)}</p>"
    )


def page_shell(*, title: str, body: str, script: str) -> str:
    stylesheet = (ECHARTS_PATH.parent / "preview.css").read_text(encoding="utf-8")
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)}</title>
  <style>
    {stylesheet}
    .chart {{ position:relative; width:100%; height:clamp(400px,62vh,620px); }}
    .duration-chart {{ height:280px; }}
    .duration-heading {{ display:flex; align-items:center; justify-content:space-between;
      flex-wrap:wrap; gap:8px 16px; margin-bottom:4px; }}
    .duration-heading-main {{ display:flex; align-items:center; flex-wrap:wrap; gap:12px; }}
    .duration-legend {{ display:flex; flex-wrap:wrap; align-items:center; gap:12px; font-size:12px; color:var(--muted); }}
    .duration-legend-item {{ display:inline-flex; align-items:center; gap:6px; }}
    .duration-line {{ width:16px; border-top:2px solid var(--red); }}
    .duration-dot {{ width:8px; height:8px; border-radius:50%; background:var(--blue); }}
    .chart-panel + .chart-panel {{ margin-top:28px; }}
    .exposure-heading {{ display:flex; align-items:center; justify-content:space-between;
      flex-wrap:wrap; gap:8px 16px; margin-bottom:4px; }}
    .exposure-heading-main {{ display:flex; align-items:center; flex-wrap:wrap; gap:12px; }}
    .exposure-title + .chart {{ margin-top:8px; }}
    .exposure-legend {{ display:flex; align-items:center; flex-wrap:wrap; gap:12px; font-size:12px; color:var(--muted); }}
    .exposure-legend-item {{ display:inline-flex; align-items:center; gap:6px; }}
    .exposure-legend-swatch {{ width:16px; height:8px; }}
    .exposure-legend-swatch.credit {{ background:var(--red); }}
    .exposure-legend-swatch.rate {{ background:var(--blue); }}
    #term-exposure-chart {{ height:260px; }}
    #spread-exposure-chart {{ height:250px; }}
    #market-chart {{ height:340px; margin-top:8px; }}
    .exposure-legend-swatch.iqr {{ width:10px; height:10px; background:#c4c4c4; }}
    .alpha-ranking-controls {{ margin-bottom:18px; }}
    .alpha-ranking-weight-head,.alpha-ranking-heading {{ display:flex; align-items:center;
      justify-content:space-between; gap:16px; font-size:12px; }}
    .alpha-ranking-weight-head strong,.alpha-ranking-heading strong {{ color:var(--ink); }}
    .alpha-ranking-controls input {{ width:100%; margin-top:8px; accent-color:#000; }}
    .alpha-ranking-heading {{ margin-top:12px; font-size:15px; }}
    .alpha-ranking-heading strong {{ font-weight:600; }}
    .alpha-ranking-heading span {{ color:var(--muted); font-size:12px; }}
    .alpha-ranking-table {{ min-width:700px; }}
    .alpha-ranking-table td.fund {{ text-align:left; }}
    .alpha-ranking-table .empty-row {{ padding:36px 12px; color:var(--muted); text-align:center; }}
    .empty {{ padding:72px 0; color:var(--muted); text-align:center; border-block:1px solid var(--line); }}
  </style>
</head>
<body class="hb-preview">
<main>{body}</main>
<script>{echarts_source()}</script>
<script type="module">{script}</script>
</body>
</html>
"""


def _chart_fields(chart_kinds: tuple[str, ...]) -> tuple[str, ...]:
    fields: list[str] = []
    if "duration" in chart_kinds:
        fields.append("estimated_modified_duration")
    if "term-exposure" in chart_kinds:
        fields.extend(TERM_EXPOSURE_FIELDS)
    if "spread-exposure" in chart_kinds:
        fields.extend(SPREAD_EXPOSURE_FIELDS)
    return tuple(dict.fromkeys(fields))


def _chart_section(kind: str, *, metadata: str, safe_code: str) -> str:
    if kind == "duration":
        return f"""
<section class="chart-panel" aria-labelledby="duration-title">
  <header class="duration-heading compact-header">
    <div class="duration-heading-main">
      <h1 id="duration-title" class="compact-title">修正久期时序</h1>
      <div class="duration-legend" aria-label="图例">
        <span class="duration-legend-item"><i class="duration-line"></i>30 日模型估计</span>
        <span class="duration-legend-item"><i class="duration-dot"></i>报告期披露久期</span>
      </div>
    </div>
    <div class="meta">{metadata}</div>
  </header>
  <div id="duration-chart" class="chart duration-chart" role="img" aria-label="{safe_code} 修正久期变化图"></div>
</section>
"""
    title = "期限暴露时序" if kind == "term-exposure" else "利差暴露时序"
    chart_id = "term-exposure-chart" if kind == "term-exposure" else "spread-exposure-chart"
    return f"""
<section class="chart-panel" aria-labelledby="{chart_id}-title">
  <header class="exposure-heading">
    <div class="exposure-heading-main">
      <h2 id="{chart_id}-title" class="exposure-title">{title}</h2>
      <div class="exposure-legend" aria-label="颜色表示模型分支">
        <span class="exposure-legend-item"><span class="exposure-legend-swatch credit" aria-hidden="true"></span>信用债基</span>
        <span class="exposure-legend-item"><span class="exposure-legend-swatch rate" aria-hidden="true"></span>利率债基</span>
      </div>
    </div>
    <div class="meta">{metadata}</div>
  </header>
  <div id="{chart_id}" class="chart exposure-chart" role="img" aria-label="{safe_code} {title}热力图"></div>
</section>
"""


def render_chart_document(
    payload: dict[str, object],
    *,
    chart_kinds: tuple[str, ...],
    disclosed_payload: dict[str, object] | None = None,
) -> str:
    allowed = {"duration", "term-exposure", "spread-exposure"}
    if not chart_kinds or len(set(chart_kinds)) != len(chart_kinds):
        raise ValueError("chart_kinds must contain unique chart names")
    unknown = set(chart_kinds) - allowed
    if unknown:
        raise ValueError(f"unknown chart kinds: {', '.join(sorted(unknown))}")
    validate_history_payload(
        payload,
        expected_fund_code=None,
        fields=_chart_fields(chart_kinds),
    )
    code = str(payload.get("fund_code") or "")
    name = str(payload.get("fund_name") or "")
    points = payload.get("points")
    point_dates = [
        str(point.get("model_date"))
        for point in points
        if isinstance(point, dict) and point.get("model_date")
    ] if isinstance(points, list) else []
    disclosed_payload = disclosed_payload or {
        "fund_code": code,
        "fund_name": name,
        "points": [],
    }
    if "duration" in chart_kinds:
        validate_disclosed_duration_payload(
            disclosed_payload,
            expected_fund_code=code,
        )
    metadata = " · ".join(
        escape(item) for item in (code, name) if item
    )
    safe_code = escape(code)
    chart_body = "\n".join(
        _chart_section(kind, metadata=metadata, safe_code=safe_code)
        for kind in chart_kinds
    )
    body = (
        chart_body
        + source_note(
            point_dates[0] if point_dates else None,
            point_dates[-1] if point_dates else None,
        )
    )
    script = """
const rendererSource=__RENDERER_SOURCE__;
const rendererUrl=URL.createObjectURL(
  new Blob([rendererSource],{type:'text/javascript'})
);
try {
  const {renderBondFundCharts}=await import(rendererUrl);
  const requested=__CHARTS__;
  const style=getComputedStyle(document.body);
  const roots=Object.fromEntries(requested.map(kind=>[
    kind,
    document.getElementById(kind==='duration'?'duration-chart':`${kind}-chart`),
  ]));
  renderBondFundCharts({
    echarts,
    roots,
    history:__PAYLOAD__,
    disclosed:__DISCLOSED__,
    chartKinds:requested,
    theme:{
      ink:style.getPropertyValue('--ink').trim(),
      muted:style.getPropertyValue('--muted').trim(),
      gridLine:style.getPropertyValue('--line').trim(),
      surface:style.getPropertyValue('--surface').trim(),
      red:style.getPropertyValue('--red').trim(),
      blue:style.getPropertyValue('--blue').trim(),
    },
  });
} finally {
  URL.revokeObjectURL(rendererUrl);
}
"""
    script = (
        script.replace("__RENDERER_SOURCE__", safe_json(chart_renderer_source()))
        .replace("__PAYLOAD__", safe_json(payload))
        .replace("__DISCLOSED__", safe_json(disclosed_payload))
        .replace("__CHARTS__", safe_json(chart_kinds))
    )
    page_title = "、".join(
        {
            "duration": "修正久期",
            "term-exposure": "期限暴露",
            "spread-exposure": "利差暴露",
        }[kind]
        for kind in chart_kinds
    )
    return page_shell(title=f"{code} {page_title}", body=body, script=script)


def render_duration_chart(
    payload: dict[str, object],
    disclosed_payload: dict[str, object] | None = None,
) -> str:
    return render_chart_document(
        payload,
        chart_kinds=("duration",),
        disclosed_payload=disclosed_payload,
    )


def render_term_exposure_chart(payload: dict[str, object]) -> str:
    return render_chart_document(payload, chart_kinds=("term-exposure",))


def render_spread_exposure_chart(payload: dict[str, object]) -> str:
    return render_chart_document(payload, chart_kinds=("spread-exposure",))


def render_all_charts(
    payload: dict[str, object],
    disclosed_payload: dict[str, object] | None = None,
) -> str:
    return render_chart_document(
        payload,
        chart_kinds=("duration", "term-exposure", "spread-exposure"),
        disclosed_payload=disclosed_payload,
    )


def render_market_duration_document(
    payload: dict[str, object],
    series: dict[str, object],
) -> str:
    points = series.get("points")
    dates = [
        str(point.get("model_date"))
        for point in points
        if isinstance(point, dict) and point.get("model_date")
    ] if isinstance(points, list) else []
    labels = {
        "rate": "利率债基金",
        "credit": "信用债基金",
        "long_term": "中长期纯债",
        "short_term": "短期纯债",
        "long_term_rate": "中长期纯债 · 利率债基金",
        "long_term_credit": "中长期纯债 · 信用债基金",
        "short_term_credit": "短期纯债 · 信用债基金",
    }
    label = labels.get(str(series.get("series_key")), str(series.get("series_key")))
    body = f"""
<header class="exposure-heading">
  <div class="exposure-heading-main">
    <h1 class="compact-title">市场久期中位数：{escape(label)}</h1>
  </div>
</header>
<div id="market-chart" class="chart" style="height:340px" role="img" aria-label="{escape(label)}市场久期历史"></div>
{source_note(dates[0] if dates else None, dates[-1] if dates else None)}
"""
    script = """
const rendererSource=__RENDERER_SOURCE__;
const rendererUrl=URL.createObjectURL(new Blob([rendererSource],{type:'text/javascript'}));
try {
  const {renderMarketDurationChart}=await import(rendererUrl);
  renderMarketDurationChart({
    echarts,
    root:document.getElementById('market-chart'),
    series:__SERIES__,
  });
} finally { URL.revokeObjectURL(rendererUrl); }
"""
    script = script.replace(
        "__RENDERER_SOURCE__",
        safe_json(asset_source(MARKET_DURATION_RENDERER_PATH, "market renderer")),
    ).replace("__SERIES__", safe_json(series))
    return page_shell(title=f"市场久期中位数：{label}", body=body, script=script)


def render_alpha_history_document(payload: dict[str, object]) -> str:
    points = payload.get("points")
    point_list = points if isinstance(points, list) else []
    dates = [
        str(point.get("model_date"))
        for point in point_list
        if isinstance(point, dict) and point.get("model_date")
    ]
    latest = point_list[-1] if point_list and isinstance(point_list[-1], dict) else {}
    code = escape(str(payload.get("fund_code") or ""))
    name = escape(str(payload.get("fund_name") or ""))
    metadata = " · ".join(
        escape(str(value))
        for value in (
            latest.get("sample_type"),
            f"Q{latest.get('duration_bucket')}" if latest.get("duration_bucket") else None,
            f"最新模型日 {latest.get('model_date')}" if latest.get("model_date") else None,
        )
        if value
    )
    panels = (
        ("signal", "Alpha 信号与组内位置", 310),
        ("duration", "长期久期状态", 300),
        ("gamma", "长期利差暴露", 260),
    )
    body = f"""
<header><h1>{code} · {name}</h1><div class="meta">{metadata}</div></header>
{''.join(f'<section class="chart-panel"><h2 class="exposure-title">{title}</h2><div id="alpha-{kind}" class="chart" style="height:{height}px"></div></section>' for kind, title, height in panels)}
{source_note(dates[0] if dates else None, dates[-1] if dates else None)}
"""
    script = """
const sharedSource=__SHARED_SOURCE__;
const sharedUrl=URL.createObjectURL(new Blob([sharedSource],{type:'text/javascript'}));
const rendererSource=__RENDERER_SOURCE__.replace('./chart-renderer.mjs',sharedUrl);
const rendererUrl=URL.createObjectURL(new Blob([rendererSource],{type:'text/javascript'}));
try {
  const {renderAlphaHistoryCharts}=await import(rendererUrl);
  renderAlphaHistoryCharts({
    echarts,
    roots:{
      signal:document.getElementById('alpha-signal'),
      duration:document.getElementById('alpha-duration'),
      gamma:document.getElementById('alpha-gamma'),
    },
    history:__PAYLOAD__,
  });
} finally {
  URL.revokeObjectURL(rendererUrl);
  URL.revokeObjectURL(sharedUrl);
}
"""
    script = (
        script.replace("__SHARED_SOURCE__", safe_json(chart_renderer_source()))
        .replace(
            "__RENDERER_SOURCE__",
            safe_json(asset_source(ALPHA_HISTORY_RENDERER_PATH, "Alpha renderer")),
        )
        .replace("__PAYLOAD__", safe_json(payload))
    )
    return page_shell(title=f"{code} Alpha 历史", body=body, script=script)


def render_alpha_cross_section_document(
    payload: dict[str, object],
    *,
    alpha_weight: float,
    sample_type: str | None,
    duration_bucket: int | None,
) -> str:
    model_date = str(payload.get("model_date") or "")
    filters = [
        ALPHA_SAMPLE_TYPES.get(sample_type, "全部基金分支") if sample_type else "全部基金分支",
        f"Q{duration_bucket}" if duration_bucket else "全部久期组",
        model_date or "最新模型日",
    ]
    body = f"""
<header><h1>Alpha 截面排行</h1><div class="meta">{' · '.join(escape(item) for item in filters)}</div></header>
<div id="alpha-cross-section"></div>
{source_note(model_date or None, model_date or None)}
"""
    script = """
const rendererSource=__RENDERER_SOURCE__;
const rendererUrl=URL.createObjectURL(new Blob([rendererSource],{type:'text/javascript'}));
try {
  const {renderAlphaCrossSectionTable}=await import(rendererUrl);
  renderAlphaCrossSectionTable({
    root:document.getElementById('alpha-cross-section'),
    payload:__PAYLOAD__,
    initialAlphaWeight:__ALPHA_WEIGHT__,
  });
} finally { URL.revokeObjectURL(rendererUrl); }
"""
    script = (
        script.replace(
            "__RENDERER_SOURCE__",
            safe_json(
                asset_source(
                    ALPHA_CROSS_SECTION_RENDERER_PATH,
                    "Alpha cross-section renderer",
                )
            ),
        )
        .replace("__PAYLOAD__", safe_json(payload))
        .replace("__ALPHA_WEIGHT__", str(alpha_weight))
    )
    return page_shell(title="Alpha 截面排行", body=body, script=script)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="Create interactive charts and tables from published bond-fund results"
    )
    commands = result.add_subparsers(dest="command", required=True)
    for command, help_text in (
        ("duration", "draw a single fund's estimated modified-duration history"),
        ("term-exposure", "draw a single fund's 30-day term-exposure heatmap"),
        ("spread-exposure", "draw a single fund's 30-day spread-exposure heatmap"),
        ("all", "draw all three charts with linked cursors"),
    ):
        chart = commands.add_parser(command, help=help_text)
        source = chart.add_mutually_exclusive_group(required=True)
        source.add_argument("--fund-code", type=normalized_fund_code)
        source.add_argument("--input", type=Path, help="Complete saved history; no network access")
        chart.add_argument("--disclosed-input", type=Path)
        chart.add_argument("--start", type=iso_date)
        chart.add_argument("--end", type=iso_date)
        chart.add_argument("--output", type=Path)
    market_duration = commands.add_parser(
        "market-duration",
        help="draw one published market-duration median and IQR series",
    )
    market_duration.add_argument(
        "--series",
        choices=tuple(MARKET_SERIES),
        default="rate",
    )
    market_duration.add_argument("--start", type=iso_date)
    market_duration.add_argument("--end", type=iso_date)
    market_duration.add_argument("--output", type=Path)
    market_duration.add_argument("--input", type=Path)

    alpha_history = commands.add_parser(
        "alpha-history",
        help="draw one fund's Alpha, duration-state, and spread-exposure history",
    )
    alpha_history_source = alpha_history.add_mutually_exclusive_group(required=True)
    alpha_history_source.add_argument("--fund-code", type=normalized_fund_code)
    alpha_history_source.add_argument(
        "--input",
        type=Path,
        help="read one raw or query.py-wrapped Alpha history JSON file",
    )
    alpha_history.add_argument("--start", type=iso_date)
    alpha_history.add_argument("--end", type=iso_date)
    alpha_history.add_argument("--output", type=Path)

    alpha_cross_section = commands.add_parser(
        "alpha-cross-section",
        help="create an interactive Alpha cross-section ranking table",
    )
    alpha_cross_section.add_argument("--date", type=iso_date)
    alpha_cross_section.add_argument(
        "--sample-type",
        choices=tuple(ALPHA_SAMPLE_TYPES),
    )
    alpha_cross_section.add_argument(
        "--duration-bucket",
        type=int,
        choices=range(1, 6),
    )
    alpha_cross_section.add_argument(
        "--alpha-weight",
        type=unit_weight,
        default=0.75,
    )
    alpha_cross_section.add_argument("--output", type=Path)
    alpha_cross_section.add_argument("--input", type=Path)
    return result


def write_html(output: Path, html: str) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=output.parent,
            prefix=f".{output.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            handle.write(html)
            temporary = Path(handle.name)
        temporary.replace(output)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def main() -> int:
    argument_parser = parser()
    args = argument_parser.parse_args()
    start = getattr(args, "start", None)
    end = getattr(args, "end", None)
    if start is not None and end is not None and end < start:
        argument_parser.error("--end must not be earlier than --start")
    if getattr(args, "input", None) and (start or end or getattr(args, "date", None)):
        argument_parser.error("--input uses the saved interval; do not also pass dates")
    summary: dict[str, object]
    try:
        if args.command == "market-duration":
            if args.input:
                payload = load_json(args.input)
                selected_series = next((item for item in payload.get("series", [])
                                        if item.get("series_key") == MARKET_SERIES[args.series][1]), None)
                if selected_series is None:
                    raise response_error("Requested market series is absent from input")
            else:
                payload, selected_series = fetch_market_duration(args.series, start=start, end=end)
            html = render_market_duration_document(payload, selected_series)
            points = selected_series.get("points")
            summary = {
                "series": args.series,
                "points": len(points) if isinstance(points, list) else 0,
                "source": str(args.input) if args.input else f"{MODEL_URL}/median-history",
            }
            default_output = Path(f"market-duration-{args.series}.html")
        elif args.command == "alpha-history":
            if args.input is not None:
                if start is not None or end is not None:
                    argument_parser.error(
                        "--start and --end cannot be combined with --input"
                    )
                payload = load_alpha_history(args.input.expanduser())
                source = str(args.input)
            else:
                payload = fetch_alpha_history(
                    args.fund_code,
                    start=start,
                    end=end,
                    base_url=ALPHA_URL,
                )
                source = f"{ALPHA_URL}/history"
            html = render_alpha_history_document(payload)
            points = payload.get("points")
            fund_code = str(payload.get("fund_code") or "alpha")
            summary = {
                "fund_code": fund_code,
                "points": len(points) if isinstance(points, list) else 0,
                "source": source,
            }
            default_output = Path(f"{fund_code[:6]}-alpha-history.html")
        elif args.command == "alpha-cross-section":
            payload = load_json(args.input) if args.input else fetch_alpha_cross_section(
                model_date=args.date,
                sample_type=args.sample_type,
                duration_bucket=args.duration_bucket,
            )
            html = render_alpha_cross_section_document(
                payload,
                alpha_weight=args.alpha_weight,
                sample_type=args.sample_type,
                duration_bucket=args.duration_bucket,
            )
            rows = payload.get("rows")
            summary = {
                "model_date": payload.get("model_date"),
                "rows": len(rows) if isinstance(rows, list) else 0,
                "alpha_weight": args.alpha_weight,
                "source": str(args.input) if args.input else f"{ALPHA_URL}/cross-section",
            }
            default_output = Path("alpha-cross-section.html")
        else:
            fields = {
                "duration": ("estimated_modified_duration",),
                "term-exposure": TERM_EXPOSURE_FIELDS,
                "spread-exposure": SPREAD_EXPOSURE_FIELDS,
                "all": ("estimated_modified_duration", *EXPOSURE_FIELDS),
            }[args.command]
            payload = validate_history_payload(
                single_series(load_json(args.input)), expected_fund_code=None, fields=fields,
            ) if args.input else fetch_history(
                args.fund_code,
                start=start,
                end=end,
                fields=fields,
            )
            disclosed_payload = None
            if args.disclosed_input:
                disclosed_payload = single_series(load_json(args.disclosed_input))
                if disclosed_payload.get("fund_code") != payload.get("fund_code"):
                    raise response_error("Disclosure and history fund codes differ")
            elif not args.input and args.command in {"duration", "all"}:
                disclosed_payload = fetch_disclosed_duration_history(
                    args.fund_code,
                    start=start,
                    end=end,
                )
            html = {
                "duration": lambda: render_duration_chart(payload, disclosed_payload),
                "term-exposure": lambda: render_term_exposure_chart(payload),
                "spread-exposure": lambda: render_spread_exposure_chart(payload),
                "all": lambda: render_all_charts(payload, disclosed_payload),
            }[args.command]()
            points = payload.get("points")
            summary = {
                "fund_code": payload.get("fund_code"),
                "points": len(points) if isinstance(points, list) else 0,
                "source": str(args.input) if args.input else f"{MODEL_URL}/history",
            }
            default_output = Path(f"{str(payload['fund_code'])[:6]}-{args.command}.html")
    except (ValueError, OSError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1
    except ApiRequestError as exc:
        print(json.dumps({"ok": False, **exc.details}, ensure_ascii=False), file=sys.stderr)
        return 1
    output = args.output or default_output
    output = output.expanduser().resolve()
    for source in (getattr(args, "input", None), getattr(args, "disclosed_input", None)):
        if source and output == Path(source).expanduser().resolve():
            argument_parser.error("Output must not overwrite an input snapshot")
    try:
        write_html(output, html)
    except OSError as exc:
        print(
            json.dumps(
                {"ok": False, "error": "unable to write chart", "detail": str(exc)},
                ensure_ascii=False,
            ),
            file=sys.stderr,
        )
        return 1
    print(
        json.dumps(
            {
                "ok": True,
                "output": str(output),
                **summary,
                "start": start,
                "end": end,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
