"""
Root WSGI entrypoint for Render, Railway, Heroku, and local Gunicorn.
Loads and exposes the Flask application from the backend package.
"""
import sys
import os
import importlib.util

root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, "backend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

backend_app_path = os.path.join(backend_dir, "app.py")
spec = importlib.util.spec_from_file_location("backend_app_entrypoint", backend_app_path)
if spec is None or spec.loader is None:
    raise ImportError(f"Cannot load backend app from {backend_app_path}")

backend_app_mod = importlib.util.module_from_spec(spec)
sys.modules["backend_app_entrypoint"] = backend_app_mod
spec.loader.exec_module(backend_app_mod)

app = backend_app_mod.app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5055))
    app.run(host="0.0.0.0", port=port, debug=False)
