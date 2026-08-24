import cv2
import numpy as np
import math


def get_skin_regions(face):
    """
    Return multiple safer regions for tone/undertone:
    - Forehead center (avoid hairline)
    - Upper cheeks (avoid beard/jaw/mouth)
    """
    h, w, _ = face.shape

    forehead = face[int(h * 0.14) : int(h * 0.28), int(w * 0.35) : int(w * 0.65)]
    left_cheek = face[int(h * 0.36) : int(h * 0.52), int(w * 0.20) : int(w * 0.42)]
    right_cheek = face[int(h * 0.36) : int(h * 0.52), int(w * 0.58) : int(w * 0.80)]

    regions = [r for r in (forehead, left_cheek, right_cheek) if r.size > 0]
    return regions


def calculate_ita_score(face) -> float:
    regions = get_skin_regions(face)
    if not regions:
        regions = [face]

    ita_values = []
    for region in regions:
        lab = cv2.cvtColor(region, cv2.COLOR_BGR2LAB)

        l_mean = np.mean(lab[:, :, 0]) * (100 / 255)
        b_mean = np.mean(lab[:, :, 2]) - 128

        if b_mean == 0:
            b_mean = 0.0001

        ita = math.degrees(math.atan((l_mean - 50) / b_mean))
        ita_values.append(float(ita))

    return round(float(np.mean(ita_values)), 2)


def classify_skin_tone(ita: float) -> str:
    if ita > 55:
        return "Very light"
    elif ita > 41:
        return "Light"
    elif ita > 28:
        return "Intermediate"
    elif ita > 10:
        return "Tan"
    elif ita > -30:
        return "Brown"
    else:
        return "Dark"


def estimate_undertone(face):
    regions = get_skin_regions(face)
    if not regions:
        regions = [face]

    yellow_scores = []
    pink_scores = []

    for region in regions:
        rgb = cv2.cvtColor(region, cv2.COLOR_BGR2RGB)
        r_mean = float(np.mean(rgb[:, :, 0]))
        g_mean = float(np.mean(rgb[:, :, 1]))
        b_mean = float(np.mean(rgb[:, :, 2]))

        yellow_scores.append(r_mean + g_mean - b_mean)
        pink_scores.append(r_mean - g_mean)

    yellow_score = float(np.mean(yellow_scores))
    pink_score = float(np.mean(pink_scores))

    if yellow_score > 180 and pink_score < 20:
        undertone = "Warm"
    elif pink_score > 20:
        undertone = "Cool"
    else:
        undertone = "Neutral"

    confidence = min(abs(yellow_score - pink_score) / 100, 1.0)

    return {"undertone": undertone, "confidence": round(float(confidence), 2)}

