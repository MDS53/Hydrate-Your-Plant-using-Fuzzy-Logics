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
        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
            user_id = payload.get("userId")
            db = get_db()
            try:
                user = db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
            except Exception:
                user = db.users.find_one({"_id": user_id})

            if not user:
                return jsonify({"error": "User not found"}), 401

            g.user = user
            g.user_id = str(user["_id"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired, please log in again"}), 401
        except Exception as e:
            return jsonify({"error": f"Invalid authentication token: {e}"}), 401

        return f(*args, **kwargs)
    return decorated
