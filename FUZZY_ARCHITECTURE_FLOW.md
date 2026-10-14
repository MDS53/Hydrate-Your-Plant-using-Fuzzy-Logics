# Fuzzy Logic Implementation & Application Architecture Flow

This document details the internal working, mathematical design, and end-to-end execution flow of the **Fuzzy Logic Botanical Hydration Engine** within the *Hydrate your plant using fuzzy logic* application.

---

## 1. High-Level System Architecture Flow

```mermaid
flowchart TD
    A["🌐 Live Weather Service (Open-Meteo / OWM)"] -->|Temp °C, Humidity %, Rain mm| D["🌿 Fuzzy Inference Engine (backend/fuzzy/engine.py)"]
    B["🪴 Plant Botanical Profile (MongoDB / User Inputs)"] -->|Base ml, Environment, Drought Tolerance, Pot Material| D
    C["⏰ Daily Morning Cron Job (APScheduler 8:00 AM)"] -->|Triggers Morning Re-evaluation| D

    subgraph FuzzyEngine["Fuzzy Logic Engine Pipeline"]
        D1["1. Fuzzification (sets.py, membership.py)"] --> D2["2. Mamdani Rule Evaluation (rules.py - 16 Rules)"]
        D2 --> D3["3. Fuzzy Set Aggregation (Max-Union of Clipped Sets)"]
        D3 --> D4["4. Centroid Defuzzification (defuzzifier.py - Center of Area)"]
        D4 --> D5["5. Botanical Context & Environmental Damping"]
        D5 --> D6["6. Crisp Hydration Output & Reasoning Formulation"]
    end

    D --> FuzzyEngine
    D6 --> E["📊 REST API Response (/api/plants, /api/schedules)"]
    D6 --> F["📧 Automated Master Email Dispatcher (sm3590357@gmail.com)"]
    D6 --> G["💻 Frontend React UI (Fuzzy Inspector & Plant Dashboard)"]
```

---

## 2. Detailed Internal Fuzzy Processing Flowchart

