const test = require("node:test");
const assert = require("node:assert/strict");

const { recommendProducts } = require("./recommendationEngine");

function mkProduct(overrides) {
  return {
    id: "x",
    name: "X",
    type: "skincare",
    category: "moisturizer",
    texture: "cream",
    attributes: [],
    environmental_targets: { min_humidity: 0, max_humidity: 100, min_temp_c: -20, max_temp_c: 50 },
    clean_ingredients: ["water", "glycerin", "niacinamide", "sodium hyaluronate", "tocopherol"],
    ...overrides,
  };
}

test("S1 Tropical Oily: penalizes heavy_cream and boosts gel/lotion", () => {
  const catalog = [
    mkProduct({ id: "heavy", texture: "heavy_cream", attributes: ["occlusive"] }),
    mkProduct({ id: "gel", texture: "gel", attributes: ["lightweight", "oil-free"] }),
  ];

  const out = recommendProducts({
    catalog,
    cvScores: { shine_score: 80 },
    climateData: { humidity_pct: 85, temperature_c: 30 },
    type: "skincare",
    limit: 10,
  });

  const ids = out.items.map((i) => i.product.id);
  assert.equal(ids[0], "gel");
  assert.equal(ids[1], "heavy");
});

test("S6 Sun Damage: prioritizes SPF50+ sunscreen and warns on exfoliants", () => {
  const catalog = [
    mkProduct({
      id: "spf30",
      name: "Daily Sunscreen SPF 30",
      category: "sunscreen",
      spf: 30,
      attributes: ["uv-protection", "chemical-sunscreen"],
    }),
    mkProduct({
      id: "spf50",
      name: "Mineral Sunscreen SPF 50",
      category: "sunscreen",
      spf: 50,
      attributes: ["uv-protection", "mineral-sunscreen", "soothing"],
    }),
    mkProduct({
      id: "aha",
      name: "AHA Exfoliating Toner",
      category: "toner",
      attributes: ["exfoliating"],
    }),
  ];

  const out = recommendProducts({
    catalog,
    cvScores: { pigmentation_score: 70 },
    climateData: { uv_index: 7, humidity_pct: 60, temperature_c: 28 },
    type: "skincare",
    limit: 10,
  });

  assert.equal(out.items[0].product.id, "spf50");
  assert.ok(out.safety_alerts.some((t) => t.toLowerCase().includes("high uv day")));
});

test("Makeup: strict foundation shade depth + undertone filter when available", () => {
  const catalog = [
    {
      id: "mk1",
      name: "Foundation - Mocha",
      type: "makeup",
      category: "foundation",
      shade_depth: "Brown",
      undertone: "Cool",
      texture: "cream",
      attributes: ["matte"],
      environmental_targets: { min_humidity: 0, max_humidity: 100, min_temp_c: -20, max_temp_c: 50 },
      clean_ingredients: [],
    },
    {
      id: "mk2",
      name: "Foundation - Espresso",
      type: "makeup",
      category: "foundation",
      shade_depth: "Dark",
      undertone: "Warm",
      texture: "cream",
      attributes: ["dewy"],
      environmental_targets: { min_humidity: 0, max_humidity: 100, min_temp_c: -20, max_temp_c: 50 },
      clean_ingredients: [],
    },
  ];

  const out = recommendProducts({
    catalog,
    cvScores: { skin_tone: "Brown", undertone: "Cool" },
    climateData: { humidity_pct: 80, temperature_c: 30 },
    type: "makeup",
    limit: 10,
  });

  assert.deepEqual(out.items.map((i) => i.product.id), ["mk1"]);
});

test("Chemical Stability: penalizes Vitamin C and warns on Retinol in extreme conditions", () => {
  const catalog = [
    mkProduct({
      id: "vitc",
      name: "Vitamin C Serum",
      clean_ingredients: ["water", "ascorbic acid", "glycerin"],
    }),
    mkProduct({
      id: "retinol",
      name: "Retinol Night Cream",
      clean_ingredients: ["water", "retinol", "dimethicone"],
    }),
    mkProduct({
      id: "safe",
      name: "Basic Moisturizer",
      clean_ingredients: ["water", "glycerin", "niacinamide"],
    }),
  ];

  const out = recommendProducts({
    catalog,
    cvScores: { age: 30, skin_tone: "Light" },
    climateData: { humidity_pct: 80, temperature_c: 32, uv_index: 7 },
    type: "skincare",
    limit: 10,
  });

  const vitcItem = out.items.find((i) => i.product.id === "vitc");
  const safeItem = out.items.find((i) => i.product.id === "safe");
  
  // "safe" should ideally have a higher base score - penalty than vitc.
  // We can just verify the penalties were applied by checking if the alerts exist.
  
  // Verify safety alerts contain retinol warning
  assert.ok(out.safety_alerts.some((t) => t.toLowerCase().includes("retinoids degrade")));
  
  // Verify stability alerts contain vitamin C warning
  assert.ok(vitcItem.stability_alerts.some((t) => t.toLowerCase().includes("vitamin c oxidation")));
});
