"""Regenerate the audit #1 web assets from the original public PNGs.

Run from the repository root with:
    .venv/Scripts/python.exe frontend/scripts/optimize-images.py
Requires Pillow with WebP support. Originals are retained for future exports.
"""

from pathlib import Path

from PIL import Image, features


PUBLIC = Path(__file__).resolve().parents[1] / "public"
MASCOTS = [f"suri-snake-{state}" for state in ("happy", "sad", "left", "right")]
VILLAINS = [
    "enemy-math-villain",
    "fraction-fiend-villain",
    "variable-phantom-villan",
    "exponent-wraith-villain",
    "equation-golem-villain",
    "polynomial-hydra-villain",
]
BACKGROUNDS = ["arena", "bookstand", "library", "math-quest-academy", "results", "study"]


def export(source: str, destination: str, width: int, quality: int = 90) -> int:
    with Image.open(PUBLIC / source) as original:
        # Preserve aspect ratio and alpha; never crop, upscale, or flatten sprites.
        image = original.convert("RGBA" if "A" in original.getbands() else "RGB")
        if image.width > width:
            height = round(image.height * width / image.width)
            image = image.resize((width, height), Image.Resampling.LANCZOS)
        output = PUBLIC / destination
        if output.suffix == ".png":
            image.save(output, optimize=True)
        else:
            image.save(output, "WEBP", quality=quality, method=6)
        size = output.stat().st_size
        print(f"{destination}: {image.width}x{image.height}, {size:,} bytes")
        return size


def main() -> None:
    if not features.check("webp"):
        raise RuntimeError("Pillow must be installed with WebP support")

    source_bytes = output_bytes = 0
    # 640px supports the larger battle sprites at 2x display density.
    for name in MASCOTS + VILLAINS:
        source_bytes += (PUBLIC / f"{name}.png").stat().st_size
        output_bytes += export(f"{name}.png", f"{name}.webp", 640)
    source_bytes += (PUBLIC / "SURI1.png").stat().st_size
    output_bytes += export("SURI1.png", "SURI1.webp", 600)

    # Full-screen artwork keeps its source resolution; only encoding changes.
    for name in BACKGROUNDS:
        source = f"login/{name}.png"
        source_bytes += (PUBLIC / source).stat().st_size
        output_bytes += export(source, f"login/{name}.webp", 1672, quality=85)

    # This variant is used only underneath the existing CSS blur.
    output_bytes += export("login/library.png", "login/library-blurred.webp", 960, quality=82)
    output_bytes += export("suri-snake-happy.png", "icons/favicon-64.png", 64)
    print(f"Total: {source_bytes:,} -> {output_bytes:,} bytes "
          f"({100 * (1 - output_bytes / source_bytes):.1f}% smaller, including variants)")


if __name__ == "__main__":
    main()
