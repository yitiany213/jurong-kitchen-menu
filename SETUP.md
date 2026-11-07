# How Jurong Kitchen is hosted

Everything runs on Cloudflare's free plan:

| Piece | What it does | Where to change it |
|---|---|---|
| **Cloudflare Pages** (project `jurongkitchen`) | Serves the site at <https://jurongkitchen.yitiany.com> from the `main` branch of <https://github.com/yitiany213/jurong-kitchen-menu>. Redeploys on every push. | Workers & Pages → jurongkitchen |
| **Cloudflare Access** (Zero Trust, team `rapid-sky-08d2`) | Only Gmail addresses on the **Family** policy get in, signing in with Google. `/privacy` and `/terms` are open to everyone; `jurongkitchen.pages.dev` is blocked for everyone. | Zero Trust → Access controls → Applications |
| **Pages Functions** (`functions/api/`) | `/api/state` saves each person's picks and meal plan; `/api/feedback` is the shared feedback board. They read who's signed in from Cloudflare Access. | Code in this folder |
| **Workers KV** (binding `JK`) | Stores the picks, meal plans and feedback. | Storage & databases → KV |

## One-time: connect the storage (KV)

Without this the menu still works, but picks and plans stay on each phone, and the Family page
and Feedback button don't appear.

1. Cloudflare dashboard → **Storage & databases → Workers KV → Create instance** → name `jurongkitchen` → **Create**.
2. **Workers & Pages → jurongkitchen → Settings → Bindings → Add → KV namespace**:
   variable name `JK` (capitals), namespace `jurongkitchen` → **Save**.
3. Redeploy so the binding takes effect: **Deployments → … on the latest → Retry deployment**
   (or push any commit).

## Day to day

- **Update the site:** change files here, then commit and push. Cloudflare republishes in a minute or two.
- **Let someone in:** add their Gmail to the **Family** policy (Zero Trust → Access controls → Policies).
  If the Google app is still in Testing, also add them under **Test users** in Google Auth Platform → Audience.
- **See who picked what:** the **Family** button on the menu, or <https://jurongkitchen.yitiany.com/admin>.
  Everyone on the Family list can see this page.
- **Feedback:** the speech-bubble button on the menu. Everyone can read it; people can delete their own messages.
- **Remove someone's data or a feedback message:** Storage & databases → Workers KV → `jurongkitchen` →
  delete the key `user:<their email>` or the `fb:…` message.

## Test on this PC

Double-click `Run.bat` (runs `dev_server.py`). It fakes the Cloudflare parts so everything works
locally, saving to `.devdata.json`. You're `you@example.com`; add `?as=mum@example.com` to the
address to act as someone else.

## Privacy

The privacy policy (`privacy.html`) and terms (`terms.html`) say that everyone on the Family list can
see each other's name, email, picks, meal plans and feedback. Update them if that changes.
