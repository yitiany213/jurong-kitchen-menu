"""One-off: run the current CLEANUP edit over images_clean/ into images_tidy/, then build images/*.jpg from it."""
import sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import gen_images as g

TIDY = g.ROOT / "images_tidy"

def tidy(path):
    d = {"id": path.stem}
    out = TIDY / path.name
    if not out.exists() and (err := g.run([g.CLEANUP, "-i", str(path)], out, d)):
        return err
    im = Image.open(out).convert("RGB")
    im.thumbnail((960, 960))
    im.save(g.IMG / f"{path.stem}.jpg", "JPEG", quality=82, optimize=True)
    return f"ok   {path.stem}"

TIDY.mkdir(exist_ok=True)
want = set(sys.argv[1:])
todo = [p for p in sorted(g.CLEAN.glob("*.png")) if not want or p.stem in want]
print(f"{len(todo)} to tidy", flush=True)
with ThreadPoolExecutor(g.WORKERS) as ex:
    for msg in ex.map(tidy, todo):
        print(msg, flush=True)
