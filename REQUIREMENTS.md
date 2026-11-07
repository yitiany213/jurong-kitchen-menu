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
- [x] **Private, Google sign-in** — Cloudflare Access lets in only the Gmail addresses on the Family policy. Picks (with time added) and meal plans save to the person's account and follow them across devices; anything added on the device before joins the account. Sign out from the footer.
- [x] **Who's picked what** — the dish detail shows who else picked or planned it; the Family page (`admin.html`) lists everyone's picks and meal plans by dish and by person. Visible to everyone on the Family list.
- [x] **Feedback board** — message box (speech-bubble button) where family post feedback; everyone can read it; people can delete their own messages (with confirmation). Unsent text is kept as a draft on the device.

## UI/UX

- [ ] Two-column card grid on phones, wider grid on desktop; dark mode follows the device.
- [ ] Out of scope for v1: prices (not in the source menu), online ordering, payments, admin editing.

## Tech Stack

- **Frontend:** static HTML + vanilla JS (no build step; Node isn't available on this PC)
- **Backend:** Cloudflare Pages Functions (`functions/api/`), behind Cloudflare Access (Google identity provider).
- **Storage:** `menu.json` for dishes; `localStorage` for language, picks and plan on each device; Workers KV (binding `JK`): `user:<email>` = {email, name, picks {dishId: ms}, plan {YYYY-MM-DD: {lunch, dinner}}, updatedAt}; `fb:<reverse time>-<rand>` = {email, name, text, at}
- **Runtime:** any browser; Python 3.12 + Pillow only for `gen_images.py`

## Architecture Notes

- `index.html`, `style.css`, `app.js` — the app. `app.js` fetches `menu.json` and renders everything.
- `menu.json` — the single source of truth for categories and dishes (id, en, zh, desc). Edit it to change the menu.
- `images/<dish-id>.jpg` — 960px JPEGs shown in the app. Pipeline: `images_raw/` (Gemini original) → `images_clean/` (cutlery, napkins and sauce dishes edited out) → `images/`. The first 51 dishes were cleaned in two passes, so their final PNGs are in `images_tidy/` (made by the one-off `tidy_pass.py`); `images_old/` keeps the replaced Black Bean with Minced Pork picture that showed rice.
- `gen_images.py` — fills in any missing step. To redo a dish, delete its `images_clean/<id>.png` (and `images_raw/<id>.png` for a fresh picture), then run `python gen_images.py <id>`. Check results by eye: the cutlery edit occasionally misses a background item.
- Cropping: `dish_boxes.json` records where each dish sits and which items (cups, glasses, teapots, side rice bowls, jug) to keep out, plus optional manual `crop` overrides. `centre_crops.py` turns it into `crops.json` (centred 4:3 crops); `crop_images.py` applies them to `images/`. After regenerating a dish, re-measure its entry in `dish_boxes.json` — the boxes only fit the picture they were measured on.
- `functions/api/_middleware.js` reads the signed-in email from Cloudflare Access (`Cf-Access-Authenticated-User-Email`, falling back to the `CF_Authorization` JWT) and checks the KV binding; `state.js` (GET everyone / PUT own record) and `feedback.js` (GET / POST / DELETE own). The app falls back to device-only mode when `/api` isn't there.
- Display name comes from `/cdn-cgi/access/get-identity` (the Google name).
- Hosting: Cloudflare Pages project `jurongkitchen` at https://jurongkitchen.yitiany.com, auto-deployed from GitHub `main`; `jurongkitchen.pages.dev` is blocked for everyone; `/privacy` and `/terms` bypass Access. Cloudflare serves clean URLs, so link `privacy`, not `privacy.html`. See `SETUP.md`.
- `dev_server.py` — local stand-in for Pages + Access + KV (data in `.devdata.json`; `?as=email` switches person). `Run.bat` runs it on port 8780 and opens the browser.
- `build_site.py` is from the earlier manual-upload setup and is no longer needed.
- The older print-menu project in the parent folder (`build_menu.py`, Wikimedia photos) is separate and untouched.

## Open Questions

- Prices and availability aren't in the source document — add `price` to `menu.json` if wanted.
- The Cloudflare functions have only been tested through `dev_server.py`; the live KV binding (`JK`) must be added in the Pages settings (SETUP.md).
- KV is eventually consistent: another person's change can take up to about a minute to show in other regions.
- Owner moderation of others' feedback is only via the KV dashboard.
- Meal plan has Lunch and Dinner only; add Breakfast if wanted.
- Pictures are AI illustrations, not photos of the real dishes; swap in real photos later by replacing files in `images/`.
