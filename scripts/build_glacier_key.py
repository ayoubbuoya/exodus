"""Build an exact-fit Exodus split mark from one shared wedge outline.

The silver body's open pocket and the blue piece use the same five points.
Moving the blue piece to x=0 closes the pocket with no geometric gap.
"""

from pathlib import Path


OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "brand-concept"

# This is the single source for both sides of the mechanical join.
# The point faces left; the broad end opens at the right edge of the plate.
WEDGE = ((42, 50), (60, 29), (92, 29), (92, 71), (60, 71))

# A second exact join adapts the app's existing cut-plate idea to a square mark.
# Both pieces are peers: one asset becomes principal and yield claims.
SPLIT_SEAM = ((53, 8), (42, 41), (58, 41), (47, 92))


def point(index: int) -> str:
    """Format one shared wedge vertex for an SVG path command."""
    x, y = WEDGE[index]
    return f"{x} {y}"


def silver_path() -> str:
    """Trace the outer rounded plate and then its exact open wedge pocket."""
    return (
        "M26 8 H74 C84 8 92 16 92 26 "
        f"L{point(2)} L{point(1)} L{point(0)} L{point(4)} L{point(3)} "
        "V74 C92 84 84 92 74 92 H26 C16 92 8 84 8 74 "
        "V26 C8 16 16 8 26 8 Z"
    )


def glass_path() -> str:
    """Close the same wedge outline used by the silver pocket."""
    return f"M{point(0)} L{point(1)} L{point(2)} L{point(3)} L{point(4)} Z"


def split_silver_path() -> str:
    """Trace the left claim and its shared stepped cut."""
    top, notch_left, tooth_right, bottom = SPLIT_SEAM
    return (
        f"M26 8 H{top[0]} L{notch_left[0]} {notch_left[1]} "
        f"H{tooth_right[0]} L{bottom[0]} {bottom[1]} H26 "
        "C16 92 8 84 8 74 V26 C8 16 16 8 26 8 Z"
    )


def split_blue_path() -> str:
    """Trace the right claim using the same cut points in reverse."""
    top, notch_left, tooth_right, bottom = SPLIT_SEAM
    return (
        f"M{top[0]} {top[1]} H74 C84 8 92 16 92 26 V74 "
        f"C92 84 84 92 74 92 H{bottom[0]} "
        f"L{tooth_right[0]} {tooth_right[1]} H{notch_left[0]} Z"
    )


def defs() -> str:
    """Define restrained silver and blue finishes for the vector master."""
    return """
    <defs>
      <linearGradient id="silver" x1=".14" y1="0" x2=".9" y2="1" objectBoundingBox="true">
        <stop offset="0" stop-color="#f6f9fd"/>
        <stop offset=".34" stop-color="#d8e0e9"/>
        <stop offset=".68" stop-color="#98a9bc"/>
        <stop offset="1" stop-color="#ecf2f8"/>
      </linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1" objectBoundingBox="true">
        <stop offset="0" stop-color="#89d4ff"/>
        <stop offset=".28" stop-color="#397fff"/>
        <stop offset=".72" stop-color="#245ce1"/>
        <stop offset="1" stop-color="#0d358e"/>
      </linearGradient>
      <linearGradient id="glint" x1="0" y1="0" x2="1" y2="1" objectBoundingBox="true">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".85"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>"""


def pieces(offset: int = 0, proof: bool = False) -> str:
    """Draw two separate paths; only the glass piece moves in the exploded view."""
    silver = silver_path()
    glass = glass_path()
    seam = f"M{point(2)} L{point(1)} L{point(0)} L{point(4)} L{point(3)}"
    silver_fill = "#c9d3df" if proof else "url(#silver)"
    glass_fill = "#286cff" if proof else "url(#glass)"
    return f"""
    <path d="{silver}" fill="{silver_fill}" stroke="#718399" stroke-width=".8" stroke-linejoin="round"/>
    <path d="{silver}" fill="none" stroke="#ffffff" stroke-opacity=".57"
      stroke-width=".65" stroke-linejoin="round" transform="translate(0 -0.5)"/>
    <g transform="translate({offset} 0)">
      <path d="{glass}" fill="{glass_fill}" stroke="#0a3caa" stroke-width=".8" stroke-linejoin="round"/>
      <path d="{glass}" fill="none" stroke="#b7eaff" stroke-opacity=".8"
        stroke-width="1.05" stroke-linejoin="round" transform="translate(0 -0.5)"/>
      <path d="M61 32 L86 32 L86 34 L61 34 Z" fill="url(#glint)" opacity=".55"/>
    </g>
    {f'<path d="{seam}" fill="none" stroke="#173359" stroke-width=".65"/>' if offset == 0 else ''}
    """


def standalone_svg(offset: int) -> str:
    """Export a transparent joined or exploded mark without presentation text."""
    width = 100 if offset == 0 else 124
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width * 12}" height="1200"
      viewBox="0 0 {width} 100" role="img" aria-label="Exodus split mark">
      {defs()}
      {pieces(offset)}
    </svg>"""


def layer_svg(name: str) -> str:
    """Export each mating piece on the same transparent square canvas."""
    if name == "silver":
        content = (
            f'<path d="{silver_path()}" fill="url(#silver)" '
            'stroke="#718399" stroke-width=".8" stroke-linejoin="round"/>'
        )
    elif name == "glass":
        content = (
            f'<path d="{glass_path()}" fill="url(#glass)" '
            'stroke="#0a3caa" stroke-width=".8" stroke-linejoin="round"/>'
        )
    else:
        raise ValueError(f"Unknown layer: {name}")

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"
      viewBox="0 0 100 100" role="img" aria-label="Exodus {name} piece">
      {defs()}
      {content}
    </svg>"""


