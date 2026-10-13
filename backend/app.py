import os
import sys
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from config import Config, get_db
from routes.auth_routes import auth_bp
from routes.plant_routes import plant_bp
from routes.schedule_routes import schedule_bp
from routes.confirm_routes import confirm_bp
from routes.analytics_routes import analytics_bp
from routes.weather_routes import weather_bp
from services.scheduler_service import start_scheduler
from seed import seed_database

def create_app():
    # Detect client/dist directory (support root and backend cwd)
    client_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "client", "dist"))
    if not os.path.exists(client_dist):
        client_dist = os.path.abspath(os.path.join(os.getcwd(), "client", "dist"))

    app = Flask(__name__, static_folder=client_dist if os.path.exists(client_dist) else None)
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(plant_bp, url_prefix="/api/plants")
    app.register_blueprint(schedule_bp, url_prefix="/api/schedules")
    app.register_blueprint(confirm_bp, url_prefix="/api/confirm")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
    app.register_blueprint(weather_bp, url_prefix="/api/weather")

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_app(path):
        # Do not hijack API routes
        if path.startswith("api/"):
            return jsonify({"error": "Endpoint not found"}), 404

        # Serve static asset if requested file exists in dist
        if path and os.path.exists(client_dist):
            target_path = os.path.join(client_dist, path)
            if os.path.isfile(target_path):
                return send_from_directory(client_dist, path)

        # Serve React SPA index.html
        index_file = os.path.join(client_dist, "index.html")
        if os.path.exists(index_file):
            return send_from_directory(client_dist, "index.html")

        # Fallback API status card if frontend has not been compiled yet
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Plant Care Companion API</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #04140e; color: #ecfdf5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: rgba(7, 34, 24, 0.85); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 24px; padding: 40px; text-align: center; max-width: 520px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
                h1 { color: #34d399; margin-top: 0; font-size: 24px; }
                p { color: #a7f3d0; line-height: 1.6; font-size: 14px; }
                .btn { display: inline-block; margin: 8px 4px; padding: 12px 20px; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 13px; transition: transform 0.2s; }
                .btn:hover { transform: scale(1.05); }
                .api-link { display: block; margin-top: 15px; color: #6ee7b7; font-size: 12px; text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="card">
                <div style="font-size: 48px; margin-bottom: 10px;">🌿</div>
                <h1>Plant Care Companion API</h1>
                <p>The Python Flask + MongoDB backend is running successfully on <strong>port 5055</strong>.</p>
                <p>To use the full web application with interactive plant cards, Mamdani fuzzy logic, and funny plant mood badges, open the frontend:</p>
                <a href="http://localhost:5174" class="btn">Open Frontend (Port 5174)</a>
                <a href="http://localhost:5173" class="btn" style="background: #0f766e;">(or Port 5173)</a>
                <a href="/api/health" class="api-link">View API Health Status (/api/health)</a>
            </div>
        </body>
        </html>
        """

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({
            "status": "ok",
            "service": "Plant Care Companion Python Flask API",
            "framework": "Flask + MongoDB",
            "python_version": sys.version.split()[0],
        })

    @app.route("/api/seed", methods=["POST"])
    def trigger_seed():
        seed_database()
        return jsonify({"message": "Python backend database seeded successfully!"})

    # Auto-seed on startup if empty
    db = get_db()
    if db.users.count_documents({}) == 0:
        print("[App] Database is empty on startup. Automatically seeding sample plants and demo user...")
        seed_database()

    # Start background scheduler
    try:
        start_scheduler()
    except Exception as e:
        print(f"[App] Scheduler notice: {e}")

    return app

app = create_app()

if __name__ == "__main__":
    port = Config.PORT
    print(f"🌿 Plant Care Companion Flask server running on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
