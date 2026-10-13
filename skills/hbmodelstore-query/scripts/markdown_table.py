"""Small shared formatting primitives; each model owns its table columns."""

import math


def number(value, digits=2, *, percent=False, signed=False):
    if value is None or isinstance(value, bool):
        return "—"
    try:
        value = float(value)
    except (TypeError, ValueError):
        return "—"
    if not math.isfinite(value):
        return "—"
    if percent:
        value *= 100
    if round(value, digits) == 0:
        value = 0.0
    return f"{value:{'+' if signed else ''}.{digits}f}" + ("%" if percent else "")


def table(headers, rows):
    def cell(value):
        text = str(value if value is not None else "—").replace("&", "&amp;")
        for character in "\\*_`[]<>|":
            text = text.replace(character, f"&#{ord(character)};")
        return text.replace("\r", " ").replace("\n", " ")

    rows = list(rows)
    if any(len(row) != len(headers) for row in rows):
        raise ValueError("Table row and header lengths differ")

    return "\n".join(
        "| " + " | ".join(cell(v) for v in row) + " |"
        for row in [headers, ["---"] * len(headers), *rows]
    )