```mermaid
flowchart TD
    subgraph S1["Stage 1: Input Gathering & Normalization"]
        IN1["Crisp Weather Inputs:<br/>• Temperature T (°C)<br/>• Relative Humidity H (%)<br/>• 24h Precipitation R (mm)"]
        IN2["Plant Context:<br/>• Base Volume V_base (ml)<br/>• Environment: indoor / balcony / outdoor<br/>• Drought Tolerance: low / medium / high<br/>• Pot Material: plastic / terracotta / ceramic"]
    end

    subgraph S2["Stage 2: Fuzzification (backend/fuzzy/sets.py)"]
        F1["Temperature Membership μ_T(x):<br/>• Freezing (<= 2°C)<br/>• Cold (2 - 13°C)<br/>• Cool (9 - 19°C)<br/>• Mild (16 - 25°C)<br/>• Warm (21 - 30°C)<br/>• Hot (27 - 37°C)<br/>• ScorchingHot (>= 33°C)"]
        F2["Humidity Membership μ_H(x):<br/>• Dry (< 42%)<br/>• Comfortable (35 - 70%)<br/>• Humid (> 60%)"]
        F3["Rainfall Membership μ_R(x):<br/>• None (<= 1.2 mm)<br/>• Light (0.4 - 7.0 mm)<br/>• Heavy (>= 4.5 mm)"]
    end

    IN1 --> F1 & F2 & F3

    subgraph S3["Stage 3: Mamdani Rule Inference (backend/fuzzy/rules.py)"]
        R_EVAL["Evaluate 16 Mamdani Rules:<br/>Rule Firing Strength: α_i = min(μ_A(x), μ_B(y), ...)"]
        R_CONSEQ["Consequent Linguistic Sets:<br/>• Skip (factor ~ 0.05 - 0.20)<br/>• VeryLow (factor ~ 0.10 - 0.55)<br/>• Low (factor ~ 0.45 - 0.88)<br/>• Normal (factor ~ 0.80 - 1.20)<br/>• High (factor ~ 1.05 - 1.38)<br/>• VeryHigh (factor ~ 1.22 - 1.50)"]
        R_AGG["Fuzzy Aggregation (Max Operator):<br/>Strengths[C] = max(Strengths[C], α_i)"]
    end

    F1 & F2 & F3 & IN2 --> R_EVAL
    R_EVAL --> R_CONSEQ --> R_AGG

    subgraph S4["Stage 4: Centroid Defuzzification (backend/fuzzy/defuzzifier.py)"]
        DEFUZZ["Center of Area (COA) Integration over domain [0.0, 1.5]:<br/>z* = ∫ x · μ_agg(x) dx / ∫ μ_agg(x) dx<br/>(Computed using 300 Riemann sum steps)"]
        RAW_FAC["Raw Fuzzy Factor: raw_factor ∈ [0.0, 1.5]"]
    end

    R_AGG --> DEFUZZ --> RAW_FAC

    subgraph S5["Stage 5: Plant & Microclimate Post-Adjustments"]
        ADJ1{"Drought Tolerance?"}
        ADJ1 -->|High / Succulent| D_HIGH["Dampen heat increase by 60%<br/>Amplify cold/rain cut by 35%"]
        ADJ1 -->|Low / Tropical| D_LOW["Boost heat reaction by 15%<br/>Moderate cold cut"]
        ADJ1 -->|Medium| D_MED["Standard Factor"]

        ADJ2{"Environment?"}
        D_HIGH & D_LOW & D_MED --> ADJ2
        ADJ2 -->|Indoor| E_IND["Sheltered Damping: 1.0 + (adj - 1.0) * 0.45"]
        ADJ2 -->|Balcony| E_BAL["Semi-sheltered: 80% weather exposure<br/>If rain >= 5mm, multiply factor by 0.65"]
        ADJ2 -->|Outdoor| E_OUT["Full exposure: If rain >= 4mm,<br/>factor = max(0.05, factor * (1 - rain_offset))"]

        CLAMP["Safety Clamp: final_factor ∈ [0.05, 1.60]"]
    end

    RAW_FAC --> ADJ1
    E_IND & E_BAL & E_OUT --> CLAMP

    subgraph S6["Stage 6: Crisp Output Generation"]
        VOL["Crisp Water Volume (ml):<br/>suggested_ml = round((V_base × final_factor) / 10) × 10"]
        SKIP{"Skip Check:<br/>factor <= 0.35 OR (outdoor & rain >= 5mm) OR temp <= 2°C?"}
        REASON["Generate Human-Readable Weather Explanation & Badges"]
    end

    CLAMP --> VOL --> SKIP --> REASON
```

---

## 3. Step-by-Step Execution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Scheduler
    participant API as Flask Backend (plant_routes / schedule_routes)
    participant Weather as Weather Service (Open-Meteo)
    participant Fuzzy as Fuzzy Engine (engine.py)
    participant DB as MongoDB Database
    participant Mailer as Email Dispatcher (Gmail SMTP)
    participant Client as React Dashboard

    User->>API: Request dynamic care evaluation / morning cron triggers
    API->>DB: Fetch plant record (lat, lon, baseWaterMl, environment, droughtTolerance)
    API->>Weather: Fetch live forecast (temp, humidity, rainMm)
    Weather-->>API: Returns weather snapshot: {temp: 29.5°C, humidity: 32%, rain: 0mm}
    
    API->>Fuzzy: evaluate_fuzzy_watering(temp, humidity, rainMm, environment, droughtTolerance, baseWaterMl)
    
    rect rgb(240, 253, 244)
        Note over Fuzzy: 1. Fuzzify crisp weather into linguistic sets
        Note over Fuzzy: 2. Evaluate 16 Mamdani rules via Min-t-norm
        Note over Fuzzy: 3. Aggregate consequents via Max-s-norm
        Note over Fuzzy: 4. Defuzzify using Centroid method over [0.0, 1.5]
        Note over Fuzzy: 5. Apply microclimate damping & drought adjustments
        Note over Fuzzy: 6. Calculate crisp ml & plain-text reason
    end
    
    Fuzzy-->>API: Returns {suggestedWaterMl: 380, finalFuzzyFactor: 1.27, reason: "Heatwave alert...", explanation: {...}}
    API->>DB: Store updated schedule & fuzzyTrace
    
    opt If Morning Schedule or User Clicked Send Schedule
        API->>Mailer: Send customized HTML email to owner & caretakers
        Mailer-->>User: Delivers email notification from sm3590357@gmail.com
    end
    
    API-->>Client: Returns JSON with crisp volume, fuzzy explanation, rules fired & chart trace
    Client-->>User: Displays dynamic water card, badges, and interactive rule inspector
