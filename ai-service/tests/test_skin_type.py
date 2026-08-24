import numpy as np

from services.skin_type import classify_skin_type


def test_classify_skin_type_uses_model_for_face_images():
    face_image = np.zeros((128, 128, 3), dtype=np.uint8)
    result = classify_skin_type(face_image=face_image)

    assert result["skin_type"] in {"dry", "normal", "oily"}
    assert 0.0 <= result["confidence"] <= 1.0


def test_classify_skin_type_returns_oily_for_shiny_high_pore_images():
    result = classify_skin_type(shine_score=78.0, pore_score=70.0, redness_score=20.0)

    assert result["skin_type"] == "oily"
    assert result["confidence"] >= 0.7


def test_classify_skin_type_returns_dry_for_low_shine_and_low_pores():
    result = classify_skin_type(shine_score=10.0, pore_score=12.0, redness_score=18.0)

    assert result["skin_type"] == "dry"
    assert result["confidence"] >= 0.7


def test_classify_skin_type_returns_normal_for_balanced_scores():
    result = classify_skin_type(shine_score=35.0, pore_score=30.0, redness_score=25.0)

    assert result["skin_type"] == "normal"
