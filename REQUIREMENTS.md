# Jurong Kitchen Menu Webapp

A phone-friendly, bilingual (English / 中文) web menu for Jurong Kitchen, built from `Jurong Kitchen Menu.docx`. Family and guests browse the 58 dishes with a picture of each, search, and build a list of dishes to share.

## Core Features

- [ ] **Menu by category** — 9 categories (Egg, Vegetable, Seafood, Meat, Signature Soups, Rice, Congee, Noodles, Desserts) with sticky category tabs that follow scrolling.
- [ ] **Dish pictures** — one AI-generated photo per dish, made from its description (`gen_images.py`).
- [ ] **Dish detail** — tap a dish for a large picture, both names and a short description.
- [ ] **Search** — matches English, Chinese and description text.
- [ ] **Language toggle** — English-first or Chinese-first names; remembered per device.
- [ ] **My picks** — add dishes with ＋, see them in a list, share via the phone share sheet or clipboard.
- [x] **Weekly meal plan** — Lunch and Dinner for each day, Monday–Sunday, with previous/next week; add from a dish ("Add to meal plan": today + 13 days) or from the plan's "＋ Add dish" list; share or clear a week.
- [x] **Google sign-in (optional)** — when `firebase-config.js` is filled in, people can sign in; picks (with time added) and meal plans save to their account and follow them across devices. Anything added before signing in joins the account.
- [x] **Who added what (`admin.html`)** — owner-only page listing every signed-in person's picks and meal plans, by dish and by person. Owners are the emails in `firestore.rules`.

## UI/UX

- [ ] Two-column card grid on phones, wider grid on desktop; dark mode follows the device.
- [ ] Out of scope for v1: prices (not in the source menu), online ordering, payments, admin editing.

## Tech Stack

- **Frontend:** static HTML + vanilla JS (no build step; Node isn't available on this PC)
- **Backend:** none of our own — static files. Optional Firebase (Google Auth + Firestore, compat SDK 10.14.1 from gstatic) for accounts.
- **Storage:** `menu.json` for dishes; `localStorage` for language, picks and plan on each device; Firestore `users/{uid}` = {name, email, photo, picks {dishId: ms}, plan {YYYY-MM-DD: {lunch, dinner}}, updatedAt} when signed in
- **Runtime:** any browser; Python 3.12 + Pillow only for `gen_images.py`

## Architecture Notes

- `index.html`, `style.css`, `app.js` — the app. `app.js` fetches `menu.json` and renders everything.
- `menu.json` — the single source of truth for categories and dishes (id, en, zh, desc). Edit it to change the menu.
- `images/<dish-id>.jpg` — 960px JPEGs shown in the app. Pipeline: `images_raw/` (Gemini original) → `images_clean/` (cutlery, napkins and sauce dishes edited out) → `images/`. The first 51 dishes were cleaned in two passes, so their final PNGs are in `images_tidy/` (made by the one-off `tidy_pass.py`); `images_old/` keeps the replaced Black Bean with Minced Pork picture that showed rice.
- `gen_images.py` — fills in any missing step. To redo a dish, delete its `images_clean/<id>.png` (and `images_raw/<id>.png` for a fresh picture), then run `python gen_images.py <id>`. Check results by eye: the cutlery edit occasionally misses a background item.
- Cropping: `dish_boxes.json` records where each dish sits and which items (cups, glasses, teapots, side rice bowls, jug) to keep out, plus optional manual `crop` overrides. `centre_crops.py` turns it into `crops.json` (centred 4:3 crops); `crop_images.py` applies them to `images/`. After regenerating a dish, re-measure its entry in `dish_boxes.json` — the boxes only fit the picture they were measured on.
- `cloud.js` loads Firebase only when `firebase-config.js` has a config; `app.js` (menu) and `admin.js` (owner page) share it. `firestore.rules`: each person reads/writes only their own doc; owners can read all.
- `build_site.py` copies only the website files into `site/` for upload. `SETUP.md` is the owner's step-by-step guide (Firebase project, rules, Netlify Drop, authorised domain).
- `Run.bat` — serves on port 8780 and opens the browser.
- The older print-menu project in the parent folder (`build_menu.py`, Wikimedia photos) is separate and untouched.

## Open Questions

- Prices and availability aren't in the source document — add `price` to `menu.json` if wanted.
- Hosting: not yet published. SETUP.md uses Netlify Drop (no Node needed on this PC). The Firebase path has only been tested against a stand-in, not a real project.
- Meal plan has Lunch and Dinner only; add Breakfast if wanted.
- Pictures are AI illustrations, not photos of the real dishes; swap in real photos later by replacing files in `images/`.
