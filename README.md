# AirIndex ✈️

### Automated Airfare Price Index for India

AirIndex is an automated airfare measurement and analytics system designed to track and measure airfare movement in India.

Airfares are highly dynamic. The available fare can change depending on factors such as route, cabin, booking conditions, travel date, availability and booking lead time. Because of this, simply comparing or averaging observed ticket prices may not provide a reliable picture of overall airfare movement.

AirIndex addresses this problem by collecting airfare observations, organizing comparable fares, calculating an airfare index and presenting the results through a dashboard and API.

---

## 🚨 Problem

Airfare prices can change frequently as availability, demand and booking conditions change.

For example, a Delhi–Mumbai flight may show a fare of ₹5,000 at one point and ₹7,000 later. This does not necessarily mean that the underlying airfare has increased by 40% — the ₹5,000 fare may no longer be available and the remaining fares may have different conditions.

Therefore, the key problem is:

> **How can we fairly measure airfare price movement when the available fares themselves keep changing?**

---

## 💡 Our Solution

AirIndex provides an automated pipeline for collecting and measuring airfare movement.

The system:

1. Collects airfare observations automatically.
2. Preserves raw observations for traceability.
3. Cleans and normalizes the collected data.
4. Groups fares into comparable product categories.
5. Calculates an airfare index using a Jevons-based approach.
6. Aggregates results using relevant passenger weights.
7. Displays trends and coverage information through a dashboard.
8. Provides an API for accessing processed results.

---

## 🔄 How AirIndex Works

```text
Airfare Sources
      ↓
Automated Data Collection
      ↓
Raw Data Storage
      ↓
Cleaning & Validation
      ↓
Like-for-Like Fare Matching
      ↓
Index Calculation
      ↓
Dashboard + API
