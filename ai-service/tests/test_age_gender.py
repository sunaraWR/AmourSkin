import numpy as np

from services.age_gender import analyze_age_gender


def test_analyze_age_gender_returns_fallback_when_model_fails(monkeypatch):
    def raise_error(_image):
        raise RuntimeError("model unavailable")

    monkeypatch.setattr("services.age_gender._predict_with_deepface", raise_error)

    result = analyze_age_gender(np.zeros((120, 120, 3), dtype=np.uint8))

    assert result["age"] is None
    assert result["gender"] == "unknown"
    assert result["gender_age_source"] == "fallback"
