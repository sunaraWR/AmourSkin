const express = require("express");
const cors = require("cors");
const axios = require("axios");

require("dotenv").config();

const fs = require("fs");
const pathModule = require("path");
const { buildEnhancedCatalog, loadCatalog } = require("./catalog");
const { recommendProducts } = require("./recommendationEngine");

const {
  initializeDatabase,
  registerUser,
  authenticateUser,
  getUserById,
  updateUserProfile,
  saveScanHistory: saveScanHistoryDB,
  getUserScanHistory: getUserScanHistoryDB,
  generateToken,
} = require("./authUtils");
const { authMiddleware } = require("./authMiddleware");

const app = express();
// Recommendations can include CV scan payloads; keep a modest ceiling and prefer sending only needed fields.
app.use(express.json({ limit: "2mb" }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload. Please send valid JSON.",
    });
  }
  return next(err);
});

// If you deploy behind a reverse proxy/CDN, set TRUST_PROXY=1 so req.ip uses X-Forwarded-For.
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

const PORT = Number(process.env.PORT || 5000);
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || "";
// Air quality is now sourced from Open-Meteo (free, no key required)
const CORS_ORIGIN =
  process.env.CORS_ORIGIN || "http://127.0.0.1:5173,http://localhost:5173";

const corsOrigins = CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser callers (no Origin header) and configured dev origins
      if (!origin) return cb(null, true);
      return cb(null, corsOrigins.includes(origin));
    },
  })
);

// Initialize database on startup
async function startup() {
  try {
    await initializeDatabase();
    console.log("✓ Database initialized successfully");
  } catch (error) {
    console.error("✗ Failed to initialize database:", error.message);
    console.error("Make sure MySQL is running and credentials in .env are correct");
    process.exit(1);
  }
}

