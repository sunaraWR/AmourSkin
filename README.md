# SasviSkin AI (Facial Scan Intelligence Platform)

SasviSkin AI is an end-to-end futuristic facial scanning and skincare recommendation platform. It leverages computer vision (OpenCV) to analyze facial images, combines the results with real-time environmental data (weather, humidity, AQI), and recommends personalized skincare products based on a comprehensive algorithmic scoring system.

## Project Architecture

The project is divided into three main microservices:

1. **Dashboard (Frontend)** - A React + Vite SPA featuring a premium, futuristic, glassmorphism UI with animated SVG charts.
2. **API Server (Node.js)** - Handles environmental data fetching (OpenWeather API) and product recommendations logic.
3. **AI Service (Python/Flask)** - Handles image uploads and processes them using OpenCV heuristics to generate skin analysis scores.

---

## 1. Dashboard (Frontend)

The frontend is a React application built with Vite. It features a stunning, futuristic dark theme, custom SVG interactive charts, and client-side authentication.

**Location:** `/dashboard`

### Features:
- **Futuristic UI**: Glassmorphism cards, animated background particles, neon accents.
- **Local Storage Auth**: A fully functional login/signup flow persisting user sessions in `localStorage`.
- **Image Upload**: Users can upload facial images for scanning.
- **Interactive Charts (Pure SVG)**:
  - **Overall Score Gauge**: Radial progress ring.
  - **Radar Chart**: Spider-web chart plotting all 11 skin metrics.
  - **Animated Bar Chart**: Horizontal bars showing normalized scores.
  - **Metric Rings**: Individual glowing gauge rings for quick visual feedback.
- **Environmental Widget**: Displays live weather, AQI, and location map based on user IP.
- **Product Recommendations**: Displays dynamically ranked products based on scan results and climate.

### Tech Stack:
- React 19
- Vite
- Pure CSS (No Tailwind, custom animations)
- No external charting libraries (all charts are custom built in `ScanResults.jsx`)

### Setup & Run:
```bash
cd dashboard
npm install
npm run dev
```
*Runs on `http://localhost:5174` (or 5173).*

---

## 2. API Server (Node/Express)

The API server acts as the middle layer, gathering environmental context and calculating product suitability.

**Location:** `/api-server`

### Features:
- **Environment API (`GET /api/environment`)**: Resolves user location via IP (or provided lat/lon) and fetches real-time climate data (temperature, humidity, AQI, UV index) using OpenWeather.
- **Recommendations API (`POST /api/recommendations`)**: Accepts Computer Vision (CV) scores and climate data. It filters, scores, and ranks a catalog of skincare products (`products.json`) to find the best matches. It also generates safety alerts (e.g., "Avoid strong exfoliants on high UV days").

### Tech Stack:
- Node.js
- Express

### Setup & Run:
1. Copy `.env.example` to `.env` and add your OpenWeather API key.
```bash
cd api-server
npm install
npm start
```
*Runs on `http://localhost:5000`.*

---

## 3. AI Service (Python/Flask)

The AI service handles the heavy lifting of image analysis. It uses standard computer vision techniques (heuristics) rather than deep learning models to estimate skin properties.

**Location:** `/ai-service`

### Features:
- **Scan Endpoint (`POST /api/scan/opencv`)**: Accepts an image file, saves it temporarily, and runs multiple OpenCV algorithms to evaluate:
  - Image Quality (Blur, Brightness)
  - Skin Tone & Undertone (ITA Score)
  - Texture, Wrinkles, Pigmentation
  - Redness, Shine, Under-eye Shadows, Pores
  - Facial Symmetry

### Tech Stack:
- Python 3
- Flask & Flask-CORS
- OpenCV (`opencv-python`)
- NumPy & scikit-image

### Setup & Run:
```bash
cd ai-service
pip install -r requirements.txt
python app.py
```
*Runs on `http://localhost:5001`.*

---

## Complete End-to-End Workflow

1. **User Authentication**: User signs up/logs in via the frontend (`/dashboard/src/Login.jsx`). Session is saved locally.
2. **Image Upload**: User uploads a face image on the dashboard.
3. **Analysis Request**: Frontend sends the image to `http://localhost:5001/api/scan/opencv` (AI Service).
4. **Computer Vision Processing**: AI Service processes the image using OpenCV and returns a JSON payload of ~11 different skin metric scores.
5. **Environment Check**: Concurrently, frontend requests `http://localhost:5000/api/environment` (API Server) to get local climate data.
6. **Data Visualization**: Frontend renders the CV scores using the custom `ScanResults` animated SVG charts.
7. **Product Matching**: Frontend sends the CV scores and climate data to `http://localhost:5000/api/recommendations` (API Server).
8. **Recommendation Rendering**: API Server returns ranked products with rationales. Frontend displays them in the "Suggested Products" grid.

## Data Normalization Note
In the `ScanResults.jsx` chart component, scores are normalized individually based on their expected maximum ranges. For example, `blur_score` (Laplacian variance) has a much higher scale (0-500+) compared to percentage-based scores (0-100). This ensures accurate and visually balanced rendering on the Radar and Bar charts.
