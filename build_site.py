"""Copy just the files the website needs into site/, ready to upload (see SETUP.md, step 5).

Leaves out the picture working folders, scripts and notes. Re-run after any change.
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"
FILES = ["index.html", "admin.html", "privacy.html", "terms.html", "app.js", "admin.js", "cloud.js", "firebase-config.js",
         "style.css", "admin.css", "menu.json", "manifest.json"]

if SITE.exists():
    shutil.rmtree(SITE)
SITE.mkdir()
for f in FILES:
    shutil.copy2(ROOT / f, SITE / f)
shutil.copytree(ROOT / "images", SITE / "images")
size = sum(p.stat().st_size for p in SITE.rglob("*") if p.is_file())
print(f"site/ ready: {len(list(SITE.rglob('*.*')))} files, {size / 1e6:.1f} MB")
