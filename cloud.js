// Shared Firebase loader for the menu (app.js) and the owner's page (admin.js).
// Loads the Firebase SDK only when firebase-config.js has a config, so the menu runs without it.
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.14.1/";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Couldn't load ${src}`));
    document.head.appendChild(s);
  });
}

// Resolves to a Firestore handle, or null when sign-in isn't configured.
async function loadFirebase() {
  if (!window.FIREBASE_CONFIG) return null;
  for (const f of ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"]) {
    await loadScript(FIREBASE_SDK + f);
  }
  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  return firebase.firestore();
}

async function googleSignIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await firebase.auth().signInWithPopup(provider);
  } catch (e) {
    // Some phones block popups; a full-page redirect works there.
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
      await firebase.auth().signInWithRedirect(provider);
    } else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
      throw e;
    }
  }
}
