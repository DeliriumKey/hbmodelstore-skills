"""Selected Brinson analysis tables; no retrieval or alternative linking algorithm."""

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from drilldown import effect_history, industry_history, security_groups, security_history
from markdown_table import number, table
from public_data import load_json, unwrap

FIELDS = [
    ("fund_return", "基金收益"),
    ("benchmark_return", "模型基准"),
    ("active_return", "超额收益"),
    ("market_allocation_effect", "资产配置"),
    ("industry_allocation_effect", "股票行业配置"),
    ("security_selection_effect", "股票选择"),
    ("convertible_total", "转债贡献"),
    ("fit_residual", "主动调仓"),
    ("benchmark_bridge", "基准桥接"),
]
CB_FIELDS = [
    "convertible_bond_industry_allocation_effect",
    "convertible_bond_stock_selection_contribution",
    "convertible_bond_other_excess_effect",
]

GROUP_LABELS = {"selected": "所选股票", "rest": "其余股票", "all": "全部股票"}
STATUS_LABELS = {
    "included": "已纳入",
    "excluded": "未纳入归因",
    "not_reported": "无记录",
    "reported": "有记录",
    "classification_unavailable": "该期无此分类",
}


def view_table(headers, fields, rows, *, text=()):
    return table(
        headers,
        [
            [r.get(key) if key in text else number(r.get(key), percent=True) for key in fields]
            for r in rows
        ],
    )


def render_drilldown(view, command, kind="security"):
    scope = view["scope"]
    heading = f"区间：{scope['period_start']}～{scope['period_end']}"
    if "market" in view:
        heading += f"；市场：{'A股' if view['market'] == 'A_SHARE' else '港股'}"
    if command == "effect":
        s = view["summary"]
        stats = table(
            [
                "来源",
                "区间链接贡献",
                "正贡献期数",
                "负贡献期数",
                "零贡献期数",
                "最大绝对贡献期",
                "该期链接贡献",
                "占净贡献比例",
            ],
            [
                [
                    view["label"],
                    number(s["linked_contribution"], percent=True),
                    s["positive_periods"],
                    s["negative_periods"],
                    s["zero_periods"],
                    s["dominant_period"],
                    number(s["dominant_linked_contribution"], percent=True),
                    number(s["dominant_share_of_net"], percent=True),
                ]
            ],
        )
        headers = ["期末", "实际收益", "静态持仓收益", "主动调仓", "基准桥接"]
        fields = [
            "period_end",
            "fund_return",
            "fitted_portfolio_return",
            "fit_residual",
            "benchmark_bridge",
        ]
        if view["field"] not in {"fit_residual", "benchmark_bridge"}:
            headers.append(f"本期{view['label']}")
            fields.append("raw_contribution")
        detail = view_table(
            [*headers, "对区间的链接贡献"],
            [*fields, "linked_contribution"],
            view["rows"],
            text=("period_end",),
        )
        return f"{heading}\n\n{stats}\n\n{detail}"
    if command == "history":
        rows = [{**r, "status": STATUS_LABELS[r["status"]]} for r in view["rows"]]
        if kind == "security":
            headers = [
                "期末",
                "代码",
                "名称",
                "状态",
                "行业标准",
                "行业",
                "披露权重",
                "归因权重",
                "股票收益",
                "行业收益",
                "相对行业收益差",
                "选股贡献",
                "链接选股贡献",
            ]
            fields = [
                "period_end",
                "security_code",
                "security_name",
                "status",
                "industry_standard",
                "industry_name",
                "holding_nav_weight",
                "attribution_nav_weight",
                "security_return",
                "comparison_return",
                "excess_return",
                "selection_contribution",
                "linked_selection_contribution",
            ]
            text = fields[:6]
        else:
            headers = [
                "期末",
                "行业标准",
                "行业代码",
                "行业",
                "状态",
                "占基金净值权重",
                "市场内组合权重",
                "市场内基准权重",
                "组合行业收益",
                "行业基准收益",
                "配置贡献",
                "选择贡献",
                "链接配置贡献",
                "链接选择贡献",
            ]
            fields = [
                "period_end",
                "industry_standard",
                "industry_code",
                "industry_name",
                "status",
                "portfolio_nav_weight",
                "portfolio_market_weight",
                "benchmark_market_weight",
                "portfolio_industry_return",
                "benchmark_industry_return",
                "allocation_effect",
                "selection_effect",
                "linked_allocation_effect",
                "linked_selection_effect",
            ]
            text = fields[:5]
        return f"{heading}\n\n{view_table(headers, fields, rows, text=text)}"
    rows = [{**r, "group": GROUP_LABELS[r["group"]]} for r in view["rows"]]
    summary = [{**r, "group": GROUP_LABELS[r["group"]]} for r in view["summary"]]
    totals = view_table(
        ["分组", "平均归因权重", "区间链接选股贡献"],
        ["group", "average_attribution_nav_weight", "linked_selection_contribution"],
        summary,
        text=("group",),
    )
    detail = view_table(
        [
            "期末",
            "分组",
            "只数",
            "归因权重",
            "选股贡献",
            "正选股贡献",
            "负选股贡献",
            "链接选股贡献",
            "静态股票篮子收益",
            "同权重行业篮子收益",
            "篮子收益差",
        ],
        [
            "period_end",
            "group",
            "security_count",
            "attribution_nav_weight",
            "selection_contribution",
            "positive_selection",
            "negative_selection",
            "linked_selection_contribution",
            "static_basket_return",
            "industry_basket_return",
            "basket_excess",
        ],
        rows,
        text=("period_end", "group", "security_count"),
    )
    return f"{heading}\n\n{totals}\n\n{detail}"


