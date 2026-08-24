function toNum(value) {
  const num = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(num) ? num : null;
}

function toText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeCvScores(cvScores) {
  const cv = cvScores && typeof cvScores === "object" ? cvScores : {};
  return {
    shine_score: toNum(cv.shine_score),
    wrinkle_score: toNum(cv.wrinkle_score),
    texture_score: toNum(cv.texture_score),
    redness_score: toNum(cv.redness_score),
    pigmentation_score: toNum(cv.pigmentation_score),
    skin_tone: toText(cv.skin_tone),
    undertone: toText(cv.undertone),
    age: toNum(cv.age),
    gender: toText(cv.gender),
  };
}

function normalizeClimateData(climateData) {
  const c = climateData && typeof climateData === "object" ? climateData : {};
  return {
    humidity_pct: toNum(c.humidity_pct ?? c.humidity ?? c.humidityPct),
    temperature_c: toNum(c.temperature_c ?? c.temperature ?? c.temperatureC ?? c.temp_c ?? c.tempC),
    aqi_us: toNum(c.aqi_us ?? c.aqi ?? c.aqiUS),
    uv_index: toNum(c.uv_index ?? c.uvIndex ?? c.uvi),
  };
}

function deterministicScoreVariance(productId, seedString = "") {
  const id = String(productId || "") + String(seedString);
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const variance = (hash % 11) - 5; // -5 .. +5
  return variance * 2.5; // increased variance (-12.5 to +12.5) to meaningfully shuffle top products per person
}

function parseSpf(name) {
  const text = toText(name);
  if (!text) return null;
  const match = text.match(/\bspf\s*([0-9]{2,3})\b/i);
  if (!match) return null;
  const spf = Number(match[1]);
  return Number.isFinite(spf) ? spf : null;
}

function hasAttr(product, attr) {
  const attrs = Array.isArray(product?.attributes) ? product.attributes : [];
  return attrs.includes(attr);
}

function textureIn(product, textures) {
  const t = toText(product?.texture);
  return textures.includes(t);
}

function toneToShadeDepth(skinTone) {
  const t = toText(skinTone).toLowerCase();
  if (!t) return null;
  if (t.includes("very")) return "Light";
  if (t === "light") return "Light";
  if (t === "intermediate") return "Tan";
  if (t === "tan") return "Tan";
  if (t === "brown") return "Brown";
  if (t === "dark") return "Dark";
  return null;
}

function scoreBaseEnvironment(product, climate) {
  const humidity = toNum(climate?.humidity_pct);
  const tempC = toNum(climate?.temperature_c);
  const aqi = toNum(climate?.aqi_us);

  const targets = product?.environmental_targets || {};
  const minHumidity = toNum(targets.min_humidity);
  const maxHumidity = toNum(targets.max_humidity);
  const minTemp = toNum(targets.min_temp_c ?? targets.min_temp);
  const maxTemp = toNum(targets.max_temp_c ?? targets.max_temp);

  let score = 50;

  if (humidity != null) {
    if (maxHumidity != null && humidity > maxHumidity) score -= (humidity - maxHumidity) * 0.8;
    if (minHumidity != null && humidity < minHumidity) score -= (minHumidity - humidity) * 0.8;

    if (humidity >= 78 && product.texture === "heavy_cream") score -= 18;
    if (humidity >= 78 && (product.texture === "gel" || product.texture === "lotion")) score += 8;
    if (humidity <= 35 && product.texture === "heavy_cream") score += 10;
  }

  if (tempC != null) {
    if (maxTemp != null && tempC > maxTemp) score -= (tempC - maxTemp) * 1.2;
    if (minTemp != null && tempC < minTemp) score -= (minTemp - tempC) * 1.2;
  }

  if (aqi != null) {
    if (aqi > 100 && hasAttr(product, "antioxidant")) score += 8;
    if (aqi > 150 && hasAttr(product, "barrier-support")) score += 6;
  }

  if (product.category === "sunscreen") score += 7;
  if (product.category === "cleanser") score += 2;
  if (product.category === "moisturizer") score += 3;

  const ingCount = Array.isArray(product.clean_ingredients) ? product.clean_ingredients.length : 0;
  if (ingCount > 0 && ingCount < 5) score -= 6;

  return clamp(score, 0, 100);
}

