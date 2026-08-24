const fs = require("fs");
const path = require("path");

function toLowerText(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function normalizeIngredients(cleanIngredients) {
  if (Array.isArray(cleanIngredients)) {
    return cleanIngredients
      .map((x) => toLowerText(x))
      .filter(Boolean);
  }

  if (typeof cleanIngredients === "string") {
    return cleanIngredients
      .split(/[,;|]/g)
      .map((x) => toLowerText(x))
      .filter(Boolean);
  }

  return [];
}

const UV_FILTER_KEYWORDS = [
  "homosalate",
  "octocrylene",
  "octisalate",
  "ethylhexyl salicylate",
  "avobenzone",
  "butyl methoxydibenzoylmethane",
  "oxybenzone",
  "benzophenone-3",
  "ecamsule",
  "mexoryl",
  "ensulizole",
  "phenylbenzimidazole sulfonic acid",
  "tinosorb",
  "bemotrizinol",
  "bisoctrizole",
  "drometrizole trisiloxane",
  "uvinul",
  "diethylamino hydroxybenzoyl hexyl benzoate",
  "ethylhexyl triazone",
  "zinc oxide",
  "titanium dioxide",
];

const MINERAL_UV_FILTERS = ["zinc oxide", "titanium dioxide"];

function hasAny(haystack, needles) {
  for (const n of needles) {
    if (!n) continue;
    if (haystack.includes(n)) return true;
  }
  return false;
}

function detectTexture(name) {
  const n = toLowerText(name);
  if (!n) return "cream";

  if (n.includes("gel") || n.includes("jelly") || n.includes("aqua")) return "gel";
  if (n.includes("lotion") || n.includes("fluid") || n.includes("emulsion")) return "lotion";
  if (n.includes("serum") || n.includes("ampoule") || n.includes("essence")) return "serum";
  if (n.includes("mist") || n.includes("spray")) return "mist";
  if (n.includes("balm") || n.includes("ointment") || n.includes("butter") || n.includes("salve"))
    return "heavy_cream";
  if (n.includes("cream") || n.includes("moisturising") || n.includes("moisturizing")) return "cream";

  return "cream";
}

function parseSpfFromName(name) {
  const n = toLowerText(name);
  if (!n) return null;
  const m = n.match(/\bspf\s*([0-9]{2,3})\b/i);
  if (!m) return null;
  const spf = Number(m[1]);
  return Number.isFinite(spf) ? spf : null;
}

function defaultTargets() {
  return {
    min_humidity: 0,
    max_humidity: 100,
    min_temp_c: -20,
    max_temp_c: 50,
  };
}

function targetsForTexture(texture) {
  // Heuristics: heavy textures penalize very high humidity; gels favor high humidity/warm weather.
  if (texture === "gel" || texture === "lotion") {
    return { ...defaultTargets(), min_humidity: 55, min_temp_c: 18 };
  }
  if (texture === "heavy_cream") {
    return { ...defaultTargets(), max_humidity: 55, max_temp_c: 18 };
  }
  return defaultTargets();
}

function normalizeTargets(targets) {
  if (!targets || typeof targets !== "object") return {};
  const out = { ...targets };
  if (out.min_temp_c == null && out.min_temp != null) out.min_temp_c = out.min_temp;
  if (out.max_temp_c == null && out.max_temp != null) out.max_temp_c = out.max_temp;
  delete out.min_temp;
  delete out.max_temp;
  if (out.min_uv_index == null && out.min_uv != null) out.min_uv_index = out.min_uv;
  delete out.min_uv;
  return out;
}

function detectSunscreenType(ingredientsArr) {
  const joined = (ingredientsArr || []).join(" ");
  const hasMineral = hasAny(joined, MINERAL_UV_FILTERS);
  const hasAnyUv = hasAny(joined, UV_FILTER_KEYWORDS);
  if (!hasAnyUv) return null;
  if (hasMineral) {
    // hybrid if also contains chemical filters beyond mineral
    const chemicalJoined = UV_FILTER_KEYWORDS.filter((k) => !MINERAL_UV_FILTERS.includes(k));
    const hasChemical = hasAny(joined, chemicalJoined);
    return hasChemical ? "hybrid" : "mineral";
  }
  return "chemical";
}

function buildAttributes({ name, ingredients, texture, isSunscreen }) {
  const attrs = new Set();
  const n = toLowerText(name);

  if (texture === "gel" || texture === "lotion" || n.includes("oil free") || n.includes("oil-free"))
    attrs.add("lightweight");
  if (texture === "heavy_cream") attrs.add("occlusive");
  if (isSunscreen) attrs.add("uv-protection");
  if (n.includes("oil free") || n.includes("oil-free")) attrs.add("oil-free");

  if (ingredients.has("niacinamide")) {
    attrs.add("barrier-support");
    attrs.add("niacinamide");
  }
  if (ingredients.has("ceramide") || hasAny([...ingredients].join(" "), ["ceramide", "ceramides"]))
    attrs.add("barrier-support");
  if (ingredients.has("hyaluronic acid") || ingredients.has("sodium hyaluronate")) attrs.add("hydrating");
  if (hasAny([...ingredients].join(" "), ["salicylic acid", "bha"])) attrs.add("exfoliating");
  if (hasAny([...ingredients].join(" "), ["ascorbic acid", "vitamin c", "tocopherol", "vitamin e"]))
    attrs.add("antioxidant");
  if (hasAny([...ingredients].join(" "), ["retinol", "tretinoin", "retinal", "adapalene"])) attrs.add("retinoid");
  if (hasAny([...ingredients].join(" "), ["peptide", "peptides"])) attrs.add("peptide");

  if (
    hasAny([...ingredients].join(" "), [
      "centella asiatica",
      "madecassoside",
      "asiaticoside",
      "allantoin",
      "colloidal oatmeal",
      "avena sativa",
      "beta-glucan",
    ])
  ) {
    attrs.add("soothing");
  }

  return [...attrs];
}

function buildMakeupAttributes({ name }) {
  const attrs = new Set();
  const n = toLowerText(name);
  if (!n) return [];

  if (n.includes("matte")) attrs.add("matte");
  if (n.includes("dewy")) attrs.add("dewy");
  if (n.includes("luminous") || n.includes("glow")) attrs.add("luminous");
  if (n.includes("long wear") || n.includes("longwear") || n.includes("long-wear")) attrs.add("long-wear");
  if (n.includes("hydrating") || n.includes("moisture")) attrs.add("hydrating");
  if (n.includes("oil free") || n.includes("oil-free")) attrs.add("oil-free");
  if (n.includes("powder")) attrs.add("powder");
  if (n.includes("cream")) attrs.add("cream");
  if (n.includes("liquid")) attrs.add("liquid");

  return [...attrs];
}

function enhanceProduct(product) {
  const name = product?.name || "";
  const type = product?.type || null;
  let category = product?.category || null;

  const ingredientsArr = normalizeIngredients(product?.clean_ingredients);
  const ingredientSet = new Set(ingredientsArr);

  const nameLower = toLowerText(name);
  const spf = parseSpfFromName(name);
  const isSunscreen =
    nameLower.includes("spf") ||
    hasAny(nameLower, ["sunscreen", "sun screen", "suncream", "sun cream"]) ||
    hasAny(ingredientsArr.join(" "), UV_FILTER_KEYWORDS);

  if (isSunscreen) category = "sunscreen";

  const texture = detectTexture(name);
  const inferredTargets = targetsForTexture(texture);
  const environmental_targets = {
    ...inferredTargets,
    ...normalizeTargets(product?.environmental_targets),
  };

  // If sunscreen, it's relevant when UV is present; we keep the field but do not compute UV currently.
  if (isSunscreen) {
    environmental_targets.min_uv_index = 3;
  }

  const sunscreen_type = isSunscreen ? detectSunscreenType(ingredientsArr) : null;
  const skincareAttributes = buildAttributes({
    name,
    ingredients: ingredientSet,
    texture,
    isSunscreen,
  });
  if (sunscreen_type === "mineral") skincareAttributes.push("mineral-sunscreen");
  if (sunscreen_type === "chemical") skincareAttributes.push("chemical-sunscreen");
  if (sunscreen_type === "hybrid") skincareAttributes.push("hybrid-sunscreen");

  const makeupAttributes = type && toLowerText(type) === "makeup" ? buildMakeupAttributes({ name }) : [];

  const attributes = [...new Set([...skincareAttributes, ...makeupAttributes])];

  return {
    ...product,
    type,
    category,
    texture,
    attributes,
    environmental_targets,
    spf,
    sunscreen_type,
    clean_ingredients: ingredientsArr,
  };
}

function loadSriLankaCatalog() {
  const p = path.join(__dirname, "slprod.json");
  if (!fs.existsSync(p)) return [];

  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("api-server/slprod.json must be a JSON array");
  }

  return parsed.map((item) => ({
    ...item,
    sri_lanka: true,
    source: "slprod",
  }));
}

