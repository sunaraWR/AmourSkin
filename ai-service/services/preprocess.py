import cv2
import numpy as np


def load_image(image_path: str):
    image = cv2.imread(image_path)

    if image is None:
        raise ValueError("Invalid image file")

    return image


def detect_face(image):
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100)
    )

    if len(faces) == 0:
        raise ValueError("No face detected. Please upload a clear front-facing image.")

    # Pick the largest face
    faces = sorted(faces, key=lambda box: box[2] * box[3], reverse=True)
    x, y, w, h = faces[0]

    face = image[y : y + h, x : x + w]

    return face


def calculate_blur_score(image) -> float:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    score = cv2.Laplacian(gray, cv2.CV_64F).var()
    return round(float(score), 2)


def calculate_brightness_score(image) -> float:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    brightness = np.mean(hsv[:, :, 2])
    return round(float(brightness), 2)


def normalize_brightness(image):
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    corrected_l = clahe.apply(l_channel)

    corrected_lab = cv2.merge((corrected_l, a_channel, b_channel))
    corrected_image = cv2.cvtColor(corrected_lab, cv2.COLOR_LAB2BGR)

    return corrected_image


def get_quality_status(blur_score: float, brightness_score: float) -> str:
    if blur_score < 80:
        return "Blurry"

    if brightness_score < 60:
        return "Too dark"

    if brightness_score > 220:
        return "Too bright"

    return "Good"


def estimate_quality_confidence(blur_score: float, brightness_score: float) -> float:
    blur_conf = min(max(blur_score / 120.0, 0.0), 1.0)
    if brightness_score < 80:
        bright_conf = max(brightness_score / 80.0, 0.0)
    elif brightness_score > 220:
        bright_conf = max((255.0 - brightness_score) / 35.0, 0.0)
    else:
        bright_conf = 1.0

    return round(float(np.clip((blur_conf * 0.65 + bright_conf * 0.35), 0.0, 1.0)), 4)

