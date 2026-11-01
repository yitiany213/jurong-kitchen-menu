"""Rebuild images/<id>.jpg for every dish listed in crops.json, cropped from its best source PNG.

Source order: images_tidy/ (final edit), images_clean/, then images_old/ (only while a replacement is pending). Safe to re-run after tweaking a box.
Usage: python crop_images.py [dish-id ...]
"""
import json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
crops = {k: v for k, v in json.loads((ROOT / "crops.json").read_text(encoding="utf-8")).items() if not k.startswith("_")}
want = set(sys.argv[1:])
for dish, (l, t, r, b) in crops.items():
    if want and dish not in want:
        continue
    src = next((p for p in (ROOT / "images_tidy" / f"{dish}.png", ROOT / "images_clean" / f"{dish}.png",
                            ROOT / "images_old" / f"{dish}.images_tidy.png") if p.exists()), None)
    if src is None:
        print(f"skip {dish}: no source picture")
        continue
    im = Image.open(src).convert("RGB")
    w, h = im.size
    im = im.crop((round(l * w), round(t * h), round(r * w), round(b * h)))
    im = im.resize((960, round(960 * im.height / im.width)), Image.LANCZOS)
    im.save(ROOT / "images" / f"{dish}.jpg", "JPEG", quality=85, optimize=True)
    print(f"ok   {dish} {im.size}")