```

---

## 4. Mathematical Formulations

### 1. Membership Functions (`membership.py`)
- **Left-Shoulder Function:**
  $$\mu_L(x; a, b) = \begin{cases} 
  1.0 & x \le a \\
  \frac{b - x}{b - a} & a < x < b \\
  0.0 & x \ge b 
  \end{cases}$$

- **Triangular Function:**
  $$\mu_\Delta(x; a, b, c) = \begin{cases} 
  0.0 & x \le a \\
  \frac{x - a}{b - a} & a < x \le b \\
  \frac{c - x}{c - b} & b < x < c \\
  0.0 & x \ge c 
  \end{cases}$$

- **Right-Shoulder Function:**
  $$\mu_R(x; a, b) = \begin{cases} 
  0.0 & x \le a \\
  \frac{x - a}{b - a} & a < x < b \\
  1.0 & x \ge b 
  \end{cases}$$

---

### 2. Mamdani Inference & Aggregation (`rules.py`)
For each rule $R_i$:
$$\alpha_i = \min\big(\mu_{\text{temp}, i}(T), \mu_{\text{hum}, i}(H), \mu_{\text{rain}, i}(R)\big)$$

Aggregated consequent strength for each linguistic term $C \in \{\text{Skip, VeryLow, Low, Normal, High, VeryHigh}\}$:
$$\mu_{\text{agg}, C}(x) = \min\left( \max_{i \in R_C} (\alpha_i),\, \mu_C(x) \right)$$

Overall fuzzy output curve:
$$\mu_{\text{combined}}(x) = \max_{C} \big( \mu_{\text{agg}, C}(x) \big)$$

---

### 3. Centroid Defuzzification (`defuzzifier.py`)
Computes the center of gravity over the adjustment factor domain $[0.0, 1.5]$:
$$z^* = \frac{\int_{0.0}^{1.5} x \cdot \mu_{\text{combined}}(x) \, dx}{\int_{0.0}^{1.5} \mu_{\text{combined}}(x) \, dx}$$

---

### 4. Environmental Damping & Output Clamping
- **Indoor plants** (attenuated atmospheric variance):
  $$\text{factor}_{\text{indoor}} = 1.0 + (z^* - 1.0) \times 0.45$$
- **Balcony plants** (semi-protected):
  $$\text{factor}_{\text{balcony}} = 1.0 + (z^* - 1.0) \times 0.80 \quad (\times 0.65 \text{ if rain} \ge 5\text{mm})$$
- **Outdoor plants** (full rain subtraction):
  $$\text{factor}_{\text{outdoor}} = \max\left(0.05,\, z^* \times \left(1.0 - \min\left(0.85, \frac{\text{rain\_mm}}{10} \times 0.8\right)\right)\right)$$
- **Crisp Volume (ml):**
  $$V_{\text{suggested}} = \text{round}\left(\frac{V_{\text{base}} \times \text{clamp}(\text{factor}, 0.05, 1.60)}{10}\right) \times 10$$