function inferSkinProfile(cv) {
  const age = toNum(cv?.age);
  const ageGroup = age == null ? "adult" : age >= 40 ? "mature" : age <= 19 ? "teen" : "adult";

  const sensitiveSignals = [
    cv?.redness_score != null && cv.redness_score > 45,
    cv?.shine_score != null && cv.shine_score > 70,
  ].filter(Boolean).length;

  const acneSignals = [
    cv?.shine_score != null && cv.shine_score > 70,
    cv?.pigmentation_score != null && cv.pigmentation_score > 50,
  ].filter(Boolean).length;

  const eczemaSignals = [
    cv?.redness_score != null && cv.redness_score > 55,
    cv?.texture_score != null && cv.texture_score < 35,
  ].filter(Boolean).length;

  const rosaceaSignals = [
    cv?.redness_score != null && cv.redness_score > 50,
    cv?.wrinkle_score != null && cv.wrinkle_score > 40,
  ].filter(Boolean).length;

  let skinCondition = "none";
  if (eczemaSignals >= 1) skinCondition = "eczema";
  else if (rosaceaSignals >= 1) skinCondition = "rosacea";
  else if (sensitiveSignals >= 1) skinCondition = "sensitive";
  else if (acneSignals >= 1) skinCondition = "acne_prone";

  return { ageGroup, skinCondition };
}

function getAllergyFlags(product) {
  const ingredients = Array.isArray(product?.clean_ingredients) ? product.clean_ingredients : [];
  const text = ingredients.join(" ").toLowerCase();
  const flags = [];

  if (/(fragrance|parfum|aroma|linalool|limonene|citronellol|geraniol|eugenol|cinnamal|coumarin|benzyl|farnesol|hexyl cinnamal|citral|isoeugenol)/.test(text)) {
    flags.push({ key: "fragrance_allergen", severity: "moderate", reason: "Contains fragrance-like ingredients that can trigger sensitivity." });
  }
  if (/(tea tree|bergamot|citrus|orange oil|lemon oil|ylang|phototoxic)/.test(text)) {
    flags.push({ key: "phototoxic_essential_oil", severity: "moderate", reason: "Contains essential oils that can be irritating in sun exposure." });
  }
  if (/(methylisothiazolinone|methylchloroisothiazolinone|quaternium-15|dmdm hydantoin|imidazolidinyl urea|diazolidinyl urea|formaldehyde|nickel|ppd|cocamidopropyl betaine|lanolin|propolis|carmine)/.test(text)) {
    flags.push({ key: "sensitizer_preservative_or_metal", severity: "high", reason: "Contains known sensitizers or preservatives associated with irritation." });
  }
  if (/(alcohol denat|witch hazel|menthol|peppermint|sodium lauryl sulfate)/.test(text)) {
    flags.push({ key: "drying_irritant", severity: "low", reason: "Contains drying or irritating agents that may compromise sensitive skin." });
  }
  if (/(retinol|retinal|retinyl|glycolic acid|lactic acid|salicylic acid|hydroquinone)/.test(text)) {
    flags.push({ key: "active_ingredient_caution", severity: "moderate", reason: "Contains actives that may be too strong for some profiles." });
  }
  if (/(isopropyl myristate|isopropyl palmitate|coconut oil|cocos nucifera|cocoa butter|theobroma cacao|lanolin|oleic acid|bismuth oxychloride|octyldodecanol)/.test(text)) {
    flags.push({ key: "comedogenic", severity: "moderate", reason: "Contains ingredients that may clog pores on acne-prone skin." });
  }
  return flags;
}

