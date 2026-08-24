import json
from pathlib import Path

import cv2
import numpy as np
from tensorflow.keras.models import load_model

_MODEL = None
_LABELS = None


def _heuristic_skin_type(shine_score: float, pore_score: float, redness_score: float):
    shine_score = float(shine_score or 0.0)
    pore_score = float(pore_score or 0.0)
    redness_score = float(redness_score or 0.0)

    oiliness_score = 0.5 * (shine_score / 100.0) + 0.3 * (pore_score / 100.0) + 0.2 * (1.0 - (redness_score / 100.0))
    dryness_score = 0.5 * (1.0 - (shine_score / 100.0)) + 0.3 * (1.0 - (pore_score / 100.0)) + 0.2 * (redness_score / 100.0)

    if oiliness_score >= 0.60 and oiliness_score >= dryness_score + 0.08:
        skin_type = "oily"
        confidence = round(min(0.95, 0.65 + oiliness_score * 0.3), 2)
    elif dryness_score >= 0.60 and dryness_score >= oiliness_score + 0.08:
        skin_type = "dry"
        confidence = round(min(0.95, 0.65 + dryness_score * 0.3), 2)
    else:
        skin_type = "normal"
        confidence = round(min(0.95, 0.6 + max(oiliness_score, dryness_score) * 0.2), 2)

    return {
        "skin_type": skin_type,
        "confidence": confidence,
        "oiliness_score": round(oiliness_score, 3),
        "dryness_score": round(dryness_score, 3),
    }


def _load_model_assets():
    global _MODEL, _LABELS

    if _MODEL is not None and _LABELS is not None:
        return _MODEL, _LABELS

    model_path = Path(__file__).resolve().parents[1] / "models" / "skin_type_model.keras"
    labels_path = Path(__file__).resolve().parents[1] / "models" / "skin_type_labels.json"

    if not model_path.exists() or not labels_path.exists():
        return None, None

    _MODEL = load_model(model_path, compile=False)
    _LABELS = json.loads(labels_path.read_text(encoding="utf-8"))
    return _MODEL, _LABELS


def _predict_with_trained_model(face_image):
    if face_image is None:
        return None

    try:
        image = np.asarray(face_image)
        if image.ndim == 2:
            image = np.repeat(image[..., None], 3, axis=-1)
        if image.ndim != 3 or image.shape[-1] != 3:
            return None

        image = image.astype(np.uint8)
        image = cv2.resize(image, (128, 128))
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        image = image.astype("float32") / 255.0
        image = np.expand_dims(image, axis=0)

        model, labels = _load_model_assets()
        if model is None or not labels:
            return None

        probabilities = model.predict(image, verbose=0)[0]
        class_index = int(np.argmax(probabilities))
        if class_index >= len(labels):
            return None

        return {
            "skin_type": labels[class_index],
            "confidence": round(float(probabilities[class_index]), 4),
        }
    except Exception:
        return None


def classify_skin_type(shine_score: float = None, pore_score: float = None, redness_score: float = None, face_image=None):
    """
    Classify skin type using the trained image model when a face crop is available,
    and fall back to the heuristic rules when the model is unavailable.
    """
    if face_image is not None:
        trained_result = _predict_with_trained_model(face_image)
        if trained_result is not None:
            heuristic_result = _heuristic_skin_type(shine_score, pore_score, redness_score)
            return {
                "skin_type": trained_result["skin_type"],
                "confidence": trained_result["confidence"],
                "oiliness_score": heuristic_result["oiliness_score"],
                "dryness_score": heuristic_result["dryness_score"],
            }

    return _heuristic_skin_type(shine_score, pore_score, redness_score)
