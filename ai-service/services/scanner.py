import base64

import cv2
import numpy as np

from services.preprocess import (
    load_image,
    detect_face,
    calculate_blur_score,
    calculate_brightness_score,
    normalize_brightness,
    get_quality_status,
    estimate_quality_confidence,
)

from services.skin_tone import calculate_ita_score, classify_skin_tone, estimate_undertone

from services.pigmentation import calculate_pigmentation_score
from services.wrinkles import calculate_wrinkle_score, calculate_texture_score
from services.features import (
    calculate_contrast_score,
    calculate_redness_score,
    calculate_shine_score,
    calculate_dark_circle_score,
    calculate_pore_score,
    calculate_symmetry_score,
    redness_visual,
    shine_visual,
    dark_circle_visual,
    pore_visual,
    symmetry_visual,
)
from services.age_gender import analyze_age_gender
from services.skin_type import classify_skin_type


def _to_data_url_bgr(image_bgr, max_size: int = 512, quality: int = 85) -> str:
    if image_bgr is None:
        return ""

    h, w = image_bgr.shape[:2]
    scale = min(1.0, float(max_size) / max(h, w))
    if scale < 1.0:
        image_bgr = cv2.resize(image_bgr, (int(w * scale), int(h * scale)))

    ok, buf = cv2.imencode(".jpg", image_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), int(quality)])
    if not ok:
        return ""

    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def _edges_visual(face_bgr):
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    filtered = cv2.bilateralFilter(gray, 9, 75, 75)
    edges = cv2.Canny(filtered, 60, 120)
    return cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)


def _pigmentation_mask_visual(face_bgr):
    lab = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2LAB)
    l_channel = lab[:, :, 0]

    mean_l = float(np.mean(l_channel))
    std_l = float(np.std(l_channel))

    dark_threshold = mean_l - (0.8 * std_l)
    dark_mask = (l_channel < dark_threshold).astype(np.uint8) * 255

    # Make mask easy to interpret
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_DILATE, kernel, iterations=1)

    return cv2.cvtColor(dark_mask, cv2.COLOR_GRAY2BGR)


def _lbp_visual(face_bgr):
    # Lightweight “texture map” visualization (not used for scoring directly here)
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    lbp_like = cv2.Laplacian(gray, cv2.CV_32F)
    lbp_like = np.absolute(lbp_like)
    lbp_like = np.clip(lbp_like / (np.max(lbp_like) + 1e-6) * 255.0, 0, 255).astype(np.uint8)
    return cv2.applyColorMap(lbp_like, cv2.COLORMAP_TURBO)


def analyze_face(image_path: str, include_layers: bool = False):
    image = load_image(image_path)

    # Detect the face first so brightness and blur are measured on the actual face region.
    face_crop = detect_face(image)
    age_gender = analyze_age_gender(face_crop)
    blur_score = calculate_blur_score(face_crop)
    brightness_score = calculate_brightness_score(face_crop)
    quality_confidence = estimate_quality_confidence(blur_score, brightness_score)
    quality_status = get_quality_status(blur_score, brightness_score)

    if quality_status != "Good":
        out = {
            "image_quality": quality_status,
            "blur_score": blur_score,
            "brightness_score": brightness_score,
            "quality_confidence": quality_confidence,
            "age": age_gender["age"],
            "gender": age_gender["gender"],
            "gender_age_source": age_gender["gender_age_source"],
            "message": (
                "Photo is too dark or blurry for reliable analysis. "
                "Please retake the photo in brighter, even lighting."
            ),
        }
        if include_layers:
            out["layers"] = [
                {"key": "original", "label": "Original", "image": _to_data_url_bgr(image)},
            ]
        return out

    face = normalize_brightness(face_crop)

    ita_score = calculate_ita_score(face)
    skin_tone = classify_skin_tone(ita_score)
    undertone_result = estimate_undertone(face)

    pigmentation_score = calculate_pigmentation_score(face)
    wrinkle_score = calculate_wrinkle_score(face)
    texture_score = calculate_texture_score(face)

    contrast_score = calculate_contrast_score(face)
    redness_score = calculate_redness_score(face)
    shine_score = calculate_shine_score(face)
    under_eye_shadow_score = calculate_dark_circle_score(face)
    pore_score = calculate_pore_score(face)
    symmetry_score = calculate_symmetry_score(face)

    skin_type_result = classify_skin_type(
        shine_score=shine_score,
        pore_score=pore_score,
        redness_score=redness_score,
        face_image=face,
    )

    analysis_confidence = round(
        float(
            np.clip(
                0.5 * quality_confidence
                + 0.35 * skin_type_result.get("confidence", 0.0)
                + 0.15 * min(1.0, contrast_score / 100.0),
                0.0,
                1.0,
            )
        ),
        4,
    )

    out = {
        "analysis_confidence": analysis_confidence,
        "quality_confidence": quality_confidence,
        "contrast_score": contrast_score,
        "image_quality": quality_status,
        "blur_score": blur_score,
        "brightness_score": brightness_score,
        "age": age_gender["age"],
        "gender": age_gender["gender"],
        "gender_age_source": age_gender["gender_age_source"],
        "ita_score": ita_score,
        "skin_tone": skin_tone,
        "undertone": undertone_result["undertone"],
        "undertone_confidence": undertone_result["confidence"],
        "pigmentation_score": pigmentation_score,
        "wrinkle_score": wrinkle_score,
        "texture_score": texture_score,
        "contrast_score": contrast_score,
        "redness_score": redness_score,
        "shine_score": shine_score,
        "under_eye_shadow_score": under_eye_shadow_score,
        "pore_score": pore_score,
        "symmetry_score": symmetry_score,
        "skin_type": skin_type_result["skin_type"],
        "skin_type_confidence": skin_type_result["confidence"],
        "skin_type_details": {
            "oiliness_score": skin_type_result["oiliness_score"],
            "dryness_score": skin_type_result["dryness_score"],
        },
    }

    if include_layers:
        normalized_face = normalize_brightness(detect_face(image))
        symmetry_img = symmetry_visual(face)

        out["layers"] = [
            {"key": "original", "label": "Original", "image": _to_data_url_bgr(image)},
            {"key": "face", "label": "Detected face", "image": _to_data_url_bgr(face)},
            {
                "key": "normalized",
                "label": "Brightness normalized",
                "image": _to_data_url_bgr(normalized_face),
            },
            {"key": "wrinkle_edges", "label": "Wrinkle edges", "image": _to_data_url_bgr(_edges_visual(face))},
            {
                "key": "pigmentation_mask",
                "label": "Pigmentation mask",
                "image": _to_data_url_bgr(_pigmentation_mask_visual(face)),
            },
            {"key": "texture_map", "label": "Texture map", "image": _to_data_url_bgr(_lbp_visual(face))},
            {"key": "redness_map", "label": "Redness heatmap", "image": _to_data_url_bgr(redness_visual(face))},
            {"key": "shine_map", "label": "Shine highlights", "image": _to_data_url_bgr(shine_visual(face))},
            {
                "key": "dark_circles",
                "label": "Under-eye shadow",
                "image": _to_data_url_bgr(dark_circle_visual(face)),
            },
            {"key": "pores_map", "label": "Pores / high-frequency", "image": _to_data_url_bgr(pore_visual(face))},
            {
                "key": "symmetry_diff",
                "label": "Symmetry difference",
                "image": _to_data_url_bgr(symmetry_img) if symmetry_img is not None else "",
            },
        ]

    return out