function scoreAllergyRisk(product, skinProfile, precomputedFlags) {
  // If we have pre-computed flags from the Python engine, use those instead
  if (precomputedFlags && precomputedFlags.length > 0) {
    let penalty = 0;
    const matched = [];
    for (const flag of precomputedFlags) {
      const flagKey = flag.flag || "";
      const risk = flag.risk || "standard";
      // Map pre-computed flags to penalty scores
      if (flagKey.includes("fragrance") || flagKey.includes("sensitizer")) {
        penalty += risk === "elevated" ? 32 : 20;
      } else if (flagKey.includes("phototoxic")) {
        penalty += 10;
      } else if (flagKey.includes("drying") || flagKey.includes("irritant")) {
        penalty += risk === "elevated" ? 16 : 8;
      } else if (flagKey.includes("active_ingredient")) {
        penalty += risk === "elevated" ? 20 : 8;
      } else if (flagKey.includes("comedogenic")) {
        penalty += risk === "elevated" ? 22 : 10;
      } else {
        penalty += risk === "elevated" ? 15 : 6;
      }
      matched.push({
        key: flag.flag,
        severity: risk === "elevated" ? "high" : "moderate",
        reason: flag.reason,
        risk: flag.risk,
      });
    }
    return { penalty, flags: matched };
  }

  // Fallback: regex-based detection for products not in the pre-computed DB
  const flags = getAllergyFlags(product);
  if (!flags.length) return { penalty: 0, flags: [] };

  const { ageGroup, skinCondition } = skinProfile;
  let penalty = 0;
  const matched = [];

  for (const flag of flags) {
    if (flag.key === "fragrance_allergen" || flag.key === "sensitizer_preservative_or_metal") {
      penalty += 20;
      if (skinCondition === "sensitive" || skinCondition === "eczema" || skinCondition === "rosacea") penalty += 12;
    }
    if (flag.key === "phototoxic_essential_oil") {
      penalty += 10;
    }
    if (flag.key === "drying_irritant") {
      penalty += 8;
      if (skinCondition === "eczema" || skinCondition === "rosacea") penalty += 8;
    }
    if (flag.key === "active_ingredient_caution") {
      penalty += 8;
      if (ageGroup === "teen") penalty += 6;
      if (skinCondition === "pregnancy") penalty += 12;
    }
    if (flag.key === "comedogenic") {
      penalty += 10;
      if (skinCondition === "acne_prone") penalty += 12;
    }
    matched.push(flag);
  }

  return { penalty, flags: matched };
}

function predictChemicalStability({ product, climate }) {
  const ingredients = Array.isArray(product?.clean_ingredients) ? product.clean_ingredients : [];
  const text = ingredients.join(" ").toLowerCase();
  
  const humidity = toNum(climate?.humidity_pct);
  const tempC = toNum(climate?.temperature_c);
  const uvIndex = toNum(climate?.uv_index);
  
  let penalty = 0;
  const stability_alerts = [];
  const safety_warnings = [];

  if (/(ascorbic acid|l-ascorbic|vitamin c)/.test(text)) {
    if ((tempC != null && tempC >= 30) || (humidity != null && humidity >= 75)) {
      penalty += 15;
      stability_alerts.push("High heat/humidity accelerates Vitamin C oxidation. Store in a cool place.");
    }
  }

  if (/(retinol|retinal|retinyl|tretinoin)/.test(text)) {
    if (uvIndex != null && uvIndex > 5) {
      penalty += 25;
      safety_warnings.push("High UV detected. Retinoids degrade in sunlight and increase sunburn risk. Use only at night.");
    }
    if (tempC != null && tempC >= 32) {
      penalty += 10;
      stability_alerts.push("Retinoids are thermally unstable. High temperatures can reduce product potency.");
    }
  }

  if (/(glycolic acid|lactic acid|salicylic acid|aha|bha)/.test(text)) {
    if (uvIndex != null && uvIndex > 6) {
      penalty += 20;
      safety_warnings.push("Acids increase skin photosensitivity. High UV index requires strict SPF reapplication if used during the day.");
    }
    if (tempC != null && tempC >= 35) {
      penalty += 10;
      stability_alerts.push("High heat combined with strong acids can severely disrupt the skin barrier.");
    }
  }

  if (/(hyaluronic acid|sodium hyaluronate|glycerin|panthenol)/.test(text) && !/(dimethicone|ceramide|shea butter|squalane|oil)/.test(text)) {
    if (humidity != null && humidity < 35) {
      penalty += 15;
      stability_alerts.push("Low humidity detected. Pure humectants without occlusives can draw water OUT of your skin (TEWL) in arid climates.");
    }
  }

  if (/(shea butter|theobroma|coconut oil|mineral oil|petrolatum)/.test(text)) {
    if (tempC != null && tempC >= 28 && humidity != null && humidity >= 70) {
      penalty += 20;
      safety_warnings.push("Heavy occlusives in high heat and humidity drastically increase the risk of trapped sweat, leading to heat rash and breakouts.");
    }
  }

  return { penalty, stability_alerts, safety_warnings };
}

