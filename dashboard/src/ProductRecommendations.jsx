import { useEffect, useMemo, useState } from "react";
import { getEnvironmentQuery } from "./location";

function formatMoney(price, currency) {
  if (price === undefined || price === null || price === "") return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  return `${n.toFixed(2)} ${currency || ""}`.trim();
}

function formatCategory(cat) {
  return String(cat || "other")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function riskColor(risk) {
  if (risk === "elevated") return "flag-elevated";
  return "flag-standard";
}

function riskIcon(risk) {
  return risk === "elevated" ? "⚠" : "ℹ";
}

const SKINCARE_ORDER = [
  "sunscreen",
  "cleanser",
  "moisturizer",
  "serum",
  "toner",
  "mask",
  "exfoliator",
  "oil",
  "mist",
  "eye_care",
  "peel",
  "balm",
  "body_wash",
];

const MAKEUP_ORDER = [
  "foundation",
  "concealer",
  "powder",
  "primer",
  "blush",
  "bronzer",
  "highlighter",
  "lipstick",
  "lip_gloss",
  "lip_liner",
  "mascara",
  "eyeliner",
  "eyeshadow",
  "brow",
  "setting_spray",
];

export default function ProductRecommendations({ cvScores }) {
  const scanReady = Boolean(cvScores && cvScores.image_quality === "Good");
  const cvPayload = useMemo(() => {
    if (!cvScores || typeof cvScores !== "object") return null;
    return {
      image_quality: cvScores.image_quality,
      skin_tone: cvScores.skin_tone,
      undertone: cvScores.undertone,
      pigmentation_score: cvScores.pigmentation_score,
      wrinkle_score: cvScores.wrinkle_score,
      texture_score: cvScores.texture_score,
      redness_score: cvScores.redness_score,
      shine_score: cvScores.shine_score,
      age: cvScores.age,
      gender: cvScores.gender,
    };
  }, [cvScores]);

  const [activeTab, setActiveTab] = useState("skincare");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [skincareItems, setSkincareItems] = useState([]);
  const [makeupItems, setMakeupItems] = useState([]);
  const [safetyAlerts, setSafetyAlerts] = useState([]);
  const [expandedFlags, setExpandedFlags] = useState({});
  const [sriLankaOnly, setSriLankaOnly] = useState(false);

  function isSriLankanProduct(product) {
    return Boolean(
      product?.sri_lanka || product?.sri_lankan || product?.source === "slprod",
    );
  }

  // Generate unique, personalized limits for each person based on their skin profile
  const [skincareLimit, makeupLimit] = useMemo(() => {
    if (!cvPayload) return [24, 24];
    const seed = `${cvPayload.age}_${cvPayload.skin_tone}_${cvPayload.wrinkle_score}_${cvPayload.redness_score}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    const hashAbs = Math.abs(hash);
    // Skincare limit: between 14 and 24
    const sLimit = 14 + (hashAbs % 11);
    // Makeup limit: between 10 and 22
    const mLimit = 10 + ((hashAbs >> 3) % 13);
    return [sLimit, mLimit];
  }, [cvPayload]);

  const apiBase = useMemo(() => "http://127.0.0.1:5000", []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!scanReady) {
        setLoading(false);
        setError("");
        setSkincareItems([]);
        setMakeupItems([]);
        setSafetyAlerts([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const locationQuery = await getEnvironmentQuery();
        const envRes = await fetch(
          `${apiBase}/api/environment${locationQuery}`,
        ).then((r) => r.json().catch(() => null));
        if (!envRes?.success)
          throw new Error(envRes?.message || "Failed to load environment");

        const [skincareRes, makeupRes] = await Promise.all([
          fetch(`${apiBase}/api/recommendations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cvScores: cvPayload,
              climateData: envRes.result || null,
              type: "skincare",
              limit: skincareLimit,
            }),
          }).then((r) => r.json().catch(() => null)),
          fetch(`${apiBase}/api/recommendations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cvScores: cvPayload,
              climateData: envRes.result || null,
              type: "makeup",
              limit: makeupLimit,
            }),
          }).then((r) => r.json().catch(() => null)),
        ]);

        if (!cancelled) {
          if (skincareRes?.success) {
            setSkincareItems(
              Array.isArray(skincareRes.result?.items)
                ? skincareRes.result.items
                : [],
            );
            setSafetyAlerts(
              Array.isArray(skincareRes.result?.safety_alerts)
                ? skincareRes.result.safety_alerts
                : [],
            );
          }
          if (makeupRes?.success) {
            setMakeupItems(
              Array.isArray(makeupRes.result?.items)
                ? makeupRes.result.items
                : [],
            );
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Failed to load recommendations");
          setSkincareItems([]);
          setMakeupItems([]);
          setSafetyAlerts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [apiBase, cvPayload, scanReady]);

  const items = activeTab === "skincare" ? skincareItems : makeupItems;
  const sriLankaItems = items.filter((it) =>
    isSriLankanProduct(it.product || {}),
  );
  const filteredItems = sriLankaOnly ? sriLankaItems : items;
  const categoryOrder =
    activeTab === "skincare" ? SKINCARE_ORDER : MAKEUP_ORDER;

  const grouped = useMemo(() => {
    const groups = {};
    for (const it of filteredItems) {
      const category = (it?.product?.category || "other").toString();
      if (!groups[category]) groups[category] = [];
      groups[category].push(it);
    }

    const keys = Object.keys(groups);
    keys.sort((a, b) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return keys.map((k) => ({ category: k, items: groups[k] }));
  }, [filteredItems, categoryOrder]);

  function toggleFlags(productId) {
    setExpandedFlags((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }

  if (!scanReady) {
    if (
      cvScores &&
      cvScores.image_quality &&
      cvScores.image_quality !== "Good"
    ) {
      return (
        <div className="muted">
          Scan quality: <b>{cvScores.image_quality}</b>. Upload a clearer image
          and scan again to get product matches.
        </div>
      );
    }
    return (
      <div className="muted">
        Upload & scan an image to see product matches.
      </div>
    );
  }
  if (loading) return <div className="muted">Finding best-fit products...</div>;
  if (error) return <div className="alert error">{error}</div>;

  return (
    <>
      {/* Skincare / Makeup Toggle */}
      <div
        className="product-type-toggle"
        role="tablist"
        aria-label="Product type selector"
      >
        <button
          type="button"
          className={`type-pill ${activeTab === "skincare" ? "active" : ""}`}
          onClick={() => setActiveTab("skincare")}
          role="tab"
          aria-selected={activeTab === "skincare"}
        >
          <span className="type-pill-icon">🧴</span>
          Skincare
          {skincareItems.length > 0 && (
            <span className="type-pill-count">{skincareItems.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`type-pill ${activeTab === "makeup" ? "active" : ""}`}
          onClick={() => setActiveTab("makeup")}
          role="tab"
          aria-selected={activeTab === "makeup"}
        >
          <span className="type-pill-icon">💄</span>
          Makeup
          {makeupItems.length > 0 && (
            <span className="type-pill-count">{makeupItems.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`type-pill ${sriLankaOnly ? "active" : ""}`}
          onClick={() => setSriLankaOnly((prev) => !prev)}
          aria-pressed={sriLankaOnly}
        >
          <span className="type-pill-icon">🇱🇰</span>
          Sri Lanka
          <span className="type-pill-count">{sriLankaItems.length}</span>
        </button>
      </div>

      <div className="product-legend">
        <span className="legend-dot sri-lanka" aria-hidden="true" />
        <span className="sri-lanka-legend-icon" aria-hidden="true">
          🏝️
        </span>
        Sri Lanka
      </div>
      <div className="sri-lanka-description">
        Discover curated Sri Lankan favorites and island-inspired essentials
        with bold, vibrant appeal.
      </div>

      {safetyAlerts?.length && activeTab === "skincare" ? (
        <div className="alert warn" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Safety alerts</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {safetyAlerts.slice(0, 3).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!items.length ? (
        <div className="muted" style={{ padding: "24px 0" }}>
          No {activeTab} recommendations available. Try scanning a clearer
          image.
        </div>
      ) : (
        grouped.map(({ category, items: catItems }) => (
          <div key={category} style={{ marginBottom: 16 }}>
            <div className="category-heading">{formatCategory(category)}</div>
            <div className="productsGrid">
              {catItems.slice(0, 6).map((it) => {
                const p = it.product || {};
                const score = it.score;
                const price = formatMoney(p.price, p.currency);
                const flags = Array.isArray(it.allergy_flags)
                  ? it.allergy_flags
                  : [];
                const productId = p.id || p.name;
                const flagsExpanded = expandedFlags[productId];
                const hasElevated = flags.some(
                  (f) => f.risk === "elevated" || f.severity === "high",
                );
                const isSriLankan = Boolean(
                  p.sri_lanka || p.sri_lankan || p.source === "slprod",
                );

                return (
                  <div
                    className={`productCard${isSriLankan ? " sri-lanka" : ""}`}
                    key={productId}
                  >
                    <div className="productTop">
                      <div className="productName" title={p.name}>
                        {p.name}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 6,
                        }}
                      >
                        <div className="productScore" title="Suitability score">
                          {score}
                        </div>
                        {isSriLankan ? (
                          <span className="sri-lanka-badge">🏝️ Sri Lanka</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="productMetaRow">
                      {p.texture ? (
                        <span className="pill subtle">{p.texture}</span>
                      ) : null}
                      {price ? (
                        <span className="pill subtle">{price}</span>
                      ) : null}
                      {p.shade_depth ? (
                        <span className="pill subtle">{p.shade_depth}</span>
                      ) : null}
                      {p.undertone ? (
                        <span className="pill subtle">{p.undertone}</span>
                      ) : null}
                      {p.finish ? (
                        <span className="pill subtle">{p.finish}</span>
                      ) : null}
                    </div>

                    {Array.isArray(p.attributes) && p.attributes.length ? (
                      <div className="productAttrs">
                        {p.attributes.slice(0, 4).map((a) => (
                          <span className="chip" key={a}>
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {/* Allergy Flags */}
                    {flags.length > 0 && (
                      <div className="allergy-flags-section">
                        <button
                          type="button"
                          className={`allergy-flags-toggle ${hasElevated ? "has-elevated" : ""}`}
                          onClick={() => toggleFlags(productId)}
                        >
                          <span className="allergy-flags-icon">
                            {hasElevated ? "⚠" : "ℹ"}
                          </span>
                          <span>
                            {flags.length} allergy flag
                            {flags.length > 1 ? "s" : ""}
                          </span>
                          <span className="allergy-flags-chevron">
                            {flagsExpanded ? "▾" : "▸"}
                          </span>
                        </button>
                        {flagsExpanded && (
                          <div className="allergy-flags-list">
                            {flags.map((f, i) => (
                              <div
                                className={`allergy-flag-item ${riskColor(f.risk || (f.severity === "high" ? "elevated" : "standard"))}`}
                                key={i}
                              >
                                <span className="allergy-flag-risk-icon">
                                  {riskIcon(
                                    f.risk ||
                                      (f.severity === "high"
                                        ? "elevated"
                                        : "standard"),
                                  )}
                                </span>
                                <div className="allergy-flag-content">
                                  <div className="allergy-flag-key">
                                    {(f.flag || f.key || "").replace(/_/g, " ")}
                                  </div>
                                  <div className="allergy-flag-reason">
                                    {f.reason}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {Array.isArray(it.rationales) && it.rationales.length ? (
                      <div
                        className="muted"
                        style={{ marginTop: 4, lineHeight: 1.35 }}
                      >
                        {it.rationales[0]}
                      </div>
                    ) : null}

                    <div className="productActions">
                      {p.product_url ? (
                        <a
                          className="linkBtn"
                          href={p.product_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View product
                        </a>
                      ) : (
                        <span className="muted">No link</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </>
  );
}
