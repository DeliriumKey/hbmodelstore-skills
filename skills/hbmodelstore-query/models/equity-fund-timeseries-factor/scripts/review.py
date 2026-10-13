#!/usr/bin/env python3
"""Render equity comparison data as Markdown; no queries or peer selection."""

import argparse
import json
import math
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import unwrap as unwrap_export

STOCK_FACTORS = (
    ("beta_mkt", "市场"),
    ("beta_smb_ep", "规模"),
    ("beta_vmg_ep", "价值"),
    ("beta_mom", "动量"),
)
BOND_FACTORS = (("beta_credit", "信用债"),)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def number(value, *, percent=False, digits=2):
    if not finite(value):
        return "—"
    value = round(value * (100 if percent else 1), digits)
    if value == 0:
        value = 0.0
    return f"{value:.{digits}f}" + ("%" if percent else "")


def cell(value):
    if value is None or value == "":
        return "—"
    text = str(value).replace("&", "&amp;")
    for character in "\\*_`[]<>|":
        text = text.replace(character, f"&#{ord(character)};")
    return text.replace("\r", " ").replace("\n", " ")


def table(headers, rows, text_columns=1):
    lines = ["| " + " | ".join(headers) + " |"]
    lines.append("| " + " | ".join(
        "---" if i < text_columns else "---:" for i in range(len(headers))
    ) + " |")
    for row in rows:
        if len(row) != len(headers):
            raise ValueError("Table row and header lengths differ")
        lines.append("| " + " | ".join(cell(value) for value in row) + " |")
    return "\n".join(lines)


def unwrap(payload):
    return unwrap_export(payload)


def validate(payload):
    if payload.get("model_key") != "equity-fund-timeseries-factor":
        raise ValueError("Unexpected model")
    for key, expected in (("return_unit", "decimal"), ("exposure_unit", "coefficient"),
                          ("percentile_unit", "fraction")):
        if payload.get(key) != expected:
            raise ValueError(f"Unexpected {key}")
    date.fromisoformat(payload["model_date"])
    if not payload.get("category"):
        raise ValueError("Comparison category is missing")
    target = payload["target"]
    if not isinstance(target.get("cb_enabled"), bool):
        raise ValueError("Target CB status is missing")
    peers = payload.get("peers")
    if not isinstance(peers, list) or len(peers) != payload.get("selected_count"):
        raise ValueError("Incomplete peer list")
    if not 5 <= payload.get("requested_count", 0) <= 10 or len(peers) > payload["requested_count"]:
        raise ValueError("Unexpected peer count")
    codes = set()
    for row in [target, *peers]:
        code = row.get("code")
        if not code or code in codes:
            raise ValueError("Missing or duplicate fund identity")
        codes.add(code)
        for key in ("model_version", "spec_id", "cb_enabled"):
            if target.get(key) is None or row.get(key) != target[key]:
                raise ValueError("Peer model specification or CB status differs")
    return payload


def active_factors(payload):
    factors = STOCK_FACTORS + BOND_FACTORS
    if payload["target"]["cb_enabled"]:
        factors += (("beta_cb", "转债"),)
    return factors


def render_style(payload, *, include_bonds=False):
    validate(payload)
    factors = active_factors(payload) if include_bonds else STOCK_FACTORS
    rows = []
    for key, label in factors:
        position = payload["category_factor_positions"][key]
        percentile = position.get("percentile_at_or_below")
        if finite(percentile) and not 0 <= percentile <= 1:
            raise ValueError("Percentile must be a fraction between zero and one")
        rows.append([
            label, number(payload["target"].get(key)), number(position.get("median")),
            number(percentile, percent=True, digits=1),
        ])
    return table(["因子", "本基金暴露", "同类暴露中位数", "同类百分位"], rows)


def render_peers(payload):
    validate(payload)
    factors = active_factors(payload)
    rows = [
        [row["code"], row.get("name"), number(row.get("alpha_annual"), percent=True),
         number(row.get("return_252"), percent=True),
         *(number(row.get(key)) for key, _ in factors)]
        for row in [payload["target"], *payload["peers"]]
    ]
    return table(
        ["基金代码", "基金名称", "年化 Alpha", "252 日收益",
         *(label + "暴露" for _, label in factors)], rows, text_columns=2,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("style", "peers"):
        command = commands.add_parser(name)
        command.add_argument("--input", required=True, help="Comparison JSON file, or - for stdin")
        if name == "style":
            command.add_argument("--include-bonds", action="store_true")
    args = parser.parse_args()
    raw = sys.stdin.read() if args.input == "-" else Path(args.input).read_text(encoding="utf-8")
    payload = unwrap(json.loads(raw))
    print(render_style(payload, include_bonds=args.include_bonds)
          if args.command == "style" else render_peers(payload))


if __name__ == "__main__":
    main()
