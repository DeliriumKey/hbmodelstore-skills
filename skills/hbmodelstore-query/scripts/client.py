#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ORIGIN = "https://api.delirium.com.cn"
MODELS_URL = f"{ORIGIN}/models"
FUND_SEARCH_URL = f"{ORIGIN}/models/fund-reference/search"
FUND_RESOLVE_URL = f"{ORIGIN}/models/fund-reference/resolve"
MODEL_DOC_URL = f"{ORIGIN}/llms.mdx/docs/models/{{model_key}}/content.md"
MODEL_KEY = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FUND_CODE = re.compile(r"^[A-Z0-9]+(?:![0-9]+)?(?:\.OF)?$", re.IGNORECASE)


def fetch_json(url: str) -> object:
    with urllib.request.urlopen(url, timeout=20) as response:
        return json.load(response)


def fetch_text(url: str) -> str:
    with urllib.request.urlopen(url, timeout=20) as response:
        return response.read().decode("utf-8")


def print_error(exc: urllib.error.HTTPError | urllib.error.URLError | TimeoutError) -> int:
    if isinstance(exc, urllib.error.HTTPError):
        detail = exc.read().decode("utf-8", errors="replace")
        print(json.dumps({"ok": False, "status": exc.code, "detail": detail}), file=sys.stderr)
        return 1
    error = exc.reason if hasattr(exc, "reason") else exc
    print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Discover public hbmodelstore models and fetch model documentation"
    )
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list-models")
    search_funds = commands.add_parser(
        "search-funds",
        help="Search fund shares by code or name",
    )
    search_funds.add_argument("--query", required=True)
    search_funds.add_argument("--limit", type=int, choices=range(1, 21), default=10)
    resolve_fund = commands.add_parser(
        "resolve-fund",
        help="Resolve one fund share code to its initial fund code",
    )
    resolve_fund.add_argument("--fund-code", required=True)
    model_docs = commands.add_parser(
        "model-docs",
        help="Fetch the latest machine-readable model documentation",
    )
    model_docs.add_argument("--model-key", required=True)
    args = parser.parse_args()
    if args.command == "model-docs" and not MODEL_KEY.fullmatch(args.model_key):
        parser.error("--model-key must use lowercase letters, digits, and single hyphens")
    if args.command == "search-funds" and not args.query.strip():
        parser.error("--query must not be blank")
    if args.command == "resolve-fund" and not FUND_CODE.fullmatch(args.fund_code.strip()):
        parser.error("--fund-code must be a Wind fund code with optional .OF suffix")
    try:
        if args.command == "list-models":
            payload = fetch_json(MODELS_URL)
            print(json.dumps({"ok": True, "data": payload}, ensure_ascii=False, default=str))
            return 0
        if args.command == "search-funds":
            query = urllib.parse.urlencode({"q": args.query.strip(), "limit": args.limit})
            payload = fetch_json(f"{FUND_SEARCH_URL}?{query}")
            print(json.dumps({"ok": True, "data": payload}, ensure_ascii=False, default=str))
            return 0
        if args.command == "resolve-fund":
            query = urllib.parse.urlencode({"fund_code": args.fund_code.strip()})
            payload = fetch_json(f"{FUND_RESOLVE_URL}?{query}")
            print(json.dumps({"ok": True, "data": payload}, ensure_ascii=False, default=str))
            return 0
        model_key = urllib.parse.quote(args.model_key, safe="")
        content = fetch_text(MODEL_DOC_URL.format(model_key=model_key))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
        return print_error(exc)
    print(content)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
