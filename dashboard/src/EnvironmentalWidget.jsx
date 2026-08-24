import { useEffect, useMemo, useState } from "react";
import { getEnvironmentQuery } from "./location";

function formatNum(value, suffix = "") {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value))
    return `${value}${suffix}`;
  return `${value}${suffix}`;
}

function buildOsmEmbedUrl(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const latDelta = 0.02;
  const lonDelta = 0.02;

  const left = lon - lonDelta;
  const right = lon + lonDelta;
  const bottom = lat - latDelta;
  const top = lat + latDelta;

  const params = new URLSearchParams();
  params.set("bbox", `${left},${bottom},${right},${top}`);
  params.set("layer", "mapnik");
  params.set("marker", `${lat},${lon}`);

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

export default function EnvironmentalWidget() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const apiUrl = useMemo(() => {
    return "http://127.0.0.1:5000/api/environment";
  }, []);

  async function fetchEnvironment() {
    setError("");
    setLoading(true);
    try {
      const locationQuery = await getEnvironmentQuery();
      const res = await fetch(`${apiUrl}${locationQuery}`);
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message || `Request failed (${res.status})`);
      }
      if (!body?.success) {
        throw new Error(body?.message || "Failed to load environment data");
      }

      setData(body.result || null);
    } catch (e) {
      setError(e?.message || "Failed to load environment data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEnvironment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const humidity = data?.humidity_pct ?? null;
  const aqi = data?.aqi_us ?? null;
  const lat = typeof data?.latitude === "number" ? data.latitude : null;
  const lon = typeof data?.longitude === "number" ? data.longitude : null;
  const mapSrc = lat != null && lon != null ? buildOsmEmbedUrl(lat, lon) : null;
  const hint = data?.location_hint;

  return (
    <div>
      {loading ? (
        <div className="muted">Scanning local environment…</div>
      ) : null}
      {error ? <div className="alert error">{error}</div> : null}

      {!loading && !data && !error ? (
        <div className="muted">Could not load environmental data.</div>
      ) : null}

      {!loading && data ? (
        <>
          <div className="envGrid">
            <EnvMetric
              label="Temperature"
              value={formatNum(data.temperature_c, "°C")}
            />
            <EnvMetric
              label="Humidity"
              value={formatNum(data.humidity_pct, "%")}
            />
            <EnvMetric
              label="Air quality (AQI US)"
              value={formatNum(data.aqi_us)}
            />
            <EnvMetric label="Weather" value={formatNum(data.main_weather)} />

            {mapSrc ? (
              <div className="miniMapShell">
                <iframe
                  className="miniMap"
                  title="Location map"
                  src={mapSrc}
                  loading="lazy"
                />
                <div className="miniMapMeta">
                  <div className="miniMapTitle">
                    {data.location_source === "gps"
                      ? "Current location (GPS)"
                      : "Approx location (IP)"}
                  </div>
                  <div className="miniMapSub">
                    {hint?.city || hint?.region || hint?.country
                      ? [hint?.city, hint?.region, hint?.country]
                          .filter(Boolean)
                          .join(", ")
                      : `${lat.toFixed(3)}, ${lon.toFixed(3)}`}
                  </div>
                </div>
              </div>
            ) : null}

            <EnvMetric
              label="Environmental stress (1–100)"
              value={formatNum(data.environmental_stress_score)}
            />
          </div>

          {Array.isArray(data.warnings) && data.warnings.length ? (
            <div className="muted" style={{ marginTop: 10 }}>
              {data.warnings.join(" · ")}
            </div>
          ) : null}

          {humidity != null && humidity > 70 ? (
            <div className="alert">
              High humidity detected: prefer lightweight gel moisturizers today.
            </div>
          ) : null}
          {humidity != null && humidity < 30 ? (
            <div className="alert">
              Low humidity detected: prioritize barrier support + richer
              moisturizers.
            </div>
          ) : null}
          {aqi != null && aqi > 100 ? (
            <div className="alert">
              High pollution: consider antioxidants (e.g., Vitamin C) and gentle
              cleansing.
            </div>
          ) : null}

          <div className="envActions">
            <button
              type="button"
              onClick={() => {
                fetchEnvironment();
              }}
              disabled={loading}
            >
              Refresh
            </button>
            {lat != null && lon != null ? (
              <div className="muted">
                Using approx coords: {lat.toFixed(4)}, {lon.toFixed(4)}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function EnvMetric({ label, value }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
