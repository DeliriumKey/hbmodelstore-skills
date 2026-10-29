"""Render offline scenario output as self-contained interactive HTML."""

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from chart_assets import inline_chart_style
from public_data import load_json


def render(payload):
    if payload.get("model_key") != "new-issue-return" or not payload.get("scenarios"):
        raise ValueError("Expected nonempty new-issue analysis output")
    root = Path(__file__).resolve().parents[1]
    stylesheet = (root.parents[1] / "assets/preview.css").read_text(encoding="utf-8")
    runtime = (root.parents[1] / "assets/echarts-6.1.0.min.js").read_text(encoding="utf-8")
    renderer = (root / "assets/new-issue-renderer.mjs").read_text(encoding="utf-8")
    renderer = inline_chart_style(renderer)
    renderer = renderer.replace("export function", "function")
    calculator = (root / "assets/new-issue-analysis.mjs").read_text(encoding="utf-8")
    calculator = calculator.replace("export function", "function").replace("export const", "const")
    controls = (root / "assets/new-issue-controls.mjs").read_text(encoding="utf-8")
    controls = re.sub(r"^import[^\n]+\n", "", controls, flags=re.MULTILINE)
    controls = controls.replace("export function", "function").replace("export const", "const")
    analysis = (root / "assets/new-issue-monthly.mjs").read_text(encoding="utf-8")
    analysis = analysis.replace("export function", "function")
    details = (root / "assets/new-issue-details.mjs").read_text(encoding="utf-8")
    details = re.sub(r"^import[^\n]+\n", "", details, flags=re.MULTILINE)
    details = details.replace("export function", "function")
    data = json.dumps(payload, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    page = (root / "assets/new-issue-preview.html").read_text(encoding="utf-8")
    return (
        page.replace("__STYLE__", stylesheet)
        .replace("__RUNTIME__", runtime)
        .replace("__CALCULATOR__", calculator)
        .replace("__CONTROLS__", controls)
        .replace("__ANALYSIS__", analysis)
        .replace("__DETAILS__", details)
        .replace("__RENDERER__", renderer)
        .replace("__DATA__", data)
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("Output must not overwrite input")
    page = render(load_json(args.input))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(page, encoding="utf-8")
    print(args.output.resolve())


if __name__ == "__main__":
    main()
