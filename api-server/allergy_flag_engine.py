"""
allergy_flag_engine.py

A reusable, ingredient-based safety-flagging engine for cosmetic/skincare
products. It does NOT diagnose allergies — it flags products whose
ingredient lists contain substances that are recognised (by regulatory
bodies such as the EU Cosmetics Regulation Annex III, or by common
dermatological consensus) as frequent allergens/irritants, and cross
references that against:
  - age_group: "teen" (13-19) | "adult" (20-39) | "mature" (40+)
  - skin_condition: "sensitive" | "acne_prone" | "eczema" | "rosacea" |
                     "pregnancy" | "none"

Usage:
    python3 allergy_flag_engine.py <input_products.json> <output_prefix>

Produces <output_prefix>.json and <output_prefix>.csv containing one row
per (product, age_group, skin_condition) combination that has at least
one flag, plus an "any_flag" summary row per product.
"""
import json
import sys
import csv
import re

# ---------------------------------------------------------------------------
# 1. INGREDIENT REFERENCE DATABASE
# ---------------------------------------------------------------------------
# Each entry: canonical ingredient name (lowercase, matched as substring)
# -> dict(category, severity, note)
#
# severity: "high" | "moderate" | "low"  (likelihood/strength of reaction)

FRAGRANCE_ALLERGENS = {
    # EU Cosmetics Regulation Annex III - 26 declarable fragrance allergens
    "limonene": "Common contact allergen; oxidises on air exposure into a stronger sensitiser.",
    "linalool": "Common contact allergen; oxidises on air exposure into a stronger sensitiser.",
    "citronellol": "Frequent fragrance allergen.",
    "geraniol": "Frequent fragrance allergen.",
    "eugenol": "Fragrance allergen, also used in cloves; can irritate mucous membranes.",
    "citral": "Fragrance allergen; can be irritating on broken/sensitised skin.",
    "coumarin": "Fragrance allergen.",
    "farnesol": "Fragrance allergen.",
    "benzyl alcohol": "Fragrance allergen and preservative; can irritate at higher %.",
    "benzyl benzoate": "Fragrance allergen.",
    "benzyl salicylate": "Fragrance allergen.",
    "benzyl cinnamate": "Fragrance allergen.",
    "cinnamal": "Fragrance allergen; among the more potent sensitisers on the list.",
    "cinnamyl alcohol": "Fragrance allergen.",
    "hexyl cinnamal": "Fragrance allergen.",
    "hydroxycitronellal": "Fragrance allergen.",
    "isoeugenol": "Fragrance allergen; among the more potent sensitisers on the list.",
    "alpha-isomethyl ionone": "Fragrance allergen.",
    "amyl cinnamal": "Fragrance allergen.",
    "anisyl alcohol": "Fragrance allergen.",
    "butylphenyl methylpropional": "Fragrance allergen (lilial); restricted/banned in some regions.",
    "evernia prunastri": "Oakmoss extract; potent fragrance sensitiser.",
    "evernia furfuracea": "Treemoss extract; potent fragrance sensitiser.",
    "methyl 2-octynoate": "Fragrance allergen.",
    "parfum": "Undisclosed fragrance blend; the single most common cause of cosmetic contact allergy.",
    "fragrance": "Undisclosed fragrance blend; the single most common cause of cosmetic contact allergy.",
    "aroma": "Undisclosed fragrance blend (flavour/fragrance); common allergy trigger.",
}

ESSENTIAL_OIL_PHOTOTOXIC = {
    "citrus aurantium bergamia": "Bergamot oil; contains bergapten, a known phototoxic/photoallergenic compound.",
    "citrus limon": "Lemon oil; phototoxic in unrefined form.",
    "citrus aurantium dulcis": "Sweet orange oil; can be phototoxic/irritating.",
    "cananga odorata": "Ylang-ylang; frequent sensitiser.",
    "melaleuca alternifolia": "Tea tree oil; oxidises into stronger sensitiser with air/light exposure.",
}

OTHER_SENSITIZERS = {
    "propolis": "Bee-derived resin; one of the more common cosmetic allergens, cross-reacts with bee-sting allergy.",
    "lanolin": "Wool-derived; well-documented sensitiser, especially on already-irritated/eczematous skin.",
    "carmine": "Insect-derived red pigment (cochineal); documented allergen, occasionally severe reactions.",
    "methylisothiazolinone": "Preservative; one of the leading causes of allergic contact dermatitis in leave-on products.",
    "methylchloroisothiazolinone": "Preservative (often paired with MI); strong sensitiser.",
    "quaternium-15": "Formaldehyde-releasing preservative.",
    "dmdm hydantoin": "Formaldehyde-releasing preservative.",
    "imidazolidinyl urea": "Formaldehyde-releasing preservative.",
    "diazolidinyl urea": "Formaldehyde-releasing preservative.",
    "toluene": "Solvent found in some nail/lash products; irritant and sensitiser.",
    "formaldehyde": "Direct formaldehyde; known human sensitiser/carcinogen at high exposure.",
    "nickel": "Trace metal contaminant in some mineral pigments; among the most common contact allergens overall.",
    "para-phenylenediamine": "PPD; potent allergen found in some dark eyeliners/dyes.",
    "cocamidopropyl betaine": "Surfactant; amidoamine impurities are a recognised allergen, especially in rinse-off cleansers.",
}