async function startServer(port = PORT, { initializeDb = true } = {}) {
  if (initializeDb) {
    await startup();
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Environment server running on port ${server.address().port}`);
      resolve(server);
    });

    server.on("error", reject);
  });
}

function parseCoord(value, min, max) {
  const num = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

function computeEnvironmentalStressScore({ humidity, aqi, temperature, uvIndex }) {
  const pollutionStress = aqi == null ? null : clamp01(aqi / 200) * 100;

  let humidityStress = null;
  if (humidity != null && Number.isFinite(humidity)) {
    if (humidity < 30) humidityStress = clamp01((30 - humidity) / 30) * 100;
    else if (humidity > 70) humidityStress = clamp01((humidity - 70) / 30) * 100;
    else humidityStress = 0;
  }

  let uvStress = null;
  if (uvIndex != null && Number.isFinite(uvIndex)) {
    uvStress = clamp01(uvIndex / 11) * 100;
  }

  let thermalStress = null;
  if (temperature != null && Number.isFinite(temperature)) {
    if (temperature > 25) {
      thermalStress = clamp01((temperature - 25) / 15) * 100;
    } else if (temperature < 10) {
      thermalStress = clamp01((10 - temperature) / 20) * 100;
    } else {
      thermalStress = 0;
    }
  }

  // Synergistic interaction: temperature amplifies UV damage by ~2% per degree C above 25.
  if (uvStress != null && temperature != null && temperature > 25) {
    const amplification = 1 + ((temperature - 25) * 0.02);
    uvStress = clamp01((uvStress * amplification) / 100) * 100;
  }

  const parts = [
    { key: "pollution", value: pollutionStress, weight: 0.35 },
    { key: "humidity", value: humidityStress, weight: 0.25 },
    { key: "uv", value: uvStress, weight: 0.25 },
    { key: "thermal", value: thermalStress, weight: 0.15 },
  ].filter((p) => p.value != null);

  if (parts.length === 0) {
    return {
      environmental_stress_score: null,
      factors: { pollution: pollutionStress, humidity: humidityStress, uv: uvStress, thermal: thermalStress },
    };
  }

  const weightSum = parts.reduce((s, p) => s + p.weight, 0);
  const score =
    parts.reduce((s, p) => s + p.value * p.weight, 0) / (weightSum || 1);

  return {
    environmental_stress_score: round2(score),
    factors: {
      pollution: pollutionStress == null ? null : round2(pollutionStress),
      humidity: humidityStress == null ? null : round2(humidityStress),
      uv: uvStress == null ? null : round2(uvStress),
      thermal: thermalStress == null ? null : round2(thermalStress),
    },
  };
}

const http = axios.create({
  timeout: 8000,
  headers: {
    "User-Agent": "AmourSkin/0.1 (environment-service)",
  },
});

let enhancedCatalog = [];
try {
  const rawCatalog = loadCatalog();
  enhancedCatalog = buildEnhancedCatalog(rawCatalog);
  // eslint-disable-next-line no-console
  console.log(`Loaded products catalog: ${enhancedCatalog.length} items`);
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn(`Products catalog not loaded: ${e?.message || e}`);
  enhancedCatalog = [];
}

// Load pre-computed allergy flags (generated by allergy_flag_engine.py)
let allergyFlagsDb = null;
try {
  const allergyPath = pathModule.join(__dirname, "allergy_flags_makeup.json");
  if (fs.existsSync(allergyPath)) {
    const allergyRaw = fs.readFileSync(allergyPath, "utf8");
    allergyFlagsDb = JSON.parse(allergyRaw);
    const productCount = Array.isArray(allergyFlagsDb?.products) ? allergyFlagsDb.products.length : 0;
    // eslint-disable-next-line no-console
    console.log(`Loaded allergy flags for ${productCount} products`);
  }
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn(`Allergy flags not loaded: ${e?.message || e}`);
  allergyFlagsDb = null;
}

async function ipGeolocate(req) {
  // In production you should set `app.set('trust proxy', 1)` if behind a proxy/CDN.
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip;

  // Some providers can’t resolve localhost/private IPs; we still attempt and let it fail cleanly.
  const providers = [
    {
      name: "ipwho.is",
      url: "https://ipwho.is/",
      params: { ip: ip || "" },
      pick(data) {
        if (!data || data.success === false) return null;
        if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) return null;
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.city || null,
          region: data.region || null,
          country: data.country || null,
          source: "ipwho.is",
        };
      },
    },
    {
      name: "ipapi.co",
      url: "https://ipapi.co/json/",
      params: null,
      pick(data) {
        if (!data) return null;
        const lat = Number(data.latitude);
        const lon = Number(data.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          latitude: lat,
          longitude: lon,
          city: data.city || null,
          region: data.region || null,
          country: data.country_name || data.country || null,
          source: "ipapi.co",
        };
      },
    },
  ];

  for (const p of providers) {
    try {
      const res = await http.get(p.url, { params: p.params || undefined });
      const picked = p.pick(res.data);
      if (picked) return picked;
    } catch {
      // try next provider
    }
  }

  return null;
}

// Simple in-memory cache to reduce external API calls during dev
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
function cacheKey(lat, lon) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/register
 * Register a new user with email, password, and name
 */
app.post("/api/register", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and name are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const user = await registerUser(email, password, name);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      result: {
        id: user.id,
        email: user.email,
        name: user.name,
        token: user.token,
      },
    });
  } catch (error) {
    const message = error.message || "Registration failed";
    const status = message.includes("already exists") ? 409 : 500;
    return res.status(status).json({
      success: false,
      message,
    });
  }
});

/**
 * POST /api/login
 * Authenticate user and return JWT token
 */
app.post("/api/login", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await authenticateUser(email, password);

    return res.json({
      success: true,
      message: "Login successful",
      result: {
        id: user.id,
        email: user.email,
        name: user.name,
        token: user.token,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || "Invalid email or password",
    });
  }
});

/**
 * GET /api/profile
 * Get current user profile (requires authentication)
 */
app.get("/api/profile", authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      result: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch profile",
    });
  }
});

/**
 * PUT /api/profile
 * Update user profile (requires authentication)
 */
app.put("/api/profile", authMiddleware, async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    const user = await updateUserProfile(req.user.userId, name);

    return res.json({
      success: true,
      message: "Profile updated successfully",
      result: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile",
    });
  }
});

// ============================================================================
// END OF AUTHENTICATION ENDPOINTS
// ============================================================================

app.get("/api/history/:email", authMiddleware, async (req, res) => {
  try {
    // Verify user is requesting their own history
    if (req.user.email !== decodeURIComponent(req.params.email)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Cannot access other users' history",
      });
    }

    const history = await getUserScanHistoryDB(req.user.userId);
    return res.json({ success: true, result: history });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || "Failed to load history" });
  }
});

app.post("/api/history", authMiddleware, async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    let environment = null;
    try {
      environment = await fetchEnvironmentData(req, null, null);
    } catch (e) {
      // Non-fatal if environment fails, just continue
      // eslint-disable-next-line no-console
      console.warn("Failed to attach environment data to history:", e.message);
    }

    const saved = await saveScanHistoryDB(
      req.user.userId,
      req.user.email,
      body.scanResult || {},
      { ...(body.metadata || {}), environment }
    );

    return res.json({ success: true, result: saved });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || "Failed to save history" });
  }
});

app.get("/api/location", async (req, res) => {
  const loc = await ipGeolocate(req);
  if (!loc) {
    return res.status(502).json({
      success: false,
      message: "Failed to resolve location from IP.",
    });
  }
  return res.json({ success: true, result: loc });
});

app.get("/api/products", (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type.trim().toLowerCase() : null;
  const category =
    typeof req.query.category === "string" ? req.query.category.trim().toLowerCase() : null;
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : null;
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5000, limitRaw)) : 50;

  let out = enhancedCatalog;
  if (type) out = out.filter((p) => (p.type || "").toLowerCase() === type);
  if (category) out = out.filter((p) => (p.category || "").toLowerCase() === category);
  if (q) out = out.filter((p) => (p.name || "").toLowerCase().includes(q));

  return res.json({ success: true, result: out.slice(0, limit), total: out.length });
});

app.get("/api/allergy-flags", (req, res) => {
  if (!allergyFlagsDb || !Array.isArray(allergyFlagsDb.products)) {
    return res.json({ success: true, result: [], disclaimer: null });
  }

  const productId = typeof req.query.product_id === "string" ? req.query.product_id.trim() : null;
  const ageGroup = typeof req.query.age_group === "string" ? req.query.age_group.trim() : null;
  const skinCondition = typeof req.query.skin_condition === "string" ? req.query.skin_condition.trim() : null;

  let products = allergyFlagsDb.products;
  if (productId) products = products.filter((p) => p.id === productId);

  const result = products.map((p) => {
    let flags = p.flags_by_profile || {};
    if (ageGroup && skinCondition) {
      const key = `${ageGroup}__${skinCondition}`;
      flags = { [key]: flags[key] || [] };
    } else if (ageGroup) {
      const filtered = {};
      for (const [k, v] of Object.entries(flags)) {
        if (k.startsWith(`${ageGroup}__`)) filtered[k] = v;
      }
      flags = filtered;
    } else if (skinCondition) {
      const filtered = {};
      for (const [k, v] of Object.entries(flags)) {
        if (k.endsWith(`__${skinCondition}`)) filtered[k] = v;
      }
      flags = filtered;
    }
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      has_any_flag: p.has_any_flag,
      matched_ingredients: p.matched_ingredients,
      flags_by_profile: flags,
    };
  });

  return res.json({
    success: true,
    disclaimer: allergyFlagsDb.disclaimer || null,
    result,
  });
});

app.get("/api/allergy-flags/:productId", (req, res) => {
  if (!allergyFlagsDb || !Array.isArray(allergyFlagsDb.products)) {
    return res.json({ success: false, message: "Allergy flags data not loaded" });
  }

  const product = allergyFlagsDb.products.find((p) => p.id === req.params.productId);
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found in allergy flags database" });
  }

  return res.json({
    success: true,
    disclaimer: allergyFlagsDb.disclaimer || null,
    result: product,
  });
});

app.post("/api/recommendations", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const cvScores = body.cvScores || body.cv_scores || body.cv || null;
  const climateData = body.climateData || body.climate_data || body.climate || null;

  const type = typeof body.type === "string" ? body.type.trim().toLowerCase() : null;
  const category = typeof body.category === "string" ? body.category.trim().toLowerCase() : null;
  const limitRaw = typeof body.limit === "number" || typeof body.limit === "string" ? Number(body.limit) : 12;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 12;

  const result = recommendProducts({
    catalog: enhancedCatalog,
    cvScores,
    climateData,
    type,
    category,
    limit,
    allergyFlagsDb,
  });

  return res.json({ success: true, result });
});

async function fetchEnvironmentData(req, latParam, lonParam) {
  let lat = parseCoord(latParam, -90, 90);
  let lon = parseCoord(lonParam, -180, 180);
  let ipLocation = null;

  if (lat == null || lon == null) {
    ipLocation = await ipGeolocate(req);
    if (!ipLocation) {
      throw new Error("Missing lat/lon and failed to resolve location from IP. Provide lat/lon query params.");
    }
    lat = ipLocation.latitude;
    lon = ipLocation.longitude;
  }

  if (!OPENWEATHER_API_KEY) {
    throw new Error("Missing API key. Set OPENWEATHER_API_KEY in api-server/.env.");
  }

  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Open-Meteo Air Quality API – free, no key required
  const openMeteoAQUrl = "https://air-quality-api.open-meteo.com/v1/air-quality";
  const weatherUrl = "https://api.openweathermap.org/data/2.5/weather";
  const oneCall4CurrentUrl = "https://api.openweathermap.org/data/4.0/onecall/current";

  const airReq = http
    .get(openMeteoAQUrl, {
      params: {
        latitude: lat,
        longitude: lon,
        current: [
          "us_aqi",
          "pm2_5",
          "pm10",
          "nitrogen_dioxide",
          "ozone",
          "sulphur_dioxide",
          "carbon_monoxide",
          "dust",
        ].join(","),
        timezone: "auto",
      },
    })
    .catch(() => null);

  const oneCall4Req = http
    .get(oneCall4CurrentUrl, {
      params: { lat, lon, appid: OPENWEATHER_API_KEY, units: "metric", lang: "en" },
    })
    .catch(() => null);

  const [oneCall4Res, airRes] = await Promise.all([oneCall4Req, airReq]);

  let temperature = null;
  let humidity = null;
  let mainWeather = null;
  let openWeatherSource = null;
  let feelsLike = null;
  let pressure = null;
  let dewPoint = null;
  let clouds = null;
  let visibility = null;
  let windSpeed = null;
  let windDeg = null;
  let sunrise = null;
  let sunset = null;
  let weatherDescription = null;
  let weatherIcon = null;
  let uvIndex = null;

  if (oneCall4Res?.data?.data?.[0]) {
    const current = oneCall4Res.data.data[0];
    temperature = current.temp ?? null;
    humidity = current.humidity ?? null;
    mainWeather = current.weather?.[0]?.main ?? null;
    feelsLike = current.feels_like ?? null;
    pressure = current.pressure ?? null;
    dewPoint = current.dew_point ?? null;
    clouds = current.clouds ?? null;
    visibility = current.visibility ?? null;
    windSpeed = current.wind_speed ?? null;
    windDeg = current.wind_deg ?? null;
    sunrise = current.sunrise ?? null;
    sunset = current.sunset ?? null;
    weatherDescription = current.weather?.[0]?.description ?? null;
    weatherIcon = current.weather?.[0]?.icon ?? null;
    uvIndex = current.uvi ?? current.uv_index ?? null;
    openWeatherSource = "onecall_4_current";
  } else {
    const weatherReq = http
      .get(weatherUrl, {
        params: { lat, lon, appid: OPENWEATHER_API_KEY, units: "metric" },
      })
      .catch(() => null);

    const weatherRes = await weatherReq;

    temperature = weatherRes?.data?.main?.temp ?? null;
    humidity = weatherRes?.data?.main?.humidity ?? null;
    feelsLike = weatherRes?.data?.main?.feels_like ?? null;
    pressure = weatherRes?.data?.main?.pressure ?? null;
    clouds = weatherRes?.data?.clouds?.all ?? null;
    visibility = weatherRes?.data?.visibility ?? null;
    windSpeed = weatherRes?.data?.wind?.speed ?? null;
    windDeg = weatherRes?.data?.wind?.deg ?? null;
    sunrise = weatherRes?.data?.sys?.sunrise ?? null;
    sunset = weatherRes?.data?.sys?.sunset ?? null;
    mainWeather = weatherRes?.data?.weather?.[0]?.main ?? null;
    weatherDescription = weatherRes?.data?.weather?.[0]?.description ?? null;
    weatherIcon = weatherRes?.data?.weather?.[0]?.icon ?? null;
    openWeatherSource = weatherRes ? "weather_2_5" : null;
  }

  // Open-Meteo Air Quality – current object
  const aqCurrent = airRes?.data?.current ?? null;
  const aqi = aqCurrent?.us_aqi ?? null;
  const pm2_5 = aqCurrent?.pm2_5 ?? null;
  const pm10 = aqCurrent?.pm10 ?? null;
  const no2 = aqCurrent?.nitrogen_dioxide ?? null;
  const o3 = aqCurrent?.ozone ?? null;
  const so2 = aqCurrent?.sulphur_dioxide ?? null;
  const co = aqCurrent?.carbon_monoxide ?? null;
  const dust = aqCurrent?.dust ?? null;

  // Derive dominant pollutant label from the highest concentration
  let pollutant = null;
  if (aqCurrent) {
    const candidates = [
      { key: "pm2_5", val: pm2_5 },
      { key: "pm10", val: pm10 },
      { key: "no2", val: no2 },
      { key: "o3", val: o3 },
      { key: "so2", val: so2 },
      { key: "co", val: co !== null ? co / 1000 : null }, // µg/m³ → mg/m³ scale
    ].filter((c) => c.val !== null);
    if (candidates.length) {
      pollutant = candidates.reduce((a, b) => (b.val > a.val ? b : a)).key;
    }
  }

  const stress = computeEnvironmentalStressScore({ humidity, aqi, temperature, uvIndex });

  const warnings = [];
  if (!aqCurrent) warnings.push("Air quality unavailable (Open-Meteo)");
  if (!openWeatherSource) warnings.push("Weather unavailable (OpenWeather)");

  const skinClimateData = {
    latitude: lat,
    longitude: lon,
    location_source: ipLocation ? "ip" : "gps",
    location_hint: ipLocation
      ? { city: ipLocation.city, region: ipLocation.region, country: ipLocation.country }
      : null,
    fetched_at: new Date().toISOString(),
    temperature_c: temperature,
    feels_like_c: feelsLike,
    pressure_hpa: pressure,
    humidity_pct: humidity,
    dew_point_c: dewPoint,
    clouds_pct: clouds,
    visibility_m: visibility,
    wind_speed_ms: windSpeed,
    wind_deg: windDeg,
    sunrise_unix: sunrise,
    sunset_unix: sunset,
    aqi_us: aqi,
    pm2_5,
    pm10,
    no2,
    ozone: o3,
    so2,
    co,
    dust,
    dominant_pollutant: pollutant,
    main_weather: mainWeather,
    weather_description: weatherDescription,
    weather_icon: weatherIcon,
    uv_index: uvIndex,
    sources: {
      openweather: openWeatherSource,
      air_quality: aqCurrent ? "open-meteo" : null,
    },
    ...stress,
    warnings,
  };

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data: skinClimateData });
  return skinClimateData;
}

app.get("/api/environment", async (req, res) => {
  try {
    const data = await fetchEnvironmentData(req, req.query.lat, req.query.lon);
    return res.json({ success: true, result: data });
  } catch (error) {
    const status = error.message.includes("API keys") ? 500 : 400;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch environmental data.",
    });
  }
});

if (require.main === module) {
  startServer(PORT).catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
};
