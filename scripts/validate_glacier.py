"""Check the dimensions, transparency, and placement of Glacier PNG assets."""

from pathlib import Path

from PIL import Image


# These files form one layered asset set, so unexpected size or mode breaks compositing.
EXPECTED = {
    "hero-joined.png": ((1536, 1024), "RGBA"),
    "shell.png": ((1536, 1024), "RGBA"),
    "wedge.png": ((1536, 1024), "RGBA"),
    "shadow-shell.png": ((1536, 1024), "RGBA"),
    "shadow-wedge.png": ((1536, 1024), "RGBA"),
    "glow-wedge.png": ((1536, 1024), "RGB"),
    "mark-front.png": ((1024, 1024), "RGBA"),
    "privacy-quote.png": ((1536, 1024), "RGBA"),
    "privacy-pt.png": ((1536, 1024), "RGBA"),
    "privacy-cash.png": ((1536, 1024), "RGBA"),
    "privacy-stack-reference.png": ((1536, 1024), "RGBA"),
}


def has_visible_checkerboard(image: Image.Image) -> bool:
    """Flag repeated opaque gray tiles in nominally transparent corner regions."""
    if image.mode != "RGBA":
        return False

    # A screenshot checkerboard alternates two gray values every 8 or 16 px.
    # Sample a 64 px corner square; transparent pixels cannot display tiles.
    pixels = image.load()
    for tile_size in (8, 16):
        tiles = []
        for tile_y in range(4):
            row = []
            for tile_x in range(4):
                x = tile_x * tile_size + tile_size // 2
                y = tile_y * tile_size + tile_size // 2
                r, g, b, a = pixels[x, y]
                if a < 16 or max(r, g, b) - min(r, g, b) > 6:
                    row = []
                    break
                row.append((r + g + b) // 3)
            if not row:
                break
            tiles.append(row)
        if len(tiles) == 4:
            even = [tiles[y][x] for y in range(4) for x in range(4) if (x + y) % 2 == 0]
            odd = [tiles[y][x] for y in range(4) for x in range(4) if (x + y) % 2 == 1]
            if max(even) - min(even) <= 6 and max(odd) - min(odd) <= 6:
                if abs(sum(even) / len(even) - sum(odd) / len(odd)) >= 12:
                    return True
    return False


def main() -> None:
    """Print a compact report and fail if a required export property is wrong."""
    folder = Path(__file__).resolve().parents[1] / "assets" / "glass"
    failed = False
    bounds = {}

    extra = sorted(path.name for path in folder.glob("*.png") if path.name not in EXPECTED)
    for name in extra:
        print(f"FAIL {name}: unexpected PNG")
        failed = True

    for name, (wanted_size, wanted_mode) in EXPECTED.items():
        path = folder / name
        if not path.exists():
            print(f"FAIL {name}: missing")
            failed = True
            continue

        with Image.open(path) as image:
            corners = (
                (0, 0),
                (image.width - 1, 0),
                (0, image.height - 1),
                (image.width - 1, image.height - 1),
            )
            if image.mode == "RGBA":
                corner_ok = all(image.getpixel(point)[3] == 0 for point in corners)
                bbox = image.getchannel("A").getbbox()
            else:
                corner_ok = all(image.getpixel(point) == (0, 0, 0) for point in corners)
                bbox = None

            checkerboard = has_visible_checkerboard(image)
            ok = (
                image.size == wanted_size
                and image.mode == wanted_mode
                and corner_ok
                and not checkerboard
            )
            failed |= not ok
            bounds[name] = bbox
            print(
                f"{'PASS' if ok else 'FAIL'} {name}: mode={image.mode}, "
                f"size={image.size}, corners={'clear' if corner_ok else 'bad'}, "
                f"checkerboard={'yes' if checkerboard else 'no'}, bbox={bbox}"
            )

    print("\nLayer bounds (nontransparent pixels), side by side:")
    print(
        f"hero-joined={bounds.get('hero-joined.png')} | "
        f"shell={bounds.get('shell.png')} | "
        f"wedge={bounds.get('wedge.png')}"
    )

    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
