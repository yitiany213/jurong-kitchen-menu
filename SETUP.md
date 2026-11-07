# How Jurong Kitchen is hosted

| Piece | What it does | Where to change it |
|---|---|---|
| **Cloudflare Pages** (project `jurongkitchen`) | Serves the site at <https://jurongkitchen.yitiany.com> from the `main` branch of <https://github.com/yitiany213/jurong-kitchen-menu>. Redeploys on every push. | Workers & Pages → jurongkitchen |
| **Cloudflare Access** (Zero Trust, team `rapid-sky-08d2`) | The gate: only Gmail addresses on the **Family** policy reach the site. `/privacy` and `/terms` are open to everyone; `jurongkitchen.pages.dev` is blocked. | Zero Trust → Access controls → Applications |
| **Firebase** (Google sign-in + Firestore) | Inside the site: saves each person's picks and meal plan, powers "who's picked what" and the feedback board. | <https://console.firebase.google.com> |

Until `firebase-config.js` is filled in, the menu still works, but picks stay on each phone and
the Sign in, Family and Feedback buttons don't appear.

## One-time: set up Firebase (about 15 minutes)

1. **Create the project.** <https://console.firebase.google.com> → **Create a project**. You can pick the
   existing Google Cloud project `jurongkitchen` or make a new one. Google Analytics can be off.
2. **Turn on Google sign-in.** Build → **Authentication → Get started → Sign-in method → Google** →
   Enable → choose your support email → **Save**.
3. **Allow your domain.** Authentication → **Settings → Authorized domains → Add domain** →
   `jurongkitchen.yitiany.com`.
4. **Create the database.** Build → **Firestore Database → Create database** → location
   `asia-southeast1 (Singapore)` → **Start in production mode** → **Create**.
5. **Add the rules.** Firestore Database → **Rules** → replace everything with the contents of
   `firestore.rules` → **Publish**.
6. **Add the family list.** Firestore Database → **Data → Start collection**:
   - Collection ID `config` → Document ID `family`
   - Field `emails`, type **array**, one **string** per person, all lowercase
     (e.g. `yitiany213@gmail.com`) → **Save**.
7. **Connect the website.** Project overview (gear) → **Project settings → Your apps → Web (`</>`)** →
   nickname `menu` → **Register app**. Copy the `firebaseConfig = { … }` values into
   `firebase-config.js` so it reads:

   ```js
   window.FIREBASE_CONFIG = { apiKey: "…", authDomain: "…", projectId: "…", storageBucket: "…", messagingSenderId: "…", appId: "…" };
   ```

   These values are meant to be public: they name the project, and the rules protect the data.
   Then commit and push (or send them to Claude to do it).

## Day to day

- **Update the site:** change files here, then commit and push. Cloudflare republishes in a minute or two.
- **Let someone in:** add their Gmail in **two** places:
  1. Cloudflare Zero Trust → the **Family** policy (gets them through the gate), and
  2. Firestore → `config/family` → `emails` (lets them save picks and use feedback). Hover the **emails**
     row and use its **+**; the **Add field** link at the top makes a separate field that doesn't count.
- **See who picked what:** the **Family** button on the menu, or <https://jurongkitchen.yitiany.com/admin>.
- **Feedback:** the speech-bubble button. Everyone on the family list can read it; people delete their own.
  Owners (Firestore `config/family` → `owners`, currently yitiany213@gmail.com) see **Delete** on every message.
- **Remove someone's data or a message:** Firestore → Data → `users/<their id>` or `feedback/<message>` → delete.

## Test on this PC

`Run.bat` serves the site. To try sign-in, sharing and feedback without the real Firebase project,
run `python dev_server.py 8780 --stub` instead: it swaps in `dev_firebase_stub.js`, a pretend
Firebase kept in the browser. Add `?as=mum@example.com` to the address to act as someone else;
`stranger@example.com` shows what someone not on the family list sees.

## Privacy

`privacy.html` and `terms.html` say that everyone on the family list can see each other's name,
email, picks, meal plans and feedback, stored by Google Firebase. Update them if that changes.
