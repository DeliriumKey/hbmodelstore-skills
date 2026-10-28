"""Export precomputed industry history through the configured read-only API."""
import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlencode, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import fetch_json

DEFAULT_ORIGIN = "https://api.delirium.com.cn"


def query(*, origin=None, start=None, end=None, industries=None, standard="SW2021"):
    origin = (origin or os.environ.get("HBMODELSTORE_API_ORIGIN") or DEFAULT_ORIGIN).rstrip("/")
    parsed = urlsplit(origin)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username
            or parsed.password or parsed.path or parsed.query or parsed.fragment):
        raise ValueError("API origin must be an HTTP(S) origin without credentials or path")
    if start is None or end is None:
        available = fetch_json(
            f"{origin}/models/convertible-bond-qmc/industry-dates?"
            f"{urlencode({'industry_standard': standard})}", timeout=60
        )
        dates = sorted(row["model_date"] for row in available["rows"])
        if not dates:
            raise ValueError("暂无可用行业模型日期")
        start = start if start is not None else dates[0]
        end = end if end is not None else dates[-1]
    params = {"industry_standard": standard}
    params.update({
        key: value for key, value in (("start", start), ("end", end), ("industries", industries))
        if value is not None
    })
    payload = fetch_json(
        f"{origin}/models/convertible-bond-qmc/industry-history?{urlencode(params)}", timeout=60
    )
    if not isinstance(payload, dict) or not isinstance(payload.get("rows"), list):
        raise ValueError("Expected a complete industry history response")
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=date.fromisoformat)
    parser.add_argument("--end", type=date.fromisoformat)
    parser.add_argument("--industries", help="Comma-separated industry names/codes; none means all")
    parser.add_argument("--industry-standard", choices=("SW2021", "SW2014"), default="SW2021")
    parser.add_argument("--api-origin", help="Override API origin; default: public API")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.start and args.end and not 0 <= (args.end - args.start).days <= 3660:
        parser.error("Use an ascending interval of at most 3660 days")
    payload = query(origin=args.api_origin, start=args.start, end=args.end,
                    industries=args.industries, standard=args.industry_standard)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, allow_nan=False), encoding="utf-8"
    )
    print(args.output)


if __name__ == "__main__":
    main()
