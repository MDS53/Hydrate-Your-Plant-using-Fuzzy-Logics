# 🌿 Plant Care Companion

A full-stack, production-grade plant care and watering scheduler with **Python Flask + MongoDB** backend, **weather-smart Mamdani fuzzy logic engine**, multi-container **Docker deployment**, and a visually stunning **React 19 + TypeScript + Tailwind CSS** frontend featuring non-standard botanical color aesthetics, witty plant personality mood badges, and gamified achievements.

---

## 🌟 Highlights & Key Features

- **🐍 Python Flask + MongoDB Backend**:
  - Modular Flask architecture with PyMongo and automatic zero-config fallback to `mongomock` in-memory database when running offline or without standalone daemon.
  - Production WSGI compatibility with **Gunicorn** and background jobs powered by **APScheduler**.
  - Secure bcrypt password hashing and JWT authentication.
- **🧠 Deterministic Mamdani Fuzzy Logic Engine (`backend/fuzzy/`)**:
  - Pure Python, zero-LLM hallucination, deterministic inference engine tested with `pytest`.
  - Triangular, shoulder, and trapezoidal membership functions across 27 rules (Temperature, Humidity, Rain).
  - Centroid (Center of Area) defuzzification with environment damping (indoor vs outdoor) and botanical succulent protection.
  - Transparent calculation modal showing exact inputs, firing degrees, and centroid math.
- **🎨 Visually Appealing Non-Standard Botanical Color Palette**:
  - Tailored color palette avoiding generic greens:
    - **Deep Rainforest Obsidian** (`#04140e`, `#072218`)
    - **Electric Neon Sprout / Chartreuse** (`#a3e635`, `#22c55e`)
    - **Sunbaked Terracotta** (`#ea580c`, `#f97316`)
    - **Amazonian Orchid Magenta** (`#d946ef`, `#a855f7`)
    - **Luminous Dewdrop Cyan** (`#06b6d4`, `#38bdf8`)
  - Frosted chlorophyll glassmorphism cards and ambient radial gradient glow orbs.
- **🤣 Funny & Attention-Grabbing Plant Icons & Personality Badges**:
  - **🚨 Certified Thirst Trap**: *"Bro, my soil is literally the Sahara Desert. Pour it up!"*
  - **🤿 Not A Fish Bro!**: *"I have roots, not gills! Put the watering can down!"*
  - **👑 Photosynthesis Royalty**: *"Living rent-free on your windowsill. Chlorophyll poppin'!"*
  - **🌵 Desert Chad Certified**: *"Water me once in 2029 and I'll still outlive your Wi-Fi router."*
  - **🦹‍♀️ Drama Queen VIP**: *"Dropped a leaf because someone sneezed two rooms away."*
  - Interactive speech bubble: click any mood pill to cycle through sassy botanical thoughts!
  - Wiggling leaf animations and celebratory confetti bursts on hydration.
- **⛅ Live Weather Forecast & Morning Automation**:
  - Real-time weather fetched from Open-Meteo API with in-memory caching and city geocoding search.
  - APScheduler automatic morning schedule re-evaluation and reminder dispatches.
- **👥 Care Circles & Magic Links**:
  - Invite friends to care for plants; friends can confirm watering with expiring single-click magic tokens.
- **🚀 Production Deployment & Containers**:
  - `docker-compose.yml` orchestrating Python Flask API, MongoDB 7.0 with persistent storage, and React Client (Nginx).
  - `backend/Dockerfile`, `client/Dockerfile`, `render.yaml` Blueprint, and `Procfile`.

---

## 🏛️ Project Directory Structure

