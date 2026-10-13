# 🚀 Plant Care Companion — Production Deployment Guide

This guide covers deploying the **Plant Care Companion** application with a **Python Flask + MongoDB** backend and a **React 19 + TypeScript + Tailwind CSS** frontend.

---

## 🏛️ Architecture Overview

```
                      +-----------------------------+
                      |       Internet Users        |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |   React Frontend (Nginx)    |
                      |   Port 3000 (Internal: 80)  |
                      +--------------+--------------+
                                     |
                         /api/* proxy pass
                                     v
                      +-----------------------------+
                      |  Python Flask WSGI API      |
                      |   Gunicorn Server (:5055)   |
                      |   - Mamdani Fuzzy Engine    |
                      |   - APScheduler Weather Job |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |      MongoDB 7.0 (Atlas     |
                      |     or Docker Container)    |
                      |          Port 27017         |
                      +-----------------------------+
```

---

## 🐳 Option 1: Docker Compose (Recommended for Local / VPS)

The project includes a ready-to-run multi-container setup with:
- **`backend`**: Python 3.12 + Gunicorn + Flask API + APScheduler + Mamdani engine
- **`client`**: Node 20 builder + Nginx Alpine static server + API reverse proxy
- **`mongodb`**: MongoDB 7.0 database with persistent volume and automatic healthcheck

### 1. Prerequisites
- Docker Engine 24.0+
- Docker Compose v2.20+

### 2. Configure Environment (Optional)
Create or adjust `.env` in the project root:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5055
FRONTEND_URL=http://localhost:3000
```

### 3. Build & Launch Containers
```bash
# Build images and start all 3 services in the background
docker compose up -d --build

# View container logs
docker compose logs -f

# Check health of services
docker compose ps
```

### 4. Access the Application
- **Frontend Web UI**: [http://localhost:3000](http://localhost:3000)
- **Backend API Health Check**: [http://localhost:5055/api/health](http://localhost:5055/api/health)
- **Demo Credentials**:
  - Email: `sophia@example.com`
  - Password: `password123`

### 5. Stop the Containers
```bash
docker compose down

# To also delete the MongoDB database volume:
docker compose down -v
```

---

## ☁️ Option 2: Cloud Deployment (Render.com)

A `render.yaml` blueprint is included in the project root.

### 1. MongoDB Database Setup (MongoDB Atlas)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a free M0 cluster.
2. Under **Database Access**, create a database user and password.
3. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) or Render's IP addresses.
4. Copy your connection URI:
   `mongodb+srv://<username>:<password>@cluster0.mongodb.net/plant_companion?retryWrites=true&w=majority`

### 2. Deploy Backend & Frontend on Render
1. Push your repository to GitHub or GitLab.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** -> **Blueprint**.
3. Connect your repository. Render will automatically detect `render.yaml` and configure:
   - `plantcare-backend`: Python Web Service using `gunicorn app:app`
   - `plantcare-frontend`: Static Site serving the Vite production build
4. Set the environment variable `MONGODB_URI` to your Atlas URI.
5. Set `FRONTEND_URL` to your Render frontend URL.
6. Click **Apply Blueprint**.

---

## 🛠️ Option 3: Manual Production Setup on Linux VPS

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run database seed (if starting fresh)
python3 seed.py

# Run production WSGI with Gunicorn
gunicorn --bind 0.0.0.0:5055 --workers 2 --timeout 120 app:app
```

### 2. Frontend Setup
```bash
cd client
npm install
npm run build
# The compiled production output is in client/dist/
# Serve with Nginx or Caddy
```

---

## 📋 Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5055` | Backend HTTP port |
| `MONGODB_URI` | *(empty = in-memory fallback)* | Connection URI for MongoDB (e.g. `mongodb://localhost:27017/plant_companion`) |
| `JWT_SECRET` | `plant_companion_super_secret_jwt_key_2026` | Secret key for signing JSON Web Tokens |
| `GEMINI_API_KEY` | *(optional)* | Google Gemini API key for dynamic plant care analysis |
| `FRONTEND_URL` | `http://localhost:5174` | Allowed CORS origin for the React client |
| `WEATHER_API_BASE` | `https://api.open-meteo.com/v1/forecast` | Open-Meteo REST API endpoint |

---

## 🧪 Production Health & Verification

Once deployed, verify your setup with:

```bash
# Verify API Health
curl -s https://<your-backend-domain>/api/health

# Verify Login
curl -s -X POST https://<your-backend-domain>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sophia@example.com","password":"password123"}'
```
