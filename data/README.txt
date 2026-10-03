AirIndex — dataset drop folder
==============================

Drop your observations file here as:  observations.json

The dashboard will auto-load it on page open and compute the
Jevons Airfare Price Index in real time. If this file is missing
or malformed, the dashboard falls back to bundled synthetic data
and shows "Source: sample data" in the header.

Schema
------
{
  "base_period":  "2026-08-01",       // reference date (base = 100)
  "snapshot":     "2026-09-01",       // today's date
  "methodology_version": "v0.3",
  "weights_source": "DGCA passenger share, Jun 2026",
  "weights": {
    "DEL-BOM": 22, "DEL-BLR": 20, "BOM-BLR": 17,
    "DEL-CCU": 15, "BLR-HYD": 14, "MAA-DEL": 12
  },
  "observations": [
    {
      "route":       "DEL-BOM",
      "date":        "2026-09-01",
      "lead_time":   "T+7",              // T+1 | T+7 | T+15 | T+30 | T+45
      "source":      "IndiGo Direct",
      "cabin":       "economy",
      "base_fare":   5300,
      "taxes":       420,
      "udf":         150,                // user-development fee
      "platform_fee":0                   // OTA convenience charge
    }
  ]
}

Total payable per observation = base_fare + taxes + udf + platform_fee.

Computation
-----------
For each route r:
  p_r,t  = geometric mean of total fares on date "snapshot"
  p_r,0  = geometric mean of total fares on date "base_period"

National AirIndex (Jevons):
  I = ∏ (p_r,t / p_r,0) ^ ( w_r / Σw )   ×   100

Sources that disagree with the consensus (deviation > 8%) are
excluded from the geometric mean and surfaced in Trust → "second
looks". This is the "handling of incorrect/outlier fares" required
by the problem statement.