COMEDOGENIC = {
    "isopropyl myristate": "high",
    "isopropyl palmitate": "moderate",
    "coconut oil": "high",
    "cocos nucifera": "high",
    "cocoa butter": "moderate",
    "theobroma cacao": "moderate",
    "lanolin": "moderate",
    "algae extract": "low",
    "oleic acid": "moderate",
    "bismuth oxychloride": "moderate",
    "octyldodecanol": "low",
}

DRYING_IRRITANT = {
    "alcohol denat": "Denatured alcohol; can strip lipid barrier, worsening dryness/eczema/rosacea.",
    "witch hazel": "Tannin-rich astringent; can be drying/irritating on compromised barriers.",
    "menthol": "Cooling agent; can irritate sensitised or rosacea-prone skin.",
    "peppermint oil": "Can irritate sensitised or rosacea-prone skin.",
    "sodium lauryl sulfate": "Strong surfactant; can strip barrier lipids.",
}

RETINOID_ACID_ACTIVES = {
    "retinol": "Vitamin A derivative; photosensitising, generally not needed/recommended pre-puberty or on undamaged teen skin; caution in pregnancy.",
    "retinal": "Vitamin A derivative (retinaldehyde); same cautions as retinol.",
    "retinyl palmitate": "Vitamin A derivative; milder, same general cautions apply.",
    "glycolic acid": "AHA exfoliant; increases sun sensitivity.",
    "lactic acid": "AHA exfoliant; increases sun sensitivity (milder than glycolic).",
    "salicylic acid": "BHA exfoliant; generally pregnancy-caution at higher leave-on concentrations.",
    "hydroquinone": "Skin-lightening agent; prescription-strength use should be medically supervised, avoid in pregnancy.",
}

BISMUTH_MICA_HEAVY = {"bismuth oxychloride": "Can cause itching/irritation with prolonged wear in some users, especially on compromised skin."}

# Merge everything into one lookup with category tags for reporting
ALLERGEN_DB = {}
for k, v in FRAGRANCE_ALLERGENS.items():
    ALLERGEN_DB[k] = {"category": "fragrance_allergen", "severity": "moderate", "note": v}
for k, v in ESSENTIAL_OIL_PHOTOTOXIC.items():
    ALLERGEN_DB[k] = {"category": "phototoxic_essential_oil", "severity": "moderate", "note": v}
for k, v in OTHER_SENSITIZERS.items():
    ALLERGEN_DB[k] = {"category": "sensitizer_preservative_or_metal", "severity": "high", "note": v}
for k, v in DRYING_IRRITANT.items():
    ALLERGEN_DB[k] = {"category": "drying_irritant", "severity": "low", "note": v}
for k, v in RETINOID_ACID_ACTIVES.items():
    ALLERGEN_DB[k] = {"category": "active_ingredient_caution", "severity": "moderate", "note": v}


def normalize(text):
    return re.sub(r"[^a-z0-9\s\-]", "", text.lower()).strip()


def find_matches(ingredients):
    """Return list of (matched_db_key, ingredient_text, info_dict)."""
    hits = []
    norm_ings = [(ing, normalize(ing)) for ing in ingredients]
    for db_key, info in ALLERGEN_DB.items():
        for original, norm in norm_ings:
            if db_key in norm:
                hits.append((db_key, original, info))
    # comedogenic separately (severity depends on match)
    for db_key, sev in COMEDOGENIC.items():
        for original, norm in norm_ings:
            if db_key in norm:
                hits.append((db_key, original, {"category": "comedogenic", "severity": sev,
                                                 "note": "May clog pores / worsen breakouts on acne-prone skin."}))
    return hits


# ---------------------------------------------------------------------------
# 2. AGE-GROUP & SKIN-CONDITION RULES
# ---------------------------------------------------------------------------
AGE_GROUPS = ["teen", "adult", "mature"]
SKIN_CONDITIONS = ["sensitive", "acne_prone", "eczema", "rosacea", "pregnancy", "none"]


