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
- [x] **Private site + Google sign-in** — Cloudflare Access lets only the Family policy's Gmail addresses reach the site. Inside, people sign in with Google (Firebase) so picks (with time added) and meal plans save to their account and follow them across devices; anything added on the device before joins the account. Firestore rules only let accounts in `config/family` read or write. Sign out from the header or footer.
- [x] **Who's picked what** — the dish detail shows who else picked or planned it; the Family page (`admin.html`) lists everyone's picks and meal plans by dish and by person. Visible to everyone on the Family list.
- [x] **Feedback board** — message box (speech-bubble button) where family post feedback; everyone can read it; people can delete their own messages, and owners (`config/family.owners`) can delete any message (with confirmation). Unsent text is kept as a draft on the device.

## UI/UX

- [ ] Two-column card grid on phones, wider grid on desktop; dark mode follows the device.
- [ ] Out of scope for v1: prices (not in the source menu), online ordering, payments, admin editing.

## Tech Stack

- **Frontend:** static HTML + vanilla JS (no build step; Node isn't available on this PC)
- **Backend:** none of our own. Firebase (Google Auth + Firestore, compat SDK 10.14.1 from gstatic), loaded only when `firebase-config.js` has a config. Hosting on Cloudflare Pages behind Cloudflare Access.
- **Storage:** `menu.json` for dishes; `localStorage` for language, picks and plan on each device; Firestore `users/{uid}` = {name, email, photo, picks {dishId: ms}, plan {YYYY-MM-DD: {lunch, dinner}}, updatedAt}; `feedback/{id}` = {uid, name, email, text, at}; `config/family` = {emails: [...]}
- **Runtime:** any browser; Python 3.12 + Pillow only for `gen_images.py`

## Architecture Notes

- `index.html`, `style.css`, `app.js` — the app. `app.js` fetches `menu.json` and renders everything.
- `menu.json` — the single source of truth for categories and dishes (id, en, zh, desc). Edit it to change the menu.
- `images/<dish-id>.jpg` — 960px JPEGs shown in the app. Pipeline: `images_raw/` (Gemini original) → `images_clean/` (cutlery, napkins and sauce dishes edited out) → `images/`. The first 51 dishes were cleaned in two passes, so their final PNGs are in `images_tidy/` (made by the one-off `tidy_pass.py`); `images_old/` keeps the replaced Black Bean with Minced Pork picture that showed rice.
- `gen_images.py` — fills in any missing step. To redo a dish, delete its `images_clean/<id>.png` (and `images_raw/<id>.png` for a fresh picture), then run `python gen_images.py <id>`. Check results by eye: the cutlery edit occasionally misses a background item.
- Cropping: `dish_boxes.json` records where each dish sits and which items (cups, glasses, teapots, side rice bowls, jug) to keep out, plus optional manual `crop` overrides. `centre_crops.py` turns it into `crops.json` (centred 4:3 crops); `crop_images.py` applies them to `images/`. After regenerating a dish, re-measure its entry in `dish_boxes.json` — the boxes only fit the picture they were measured on.
- `cloud.js` loads Firebase only when `firebase-config.js` has a config; `app.js` (menu) and `admin.js` (Family page) share it. Both keep a live Firestore listener on `users`, so "Picked by" and the Family page update as people pick. `firestore.rules`: family (emails in `config/family`) can read all `users` and `feedback`, write only their own user doc, post feedback as themselves and delete only their own.
- `app.js` starts loading the menu before wiring up buttons, and scripts/styles carry a `?v=` version so browsers fetch the new files after an update. Bump `v` in `index.html`/`admin.html` when changing JS or CSS.
- Hosting: Cloudflare Pages project `jurongkitchen` at https://jurongkitchen.yitiany.com, auto-deployed from GitHub `main`; `jurongkitchen.pages.dev` is blocked for everyone; `/privacy` and `/terms` bypass Access. Cloudflare serves clean URLs, so link `privacy`, not `privacy.html`. See `SETUP.md`.
- `dev_server.py` serves the site with clean URLs; `--stub` swaps `firebase-config.js` for `dev_firebase_stub.js` (pretend auth + Firestore in localStorage, `?as=email` to switch person). `Run.bat` runs it on port 8780.
- `build_site.py` is from the earlier manual-upload setup and is no longer needed.
- The older print-menu project in the parent folder (`build_menu.py`, Wikimedia photos) is separate and untouched.

## Open Questions

- Prices and availability aren't in the source document — add `price` to `menu.json` if wanted.
- Firebase project `jurong-kitchen` (Spark plan, billing unlinked so usage can never be charged; Firestore in asia-southeast1). Set up 2026-11-07 via gcloud + REST; the end-to-end sign-in on the live site was not tested by Claude.
- People sign in twice: at the Cloudflare gate and again in the app (Firebase). Both use Google; Firebase remembers the device.
- Adding a person means two lists: Cloudflare's Family policy and Firestore `config/family`.
- Owner moderation of others' feedback is only via the Firestore console.
- Meal plan has Lunch and Dinner only; add Breakfast if wanted.
- Pictures are AI illustrations, not photos of the real dishes; swap in real photos later by replacing files in `images/`.
