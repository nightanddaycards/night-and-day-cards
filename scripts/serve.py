"""Local preview server that handles clean URLs like GitHub Pages does.

/products serves products.html, /cart serves cart.html, and so on.
Run from the project folder:

    python3 scripts/serve.py          (then open http://localhost:8000)
    python3 scripts/serve.py 8080     (different port)
"""
import http.server
import os
import sys
import urllib.parse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class CleanURLHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_head(self):
        path = urllib.parse.urlsplit(self.path).path
        local = self.translate_path(path)
        # No file and no folder by that name: try the same name with .html
        if not os.path.exists(local) and os.path.isfile(local + ".html"):
            query = urllib.parse.urlsplit(self.path).query
            self.path = path + ".html" + ("?" + query if query else "")
        return super().send_head()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Previewing {ROOT} at http://localhost:{port}  (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), CleanURLHandler).serve_forever()