def evaluate_product(hits, age_group, skin_condition):
    """
    Given ingredient hits for one product, decide which flags apply for a
    given age_group / skin_condition combination. Returns list of flag dicts.
    """
    flags = []
    categories_present = {h[2]["category"] for h in hits}

    # -- Universal fragrance/sensitizer flag (relevant to everyone, but
    #    called out more strongly for sensitive/eczema/pregnancy) --
    if "fragrance_allergen" in categories_present or "sensitizer_preservative_or_metal" in categories_present:
        base_note = "Contains ingredient(s) recognised as common contact allergens."
        if skin_condition in ("sensitive", "eczema"):
            flags.append({"flag": "fragrance_or_sensitizer_present", "risk": "elevated",
                           "reason": base_note + " Higher relevance for sensitive/eczema-prone skin."})
        else:
            flags.append({"flag": "fragrance_or_sensitizer_present", "risk": "standard",
                           "reason": base_note})

    # -- Phototoxic essential oils --
    if "phototoxic_essential_oil" in categories_present:
        flags.append({"flag": "phototoxic_ingredient_present", "risk": "elevated",
                       "reason": "Contains an essential oil with documented phototoxic/photoallergenic potential; "
                                 "avoid sun exposure shortly after application or ensure SPF is worn."})

    # -- Active ingredient cautions (retinoids/acids) --
    if "active_ingredient_caution" in categories_present:
        if age_group == "teen":
            flags.append({"flag": "active_ingredient_age_caution", "risk": "elevated",
                           "reason": "Contains a retinoid/acid active generally unnecessary for teen skin and "
                                     "which increases sun sensitivity; not a safety hazard but low priority for this age group."})
        if skin_condition == "pregnancy":
            flags.append({"flag": "active_ingredient_pregnancy_caution", "risk": "elevated",
                           "reason": "Contains an ingredient (retinoid, hydroquinone, or high-dose salicylic acid) "
                                     "typically advised against in pregnancy; check with a doctor before use."})
        if age_group == "mature":
            flags.append({"flag": "active_ingredient_mature_note", "risk": "standard",
                           "reason": "Contains a retinoid/AHA/BHA active; commonly tolerated at this age but "
                                     "increases sun sensitivity, so daily SPF is important."})

    # -- Comedogenic ingredients for acne-prone skin --
    if "comedogenic" in categories_present and skin_condition == "acne_prone":
        high = any(h[2]["category"] == "comedogenic" and h[2]["severity"] == "high" for h in hits)
        flags.append({"flag": "comedogenic_ingredient_present", "risk": "elevated" if high else "standard",
                       "reason": "Contains ingredient(s) with a history of pore-clogging/breakout potential; "
                                 "relevant for acne-prone skin specifically."})
    # Teens statistically have higher rates of active acne — surface as an informational (not diagnostic) note
    if "comedogenic" in categories_present and age_group == "teen" and skin_condition in ("none", "acne_prone"):
        flags.append({"flag": "comedogenic_teen_note", "risk": "standard",
                       "reason": "Contains pore-clogging-prone ingredients; worth knowing since acne is common in the teen years."})

    # -- Drying/irritant ingredients --
    if "drying_irritant" in categories_present and skin_condition in ("eczema", "rosacea", "sensitive"):
        flags.append({"flag": "drying_or_irritant_present", "risk": "elevated",
                       "reason": "Contains alcohol/astringent-type ingredients that can further compromise an "
                                 "already-reactive or dry/eczema-prone/rosacea-prone barrier."})

    return flags


# ---------------------------------------------------------------------------
# 3. MAIN
# ---------------------------------------------------------------------------
def main():
    if len(sys.argv) < 3:
        print("Usage: python3 allergy_flag_engine.py <input_products.json> <output_prefix>")
        sys.exit(1)

    input_path, out_prefix = sys.argv[1], sys.argv[2]
    with open(input_path) as f:
        products = json.load(f)

    rows = []  # flat rows for CSV
    json_out = []  # per-product nested structure

    for p in products:
        ingredients = p.get("clean_ingredients", [])
        hits = find_matches(ingredients)
        matched_ingredient_summary = sorted({f"{h[1]} ({h[2]['category']})" for h in hits})

        product_entry = {
            "id": p["id"],
            "name": p.get("name"),
            "category": p.get("category"),
            "matched_ingredients": matched_ingredient_summary,
            "flags_by_profile": {},
        }

        any_flag_found = False
        for age in AGE_GROUPS:
            for cond in SKIN_CONDITIONS:
                flags = evaluate_product(hits, age, cond)
                if flags:
                    any_flag_found = True
                    key = f"{age}__{cond}"
                    product_entry["flags_by_profile"][key] = flags
                    for fl in flags:
                        rows.append({
                            "product_id": p["id"],
                            "product_name": p.get("name"),
                            "category": p.get("category"),
                            "age_group": age,
                            "skin_condition": cond,
                            "flag": fl["flag"],
                            "risk": fl["risk"],
                            "reason": fl["reason"],
                        })

        product_entry["has_any_flag"] = any_flag_found
        json_out.append(product_entry)

    with open(f"{out_prefix}.json", "w") as f:
        json.dump({
            "disclaimer": (
                "Informational ingredient-based screening only. This is NOT a medical diagnosis "
                "and does not replace a dermatologist patch test or professional allergy assessment. "
                "Absence of a flag does not guarantee a product is allergen-free for a given individual."
            ),
            "products": json_out,
        }, f, indent=2)

    fieldnames = ["product_id", "product_name", "category", "age_group", "skin_condition", "flag", "risk", "reason"]
    with open(f"{out_prefix}.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    flagged_products = sum(1 for p in json_out if p["has_any_flag"])
    print(f"Processed {len(products)} products.")
    print(f"{flagged_products} products have at least one flag in at least one profile.")
    print(f"{len(rows)} total (product x age x skin-condition x flag) rows written.")
    print(f"Wrote {out_prefix}.json and {out_prefix}.csv")


if __name__ == "__main__":
    main()
