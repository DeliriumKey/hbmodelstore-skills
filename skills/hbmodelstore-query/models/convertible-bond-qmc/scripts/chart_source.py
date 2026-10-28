"""Embed the model renderer and its two local style modules in offline HTML."""
import base64
from pathlib import Path


def renderer_source(name: str) -> str:
    assets = Path(__file__).resolve().parents[1] / "assets"
    common = assets.parents[2] / "assets/charts/style.mjs"

    def module_url(source: str) -> str:
        return "data:text/javascript;base64," + base64.b64encode(source.encode()).decode()

    style = (assets / "research-style.mjs").read_text().replace(
        "'../../../assets/charts/style.mjs'", repr(module_url(common.read_text()))
    )
    return (assets / name).read_text().replace(
        "'./research-style.mjs'", repr(module_url(style))
    )
