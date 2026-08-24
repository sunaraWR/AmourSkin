import cv2
import numpy as np


def calculate_contrast_score(face_bgr) -> float:
    """Contrast as std-dev of V channel (0..100 scaled)."""
    hsv = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2HSV)
    v = hsv[:, :, 2].astype(np.float32)
    score = float(np.std(v) / 64.0 * 100.0)  # ~64 std ~ "100"
    return round(float(np.clip(score, 0, 100)), 2)


def calculate_redness_score(face_bgr) -> float:
    """Redness proxy from LAB a* channel (0..100)."""
    lab = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2LAB)
    a = lab[:, :, 1].astype(np.float32)  # 0..255, 128 ~ neutral
    a_centered = a - 128.0
    score = float(np.mean(np.maximum(a_centered, 0.0)) / 40.0 * 100.0)
    return round(float(np.clip(score, 0, 100)), 2)


def redness_visual(face_bgr):
    lab = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2LAB)
    a = lab[:, :, 1].astype(np.float32)
    heat = np.maximum(a - 128.0, 0.0)
    heat = (heat / (np.max(heat) + 1e-6) * 255.0).astype(np.uint8)
    return cv2.applyColorMap(heat, cv2.COLORMAP_JET)


def calculate_shine_score(face_bgr) -> float:
    """
    Shine/specular proxy: ratio of very-bright, low-saturation pixels.
    Returns 0..100.
    """
    hsv = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2HSV)
    s = hsv[:, :, 1].astype(np.float32)
    v = hsv[:, :, 2].astype(np.float32)
    mask = (v > 225) & (s < 45)
    ratio = float(np.sum(mask) / mask.size)
    score = ratio * 2000.0
    return round(float(np.clip(score, 0, 100)), 2)


def shine_visual(face_bgr):
    hsv = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2HSV)
    s = hsv[:, :, 1].astype(np.float32)
    v = hsv[:, :, 2].astype(np.float32)
    mask = ((v > 225) & (s < 45)).astype(np.uint8) * 255
    mask3 = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
    overlay = face_bgr.copy()
    overlay[:, :, 2] = np.maximum(overlay[:, :, 2], mask)  # highlight in red channel
    return cv2.addWeighted(mask3, 0.2, overlay, 0.8, 0)


def _under_eye_region(face_bgr):
    h, w = face_bgr.shape[:2]
    # Under-eye band: upper-middle area
    x1 = int(w * 0.25)
    x2 = int(w * 0.75)
    y1 = int(h * 0.28)
    y2 = int(h * 0.45)
    return face_bgr[y1:y2, x1:x2]


def _cheek_region(face_bgr):
    h, w = face_bgr.shape[:2]
    x1 = int(w * 0.30)
    x2 = int(w * 0.70)
    y1 = int(h * 0.50)
    y2 = int(h * 0.72)
    return face_bgr[y1:y2, x1:x2]


def calculate_dark_circle_score(face_bgr) -> float:
    """
    Under-eye darkness relative to cheeks using L* difference.
    0..100 where higher means darker under-eye area.
    """
    ue = _under_eye_region(face_bgr)
    ck = _cheek_region(face_bgr)
    lab_ue = cv2.cvtColor(ue, cv2.COLOR_BGR2LAB)
    lab_ck = cv2.cvtColor(ck, cv2.COLOR_BGR2LAB)
    l_ue = float(np.mean(lab_ue[:, :, 0]))
    l_ck = float(np.mean(lab_ck[:, :, 0]))
    diff = max(0.0, l_ck - l_ue)  # bigger diff => under-eye darker
    raw = diff / 25.0 * 100.0
    score = min(raw * 1.5, 85.0)
    return round(float(np.clip(score, 0, 85)), 2)


def dark_circle_visual(face_bgr):
    ue = _under_eye_region(face_bgr)
    lab = cv2.cvtColor(ue, cv2.COLOR_BGR2LAB)
    l = lab[:, :, 0].astype(np.float32)
    inv = (255.0 - l)
    inv = (inv / (np.max(inv) + 1e-6) * 255.0).astype(np.uint8)
    return cv2.applyColorMap(inv, cv2.COLORMAP_BONE)


def calculate_pore_score(face_bgr) -> float:
    """
    Pore/high-frequency proxy from high-pass energy.
    0..100 where higher means more high-frequency detail.
    """
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    blur = cv2.GaussianBlur(gray, (0, 0), 2.0)
    high = np.abs(gray - blur)
    energy = float(np.mean(high))
    score = energy / 12.0 * 100.0
    return round(float(np.clip(score, 0, 100)), 2)


def pore_visual(face_bgr):
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    blur = cv2.GaussianBlur(gray, (0, 0), 2.0)
    high = np.abs(gray - blur)
    high = np.clip(high / (np.max(high) + 1e-6) * 255.0, 0, 255).astype(np.uint8)
    return cv2.applyColorMap(high, cv2.COLORMAP_TURBO)


def calculate_symmetry_score(face_bgr):
    """
    Simple left-right symmetry proxy: compare grayscale vs mirrored half.
    0..100 where 100 is perfectly symmetric.
    """
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    h, w = gray.shape[:2]
    half = w // 2
    if half < 20:
        return None
    left = gray[:, :half]
    right = gray[:, w - half :]
    right_m = cv2.flip(right, 1)
    diff = float(np.mean(np.abs(left - right_m)))
    if not np.isfinite(diff):
        return None
    score = 100.0 - (diff / 40.0 * 100.0)
    return round(float(np.clip(score, 0, 100)), 2)


def symmetry_visual(face_bgr):
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    h, w = gray.shape[:2]
    half = w // 2
    if half < 20:
        return None
    left = gray[:, :half]
    right = gray[:, w - half :]
    right_m = cv2.flip(right, 1)
    diff = np.abs(left - right_m)
    diff = np.clip(diff / (np.max(diff) + 1e-6) * 255.0, 0, 255).astype(np.uint8)
    return cv2.applyColorMap(diff, cv2.COLORMAP_MAGMA)

