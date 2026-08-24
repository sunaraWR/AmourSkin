import logging
import numpy as np
from uniface.analyzer import FaceAnalyzer
from uniface.attribute import AgeGender
from uniface.detection import RetinaFace

logger = logging.getLogger(__name__)

# Initialize UniFace analyzer with AgeGender attribute (lazy-loaded on first use)
_analyzer = None


def _get_analyzer():
    """Get or create the FaceAnalyzer instance with AgeGender attribute."""
    global _analyzer
    if _analyzer is None:
        try:
            _analyzer = FaceAnalyzer(
                RetinaFace(),
                attributes=[AgeGender()],
            )
            logger.info("UniFace FaceAnalyzer initialized with AgeGender attribute")
        except Exception as exc:
            logger.error("Failed to initialize UniFace analyzer: %s", exc)
            raise
    return _analyzer


def analyze_age_gender(image):
    """Analyze age and gender from an image using UniFace.
    
    Args:
        image: OpenCV image (BGR format, numpy array)
        
    Returns:
        dict with keys: age (int or None), gender (str), gender_age_source (str)
    """
    if image is None:
        return {"age": None, "gender": "unknown", "gender_age_source": "fallback"}

    if not isinstance(image, np.ndarray):
        return {"age": None, "gender": "unknown", "gender_age_source": "fallback"}

    try:
        analyzer = _get_analyzer()
        faces = analyzer.analyze(image)
        
        if not faces:
            logger.warning("No faces detected in image")
            return {"age": None, "gender": "unknown", "gender_age_source": "fallback"}
        
        # Use the first (most confident) face
        face = faces[0]
        
        # Extract age and gender from the face object
        # face.sex is a property that returns "Female" or "Male"
        age = face.age if hasattr(face, 'age') and face.age is not None else None
        sex = face.sex if hasattr(face, 'sex') and face.sex else None
        gender = sex.lower() if sex else "unknown"
        
        return {
            "age": int(age) if age is not None else None,
            "gender": gender,
            "gender_age_source": "uniface",
        }
    except Exception as exc:
        logger.warning("Age/gender detection unavailable: %s", exc)
        return {"age": None, "gender": "unknown", "gender_age_source": "fallback"}
