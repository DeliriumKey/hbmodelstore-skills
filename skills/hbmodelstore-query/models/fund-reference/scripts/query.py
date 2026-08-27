#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "https://api.delirium.com.cn/models/fund-reference"
FUND_CODE = re.compile(r"^[A-Z0-9]+(?:![0-9]+)?(?:\.OF)?$", re.IGNORECASE)


def request(endpoint: str, params: dict[str, object]) -> int:
    url = f"{BASE_URL}/{endpoint}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
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
    result = argparse.ArgumentParser(description="Search and resolve public fund references")
    commands = result.add_subparsers(dest="command", required=True)
    search = commands.add_parser("search")
    search.add_argument("--query", required=True)
    search.add_argument("--limit", type=int, choices=range(1, 21), default=10)
    resolve = commands.add_parser("resolve")
    resolve.add_argument("--fund-code", required=True)
    return result


def main() -> int:
    args = parser().parse_args()
    if args.command == "search":
        if not args.query.strip():
            parser().error("--query must not be blank")
        return request("search", {"q": args.query.strip(), "limit": args.limit})
    if not FUND_CODE.fullmatch(args.fund_code.strip()):
        parser().error("--fund-code must be a Wind fund code with optional .OF suffix")
    return request("resolve", {"fund_code": args.fund_code.strip()})


if __name__ == "__main__":
    raise SystemExit(main())