```text
Hydrate your plant/
├── backend/                         # 🐍 Python Flask + MongoDB Backend
│   ├── app.py                       # Main Flask app & auto-seeding
│   ├── config.py                    # PyMongo & mongomock resilient connection
│   ├── fuzzy/                       # Deterministic Mamdani fuzzy logic engine
│   │   ├── membership.py            # Triangular and shoulder curves
│   │   ├── sets.py                  # Linguistic sets (Cold, Mild, Hot, etc.)
│   │   ├── rules.py                 # 27 Mamdani inference rules
│   │   ├── defuzzifier.py           # Centroid (Center of Area) math
│   │   └── engine.py                # Top-level calculation & trace explanation
│   ├── services/
│   │   ├── weather_service.py       # Open-Meteo API with 30-min cache
│   │   ├── ai_service.py            # Gemini botanical care profile & pot math
│   │   ├── email_service.py         # Notifications & morning reminders
│   │   ├── analytics_service.py     # 0-100 vitality health score & badges
│   │   └── scheduler_service.py     # APScheduler background cron jobs
│   ├── routes/                      # Flask Blueprints
│   │   ├── auth_routes.py           # Signup, login, profile
│   │   ├── plant_routes.py          # Plant CRUD & instant watering
│   │   ├── schedule_routes.py       # Schedule events & weather triggers
│   │   ├── confirm_routes.py        # Magic token verification
│   │   ├── analytics_routes.py      # Gamification, streaks, badges
│   │   └── weather_routes.py        # City geocoding search
│   ├── middleware/
│   │   └── auth.py                  # PyJWT verification decorator
│   ├── tests/
│   │   └── test_fuzzy.py            # 9/9 passing unit tests
│   ├── seed.py                      # Realistic demo dataset
│   ├── requirements.txt             # Python dependencies
│   ├── Dockerfile                   # Python 3.12 + Gunicorn container
│   └── Procfile                     # Cloud WSGI runner
├── client/                          # ⚛️ React 19 + TypeScript Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── PlantCard.tsx        # Card with personality badges & confetti
│   │   │   ├── PlantMoodBadge.tsx   # Sassy speech bubble & witty quotes
│   │   │   ├── HealthGauge.tsx      # Circular vitality SVG meter
│   │   │   ├── WeatherBadge.tsx     # Live forecast pill
│   │   │   ├── FuzzyExplainerModal.tsx # Centroid defuzzification math breakdown
│   │   │   └── Navbar.tsx           # Dark mode glassmorphic navigation
│   │   ├── pages/
│   │   │   ├── HomePage.tsx         # Plant Sanctuary dashboard
│   │   │   ├── PlantDetailPage.tsx  # Blueprint specs, schedule & caretakers
│   │   │   ├── CreatePlantPage.tsx  # Pot dimensions & AI assistant
│   │   │   ├── AnalyticsPage.tsx    # Charts, streaks & gaming cards
│   │   │   ├── ConfirmationPage.tsx # Friend magic link portal
│   │   │   └── LoginPage.tsx        # Auth page with 1-click demo login
│   │   ├── index.css                # Custom botanical biome CSS & animations
│   │   └── types/index.ts           # Shared TypeScript interfaces
│   ├── Dockerfile                   # Multi-stage Node + Nginx build
│   └── nginx.conf                   # Reverse proxy configuration
├── docker-compose.yml               # Multi-container orchestration
├── render.yaml                      # Render Blueprint cloud specification
├── DEPLOYMENT.md                    # Detailed deployment instructions
└── README.md
```

---

## 🚀 How to Run the Project

### Method A: Local Development (Fastest)

#### 1. Start Python Flask Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run Python Flask server (with automatic database seeding)
PYTHONPATH=. python3 app.py
```
> Server runs at `http://127.0.0.1:5055`

#### 2. Start React Frontend
In a separate terminal:
```bash
cd client
npm install
npm run dev
```
> Client runs at `http://localhost:5174` (or `5173`) and automatically proxies `/api` to port `5055`.

#### 3. Log In With Demo Credentials
- **Email**: `sophia@example.com`
- **Password**: `password123`

---

### Method B: Docker Compose (Production Environment)

To run everything (MongoDB 7.0 database, Python Flask Gunicorn backend, and React Nginx frontend) with one command:

```bash
docker compose up -d --build
```

- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **Backend API Health**: [http://localhost:5055/api/health](http://localhost:5055/api/health)
- **Database**: MongoDB container on port `27017` with persistent volume `plantcare_mongo_data`.

To stop the containers:
```bash
docker compose down
```

---

## 🧪 Testing the Python Backend

Run the full pytest suite:
```bash
PYTHONPATH=backend backend/venv/bin/pytest backend/tests/ -v
```

All 9 tests pass covering:
1. Triangular, left shoulder, right shoulder membership curves.
2. Centroid defuzzification calculations.
3. Cold snap / freezing weather damping.
4. Hot & dry weather volume increases.
5. Rain skips for outdoor plants.
6. Indoor environmental dampening.
7. Succulent drought protection.
8. Practical rounding to nearest 10 ml.

---

## ☁️ Cloud Deployment

For full cloud deployment instructions (Render Blueprint, Railway, AWS ECS, MongoDB Atlas), see [DEPLOYMENT.md](file:///Users/macbook/Desktop/Masters/Fuzzy/Hydrate%20your%20plant/DEPLOYMENT.md).