function loadCatalog() {
  const p = path.join(__dirname, "products.json");
  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("api-server/products.json must be a JSON array");
  }

  // Merge makeup_products.json (if present), deduplicating by product id
  const makeupPath = path.join(__dirname, "makeup_products.json");
  if (fs.existsSync(makeupPath)) {
    try {
      const makeupRaw = fs.readFileSync(makeupPath, "utf8");
      const makeupParsed = JSON.parse(makeupRaw);
      if (Array.isArray(makeupParsed)) {
        const existingIds = new Set(parsed.map((p) => p.id));
        let added = 0;
        for (const item of makeupParsed) {
          if (item.id && !existingIds.has(item.id)) {
            parsed.push(item);
            existingIds.add(item.id);
            added++;
          }
        }
        // eslint-disable-next-line no-console
        console.log(`Merged ${added} makeup products from makeup_products.json`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`Could not load makeup_products.json: ${e?.message || e}`);
    }
  }

  // Merge Sri Lankan products from slprod.json and mark them in the catalog
  const slProducts = loadSriLankaCatalog();
  if (slProducts.length) {
    const existingIds = new Set(parsed.filter((item) => item?.id != null).map((item) => item.id));
    let added = 0;
    for (const item of slProducts) {
      if (item.id && existingIds.has(item.id)) {
        const existingIndex = parsed.findIndex((p) => p.id === item.id);
        if (existingIndex !== -1) {
          parsed[existingIndex] = {
            ...parsed[existingIndex],
            sri_lanka: true,
            source: parsed[existingIndex].source || item.source,
          };
        }
      } else {
        parsed.push(item);
        if (item.id) existingIds.add(item.id);
        added++;
      }
    }
    // eslint-disable-next-line no-console
    console.log(`Merged ${added} Sri Lankan products from slprod.json`);
  }

  return parsed;
}

function buildEnhancedCatalog(rawArray) {
  return rawArray.map(enhanceProduct);
}

module.exports = {
  loadCatalog,
  buildEnhancedCatalog,
  enhanceProduct,
};
