import { useState, useEffect, useRef, useMemo } from "react";
import "./ScanResults.css";

/* ──────────────────────────────────────────────
   METRIC DEFINITIONS
   ────────────────────────────────────────────── */
const SCORE_METRICS = [
  {
    key: "blur_score",
    label: "Blur",
    short: "Blur",
    color: "#7c3aed",
    max: 500,
  },
  {
    key: "brightness_score",
    label: "Brightness",
    short: "Bright",
    color: "#818cf8",
    max: 100,
  },
  {
    key: "texture_score",
    label: "Texture",
    short: "Texture",
    color: "#06b6d4",
    max: 100,
  },
  {
    key: "wrinkle_score",
    label: "Wrinkle",
    short: "Wrinkle",
    color: "#22d3ee",
    max: 100,
  },
  {
    key: "pigmentation_score",
    label: "Pigmentation",
    short: "Pigment",
    color: "#c026d3",
    max: 100,
  },
  {
    key: "contrast_score",
    label: "Contrast",
    short: "Contrast",
    color: "#e879f9",
    max: 100,
  },
  {
    key: "redness_score",
    label: "Redness",
    short: "Redness",
    color: "#f43f5e",
    max: 100,
  },
  {
    key: "shine_score",
    label: "Shine",
    short: "Shine",
    color: "#f59e0b",
    max: 100,
  },
  {
    key: "under_eye_shadow_score",
    label: "Under-Eye",
    short: "Eye",
    color: "#a78bfa",
    max: 100,
  },
  {
    key: "pore_score",
    label: "Pore",
    short: "Pore",
    color: "#34d399",
    max: 100,
  },
  {
    key: "symmetry_score",
    label: "Symmetry",
    short: "Symmetry",
    color: "#2dd4bf",
    max: 100,
  },
];

const INFO_METRICS = [
  { key: "age", label: "Age", icon: "user" },
  { key: "gender", label: "Gender", icon: "user" },
  { key: "skin_tone", label: "Skin Tone", icon: "palette" },
  { key: "undertone", label: "Undertone", icon: "droplet" },
  { key: "ita_score", label: "ITA Score", icon: "sun" },
  { key: "skin_type", label: "Skin Type", icon: "sparkles" },
];

function getVal(result, key) {
  const v = result?.[key];
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ──────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────── */
export default function ScanResults({ result }) {
  const [activeMetric, setActiveMetric] = useState(null);
  const [animate, setAnimate] = useState(false);

  // Trigger animations on mount / result change
  useEffect(() => {
    setAnimate(false);
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true));
    });
    return () => cancelAnimationFrame(t);
  }, [result]);

  const scores = useMemo(() => {
    return SCORE_METRICS.map((m) => ({
      ...m,
      value: getVal(result, m.key),
    })).filter((m) => m.value !== null);
  }, [result]);

  // Normalize each score independently against its own expected max
  const normalized = useMemo(
    () =>
      scores.map((s) => ({
        ...s,
        pct: Math.min(Math.max((s.value / (s.max || 100)) * 100, 0), 100),
      })),
    [scores],
  );

  // Overall score average
  const overallScore = useMemo(() => {
    if (!normalized.length) return 0;
    return Math.round(
      normalized.reduce((a, s) => a + s.pct, 0) / normalized.length,
    );
  }, [normalized]);

  if (!result) return null;

  return (
    <div className={`scan-viz ${animate ? "scan-viz--animated" : ""}`}>
      {/* ── Top Row: Quality + Info Cards ── */}
      <div className="scan-top-row">
        <OverallGauge
          score={overallScore}
          quality={result.image_quality}
          animate={animate}
        />
        <div className="scan-info-cards">
          {INFO_METRICS.map((m) => {
            const val = result?.[m.key];
            return (
              <div className="scan-info-card" key={m.key}>
                <InfoIcon type={m.icon} />
                <div>
                  <div className="scan-info-label">{m.label}</div>
                  <div className="scan-info-value">{val ?? "—"}</div>
                </div>
              </div>
            );
          })}
          {result.message && (
            <div className="scan-info-card scan-info-card--warn">
              <InfoIcon type="alert" />
              <div>
                <div className="scan-info-label">Note</div>
                <div className="scan-info-value">{result.message}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Charts Row: Radar + Bar Chart ── */}
      <div className="scan-charts-row">
        <div className="scan-chart-container">
          <div className="scan-chart-title">Score Distribution</div>
          <RadarChart
            data={normalized}
            animate={animate}
            activeMetric={activeMetric}
            onHover={setActiveMetric}
          />
        </div>
        <div className="scan-chart-container">
          <div className="scan-chart-title">Individual Scores</div>
          <BarChart
            data={normalized}
            animate={animate}
            activeMetric={activeMetric}
            onHover={setActiveMetric}
          />
        </div>
      </div>

      {/* ── Gauge Rings Row ── */}
      <div className="scan-gauges-row">
        {normalized.slice(0, 8).map((m, i) => (
          <GaugeRing
            key={m.key}
            label={m.short}
            value={m.value}
            pct={m.pct}
            color={m.color}
            delay={i * 80}
            animate={animate}
            active={activeMetric === m.key}
            onMouseEnter={() => setActiveMetric(m.key)}
            onMouseLeave={() => setActiveMetric(null)}
          />
        ))}
      </div>

      {/* ── Disclaimer ── */}
      <div className="scan-disclaimer">
        These results are estimated using computer vision image analysis and are
        not a medical diagnosis. Lighting, camera quality, facial hair, makeup,
        and shadows may affect the scores.
      </div>

    </div>
  );
}

