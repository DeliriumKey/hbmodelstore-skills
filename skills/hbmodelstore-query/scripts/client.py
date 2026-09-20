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
DOCS_URL = f"{ORIGIN}/api/docs"
DOC_PATH = re.compile(r"^/docs(?:/[a-zA-Z0-9_-]+)*$")
DOC_SECTION = re.compile(r"^[a-z0-9][a-z0-9-]{0,95}$")
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
        help="Legacy model overview only; use list-docs/search-docs/get-doc for methods",
    )
    model_docs.add_argument("--model-key", required=True)
    commands.add_parser("list-docs", help="List indexed documents, excluding Skill previews")
    search_docs = commands.add_parser(
        "search-docs", help="Search documents and experiment sections"
    )
    search_docs.add_argument("--query", required=True)
    search_docs.add_argument("--limit", type=int, default=8)
    get_doc = commands.add_parser("get-doc", help="Read one document or experiment section")
    get_doc.add_argument("--path", required=True)
    get_doc.add_argument("--section")
    get_doc.add_argument("--start-line", type=int, default=1)
    get_doc.add_argument("--max-lines", type=int, default=200)
    args = parser.parse_args()
    if args.command == "model-docs" and not MODEL_KEY.fullmatch(args.model_key):
        parser.error("--model-key must use lowercase letters, digits, and single hyphens")
    if args.command == "search-funds" and not args.query.strip():
        parser.error("--query must not be blank")
    if args.command == "resolve-fund" and not FUND_CODE.fullmatch(args.fund_code.strip()):
        parser.error("--fund-code must be a Wind fund code with optional .OF suffix")
    if args.command == "search-docs" and (
        not 1 <= len(args.query.strip()) <= 200 or not 1 <= args.limit <= 20
    ):
        parser.error("--query must contain 1–200 characters; --limit must be 1–20")
    if args.command == "get-doc":
        if len(args.path) > 240 or not DOC_PATH.fullmatch(args.path):
            parser.error("--path must be an indexed /docs path, not a URL")
        if args.section is not None and not DOC_SECTION.fullmatch(args.section):
            parser.error("--section must be an experiment ID from search-docs or get-doc")
        if not 1 <= args.start_line <= 100000 or not 1 <= args.max_lines <= 400:
            parser.error("--start-line must be 1–100000; --max-lines must be 1–400")
    try:
        if args.command in {"list-docs", "search-docs", "get-doc"}:
            url = DOCS_URL
            if args.command == "search-docs":
                url += "/search?" + urllib.parse.urlencode(
                    {"query": args.query.strip(), "limit": args.limit}
                )
            elif args.command == "get-doc":
                params = {
                    "path": args.path,
                    "start_line": args.start_line,
                    "max_lines": args.max_lines,
                }
                if args.section is not None:
                    params["section"] = args.section
                url += "/page?" + urllib.parse.urlencode(params)
            payload = fetch_json(url)
            print(json.dumps({"ok": True, "data": payload}, ensure_ascii=False))
            return 0
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
