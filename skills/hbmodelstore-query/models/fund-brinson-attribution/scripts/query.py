#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

BASE_URL = "https://api.delirium.com.cn/models/fund-brinson-attribution"
FUND_CODE = re.compile(r"^[0-9]{6}(?:\.OF)?$", re.IGNORECASE)


def request(endpoint: str, params: dict[str, object]) -> int:
    url = f"{BASE_URL}/{endpoint}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(json.dumps({"ok": False, "status": exc.code, "detail": detail}), file=sys.stderr)
        return 1
    except (urllib.error.URLError, TimeoutError) as exc:
        error = exc.reason if hasattr(exc, "reason") else exc
        print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
        return 1
    print(json.dumps({"ok": True, "data": payload}, ensure_ascii=False, default=str))
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Query public fund Brinson attribution")
    commands = result.add_subparsers(dest="command", required=True)
    history = commands.add_parser("history")
    history.add_argument("--fund-code", required=True)
    history.add_argument("--limit", type=int, choices=range(1, 41), default=40)
    for name in ("period", "nav"):
        command = commands.add_parser(name)
        command.add_argument("--fund-code", required=True)
        command.add_argument("--period-end", required=True, type=date.fromisoformat)
    return result


def main() -> int:
    args = parser().parse_args()
    if not FUND_CODE.fullmatch(args.fund_code.strip()):
        parser().error("--fund-code must be six digits with optional .OF suffix")
    parameters: dict[str, object] = {"fund_code": args.fund_code.strip()}
    if args.command == "history":
        parameters["limit"] = args.limit
        return request("history", parameters)
    parameters["period_end"] = args.period_end.isoformat()
    return request("nav-comparison" if args.command == "nav" else "period", parameters)


if __name__ == "__main__":
    raise SystemExit(main())
