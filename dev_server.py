"""Local stand-in for the live site: serves the files and fakes the Cloudflare parts.

- /api/state and /api/feedback behave like functions/api/*.js, saving to .devdata.json.
- /cdn-cgi/access/get-identity and /logout stand in for Cloudflare Access.
- Clean addresses (/privacy -> privacy.html) like Cloudflare Pages.

You're signed in as you@example.com. Add ?as=mum@example.com to any address to switch person.
Usage: python dev_server.py [port]
"""
import json
import re
import sys
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DATA = ROOT / ".devdata.json"
ID = re.compile(r"^[a-z0-9-]{1,60}$")
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def load():
    try:
        return json.loads(DATA.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"users": {}, "feedback": []}


def store(d):
    DATA.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")


def clean(body):
    picks = {k: int(v) for k, v in (body.get("picks") or {}).items() if ID.match(k) and isinstance(v, (int, float))}
    plan = {}
    for day, meals in (body.get("plan") or {}).items():
        if not DAY.match(day) or not isinstance(meals, dict):
            continue
        kept = {m: list(dict.fromkeys(i for i in meals.get(m, []) if isinstance(i, str) and ID.match(i)))
                for m in ("lunch", "dinner")}
        kept = {m: v for m, v in kept.items() if v}
        if kept:
            plan[day] = kept
    return {"name": str(body.get("name") or "").strip()[:80], "picks": picks, "plan": plan}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def email(self):
        q = parse_qs(urlparse(self.path).query)
        if "as" in q:
            return q["as"][0].lower()
        m = re.search(r"devuser=([^;]+)", self.headers.get("Cookie", ""))
        return m.group(1) if m else "you@example.com"

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return None

    def end_headers(self):
        q = parse_qs(urlparse(self.path).query)
        if "as" in q:
            self.send_header("Set-Cookie", f"devuser={q['as'][0].lower()}; Path=/")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def api(self, method):
        path = urlparse(self.path).path
        me, d = self.email(), load()
        if path == "/api/state":
            if method == "GET":
                return self.send_json({"me": me, "people": list(d["users"].values())})
            if method == "PUT":
                b = self.body()
                if b is None:
                    return self.send_json({"error": "bad-json"}, 400)
                rec = {"email": me, **clean(b), "updatedAt": int(time.time() * 1000)}
                rec["name"] = rec["name"] or me.split("@")[0]
                d["users"][me] = rec
                store(d)
                return self.send_json(rec)
        if path == "/api/feedback":
            if method == "GET":
                return self.send_json({"me": me, "messages": sorted(d["feedback"], key=lambda m: -m["at"])})
            if method == "POST":
                b = self.body() or {}
                text = str(b.get("text") or "").strip()
                if not text or len(text) > 2000:
                    return self.send_json({"error": "too-long" if text else "empty"}, 400)
                msg = {"id": f"fb:{uuid.uuid4().hex[:8]}", "email": me,
                       "name": str(b.get("name") or "").strip()[:80] or me.split("@")[0],
                       "text": text, "at": int(time.time() * 1000)}
                d["feedback"].append(msg)
                store(d)
                return self.send_json(msg, 201)
            if method == "DELETE":
                fid = parse_qs(urlparse(self.path).query).get("id", [""])[0]
                msg = next((m for m in d["feedback"] if m["id"] == fid), None)
                if msg and msg["email"] != me:
                    return self.send_json({"error": "not-yours"}, 403)
                d["feedback"] = [m for m in d["feedback"] if m["id"] != fid]
                store(d)
                return self.send_json({"ok": True})
        return self.send_json({"error": "not-found"}, 404)

    def do_GET(self):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            return self.api("GET")
        if path == "/cdn-cgi/access/get-identity":
            me = self.email()
            return self.send_json({"email": me, "name": me.split("@")[0].capitalize() + " (dev)"})
        if path == "/cdn-cgi/access/logout":
            body = b"<p>Signed out (local stand-in for Cloudflare Access). <a href='/'>Back to the menu</a></p>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            return self.wfile.write(body)
        if "." not in path.rsplit("/", 1)[-1] and (ROOT / f"{path.strip('/')}.html").is_file():
            self.path = f"/{path.strip('/')}.html"
        return super().do_GET()

    def do_PUT(self):
        self.api("PUT")

    def do_POST(self):
        self.api("POST")

    def do_DELETE(self):
        self.api("DELETE")

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8780
    print(f"Jurong Kitchen (local) at http://localhost:{port}  ·  switch person with ?as=name@example.com")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
