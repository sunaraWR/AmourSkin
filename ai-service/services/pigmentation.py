import cv2
import numpy as np


def _pigmentation_score_on_region(region_bgr) -> float:
    lab = cv2.cvtColor(region_bgr, cv2.COLOR_BGR2LAB)
    l_channel = lab[:, :, 0].astype(np.float32)

    mean_l = float(np.mean(l_channel))
    std_l = float(np.std(l_channel))

    # Darker-than-average regions
    dark_threshold = mean_l - (0.8 * std_l)
    dark_mask = l_channel < dark_threshold

    dark_area_ratio = np.sum(dark_mask) / dark_mask.size

    pigmentation_score = dark_area_ratio * 100
    pigmentation_score = min(pigmentation_score * 3, 100)

    return round(float(pigmentation_score), 2)


def get_pigmentation_regions(face_bgr):
    """
    Return safer skin regions to avoid beard/jawline/eyes/eyebrows.
    Regions: left cheek (upper), right cheek (upper), forehead center.
    """
    h, w = face_bgr.shape[:2]

    # Forehead (center)
    fh = face_bgr[int(h * 0.14) : int(h * 0.28), int(w * 0.35) : int(w * 0.65)]

    # Cheeks (upper-mid, avoid jaw/beard area)
    left = face_bgr[int(h * 0.38) : int(h * 0.55), int(w * 0.18) : int(w * 0.40)]
    right = face_bgr[int(h * 0.38) : int(h * 0.55), int(w * 0.60) : int(w * 0.82)]

    regions = [r for r in (left, right, fh) if r.size > 0]
    return regions


def calculate_pigmentation_score(face_bgr) -> float:
    regions = get_pigmentation_regions(face_bgr)
    if not regions:
        return round(float(_pigmentation_score_on_region(face_bgr)), 2)

    scores = [_pigmentation_score_on_region(r) for r in regions]
    return round(float(np.mean(scores)), 2)