/* ──────────────────────────────────────────────
   OVERALL GAUGE — Big central score ring
   ────────────────────────────────────────────── */
function OverallGauge({ score, quality, animate }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * (animate ? score : 0)) / 100;

  const qualityColor =
    quality === "Good" ? "#22c55e" : quality === "Fair" ? "#f59e0b" : "#ef4444";

  return (
    <div className="overall-gauge">
      <svg viewBox="0 0 140 140" className="overall-gauge-svg">
        {/* Track */}
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="rgba(124,58,237,0.08)"
          strokeWidth="10"
        />
        {/* Progress */}
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{
            transition: animate
              ? "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)"
              : "none",
          }}
        />
        {/* Glow */}
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          filter="url(#glow)"
          opacity="0.4"
          style={{
            transition: animate
              ? "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)"
              : "none",
          }}
        />
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <div className="overall-gauge-text">
        <div className="overall-gauge-score">{animate ? score : 0}</div>
        <div className="overall-gauge-label">Overall</div>
      </div>
      <div className="overall-gauge-quality" style={{ color: qualityColor }}>
        <span
          className="overall-gauge-dot"
          style={{ background: qualityColor }}
        />
        {quality || "—"}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   RADAR CHART — Spider web visualization
   ────────────────────────────────────────────── */
