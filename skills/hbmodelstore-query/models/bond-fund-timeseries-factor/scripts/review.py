"""Format selected public duration/Alpha observations as Markdown, offline."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from markdown_table import number, table
from public_data import load_json, unwrap

DURATION = [("estimated_modified_duration", "修正久期（年）", False)]
ALPHA = [
    ("alpha_annualized", "240日年化 Alpha", True),
    ("alpha_rank", "Alpha 同组分位", True),
    ("recent_residual_mean_60", "60日日均残差", True),
    ("recent_state_rank", "近期状态同组分位", True),
]
EXPOSURES = {
    "duration": [(f"beta_{term}", f"{term}Y期限暴露", False) for term in (0, 1, 3, 10, 30)]
    + [
        ("gamma_policy", "政金债", False),
        ("gamma_secondary", "银行二永债", False),
        ("gamma_high_grade_credit", "高评级信用债", False),
        ("gamma_low_grade_credit", "较低评级信用债", False),
    ],
    "alpha": [
        ("gamma_policy", "政金债", False),
        ("gamma_secondary", "银行二永债", False),
        ("gamma_cpnote", "普通信用债", False),
        ("gamma_rating_aa_plus", "AA+信用债", False),
    ],
}


def select_rows(payload, dates=None, codes=None):
    payload = unwrap(payload)
    if payload.get("has_more") or payload.get("next_offset") is not None:
        raise ValueError("Complete the query before making a comparison")
    series = payload.get("series", [payload])
    rows = []
    for item in series:
        if "points" in item:
            points = item["points"]
            chosen = (
                [p for p in points if p["model_date"] in dates]
                if dates
                else [max(points, key=lambda p: p["model_date"])]
                if points
                else []
            )
            rows.extend(
                {"fund_code": item.get("fund_code"), "fund_name": item.get("fund_name"), **p}
                for p in chosen
            )
        elif "rows" in item:
            rows.extend(
                {"model_date": item.get("model_date"), **r}
                for r in item["rows"]
                if not dates or r.get("model_date", item.get("model_date")) in dates
            )
        else:
            raise ValueError("Expected fund history or cross-section")
    if codes:
        rows = [r for r in rows if r["fund_code"] in codes]
    return rows


def render(payload, command, *, dates=None, codes=None, model="duration"):
    rows = select_rows(payload, dates, codes)
    fields = (
        DURATION if command == "duration" else ALPHA if command == "alpha" else EXPOSURES[model]
    )
    if command == "exposure" and rows and all(r.get("sample_type") == "利率债基金" for r in rows):
        fields = [f for f in fields if f[0].startswith("beta_") or f[0] == "gamma_policy"]
    output = []
    for row in rows:
        values = []
        for key, _, percent in fields:
            value = row.get(key)
            # Credit exposures are not fitted in the rate-bond branch.
            if (
                key.startswith("gamma_")
                and key != "gamma_policy"
                and row.get("sample_type") == "利率债基金"
            ):
                value = None
            values.append(
                number(value, 4 if key == "recent_residual_mean_60" else 2, percent=percent)
            )
        output.append([row.get("fund_code"), row.get("fund_name"), row.get("model_date"), *values])
    return table(["基金代码", "基金名称", "模型日期", *[f[1] for f in fields]], output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["duration", "alpha", "exposure"])
    parser.add_argument("--input", required=True)
    parser.add_argument("--dates", nargs="+")
    parser.add_argument("--codes", nargs="+")
    parser.add_argument("--model", choices=["duration", "alpha"], default="duration")
    args = parser.parse_args()
    print(
        render(
            load_json(args.input),
            args.command,
            dates=args.dates,
            codes=args.codes,
            model=args.model,
        )
    )


if __name__ == "__main__":
    main()
