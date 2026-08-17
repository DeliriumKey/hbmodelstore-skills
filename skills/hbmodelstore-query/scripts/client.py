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
MODEL_DOC_URL = f"{ORIGIN}/llms.mdx/docs/models/{{model_key}}/content.md"
MODEL_KEY = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


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
    parser = argparse.ArgumentParser(description="Discover models in the public hbmodelstore API")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list-models")
    model_docs = commands.add_parser(
        "model-docs",
        help="Fetch the latest machine-readable model documentation",
    )
    model_docs.add_argument("--model-key", required=True)
    args = parser.parse_args()
    if args.command == "model-docs" and not MODEL_KEY.fullmatch(args.model_key):
        parser.error("--model-key must use lowercase letters, digits, and single hyphens")
    try:
        if args.command == "list-models":
            payload = fetch_json(MODELS_URL)
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
