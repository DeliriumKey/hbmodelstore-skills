"""Save complete public market responses; no pricing or aggregation here."""
import argparse
import json
import math
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import fetch_json

ORIGIN = "https://api.delirium.com.cn"
DEFAULT_FILTERS = {"parity_min": 70, "parity_max": 130, "conversion_premium_max": 85}


def finite_number(value):
    number = float(value)
    if not math.isfinite(number):
        raise argparse.ArgumentTypeError("Use a finite number")
    return number


def fetch(path, params):
    payload = fetch_json(f"{ORIGIN}{path}?{urlencode(params)}", timeout=60)
    if not isinstance(payload, dict) or not isinstance(payload.get("rows"), list):
        raise ValueError("Expected a complete API object with rows")
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=date.fromisoformat)
    parser.add_argument("--end", type=date.fromisoformat)
    parser.add_argument("--parity-min", type=finite_number,
                        help="Exclusive lower bound; default 70")
    parser.add_argument("--parity-max", type=finite_number,
                        help="Exclusive upper bound; default 130")
    parser.add_argument("--conversion-premium-max", type=finite_number,
                        help="Exclusive actual conversion premium ceiling in percent; default 85")
    parser.add_argument("--all-samples", action="store_true",
                        help="Use all valid priced bonds, without the three sample filters")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.start and args.end and not 0 <= (args.end - args.start).days <= 3660:
        parser.error("Use an ascending interval of at most 3660 calendar days")
    supplied = {key: getattr(args, key) for key in DEFAULT_FILTERS
                if getattr(args, key) is not None}
    if args.all_samples and supplied:
        parser.error("--all-samples cannot be combined with sample thresholds")
    filters = {} if args.all_samples else {**DEFAULT_FILTERS, **supplied}
    if filters and not 0 <= filters["parity_min"] < filters["parity_max"]:
        parser.error("Use 0 <= parity_min < parity_max")
    if filters and filters["conversion_premium_max"] <= -100:
        parser.error("conversion_premium_max must be greater than -100")
    params = {key: value.isoformat() for key, value in
              (("start", args.start), ("end", args.end)) if value is not None}
    market_params = {**params, **filters}
    market = fetch("/models/convertible-bond-qmc/market-history", market_params)
    if any(market.get(key) != value for key, value in filters.items()):
        raise ValueError("API did not confirm the requested sample filters; update the API first")
    # Match the full market history; the premium API otherwise defaults to three years.
    rows = market["rows"]
    comparison_params = {
        "start": params.get("start") or (rows[0]["model_date"] if rows else market["start"]),
        "end": params.get("end") or (rows[-1]["model_date"] if rows else market["end"]),
    }
    groups = fetch("/models/convertible-bond-qmc/market-groups-history",
                   {**comparison_params, **filters})
    if any(groups.get(key) != value for key, value in filters.items()):
        raise ValueError("Group API did not confirm the requested sample filters")
    payload = {
        "market": market,
        "groups": groups,
        "premium": fetch("/models/convertible-bond-premium/history", comparison_params),
        "volatility": fetch(
            "/models/convertible-bond-qmc/market-volatility-history", comparison_params
        ),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, allow_nan=False), encoding="utf-8"
    )
    print(args.output)


if __name__ == "__main__":
    main()
