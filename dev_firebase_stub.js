// Test-only stand-in for the parts of Firebase the app uses (auth + Firestore), kept in localStorage
// so several pretend people can share one "database". Served by `python dev_server.py --stub` in
// place of firebase-config.js. Sign in as someone with ?as=mum@example.com; the family list is
// FAMILY below, so ?as=stranger@example.com shows the "not on the family list" path.
(() => {
  const FAMILY = ["you@example.com", "mum@example.com", "dad@example.com"];
  const KEY = "stubdb", USERKEY = "stubuser";
  const asParam = new URLSearchParams(location.search).get("as");
  if (asParam) localStorage.setItem(USERKEY, asParam.toLowerCase());

  const load = () => JSON.parse(localStorage.getItem(KEY) || "{}");
  const saveDb = (d) => localStorage.setItem(KEY, JSON.stringify(d));
  const ts = (ms) => ({ toMillis: () => ms });
  const SERVER_TS = { __serverTs: true };
  const listeners = new Set();
  const denied = () => Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });

  let current = null;
  const authCbs = [];
  function makeUser(email) {
    const name = email.split("@")[0];
    return { uid: "uid-" + name, email, displayName: name[0].toUpperCase() + name.slice(1) + " (stub)", photoURL: "" };
  }
  const isFamily = () => current && FAMILY.includes(current.email);

  const wrap = (data) => {
    const out = { ...data };
    for (const k of ["updatedAt", "at"]) if (typeof out[k] === "number") out[k] = ts(out[k]);
    return out;
  };
  const unwrapForStore = (data) => {
    const out = {};
    for (const [k, v] of Object.entries(data)) out[k] = v === SERVER_TS ? Date.now() : v;
    return out;
  };
  const snapOf = (coll, order) => {
    let rows = Object.entries(load()[coll] || {}).map(([id, d]) => ({ id, d }));
    if (order) rows.sort((a, b) => (order.dir === "desc" ? -1 : 1) * ((a.d[order.field] || 0) - (b.d[order.field] || 0)));
    if (order?.limit) rows = rows.slice(0, order.limit);
    const docs = rows.map(({ id, d }) => ({ id, exists: true, data: () => wrap(d) }));
    return { empty: !docs.length, docs };
  };
  const notify = () => listeners.forEach((l) => l());
  const write = (coll, id, data) => {
    const d = load();
    (d[coll] ??= {});
    if (data === null) delete d[coll][id]; else d[coll][id] = unwrapForStore(data);
    saveDb(d);
    notify();
  };

  function query(coll, order = {}) {
    return {
      orderBy: (field, dir = "asc") => query(coll, { ...order, field, dir }),
      limit: (n) => query(coll, { ...order, limit: n }),
      onSnapshot(cb, err) {
        if (!isFamily()) { setTimeout(() => err?.(denied())); return () => {}; }
        const fire = () => cb(snapOf(coll, order.field ? order : null));
        listeners.add(fire);
        setTimeout(fire);
        return () => listeners.delete(fire);
      },
    };
  }

  const firestore = {
    collection: (coll) => ({
      ...query(coll),
      doc: (id) => ({
        async get() {
          if (!isFamily()) throw denied();
          const v = (load()[coll] || {})[id];
          return { exists: !!v, data: () => wrap(v || {}) };
        },
        async set(data) {
          if (!isFamily() || (coll === "users" && id !== current.uid)) throw denied();
          write(coll, id, data);
        },
        async delete() {
          const v = (load()[coll] || {})[id];
          if (!isFamily() || (v && v.uid !== current.uid)) throw denied();
          write(coll, id, null);
        },
      }),
      async add(data) {
        if (!isFamily() || data.uid !== current.uid) throw denied();
        const id = "fb" + Math.random().toString(36).slice(2, 10);
        write(coll, id, data);
        return { id };
      },
    }),
  };

  const auth = {
    get currentUser() { return current; },
    onAuthStateChanged(cb) { authCbs.push(cb); setTimeout(() => cb(current)); },
    async signInWithPopup() {
      current = makeUser(localStorage.getItem(USERKEY) || "you@example.com");
      localStorage.setItem("stubSignedIn", "1");
      authCbs.forEach((cb) => cb(current));
    },
    async signInWithRedirect() { return this.signInWithPopup(); },
    async signOut() { current = null; localStorage.removeItem("stubSignedIn"); authCbs.forEach((cb) => cb(null)); },
  };
  if (localStorage.getItem("stubSignedIn")) current = makeUser(localStorage.getItem(USERKEY) || "you@example.com");

  const authFn = () => auth;
  authFn.GoogleAuthProvider = function GoogleAuthProvider() {};
  const fsFn = () => firestore;
  fsFn.FieldValue = { serverTimestamp: () => SERVER_TS };
  window.firebase = { apps: [], initializeApp() { this.apps.push({}); }, auth: authFn, firestore: fsFn };
  window.FIREBASE_CONFIG = { stub: true };
  console.info("Firebase stand-in active — signed-in person:", localStorage.getItem(USERKEY) || "you@example.com");
})();
