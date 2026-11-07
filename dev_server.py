"""Serve the site locally like Cloudflare Pages does (clean addresses: /privacy -> privacy.html).

    python dev_server.py [port]           the real site, using firebase-config.js as it is
    python dev_server.py [port] --stub    swaps in dev_firebase_stub.js, a pretend Firebase kept in
                                          the browser, to test sign-in, sharing and feedback without
                                          the real project. Add ?as=mum@example.com to act as someone else.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
STUB = "--stub" in sys.argv


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if STUB and path == "/firebase-config.js":
            self.path = "/dev_firebase_stub.js"
        elif "." not in path.rsplit("/", 1)[-1] and (ROOT / f"{path.strip('/')}.html").is_file():
            self.path = f"/{path.strip('/')}.html"
        return super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    port = int(args[0]) if args else 8780
    print(f"Jurong Kitchen (local) at http://localhost:{port}" + ("  ·  pretend Firebase on" if STUB else ""))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