def drilldown_view(
    payload,
    command,
    *,
    segment=0,
    effect="fit_residual",
    kind="security",
    codes=None,
    industry=None,
    standard=None,
    market="A_SHARE",
):
    payload = unwrap(payload)
    if command == "effect":
        return effect_history(payload, effect, segment)
    if command == "groups":
        return security_groups(payload, codes, market=market, segment=segment)
    if kind == "industry":
        if not industry:
            raise ValueError("Specify --industry with an exact industry code or name")
        return industry_history(
            payload, industry, standard=standard, market=market, segment=segment
        )
    return security_history(payload, codes, market=market, segment=segment)


def render(payload, command, *, segment=0, limit=5):
    payload = unwrap(payload)
    if payload.get("schema") != "brinson-analysis-v1":
        raise ValueError("Use the complete analyze.py result")
    if command in {"summary", "periods"}:
        rows = []
        for item in payload["segments" if command == "summary" else "periods"]:
            row = {**item, **item.get("effects", {})}
            row["convertible_total"] = math.fsum(float(row[k]) for k in CB_FIELDS)
            if command == "summary":
                for field in ("fit_residual", "benchmark_bridge"):
                    row[field] = math.fsum(
                        float(p[field]) * item["link_factors"][p["period_end"]]
                        for p in payload["periods"]
                        if p["period_end"] in item["link_factors"]
                    )
            rows.append(
                [
                    item["period_start"],
                    item["period_end"],
                    *[number(row.get(k), percent=True) for k, _ in FIELDS],
                ]
            )
        return table(["开始日期", "结束日期", *[label for _, label in FIELDS]], rows)
    if not 0 <= segment < len(payload["segments"]):
        raise ValueError("Select an existing continuous segment")
    detail = payload["segments"][segment]["drilldown"][command]
    if detail["status"] != "complete":
        raise ValueError("Selected drilldown is incomplete")
    ranked = sorted(detail["rows"], key=lambda r: float(r["linked_contribution"]))
    chosen = [r for r in reversed(ranked) if float(r["linked_contribution"]) > 0][:limit] + [
        r for r in ranked if float(r["linked_contribution"]) < 0
    ][:limit]
    identity = (
        [
            ("market_code", "市场"),
            ("industry_standard", "行业标准"),
            ("industry_code", "行业代码"),
            ("name", "行业"),
        ]
        if command == "industries"
        else [
            ("security_code", "证券代码"),
            ("name", "证券名称"),
            ("industry_standard", "行业标准"),
            ("industry_name", "行业"),
        ]
    )
    return table(
        [label for _, label in identity] + ["累计贡献"],
        [
            [r.get(key) for key, _ in identity] + [number(r["linked_contribution"], percent=True)]
            for r in chosen
        ],
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=["summary", "periods", "industries", "securities", "effect", "history", "groups"],
    )
    parser.add_argument("--input", required=True)
    parser.add_argument("--segment", type=int, default=0)
    parser.add_argument("--limit", type=int, choices=range(1, 21), default=5)
    parser.add_argument("--effect", default="fit_residual", help="Effect field for effect history")
    parser.add_argument("--kind", choices=["security", "industry"], default="security")
    parser.add_argument(
        "--codes", nargs="+", help="Exact stock codes for history or selected/rest comparison"
    )
    parser.add_argument("--industry", help="Exact industry code or name")
    parser.add_argument("--standard", help="Industry standard, e.g. SW2021")
    parser.add_argument("--market", choices=["A_SHARE", "HK"], default="A_SHARE")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown")
    args = parser.parse_args()
    payload = load_json(args.input)
    if args.command in {"effect", "history", "groups"}:
        view = drilldown_view(
            payload,
            args.command,
            segment=args.segment,
            effect=args.effect,
            kind=args.kind,
            codes=args.codes,
            industry=args.industry,
            standard=args.standard,
            market=args.market,
        )
        print(
            json.dumps(view, ensure_ascii=False, indent=2)
            if args.format == "json"
            else render_drilldown(view, args.command, args.kind)
        )
    else:
        if args.format != "markdown":
            parser.error("--format json is available for effect/history/groups")
        print(render(payload, args.command, segment=args.segment, limit=args.limit))


if __name__ == "__main__":
    main()
