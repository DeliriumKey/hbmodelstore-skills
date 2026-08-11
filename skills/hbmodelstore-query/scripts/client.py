#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

MODELS_URL = "https://api.delirium.com.cn/models"


def main() -> int:
    parser = argparse.ArgumentParser(description="Discover models in the public hbmodelstore API")
    parser.add_argument("command", choices=("list-models",))
    parser.parse_args()
    try:
        with urllib.request.urlopen(MODELS_URL, timeout=20) as response:
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


if __name__ == "__main__":
    raise SystemExit(main())
