# Jurong Kitchen Menu 裕廊厨房

A phone-friendly, bilingual (English / 中文) menu for Jurong Kitchen: 52 dishes in 9 categories,
each with a picture, plus search, "My picks", a weekly meal planner, a family
"who's picked what" page and a feedback board. Hosted on Cloudflare Pages behind Cloudflare Access; accounts and data in Firebase.

- **Live site:** <https://jurongkitchen.yitiany.com> (invited Gmail accounts only, via Cloudflare Access)
- **Run locally:** double-click `Run.bat`; `python dev_server.py 8780 --stub` adds a pretend Firebase for testing.
- **Firebase setup, hosting and adding people:** see [SETUP.md](SETUP.md).
- **Change the menu:** edit `menu.json`.
- Dish pictures are AI illustrations, not photos of the actual dishes.

More detail in [REQUIREMENTS.md](REQUIREMENTS.md).