def split_pieces(offset: int = 0) -> str:
    """Draw the two peer claims, translating only the blue half for the proof."""
    silver = split_silver_path()
    blue = split_blue_path()
    return f"""
    <path d="{silver}" fill="url(#silver)" stroke="#718399"
      stroke-width=".8" stroke-linejoin="round"/>
    <path d="{silver}" fill="none" stroke="#ffffff" stroke-opacity=".55"
      stroke-width=".65" transform="translate(0 -0.5)"/>
    <g transform="translate({offset} 0)">
      <path d="{blue}" fill="url(#glass)" stroke="#0a3caa"
        stroke-width=".8" stroke-linejoin="round"/>
      <path d="{blue}" fill="none" stroke="#b7eaff" stroke-opacity=".8"
        stroke-width="1.05" transform="translate(0 -0.5)"/>
    </g>"""


def split_svg(offset: int) -> str:
    """Export the square split plate as a transparent vector master."""
    width = 100 if offset == 0 else 124
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width * 12}" height="1200"
      viewBox="0 0 {width} 100" role="img" aria-label="Exodus split plate mark">
      {defs()}
      {split_pieces(offset)}
    </svg>"""


def comparison_svg() -> str:
    """Place both exact-fit concepts on one board for a brand decision."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="900"
      viewBox="0 0 1500 900" role="img" aria-label="Exodus mark concepts">
      {defs()}
      <rect width="1500" height="900" fill="#0e1210"/>
      <text x="84" y="91" fill="#ece8df" font-family="Arial, sans-serif"
        font-size="42" font-weight="700" letter-spacing="3">EXODUS</text>
      <text x="84" y="133" fill="#a9a59b" font-family="Arial, sans-serif"
        font-size="20">Two mechanically exact directions</text>
      <text x="150" y="233" fill="#ece8df" font-family="Arial, sans-serif"
        font-size="25">A  /  Keyed pocket</text>
      <text x="830" y="233" fill="#ece8df" font-family="Arial, sans-serif"
        font-size="25">B  /  Split plate</text>
      <g transform="translate(130 260) scale(4)">{pieces(0)}</g>
      <g transform="translate(810 260) scale(4)">{split_pieces(0)}</g>
      <text x="150" y="718" fill="#a9a59b" font-family="Arial, sans-serif"
        font-size="20">A blue key fits an exact pocket.</text>
      <text x="830" y="718" fill="#a9a59b" font-family="Arial, sans-serif"
        font-size="20">One instrument becomes two claims.</text>
      <text x="830" y="757" fill="#8bc6ff" font-family="Arial, sans-serif"
        font-size="18">Recommended: closer to Exodus's PT + YT model.</text>
    </svg>"""


def board_svg() -> str:
    """Show the fit and a small-size check on a dark review board."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="900"
      viewBox="0 0 1500 900" role="img" aria-label="Exodus exact-fit mark review">
      {defs()}
      <rect width="1500" height="900" fill="#0e1210"/>
      <text x="88" y="96" fill="#ece8df" font-family="Arial, sans-serif"
        font-size="42" font-weight="700" letter-spacing="3">EXODUS</text>
      <text x="88" y="138" fill="#a9a59b" font-family="Arial, sans-serif"
        font-size="21">One yield-bearing asset. Two exact-fitting claims.</text>
      <text x="182" y="244" fill="#a9a59b" font-family="Arial, sans-serif"
        font-size="18" letter-spacing="2">JOINED</text>
      <text x="797" y="244" fill="#a9a59b" font-family="Arial, sans-serif"
        font-size="18" letter-spacing="2">SPLIT</text>
      <g transform="translate(153 270) scale(4.2)">{pieces(0)}</g>
      <g transform="translate(756 270) scale(4.2)">{pieces(21)}</g>
      <text x="182" y="745" fill="#ece8df" font-family="Arial, sans-serif" font-size="22">
        Silver = principal</text>
      <text x="795" y="745" fill="#8bc6ff" font-family="Arial, sans-serif" font-size="22">
        Blue = yield claim</text>
      <text x="1130" y="90" fill="#a9a59b" font-family="Arial, sans-serif"
        font-size="16">32 px check</text>
      <g transform="translate(1315 60) scale(.32)">{pieces(0, True)}</g>
      <path d="M88 788 H1412" stroke="#34413c"/>
      <text x="88" y="828" fill="#a9a59b" font-family="Arial, sans-serif"
        font-size="18">The silver pocket and the blue key are generated from one five-point outline.</text>
    </svg>"""


def main() -> None:
    """Write the vector masters after proving both paths share the same join."""
    assert len(WEDGE) == 5
    assert WEDGE[2][0] == WEDGE[3][0] == 92
    assert WEDGE[1][1] == WEDGE[2][1] == 29
    assert WEDGE[3][1] == WEDGE[4][1] == 71
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "mark-joined.svg").write_text(standalone_svg(0), encoding="utf-8")
    (OUTPUT / "mark-exploded.svg").write_text(standalone_svg(21), encoding="utf-8")
    (OUTPUT / "silver-only.svg").write_text(layer_svg("silver"), encoding="utf-8")
    (OUTPUT / "glass-only.svg").write_text(layer_svg("glass"), encoding="utf-8")
    (OUTPUT / "fit-proof.svg").write_text(board_svg(), encoding="utf-8")
    (OUTPUT / "split-plate-joined.svg").write_text(split_svg(0), encoding="utf-8")
    (OUTPUT / "split-plate-exploded.svg").write_text(split_svg(21), encoding="utf-8")
    (OUTPUT / "comparison.svg").write_text(comparison_svg(), encoding="utf-8")
    print(f"Generated exact-fit SVG masters in {OUTPUT}")


if __name__ == "__main__":
    main()
