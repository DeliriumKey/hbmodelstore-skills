"""Offline interactive preview using the website's shared renderer."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from public_data import load_json
from chart_source import renderer_source


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--view", choices=["pricing", "industry"], default="pricing")
    parser.add_argument("--balances", type=Path, help="Complete same-date balances, unit CNY_100M")
    parser.add_argument("--show-distribution", action="store_true", help="Show the reserved industry count and balance charts")
    parser.add_argument("--group", choices=["all", "q1", "q2", "q3", "q4", "q5"], default="all")
    parser.add_argument("--industry", default="", help="industry_standard:industry_code")
    parser.add_argument("--bond-type", choices=["cb", "eb"], default="")
    parser.add_argument("--query", default="")
    parser.add_argument("--sort", choices=[
                        "bond_code", "bond_name", "industry_name", "market_price",
                        "conversion_value", "theoretical_price", "market_vs_theoretical_pct",
                        "remaining_years"], default="market_vs_theoretical_pct")
    parser.add_argument("--descending", action="store_true")
    parser.add_argument("--history", type=Path, action="append", default=[])
    parser.add_argument("--dates", type=Path, help="Published model dates, required with history")
    args = parser.parse_args()
    payload = load_json(args.input)
    if not isinstance(payload.get("rows"), list) or payload.get("total") != len(payload["rows"]):
        raise ValueError("Export and merge the complete single-date cross-section first")
    if (not payload.get("model_date")
        or len({r["bond_code"] for r in payload["rows"]}) != payload["total"]
        or any(row["model_date"] != payload["model_date"] for row in payload["rows"])):
        raise ValueError("Cross-section contains duplicate bonds or mixed model dates")
    if args.history and not args.dates:
        parser.error("--history requires --dates to preserve gaps in model results")
    histories = []
    for path in args.history:
        history = load_json(path)
        if not history.get("bond_code") or any(
            row["bond_code"] != history["bond_code"] for row in history["rows"]
        ):
            raise ValueError("History contains mixed bond codes")
        histories.extend(history["rows"])
    ids = [(row["bond_code"], row["model_date"]) for row in histories]
    if len(ids) != len(set(ids)):
        raise ValueError("History contains duplicate observations")
    dates = [row["model_date"] for row in load_json(args.dates)["rows"]] if args.dates else []
    if any(row["model_date"] not in dates for row in histories):
        raise ValueError("Published calendar does not cover the supplied history")
    assets = Path(__file__).parents[1] / "assets"
    renderer = renderer_source("valuation-explorer.mjs")
    offline = (assets / "valuation-offline.mjs").read_text()
    renderer += "\n" + "\n".join(
        line for line in offline.splitlines() if not line.startswith("import ")
    )
    stylesheet = (Path(__file__).resolve().parents[3] / "assets/preview.css").read_text()
    echarts = (Path(__file__).resolve().parents[3] / "assets/echarts-6.1.0.min.js").read_text()
    config = {"payload": payload, "balances": load_json(args.balances) if args.balances else None,
              "showDistribution": args.show_distribution, "view": args.view, "initial": {"group": args.group,
              "industry": args.industry, "bondType": args.bond_type, "q": args.query,
              "sort": args.sort, "descending": args.descending},
              "histories": histories, "dates": dates}
    safe = json.dumps(config, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    title = "行业拟蒙特卡洛估值" if args.view == "industry" else "个券拟蒙特卡洛估值"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>''' + title + '''</title><style>''' + stylesheet + '''
body.hb-preview .valuation-group-panel{margin-bottom:20px}
body.hb-preview .valuation-group-label{display:block;margin-bottom:8px;font-size:12px;color:var(--muted)}
body.hb-preview .valuation-groups{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));
overflow:hidden;border:1px solid var(--line);background:var(--surface)}
body.hb-preview .valuation-groups button{min-width:0;border:0;border-left:1px solid var(--line);
border-radius:0;padding:8px;font-size:14px;color:var(--muted)}
body.hb-preview .valuation-groups button:first-child{border-left:0}
body.hb-preview .valuation-groups button:hover{color:var(--ink)}
body.hb-preview .valuation-groups button[aria-pressed="true"]{background:#000;color:#fff;font-weight:500}
body.hb-preview .valuation-groups button:focus-visible{outline-offset:-2px}
body.hb-preview button.valuation-bond-link{border:0;border-radius:0;min-height:0;padding:0;background:transparent;
font:inherit;text-align:left;text-decoration:none;text-underline-offset:4px;cursor:pointer}
body.hb-preview button.valuation-bond-link:hover{text-decoration:underline;color:var(--red)}
</style><body class="hb-preview">
<main><header><h1>''' + title + '''</h1></header><div id="preview"></div></main>
<script>''' + echarts + '''</script>
<script type="module">
''' + renderer + '\nconst config=' + safe + ''';
mountValuationExplorer({root:document.getElementById('preview'),echarts:window.echarts,...config});
</script></body></html>''')
    print(args.output)


if __name__ == "__main__":
    main()
