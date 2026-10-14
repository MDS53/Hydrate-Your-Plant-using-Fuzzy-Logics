# Fuzzy Logic Watering System - Flowchart

A colorful, minimal step-by-step flowchart of how the fuzzy logic engine determines plant watering needs.

---

## Flowchart Image

![Fuzzy Logic Watering System Colorful Flowchart](./fuzzy_logic_flowchart.png)

---

## Mermaid Flowchart (Markdown)

```mermaid
flowchart TD
    A["<b>1. Data Collection</b><br/>Gathers live weather conditions and plant baseline water requirements"] --> B["<b>2. Input Fuzzification</b><br/>Converts raw weather readings into descriptive terms: Warm, Dry, Humid"]
    B --> C["<b>3. Water Quantity Fuzzification</b><br/>Defines water volume levels: Skip, Very Low, Low, Normal, High, Very High"]
    C --> D["<b>4. Rule Evaluation</b><br/>Applies IF-THEN rules linking weather conditions to water quantity levels"]
    D --> E["<b>5. Defuzzification</b><br/>Merges active water levels into a single precise watering factor"]
    E --> F["<b>6. Context Adjustment</b><br/>Fine-tunes the water factor by plant species and environment"]
    F --> G["<b>7. Final Output</b><br/>Calculates exact milliliters to pour and dispatches reminders"]

    style A fill:#eaf7ed,stroke:#8ed09f,stroke-width:2px,color:#0c5a32
    style B fill:#edf5fe,stroke:#a4cbfb,stroke-width:2px,color:#1d4ed8
    style C fill:#f2effe,stroke:#beb8fa,stroke-width:2px,color:#534bb3
    style D fill:#fdf0ed,stroke:#f7b7a8,stroke-width:2px,color:#b92c1a
    style E fill:#fef4e8,stroke:#fad1a8,stroke-width:2px,color:#b45309
    style F fill:#e6f7f2,stroke:#99e5d4,stroke-width:2px,color:#0f766e
    style G fill:#f5edfe,stroke:#d4b3fa,stroke-width:2px,color:#7e22ce
```

---

## Step Summary

1. **1. Data Collection (Soft Green)**
   - Retrieves live weather conditions (temperature, humidity, rain) and baseline plant care settings.

2. **2. Input Fuzzification (Soft Blue)**
   - Converts numeric sensor readings into linguistic terms (*Freezing, Cold, Cool, Mild, Warm, Hot*, *Dry, Comfortable, Humid*, *Light, Heavy Rain*).

3. **3. Water Quantity Fuzzification (Soft Lavender)**
   - Defines output volume levels (*Skip, Very Low, Low, Normal, High, Very High*).

4. **4. Rule Evaluation (Soft Coral)**
   - Applies botanical IF-THEN rules linking weather states to water quantity levels.

5. **5. Defuzzification (Soft Amber)**
   - Merges active rule outputs using the Center of Area method into a single numerical factor.

6. **6. Context Adjustment (Soft Mint)**
   - Fine-tunes the factor based on species (succulent heat damping) and environment (sheltered indoor vs. direct outdoor rain).

7. **7. Final Output (Soft Violet)**
   - Calculates exact milliliters to pour and dispatches automated email notifications to caretakers.
