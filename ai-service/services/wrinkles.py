import cv2
import numpy as np
from skimage.feature import local_binary_pattern


def calculate_wrinkle_score(face) -> float:
    gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)

    filtered = cv2.bilateralFilter(gray, 9, 75, 75)

    edges = cv2.Canny(filtered, 60, 120)

    edge_ratio = np.sum(edges > 0) / edges.size

    wrinkle_score = edge_ratio * 1000
    wrinkle_score = min(wrinkle_score, 100)

    return round(float(wrinkle_score), 2)


def calculate_texture_score(face) -> float:
    gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)

    radius = 2
    points = 8 * radius

    lbp = local_binary_pattern(gray, points, radius, method="uniform")

    hist, _ = np.histogram(
        lbp.ravel(), bins=np.arange(0, points + 3), range=(0, points + 2)
    )

    hist = hist.astype("float")
    hist /= hist.sum() + 1e-6

    texture_complexity = np.std(hist) * 1000
    texture_score = min(texture_complexity, 100)

    return round(float(texture_score), 2)