function applyScenarioRules({ product, cv, climate }) {
  const adjustments = [];
  const rationales = [];
  const safety = [];

  const humidity = toNum(climate.humidity_pct);
  const tempC = toNum(climate.temperature_c);
  const uvIndex = toNum(climate.uv_index);
  const aqi = toNum(climate.aqi_us);

  const shine = toNum(cv.shine_score);
  const wrinkle = toNum(cv.wrinkle_score);
  const texture = toNum(cv.texture_score);
  const redness = toNum(cv.redness_score);
  const pigmentation = toNum(cv.pigmentation_score);

  const add = (delta, scenario, rationaleText) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    adjustments.push({ delta, scenario });
    if (rationaleText) rationales.push({ scenario, text: rationaleText });
  };

  const isSkincare = (product.type || "").toLowerCase() === "skincare";
  const isMakeup = (product.type || "").toLowerCase() === "makeup";

  // Scenario 1: Tropical Oily
  if (isSkincare && shine != null && shine > 75 && ((humidity != null && humidity > 75) || (tempC != null && tempC > 26))) {
    if (product.texture === "heavy_cream" || hasAttr(product, "occlusive")) {
      add(
        -80,
        "S1_TROPICAL_OILY",
        "Lightweight, mattifying gel formula selected to control shine and prevent clogged pores in humid conditions."
      );
    }
    if (textureIn(product, ["gel", "lotion"]) && (hasAttr(product, "lightweight") || hasAttr(product, "oil-free"))) {
      add(
        +50,
        "S1_TROPICAL_OILY",
        "Lightweight, mattifying gel formula selected to control shine and prevent clogged pores in humid conditions."
      );
    }
  }

  // Scenario 2: Dehydrated Oily
  if (isSkincare && shine != null && shine > 75 && humidity != null && humidity < 45) {
    if (product.texture === "heavy_cream" || hasAttr(product, "occlusive")) add(-35, "S2_DEHYDRATED_OILY");
    if (product.category === "cleanser" && (toText(product.name).toLowerCase().includes("foaming") || toText(product.name).toLowerCase().includes("clarifying")))
      add(-25, "S2_DEHYDRATED_OILY");
    if (hasAttr(product, "hydrating") && textureIn(product, ["serum", "lotion", "gel"])) {
      add(
        +35,
        "S2_DEHYDRATED_OILY",
        "Hydrating, oil-free fluids selected to replenish deep skin hydration without triggering excess surface oil in dry air."
      );
    }
  }

  // Scenario 3: Arid Aging
  if (isSkincare && ((wrinkle != null && wrinkle > 50) || (texture != null && texture > 50)) && humidity != null && humidity < 50) {
    if (product.texture === "heavy_cream" || hasAttr(product, "barrier-support")) {
      add(
        +50,
        "S3_ARID_AGING",
        "Rich lipid-replenishing cream suggested to plump fine lines and reinforce your skin barrier against dry, dehydrating air."
      );
    }
    if (textureIn(product, ["gel", "lotion"]) && hasAttr(product, "matte")) add(-20, "S3_ARID_AGING");
  }

  // Scenario 4: Humid Aging
  if (isSkincare && wrinkle != null && wrinkle > 50 && humidity != null && humidity > 75) {
    if (product.texture === "heavy_cream" || hasAttr(product, "occlusive")) add(-35, "S4_HUMID_AGING");
    if (textureIn(product, ["serum", "lotion", "gel"]) && (hasAttr(product, "niacinamide") || hasAttr(product, "peptide") || hasAttr(product, "barrier-support"))) {
      add(
        +35,
        "S4_HUMID_AGING",
        "Fluid-based anti-aging emulsion selected to provide firming benefits without feeling heavy or suffocating in high humidity."
      );
    }
  }

  // Scenario 5: Heat Flare
  if (isSkincare && redness != null && redness > 40 && ((tempC != null && tempC > 28) || (uvIndex != null && uvIndex > 6))) {
    if (hasAttr(product, "soothing")) {
      add(
        +35,
        "S5_HEAT_FLARE",
        "Soothing mineral formula selected to calm active redness and shield heat-sensitive skin from aggressive UV damage."
      );
    }
    if (product.category === "sunscreen" && hasAttr(product, "mineral-sunscreen")) {
      add(
        +60,
        "S5_HEAT_FLARE",
        "Soothing mineral formula selected to calm active redness and shield heat-sensitive skin from aggressive UV damage."
      );
    }
    if (product.category === "sunscreen" && hasAttr(product, "chemical-sunscreen")) add(-25, "S5_HEAT_FLARE");
    if (hasAttr(product, "exfoliating")) add(-20, "S5_HEAT_FLARE");
  }

  // Scenario 6: Sun Damage (Critical Alert)
  if (isSkincare && pigmentation != null && pigmentation > 50 && uvIndex != null && uvIndex > 5) {
    const spf = toNum(product.spf ?? parseSpf(product.name));
    if (product.category === "sunscreen") {
      if (spf != null && spf >= 50) {
        add(
          +80,
          "S6_SUN_DAMAGE",
          "High UV conditions trigger melanin production. Broad-spectrum SPF 50+ is prioritized to stabilize dark spots."
        );
      } else {
        add(-40, "S6_SUN_DAMAGE");
      }
    }

    // Daytime safety warning for strong exfoliants/retinoids under high UV
    if (hasAttr(product, "exfoliating") || hasAttr(product, "retinoid")) {
      add(-35, "S6_SUN_DAMAGE");
      safety.push({
        scenario: "S6_SUN_DAMAGE",
        text: "High UV day: avoid using strong exfoliants/retinoids in the morning; prefer night use and always wear SPF.",
      });
    }
  }

  // Scenario 7: Smog Defense
  if (isSkincare && aqi != null && aqi > 90) {
    if (hasAttr(product, "antioxidant")) {
      add(
        +40,
        "S7_SMOG_DEFENSE",
        "Antioxidant defense prioritized to neutralize environmental free radicals caused by poor air quality."
      );
    }
  }

  // Scenario 8/9: Makeup tone + climate texture
  if (isMakeup) {
    const shadeDepth = toneToShadeDepth(cv.skin_tone);
    const undertone = toText(cv.undertone);
    if (product.category === "foundation" && shadeDepth && undertone) {
      if (toText(product.shade_depth) !== shadeDepth || toText(product.undertone) !== undertone) {
        // Hard filter will be applied by caller; keep a strong penalty as fallback.
        add(-999, "MAKEUP_SHADE_MISMATCH");
      }
    }

    if (humidity != null && humidity > 75) {
      if (hasAttr(product, "matte") || hasAttr(product, "long-wear") || hasAttr(product, "oil-free"))
        add(
          +35,
          "S8_HUMID_MAKEUP",
          "Exact shade match delivered in a humidity-resistant matte matrix to prevent midday melting and oxidation."
        );
      if (hasAttr(product, "dewy") || hasAttr(product, "luminous") || hasAttr(product, "cream")) add(-25, "S8_HUMID_MAKEUP");
    }

    if (humidity != null && humidity < 45) {
      if (hasAttr(product, "hydrating") || hasAttr(product, "dewy") || hasAttr(product, "cream"))
        add(
          +35,
          "S9_ARID_MAKEUP",
          "Warm-toned color match paired with a hydrating, moisture-locking formula to prevent flaking and dry patches in arid conditions."
        );
      if (hasAttr(product, "matte") || hasAttr(product, "powder")) add(-20, "S9_ARID_MAKEUP");
    }
  }

  return { adjustments, rationales, safety };
}

