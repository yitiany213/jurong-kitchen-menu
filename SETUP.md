# Publishing Jurong Kitchen with Google sign-in

The menu works without any of this: picks and meal plans are then saved on each phone only.
These steps turn on **Sign in with Google** so each person's picks and meal plan are saved to
their account, and you can see **who added which dish** on `admin.html`.

Everything below is free for a family-sized site (Firebase "Spark" plan, GitHub Pages).
Takes about 20 minutes.

## 1. Create a Firebase project

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. **Create a project** → name it e.g. `jurong-kitchen` → you can turn Google Analytics off → **Create**.

## 2. Turn on Google sign-in and the database

1. Left menu **Build → Authentication → Get started → Sign-in method → Google** → Enable →
   pick your support email → **Save**.
2. Left menu **Build → Firestore Database → Create database** → choose a location near you
   (e.g. `asia-southeast1` Singapore) → **Start in production mode** → **Create**.

## 3. Connect the website to the project

1. Project overview (house icon) → **Add app → Web (`</>`)** → nickname `menu` → leave
   "Firebase Hosting" unticked → **Register app**.
2. Firebase shows a `firebaseConfig = { … }` block. Copy the `{ … }` part.
3. Open `firebase-config.js` in this folder and replace `null` with it, so it reads:

   ```js
   window.FIREBASE_CONFIG = { apiKey: "…", authDomain: "…", projectId: "…", storageBucket: "…", messagingSenderId: "…", appId: "…" };
   ```

   These values are meant to be public — they identify the project; the rules in step 4 are what protect the data.

## 4. Choose who can see everyone's data

1. Open `firestore.rules` and replace `YOUR-EMAIL@gmail.com` with your Google account
   (add others like `['you@gmail.com', 'partner@gmail.com']`).
2. Firebase console → **Firestore Database → Rules** → replace everything with the contents of
   `firestore.rules` → **Publish**.

The rules let each person read and change only their own list, and let only the emails you listed read everyone's.

**Test it now on this PC:** double-click `Run.bat`, sign in on the menu, add a dish, then open
<http://localhost:8780/admin.html> and sign in with your owner account. (Firebase allows `localhost` by default.)

## 5. Publish the website

The site is already published with GitHub Pages at
<https://yitiany213.github.io/jurong-kitchen-menu/>, from the `main` branch of
<https://github.com/yitiany213/jurong-kitchen-menu>.

1. Firebase console → **Authentication → Settings → Authorized domains → Add domain** →
   `yitiany213.github.io`. Sign-in won't work on the live site until you do this.
2. Commit and push the `firebase-config.js` and `firestore.rules` changes from steps 3–4:

   ```
   git add firebase-config.js firestore.rules
   git commit -m "Turn on Google sign-in"
   git push
   ```

To update the site later: change files here, then commit and push. GitHub Pages republishes in a minute or two.

## 6. See who added what

Open <https://yitiany213.github.io/jurong-kitchen-menu/admin.html> and sign in with an owner account.

- **By dish** — each dish with the people who picked it (and when) and whose meal plans it's in (and which days).
- **By person** — each person's name, email, picks with dates, and their meal plan.

Only people who signed in appear. Anything someone adds before signing in stays on their phone
until they sign in, then it joins their account.

## Privacy

People see a note before signing in that you will see their name, email and the dishes they add.
Their data lives in your Firebase project; you can delete a person under **Firestore Database → Data → users**.
