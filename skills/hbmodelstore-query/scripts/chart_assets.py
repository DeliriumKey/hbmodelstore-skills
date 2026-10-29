"""Embed the project-local chart style in standalone browser modules."""

import base64
from pathlib import Path


def inline_chart_style(source: str) -> str:
    specifier = "'../../../assets/charts/style.mjs'"
    if specifier not in source:
        return source
    style = Path(__file__).resolve().parents[1] / "assets/charts/style.mjs"
    encoded = base64.b64encode(style.read_bytes()).decode("ascii")
    return source.replace(specifier, repr(f"data:text/javascript;base64,{encoded}"))
