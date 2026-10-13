"""Offline interactive preview using the website's shared renderer."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import load_json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    payload = load_json(args.input)
    if not isinstance(payload.get("rows"), list) or payload.get("total") != len(payload["rows"]):
        raise ValueError("Export and merge the complete single-date cross-section first")
    renderer = (Path(__file__).parents[1] / "assets/pricing-renderer.mjs").read_text()
    stylesheet = (Path(__file__).resolve().parents[3] / "assets/preview.css").read_text()
    safe = json.dumps(payload, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>个券拟蒙特卡洛定价</title><style>''' + stylesheet + '''</style><body class="hb-preview">
<main><header><h1>个券拟蒙特卡洛定价</h1></header><div id="preview"></div></main>
<script type="module">
''' + renderer + '\nconst payload=' + safe + ''';
mountPricingPreview({root:document.getElementById('preview'),source:offlineSource(payload)});
</script></body></html>''')
    print(args.output)


if __name__ == "__main__":
    main()
