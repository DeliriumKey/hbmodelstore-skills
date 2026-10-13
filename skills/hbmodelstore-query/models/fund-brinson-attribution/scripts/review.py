"""Selected Brinson analysis tables; no retrieval or alternative linking algorithm."""

import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
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
    parser.add_argument("command", choices=["summary", "periods", "industries", "securities"])
    parser.add_argument("--input", required=True)
    parser.add_argument("--segment", type=int, default=0)
    parser.add_argument("--limit", type=int, choices=range(1, 21), default=5)
    args = parser.parse_args()
    print(render(load_json(args.input), args.command, segment=args.segment, limit=args.limit))


if __name__ == "__main__":
    main()