function RadarChart({ data, animate, activeMetric, onHover }) {
  const svgRef = useRef(null);
  const cx = 150,
    cy = 150,
    maxR = 110;
  const n = data.length;

  if (n < 3)
    return <div className="muted">Need at least 3 scores for radar chart.</div>;

  const angleStep = (2 * Math.PI) / n;

  // Generate concentric grid
  const gridLevels = [20, 40, 60, 80, 100];
  const gridLines = gridLevels.map((pct) => {
    const r = (pct / 100) * maxR;
    const pts = data.map((_, i) => {
      const a = angleStep * i - Math.PI / 2;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    });
    return pts.join(" ");
  });

  // Axes
  const axes = data.map((_, i) => {
    const a = angleStep * i - Math.PI / 2;
    return {
      x2: cx + maxR * Math.cos(a),
      y2: cy + maxR * Math.sin(a),
    };
  });

  // Data polygon
  const dataPoints = data.map((d, i) => {
    const a = angleStep * i - Math.PI / 2;
    const r = ((animate ? d.pct : 0) / 100) * maxR;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  const dataPoly = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Labels
  const labels = data.map((d, i) => {
    const a = angleStep * i - Math.PI / 2;
    const lr = maxR + 22;
    return {
      x: cx + lr * Math.cos(a),
      y: cy + lr * Math.sin(a),
      label: d.short,
      key: d.key,
    };
  });

  return (
    <svg ref={svgRef} viewBox="0 0 300 300" className="radar-svg">
      <defs>
        <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <filter id="radarGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Grid */}
      {gridLines.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="rgba(124,58,237,0.08)"
          strokeWidth="0.8"
        />
      ))}

      {/* Axes */}
      {axes.map((ax, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={ax.x2}
          y2={ax.y2}
          stroke="rgba(124,58,237,0.06)"
          strokeWidth="0.8"
        />
      ))}

      {/* Data polygon */}
      <polygon
        points={dataPoly}
        fill="url(#radarFill)"
        stroke="url(#radarStroke)"
        strokeWidth="2"
        strokeLinejoin="round"
        style={{
          transition: animate ? "all 1.2s cubic-bezier(0.4,0,0.2,1)" : "none",
        }}
      />
      <polygon
        points={dataPoly}
        fill="none"
        stroke="url(#radarStroke)"
        strokeWidth="2"
        strokeLinejoin="round"
        filter="url(#radarGlow)"
        opacity="0.5"
        style={{
          transition: animate ? "all 1.2s cubic-bezier(0.4,0,0.2,1)" : "none",
        }}
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <g key={data[i].key}>
          <circle
            cx={p.x}
            cy={p.y}
            r={activeMetric === data[i].key ? 6 : 4}
            fill={data[i].color}
            stroke="#0a0a14"
            strokeWidth="2"
            style={{
              transition:
                "all 0.3s, cx 1.2s cubic-bezier(0.4,0,0.2,1), cy 1.2s cubic-bezier(0.4,0,0.2,1)",
              cursor: "pointer",
            }}
            onMouseEnter={() => onHover(data[i].key)}
            onMouseLeave={() => onHover(null)}
          />
          {activeMetric === data[i].key && (
            <circle
              cx={p.x}
              cy={p.y}
              r="10"
              fill={data[i].color}
              opacity="0.15"
            />
          )}
        </g>
      ))}

      {/* Labels */}
      {labels.map((l) => (
        <text
          key={l.key}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={activeMetric === l.key ? "#f3f4f6" : "rgba(156,163,175,0.6)"}
          fontSize="10"
          fontFamily="Inter, sans-serif"
          fontWeight={activeMetric === l.key ? "600" : "400"}
          style={{ transition: "all 0.3s", cursor: "pointer" }}
          onMouseEnter={() => onHover(l.key)}
          onMouseLeave={() => onHover(null)}
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}

/* ──────────────────────────────────────────────
   BAR CHART — Horizontal animated bars
   ────────────────────────────────────────────── */
function BarChart({ data, animate, activeMetric, onHover }) {
  const barH = 24;
  const gap = 8;
  const labelW = 62;
  const valueW = 44;
  const chartW = 300;
  const barArea = chartW - labelW - valueW - 10;
  const svgH = data.length * (barH + gap) + gap;

  return (
    <div className="bar-chart-scroll">
      <svg
        viewBox={`0 0 ${chartW} ${svgH}`}
        className="bar-svg"
        style={{ height: svgH }}
      >
        <defs>
          {data.map((d) => (
            <linearGradient
              key={d.key}
              id={`bar-${d.key}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor={d.color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={d.color} stopOpacity="0.4" />
            </linearGradient>
          ))}
          <filter id="barGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {data.map((d, i) => {
          const y = gap + i * (barH + gap);
          const w = animate ? (d.pct / 100) * barArea : 0;
          const isActive = activeMetric === d.key;

          return (
            <g
              key={d.key}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => onHover(d.key)}
              onMouseLeave={() => onHover(null)}
            >
              {/* Label */}
              <text
                x="0"
                y={y + barH / 2}
                dominantBaseline="central"
                fill={isActive ? "#f3f4f6" : "rgba(156,163,175,0.65)"}
                fontSize="10"
                fontFamily="Inter, sans-serif"
                fontWeight={isActive ? "600" : "400"}
                style={{ transition: "fill 0.3s" }}
              >
                {d.short}
              </text>

              {/* Track */}
              <rect
                x={labelW}
                y={y}
                width={barArea}
                height={barH}
                rx="6"
                ry="6"
                fill="rgba(124,58,237,0.05)"
              />

              {/* Bar */}
              <rect
                x={labelW}
                y={y}
                width={Math.max(w, 0)}
                height={barH}
                rx="6"
                ry="6"
                fill={`url(#bar-${d.key})`}
                style={{
                  transition: animate
                    ? `width 1s cubic-bezier(0.4,0,0.2,1) ${i * 60}ms`
                    : "none",
                }}
              />

              {/* Glow on active */}
              {isActive && (
                <rect
                  x={labelW}
                  y={y}
                  width={Math.max(w, 0)}
                  height={barH}
                  rx="6"
                  ry="6"
                  fill={d.color}
                  opacity="0.15"
                  filter="url(#barGlow)"
                />
              )}

              {/* Value */}
              <text
                x={chartW}
                y={y + barH / 2}
                textAnchor="end"
                dominantBaseline="central"
                fill={isActive ? d.color : "rgba(156,163,175,0.5)"}
                fontSize="11"
                fontFamily="Inter, sans-serif"
                fontWeight="600"
                style={{ transition: "fill 0.3s" }}
              >
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────
   GAUGE RING — Individual metric ring
   ────────────────────────────────────────────── */
function GaugeRing({
  label,
  value,
  pct,
  color,
  delay,
  animate,
  active,
  onMouseEnter,
  onMouseLeave,
}) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * (animate ? pct : 0)) / 100;

  return (
    <div
      className={`gauge-ring ${active ? "gauge-ring--active" : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <svg viewBox="0 0 80 80" className="gauge-ring-svg">
        <defs>
          <filter id={`glow-${label}`}>
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="5"
        />
        {/* Progress */}
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
          style={{
            transition: animate
              ? `stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1) ${delay}ms`
              : "none",
          }}
        />
        {/* Glow */}
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
          filter={`url(#glow-${label})`}
          opacity="0.3"
          style={{
            transition: animate
              ? `stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1) ${delay}ms`
              : "none",
          }}
        />
      </svg>
      <div className="gauge-ring-value" style={{ color }}>
        {value}
      </div>
      <div className="gauge-ring-label">{label}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   INFO ICON helper
   ────────────────────────────────────────────── */
function InfoIcon({ type }) {
  const icons = {
    palette: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
        <circle cx="6.5" cy="12" r=".5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
      </svg>
    ),
    droplet: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    ),
    sun: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
    sparkles: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
        <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z" />
        <path d="M5 15l.75 2.25L8 18l-2.25.75L5 21l-.75-2.25L2 18l2.25-.75z" />
      </svg>
    ),
    alert: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  };
  return <div className="scan-info-icon">{icons[type]}</div>;
}
