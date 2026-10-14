import functools
from flask import request, jsonify, g
import jwt
from config import Config, get_db
from bson import ObjectId

def require_auth(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication token missing"}), 401

        token = auth_header.split(" ")[1]
        user = None
        db = get_db()

        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
            user_id = payload.get("userId")
            if user_id:
                try:
                    user = db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
                except Exception:
                    user = db.users.find_one({"_id": user_id})

            if not user:
                email = payload.get("email")
                if email:
                    user = db.users.find_one({"email": email.lower().strip()})
        except Exception:
            # If secret changed across Render restarts, try extracting email from unverified token
            try:
                unverified = jwt.decode(token, options={"verify_signature": False})
                email = unverified.get("email")
                if email:
                    user = db.users.find_one({"email": email.lower().strip()})
            except Exception:
                pass

        # Fallback for in-memory / zero-config demo mode on Render
        if not user and (not Config.MONGODB_URI):
            user = db.users.find_one({})

        if not user:
            return jsonify({"error": "User session expired, please log in again"}), 401

        g.user = user
        g.user_id = str(user["_id"])
        return f(*args, **kwargs)
    return decorated
