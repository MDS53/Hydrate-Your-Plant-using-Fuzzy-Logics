import os
from dotenv import load_dotenv
from pymongo import MongoClient
import mongomock

# Load .env from workspace root and backend directory
load_dotenv()
backend_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(backend_env_path):
    load_dotenv(backend_env_path, override=True)

class Config:
    PORT = int(os.getenv("PORT", 5055))
    APP_URL = os.getenv("APP_URL", "http://localhost:5173")
    JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_plant_companion_key_2026")
    JWT_EXPIRES_DAYS = int(os.getenv("JWT_EXPIRES_DAYS", 7))
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
    WEATHER_PROVIDER = os.getenv("WEATHER_PROVIDER", "open-meteo")
    OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "").strip()
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.ethereal.email")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASS = os.getenv("SMTP_PASS", "")
    EMAIL_FROM = os.getenv("EMAIL_FROM", '"Plant Care Companion" <noreply@plantcare.local>')
    MONGODB_URI = os.getenv("MONGODB_URI", "").strip()

db_client = None
db = None
is_mock_db = False

def get_db():
    global db_client, db, is_mock_db
    if db is not None:
        return db

    uri = Config.MONGODB_URI
    if uri:
        try:
            print(f"[DB] Attempting connection to MongoDB: {uri.split('@')[-1] if '@' in uri else uri}")
            client = MongoClient(uri, serverSelectionTimeoutMS=4000)
            client.admin.command('ping')
            db_client = client
            db = client.get_database("plant_care_companion")
            is_mock_db = False
            print("[DB] Connected successfully to remote/local MongoDB!")
            return db
        except Exception as e:
            print(f"[DB] Connection to MONGODB_URI failed: {e}. Falling back to mongomock...")

    # Fallback to in-memory mongomock
    print("[DB] Initializing zero-config in-memory MongoDB (mongomock)...")
    db_client = mongomock.MongoClient()
    db = db_client["plant_care_companion"]
    is_mock_db = True
    print("[DB] In-memory MongoDB initialized.")
    return db
