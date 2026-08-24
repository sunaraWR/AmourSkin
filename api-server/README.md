# AmourSkin Environment + Recommendations API (Node/Express)

## Setup

1. Copy `api-server/.env.example` to `api-server/.env` and fill in your keys.
2. Install deps:
   - `cd api-server`
   - `npm install`
3. Run:
   - `npm start`

## Endpoints

- `GET /api/environment?lat={lat}&lon={lon}`
  - Returns `{ success: true, result: { ...skinClimateData } }`
  - Includes `uv_index` when available (OpenWeather One Call 4.0 `current`).
  - If `lat/lon` aren’t provided, the server resolves an approximate location from the requester’s IP and returns it as `location_hint`.
- `GET /api/products?type=skincare&category=moisturizer&q=cerave&limit=50`
  - Returns an enhanced catalog subset (adds `texture`, `attributes`, `environmental_targets`).
- `POST /api/recommendations`
  - Body: `{ cvScores, climateData, type, category, limit }`
  - Returns ranked products with `score`, `rationales`, and any `safety_alerts`.

Notes:
- The server tries OpenWeather One Call 4.0 `current` first; if unavailable for your plan/key, it falls back to `2.5/weather`.
- If you deploy behind a reverse proxy/CDN, set `TRUST_PROXY=1` so Express uses `X-Forwarded-For` for IP geolocation.

