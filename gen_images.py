"""Generate one food photo per dish in menu.json with the Gemini image script.

Each dish goes images_raw/<id>.png (generated) -> images_clean/<id>.png (cutlery edited out)
-> images/<id>.jpg (shown in the app). Existing steps are skipped, so it is safe to re-run.
Usage: python gen_images.py [dish-id ...]
"""
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
IMG = ROOT / "images"
RAW = ROOT / "images_raw"
CLEAN = ROOT / "images_clean"
SCRIPT = Path(r"C:\Users\yitia\ClaudeCode\tools\gemini_image.py")
WORKERS = 5

STYLE = ("Served Singapore home-style in a simple ceramic plate or bowl on a warm wooden table, "
         "soft natural window light, 45-degree angle, shallow depth of field, appetising and realistic. "
         "No cutlery, chopsticks, spoons, napkins, cloths or sauce dishes. No text, no labels, no hands, no people.")
CLEANUP = ("Edit this food photo: remove every piece of cutlery (chopsticks, chopstick rests, spoons - "
           "including any spoon resting in the dish - and forks), every napkin, cloth or tea towel, and every "
           "small sauce, chilli or condiment dish. Fill those areas with the wooden table or background that would "
           "naturally be underneath. Keep the main dish, its food, the plate or bowl, the lighting and the "
           "framing exactly the same.")


def prompt_for(d):
    return f"Professional food photograph of {d['en']} ({d['zh']}): {d['desc']} {STYLE}"


def run(args, dest, d):
    r = subprocess.run([sys.executable, str(SCRIPT), *args, "-o", str(dest), "--aspect", "4:3"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
    return None if dest.exists() else f"FAIL {d['id']}: {(r.stdout + r.stderr).strip()[-300:]}"


def make(d):
    out = IMG / f"{d['id']}.jpg"
    raw = RAW / f"{d['id']}.png"
    clean = CLEAN / f"{d['id']}.png"
    if not raw.exists() and (err := run([prompt_for(d)], raw, d)):
        return err
    if not clean.exists() and (err := run([CLEANUP, "-i", str(raw)], clean, d)):
        return err
    im = Image.open(clean).convert("RGB")
    im.thumbnail((960, 960))
    im.save(out, "JPEG", quality=82, optimize=True)
    return f"ok   {d['id']}"


def main():
    IMG.mkdir(exist_ok=True)
    RAW.mkdir(exist_ok=True)
    CLEAN.mkdir(exist_ok=True)
    menu = json.loads((ROOT / "menu.json").read_text(encoding="utf-8"))
    dishes = [d for c in menu["categories"] for d in c["dishes"]]
    want = set(sys.argv[1:])
    todo = [d for d in dishes if (d["id"] in want if want else not (CLEAN / f"{d['id']}.png").exists())]
    print(f"{len(todo)} to generate", flush=True)
    with ThreadPoolExecutor(WORKERS) as ex:
        for msg in ex.map(make, todo):
            print(msg, flush=True)


if __name__ == "__main__":
    main()
