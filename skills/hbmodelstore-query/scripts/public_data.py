"""Shared public JSON transport and native MCP export reader (standard library only)."""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def api_url(path):
    """Use the published API by default; allow a task-local test origin."""
    origin = (os.environ.get("HBMODELSTORE_API_ORIGIN") or "https://api.delirium.com.cn").rstrip(
        "/"
    )
    parsed = urllib.parse.urlsplit(origin)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.path
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
    ):
        raise ValueError("HBMODELSTORE_API_ORIGIN must be an HTTP(S) origin")
    if not path.startswith("/") or path.startswith("//"):
        raise ValueError("API path must start with a single slash")
    return origin + path


def fetch_json(url, *, timeout=30, retries=1):
    """GET only; retry transport failures, never HTTP/business errors."""
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as response:
                return json.load(response)
        except urllib.error.HTTPError:
            raise
        except (urllib.error.URLError, TimeoutError, OSError):
            if attempt == retries:
                raise


def unwrap(payload):
    """Unwrap known tool envelopes without stripping a business data/series field."""
    for _ in range(12):
        if not isinstance(payload, dict):
            raise ValueError("Expected a JSON object")
        if payload.get("isError") or payload.get("is_error") or payload.get("ok") is False:
            raise ValueError("Query failed: input is not model data")
        if payload.get("error") and ("jsonrpc" in payload or "rows" not in payload):
            raise ValueError("Input contains an API error")
        if payload.get("ok") is True and "data" in payload:
            payload = payload["data"]
            continue
        key = next(
            (
                key
                for key in ("structuredContent", "structured_content")
                if isinstance(payload.get(key), dict)
            ),
            None,
        )
        if key:
            payload = payload[key]
            continue
        key = next(
            (
                key
                for key in ("result", "response")
                if isinstance(payload.get(key), dict)
                and not any(k in payload for k in ("rows", "points", "series", "schema"))
            ),
            None,
        )
        if key:
            payload = payload[key]
            continue
        if isinstance(payload.get("content"), list) and not any(
            k in payload for k in ("rows", "points", "series", "schema", "model_key")
        ):
            texts = [
                item.get("text")
                for item in payload["content"]
                if isinstance(item, dict) and item.get("type") == "text"
            ]
            if len(texts) != 1:
                raise ValueError("Export one complete JSON tool result")
            payload = json.loads(texts[0])
            continue
        return payload
    raise ValueError("Too many nested query envelopes")


def load_json(path):
    return unwrap(
        json.loads(sys.stdin.read() if str(path) == "-" else Path(path).read_text(encoding="utf-8"))
    )


def single_series(payload):
    payload = unwrap(payload)
    if isinstance(payload.get("series"), list):
        if len(payload["series"]) != 1:
            raise ValueError("Select exactly one fund series")
        return unwrap(payload["series"][0])
    return payload
