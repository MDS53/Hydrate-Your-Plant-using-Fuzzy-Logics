from flask import Blueprint, request, jsonify, g
import bcrypt
import jwt
from datetime import datetime, timedelta
import secrets
from config import get_db, Config
from middleware.auth import require_auth
from bson import ObjectId

auth_bp = Blueprint("auth", __name__)

def generate_token(user_id: str, email: str = "") -> str:
    payload = {
        "userId": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=Config.JWT_EXPIRES_DAYS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").lower().strip()
    password = data.get("password") or ""

    if not name or not email or len(password) < 6:
        return jsonify({"error": "Name, valid email, and password (min 6 chars) are required"}), 400

    db = get_db()
    if db.users.find_one({"email": email}):
        return jsonify({"error": "An account with this email address already exists"}), 400

    salt = bcrypt.gensalt(10)
    password_hash = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    user_doc = {
        "name": name,
        "email": email,
        "passwordHash": password_hash,
        "timezone": data.get("timezone", "UTC"),
        "reminderTime": data.get("reminderTime", "08:00"),
        "createdAt": datetime.utcnow().isoformat() + "Z",
    }
    res = db.users.insert_one(user_doc)
    user_id = str(res.inserted_id)

    token = generate_token(user_id, email)
    return jsonify({
        "message": "Account created successfully",
        "token": token,
        "user": {
            "id": user_id,
            "name": name,
            "email": email,
            "timezone": user_doc["timezone"],
            "reminderTime": user_doc["reminderTime"],
        },
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("password") or ""

    db = get_db()
    user = db.users.find_one({"email": email})
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user["passwordHash"].encode("utf-8")):
        return jsonify({"error": "Invalid email or password"}), 401

    user_id = str(user["_id"])
    token = generate_token(user_id, email)
    return jsonify({
        "message": "Logged in successfully",
        "token": token,
        "user": {
            "id": user_id,
            "name": user["name"],
            "email": user["email"],
            "timezone": user.get("timezone", "UTC"),
            "reminderTime": user.get("reminderTime", "08:00"),
        },
    })

@auth_bp.route("/me", methods=["GET"])
@require_auth
def get_me():
    user = g.user
    return jsonify({
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "timezone": user.get("timezone", "UTC"),
            "reminderTime": user.get("reminderTime", "08:00"),
        }
    })

@auth_bp.route("/profile", methods=["PUT"])
@require_auth
def update_profile():
    data = request.get_json() or {}
    db = get_db()
    updates = {}
    if "name" in data: updates["name"] = data["name"].strip()
    if "timezone" in data: updates["timezone"] = data["timezone"].strip()
    if "reminderTime" in data: updates["reminderTime"] = data["reminderTime"].strip()

    if updates:
        db.users.update_one({"_id": g.user["_id"]}, {"$set": updates})

    user = db.users.find_one({"_id": g.user["_id"]})
    return jsonify({
        "message": "Profile updated",
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "timezone": user.get("timezone", "UTC"),
            "reminderTime": user.get("reminderTime", "08:00"),
        }
    })

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").lower().strip()
    db = get_db()
    user = db.users.find_one({"email": email})
    if user:
        reset_token = secrets.token_hex(20)
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"resetPasswordToken": reset_token, "resetPasswordExpires": (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z"}}
        )
        print(f"[Auth] Generated password reset token for {email}: {reset_token}")

    return jsonify({"message": "If that email is registered, reset instructions have been dispatched."})

@auth_bp.route("/smtp-status", methods=["GET"])
def get_smtp_status_route():
    from services.email_service import get_smtp_status
    status = get_smtp_status()
    return jsonify(status)

@auth_bp.route("/smtp-config", methods=["POST"])
@require_auth
def save_smtp_config_route():
    from services.email_service import configure_smtp, verify_smtp, get_smtp_status
    data = request.get_json() or {}
    configure_smtp(data)
    verify_res = verify_smtp()
    status = get_smtp_status()
    return jsonify({
        "message": verify_res.get("message", "SMTP settings updated"),
        "verified": verify_res.get("success", False),
        "isEthereal": verify_res.get("isEthereal", False),
        "status": status,
    })

@auth_bp.route("/test-email", methods=["POST"])
@require_auth
def send_test_email_route():
    from services.email_service import send_test_email
    data = request.get_json() or {}
    to_email = (data.get("toEmail") or data.get("email") or g.user.get("email") or "").strip()
    if not to_email:
        return jsonify({"error": "Recipient email address is required"}), 400
    res = send_test_email(to_email)
    return jsonify(res)