function pickTopRationales(rationales, max = 2) {
  if (!Array.isArray(rationales) || rationales.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (const r of rationales) {
    if (!r?.text) continue;
    if (seen.has(r.text)) continue;
    seen.add(r.text);
    out.push(r.text);
    if (out.length >= max) break;
  }
  return out;
}

function lookupPrecomputedFlags(allergyFlagsDb, productId, skinProfile) {
  if (!allergyFlagsDb || !Array.isArray(allergyFlagsDb.products)) return null;
  const entry = allergyFlagsDb.products.find((p) => p.id === productId);
  if (!entry || !entry.flags_by_profile) return null;
  const key = `${skinProfile.ageGroup}__${skinProfile.skinCondition}`;
  const flags = entry.flags_by_profile[key];
  return Array.isArray(flags) ? flags : null;
}

function recommendProducts({ catalog, cvScores, climateData, type, category, limit = 12, allergyFlagsDb = null }) {
  const cv = normalizeCvScores(cvScores);
  const climate = normalizeClimateData(climateData);
  const skinProfile = inferSkinProfile(cv);

  let products = Array.isArray(catalog) ? catalog : [];
  if (type) products = products.filter((p) => toText(p.type).toLowerCase() === toText(type).toLowerCase());
  if (category)
    products = products.filter((p) => toText(p.category).toLowerCase() === toText(category).toLowerCase());

  // Makeup: strict shade + undertone filtering when both are available
  if (toText(type).toLowerCase() === "makeup") {
    const shadeDepth = toneToShadeDepth(cv.skin_tone);
    const undertone = toText(cv.undertone);
    if (shadeDepth && undertone) {
      products = products.filter((p) => {
        if (toText(p.category).toLowerCase() !== "foundation") return true;
        return toText(p.shade_depth) === shadeDepth && toText(p.undertone) === undertone;
      });
    }
  }

  const items = products
    .map((product) => {
      const base = scoreBaseEnvironment(product, climate);
      const { adjustments, rationales, safety } = applyScenarioRules({ product, cv, climate });
      const delta = adjustments.reduce((s, a) => s + a.delta, 0);

      // Calculate chemical stability
      const stability = predictChemicalStability({ product, climate });

      // Use pre-computed allergy flags when available, otherwise fall back to regex
      const precomputed = product.id ? lookupPrecomputedFlags(allergyFlagsDb, product.id, skinProfile) : null;
      const allergy = scoreAllergyRisk(product, skinProfile, precomputed);
      const score = clamp(base + delta - allergy.penalty - stability.penalty, 0, 100);
      
      // Merge safety alerts
      for (const msg of stability.safety_warnings) {
        safety.push({ scenario: "CHEMICAL_STABILITY", text: msg });
      }
      
      // Generate a unique seed for this person based on their skin metrics
      const personSeed = `${cv.age}_${cv.skin_tone}_${cv.wrinkle_score}_${cv.redness_score}`;
      const variance = deterministicScoreVariance(product.id || product.name || "", personSeed);
      
      return {
        product,
        score: Math.round(clamp(score + variance, 0, 100)),
        base_score: Math.round(base),
        adjustments,
        rationales: pickTopRationales(rationales, 2),
        safety,
        allergy_flags: allergy.flags,
        stability_alerts: stability.stability_alerts,
        skin_profile: skinProfile,
      };
    })
    .filter((x) => Number.isFinite(x.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, clamp(Number(limit) || 12, 1, 100));

  const safety_alerts = [];
  for (const it of items) {
    for (const s of it.safety || []) safety_alerts.push(s.text);
  }

  return {
    input: { cv, climate, skin_profile: skinProfile },
    items,
    safety_alerts: [...new Set(safety_alerts)].slice(0, 6),
  };
}

module.exports = {
  recommendProducts,
  normalizeCvScores,
  normalizeClimateData,
  toneToShadeDepth,
};

