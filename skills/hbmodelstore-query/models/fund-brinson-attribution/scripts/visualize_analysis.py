#!/usr/bin/env python3
"""Render a linked Brinson analysis JSON offline, with bundled ECharts and no CDN."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from analyze import SCHEMA

ROOT = Path(__file__).resolve().parents[1]
ECHARTS = ROOT.parents[1] / "assets" / "echarts-6.1.0.min.js"
RENDERER = ROOT / "assets" / "analysis-renderer.mjs"
SHARED_RENDERER = ROOT / "assets" / "brinson-renderer.mjs"
TABLES = ROOT / "assets" / "analysis-tables.mjs"
STYLESHEET = ROOT / "assets" / "brinson-report.css"


def safe_json(value):
    return (
        json.dumps(value, ensure_ascii=False, allow_nan=False)
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def render(analysis):
    if analysis.get("schema") != SCHEMA:
        raise ValueError("--input must be the analysis JSON, not a raw API bundle")
    return (
        """<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brinson 跨期收益归因</title><style>"""
        + STYLESHEET.read_text()
        + """</style><body class="analysis-report"><main id="root"></main><script>"""
        + ECHARTS.read_text()
        + """</script>
<script type="module">
const sharedSource="""
        + safe_json(SHARED_RENDERER.read_text())
        + """;
const sharedUrl=URL.createObjectURL(new Blob([sharedSource],{type:'text/javascript'}));
const tablesSource="""
        + safe_json(TABLES.read_text())
        + """;
const tablesUrl=URL.createObjectURL(new Blob([tablesSource],{type:'text/javascript'}));
const source="""
        + safe_json(RENDERER.read_text())
        + """.replace("'./brinson-renderer.mjs'",JSON.stringify(sharedUrl))
  .replace("'./analysis-tables.mjs'",JSON.stringify(tablesUrl));
const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
const {renderBrinsonAnalysis}=await import(url);URL.revokeObjectURL(url);
URL.revokeObjectURL(sharedUrl);
URL.revokeObjectURL(tablesUrl);
renderBrinsonAnalysis({echarts,root:document.getElementById('root'),analysis:"""
        + safe_json(analysis)
        + """});
</script></body></html>"""
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.input.resolve() == args.output.resolve():
            raise ValueError("HTML output must not overwrite analysis input")
        analysis = json.loads(args.input.read_text())
        html = render(analysis)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(html)
        print(
            json.dumps(
                {
                    "ok": True,
                    "output": str(args.output.resolve()),
                    "status": analysis["status"],
                    "segments": len(analysis["segments"]),
                },
                ensure_ascii=False,
            )
        )
        return 0
    except (OSError, ValueError, KeyError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
