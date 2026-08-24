import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import "./ProfilePage.css";
import { getScanHistory, updateUserProfile } from "./authService";

/* ── Custom Icons ── */
const Icons = {
  home: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  ),
  dashboard: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </svg>
  ),
  logout: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  ),
};

export default function ProfilePage({
  user,
  onLogout,
  onGoHome,
  onGoToDashboard,
}) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileUser, setProfileUser] = useState(user);

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        const history = await getScanHistory();
        if (!cancelled) setHistory(Array.isArray(history) ? history : []);
      } catch (error) {
        if (!cancelled) {
          setHistory([]);
          setError("Unable to load history.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const initials = (profileUser?.name || profileUser?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function saveName(e) {
    e.preventDefault();
    const trimmed = profileName.trim();
    if (!trimmed) return;

    setProfileUser((p) => ({ ...p, name: trimmed }));
    setIsEditing(false);

    // Update on backend
    updateUserProfile(trimmed).catch((err) => {
      console.error("Failed to update profile:", err);
    });
  }

  // Derived data for charts
  const getScore = (item) => {
    const sr = item.scanResult || {};
    const sm = item.summary || {};
    const d = sm.overallScore ?? sr.overall_score ?? sr.overallScore;
    if (typeof d === "number" && Number.isFinite(d)) return Math.round(d);
    const metrics = [
      sm.blurScore,
      sm.brightnessScore,
      sm.textureScore,
      sm.symmetryScore,
      sr.blur_score,
      sr.brightness_score,
      sr.symmetry_score,
    ].filter((v) => typeof v === "number" && Number.isFinite(v));
    return metrics.length
      ? Math.round(metrics.reduce((a, b) => a + b, 0) / metrics.length)
      : 75;
  };

  const chartData = useMemo(() => {
    if (!history.length) return [];
    // Sort chronological for chart
    return [...history]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((item) => {
        const date = new Date(item.createdAt);
        return {
          date: date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          }),
          fullDate: date.toLocaleString(),
          score: getScore(item),
        };
      });
  }, [history]);

  const radarData = useMemo(() => {
    if (!history.length) return [];
    // Get latest scan
    const latest = history[0];
    const sr = latest.scanResult || {};
    const sm = latest.summary || {};

    const getVal = (k1, k2, defaultVal = 70) => {
      if (typeof sm[k1] === "number") return sm[k1];
      if (typeof sr[k2] === "number") return sr[k2];
      return defaultVal;
    };

    return [
      {
        subject: "Texture",
        A: getVal("textureScore", "texture_score", 80),
        fullMark: 100,
      },
      {
        subject: "Brightness",
        A: getVal("brightnessScore", "brightness_score", 75),
        fullMark: 100,
      },
      {
        subject: "Symmetry",
        A: getVal("symmetryScore", "symmetry_score", 85),
        fullMark: 100,
      },
      {
        subject: "Clarity",
        A: getVal("blurScore", "blur_score", 90),
        fullMark: 100,
      },
      { subject: "Overall", A: getScore(latest), fullMark: 100 },
    ];
  }, [history]);

  // Custom Tooltip for Line Chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: "#fff",
            padding: "12px",
            border: "1px solid rgba(200,132,122,0.2)",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(200,132,122,0.15)",
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              fontWeight: 600,
              color: "#2c2c2c",
              fontSize: "13px",
            }}
          >
            {payload[0].payload.fullDate}
          </p>
          <p
            style={{
              margin: 0,
              color: "#c8847a",
              fontWeight: 700,
              fontSize: "16px",
            }}
          >
            Score: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="profile-page">
      {/* HEADER */}
      <header className="profile-header">
        <div className="profile-header-left">
          <button className="profile-nav-btn" onClick={onGoHome}>
            {Icons.home} Home
          </button>
          <div className="profile-title">Profile & History</div>
        </div>
        <div className="profile-header-right">
          <button
            className="profile-nav-btn profile-nav-btn--primary"
            onClick={onGoToDashboard}
          >
            {Icons.dashboard} Scan Dashboard
          </button>
          <button className="profile-nav-btn" onClick={onLogout}>
            {Icons.logout} Sign Out
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <div className="profile-content">
        {/* User Card */}
        <section className="profile-user-card">
          <div className="profile-user-info">
            <div className="profile-avatar-large">{initials}</div>
            <div>
              <div className="profile-name">{profileUser?.name || "User"}</div>
              <div className="profile-email">{profileUser?.email}</div>
              {isEditing ? (
                <form className="profile-edit-form" onSubmit={saveName}>
                  <input
                    type="text"
                    className="profile-edit-input"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Enter your name"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="profile-nav-btn profile-nav-btn--primary"
                    style={{ padding: "8px 16px" }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="profile-nav-btn"
                    style={{ padding: "8px 16px" }}
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="profile-nav-btn"
                  style={{
                    marginTop: "12px",
                    padding: "6px 14px",
                    fontSize: "12px",
                  }}
                  onClick={() => {
                    setProfileName(profileUser?.name || "");
                    setIsEditing(true);
                  }}
                >
                  Edit Name
                </button>
              )}
            </div>
          </div>
        </section>

        {history.length > 0 && (
          <section className="profile-charts-grid">
            {/* Score Trend (Line Chart) */}
            <div className="profile-chart-card">
              <div className="profile-chart-header">
                <div className="profile-chart-title">Overall Score Trend</div>
                <div className="profile-chart-subtitle">
                  Progression of your skin health over time
                </div>
              </div>
              <div className="profile-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(200,132,122,0.15)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#6b7280"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis
                      stroke="#6b7280"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dx={-10}
                      domain={["dataMin - 5", "dataMax + 5"]}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{
                        stroke: "rgba(200,132,122,0.2)",
                        strokeWidth: 2,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#c8847a"
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        fill: "#c8847a",
                        strokeWidth: 2,
                        stroke: "#fff",
                      }}
                      activeDot={{ r: 6, fill: "#a8645a", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Latest Scan Metrics (Radar Chart) */}
            <div className="profile-chart-card">
              <div className="profile-chart-header">
                <div className="profile-chart-title">Latest Scan Metrics</div>
                <div className="profile-chart-subtitle">
                  Breakdown of your most recent scan
                </div>
              </div>
              <div className="profile-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                    data={radarData}
                  >
                    <PolarGrid stroke="rgba(200,132,122,0.2)" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "#6b7280", fontSize: 11, fontWeight: 500 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name="Score"
                      dataKey="A"
                      stroke="#c8847a"
                      strokeWidth={2}
                      fill="#c8847a"
                      fillOpacity={0.25}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid rgba(200,132,122,0.2)",
                      }}
                      itemStyle={{ color: "#c8847a", fontWeight: 600 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* History Table */}
        <section className="profile-history-card">
          <div className="profile-history-title">
            Scan History
            <span className="profile-history-count">
              {history.length} scans
            </span>
          </div>

          {loading ? (
            <div className="profile-empty">Loading your scan history...</div>
          ) : error ? (
            <div className="profile-empty">{error}</div>
          ) : history.length === 0 ? (
            <div className="profile-empty">
              No scans yet — go to the Dashboard and upload your first image to
              begin tracking your skin health.
              <br />
              <br />
              <button
                className="profile-nav-btn profile-nav-btn--primary"
                style={{ display: "inline-flex", margin: "0 auto" }}
                onClick={onGoToDashboard}
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <table className="profile-history-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Skin Tone</th>
                  <th>Undertone</th>
                  <th style={{ textAlign: "right" }}>Overall Score</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => {
                  const sm = item.summary || {};
                  const sr = item.scanResult || {};
                  const score = getScore(item);
                  const skinTone = sm.skinTone || sr.skin_tone || "—";
                  const undertone = sm.undertone || sr.undertone || "—";
                  const date = new Date(item.createdAt);

                  return (
                    <tr key={item._id || idx} className="profile-history-row">
                      <td>
                        <div className="ph-date">
                          {date.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div className="ph-time">
                          {date.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td>
                        <div className="ph-metric">{skinTone}</div>
                        <div className="ph-metric-sub">Detected tone</div>
                      </td>
                      <td>
                        <div className="ph-metric">{undertone}</div>
                        <div className="ph-metric-sub">Base undertone</div>
                      </td>
                      <td>
                        <div className="ph-score">{score}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
