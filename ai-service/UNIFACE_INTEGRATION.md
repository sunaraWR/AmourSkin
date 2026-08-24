# UniFace Integration Guide

## Overview

The age and gender detection module has been upgraded from **DeepFace** to **UniFace**, a modern, lightweight, and production-ready face analysis library. This provides better performance, cleaner API, and more flexible model options.

## Key Improvements

| Feature | DeepFace | UniFace |
|---------|----------|---------|
| **Library Size** | Heavy | Lightweight (135 KB) |
| **Temp File Handling** | Creates temporary files | Direct memory processing |
| **Model Availability** | Limited | Multiple models (AgeGender, FairFace, Emotion) |
| **Performance** | Slower | Optimized ONNX models |
| **API** | File-based | Direct numpy array support |
| **Hardware Support** | Limited | CPU, ARM64, CUDA optimized |

## Installation

The library is installed automatically via `requirements.txt`:

```bash
pip install uniface[cpu]  # For CPU-only (default)
pip install uniface[gpu]  # For NVIDIA CUDA support
```

## Current Implementation

### File: `ai-service/services/age_gender.py`

The module provides a single function:

```python
def analyze_age_gender(image):
    """
    Analyze age and gender from an image using UniFace.
    
    Args:
        image: OpenCV image (BGR format, numpy array)
        
    Returns:
        dict with keys:
            - age: int or None (exact age in years)
            - gender: str ("male", "female", or "unknown")
            - gender_age_source: str ("uniface" or "fallback")
    """
```

### Usage Example

```python
import cv2
from services.age_gender import analyze_age_gender

# Load image
image = cv2.imread("photo.jpg")

# Analyze
result = analyze_age_gender(image)
print(f"Age: {result['age']}")
print(f"Gender: {result['gender']}")
print(f"Source: {result['gender_age_source']}")
```

### Output Format

Success case:
```json
{
    "age": 28,
    "gender": "male",
    "gender_age_source": "uniface"
}
```

Fallback case (no face or error):
```json
{
    "age": null,
    "gender": "unknown",
    "gender_age_source": "fallback"
}
```

## Architecture

### Lazy Initialization

The FaceAnalyzer is initialized on first use with lazy-loading:
- Models are downloaded automatically (cached in `~/.uniface/models/`)
- RetinaFace detector: Fast and accurate face detection
- AgeGender attribute: Predicts exact age and binary gender

### Error Handling

- **No faces detected**: Returns fallback with `age=None, gender="unknown"`
- **Invalid input (None, non-array)**: Returns fallback
- **Model errors**: Logs warning and returns fallback

## Integration Points

### Scanner Pipeline

The `analyze_age_gender()` function is called from:
- **File**: `ai-service/services/scanner.py`
- **Context**: Part of comprehensive face analysis pipeline
- **Returns to**: Flask endpoint `/api/scan/opencv`

### API Response

Age/gender results are included in the scan response:
```json
{
    "success": true,
    "result": {
        "age": 28,
        "gender": "male",
        "gender_age_source": "uniface",
        ...other_analysis_results...
    }
}
```

## Model Details

### AgeGender Model
- **Accuracy**: Trained on CelebA dataset
- **Input**: Face region (auto-extracted by detector)
- **Output**: 
  - `age`: Integer (0-100+)
  - `sex`: String ("Male" or "Female")
- **Size**: 8 MB
- **Speed**: Real-time inference

### Alternative: FairFace Model

For demographic parity (more balanced across races), you can switch to FairFace:

```python
from uniface.attribute import FairFace

# In _get_analyzer():
_analyzer = FaceAnalyzer(
    RetinaFace(),
    attributes=[FairFace()],  # Instead of AgeGender()
)
```

**FairFace output**:
- `sex`: "Male" or "Female"
- `age_group`: "20-29", "30-39", etc. (not exact age)
- `race`: "White", "Black", "Asian", etc.

## Model Caching

Models are automatically downloaded and cached:
- **Default location**: `~/.uniface/models/`
- **Override via environment variable**: 
  ```bash
  export UNIFACE_CACHE_DIR=/data/models
  ```
- **Or programmatically**:
  ```python
  from uniface.model_store import set_cache_dir
  set_cache_dir('/data/models')
  ```

## Hardware Acceleration

### CPU (Default)
```python
from uniface.detection import RetinaFace
detector = RetinaFace(providers=["CPUExecutionProvider"])
```

### NVIDIA CUDA
```bash
pip install uniface[gpu]
pip install faiss-gpu
```

### Apple Silicon
```bash
pip install uniface[cpu]  # Automatically optimized for ARM64
```

## Performance Notes

- **First inference**: Slightly slower (models downloading/warming up)
- **Subsequent calls**: Very fast (typically 50-100ms for face detection + attribute prediction)
- **GPU inference**: 2-5x faster than CPU
- **Batch processing**: Use `FaceAnalyzer.analyze()` with multiple faces

## Testing

Run the integration test:
```bash
cd ai-service
python test_uniface_integration.py
```

Expected output:
```
Tests passed: 3/3
✓ None image handled correctly
✓ Invalid input handled correctly
✓ Function executed successfully
```

## Common Issues & Solutions

### Issue: "No faces detected"
- **Cause**: Image quality too low, face too small, or poor lighting
- **Solution**: Ensure face occupies at least 50x50 pixels and is well-lit

### Issue: Slow first inference
- **Cause**: Models being downloaded and cached
- **Solution**: This happens only once; subsequent calls are fast

### Issue: "FaceAnalyzer.__init__() got an unexpected keyword argument"
- **Cause**: Using old API syntax (`predictors=` instead of `attributes=`)
- **Solution**: Update imports: `from uniface.analyzer import FaceAnalyzer`

### Issue: CUDA out of memory
- **Cause**: GPU memory exhausted
- **Solution**: Use CPU mode or process smaller batches

## Migration from DeepFace

### Before (DeepFace)
```python
from deepface import DeepFace

response = DeepFace.analyze(
    img_path="temp.jpg",  # File-based
    actions=["age", "gender"],
    enforce_detection=False,
    detector_backend="opencv",
)
age = int(response[0]["age"])
gender = response[0]["dominant_gender"]
```

### After (UniFace)
```python
from uniface.analyzer import FaceAnalyzer
from uniface.attribute import AgeGender

analyzer = FaceAnalyzer(RetinaFace(), attributes=[AgeGender()])
faces = analyzer.analyze(image)  # Direct numpy array
age = faces[0].age
gender = faces[0].sex  # "Male" or "Female"
```

### Key Differences
1. **No temp files**: Direct numpy array processing
2. **Faster**: Optimized ONNX models
3. **Cleaner API**: Object-oriented design
4. **Better error handling**: Explicit face detection step

## Next Steps

### Enhancement Ideas

1. **Multi-face handling**: Process all faces in image
   ```python
   faces = analyzer.analyze(image)
   for face in faces:
       print(f"{face.sex}, {face.age}y")
   ```

2. **Confidence scores**: Add face detection confidence
   ```python
   print(f"Detection confidence: {face.confidence:.2%}")
   ```

3. **Race detection**: Add FairFace for demographics
   ```python
   attributes=[AgeGender(), FairFace()]
   ```

4. **Emotion detection**: Add emotion analysis (requires PyTorch)
   ```bash
   pip install torch
   ```

5. **Batch processing**: Process video frames efficiently
   ```python
   from uniface.tracking import BYTETracker
   tracker = BYTETracker()
   ```

## Resources

- **GitHub**: https://github.com/yakhyo/uniface
- **Documentation**: https://yakhyo.github.io/uniface/
- **PyPI**: https://pypi.org/project/uniface/
- **Model Zoo**: https://yakhyo.github.io/uniface/models/
- **Discord**: https://discord.gg/wdzrjr7R5j

## License Information

- **UniFace**: MIT License
- **Model Licenses**: Vary by model (check [license attribution](https://yakhyo.github.io/uniface/license-attribution/))
  - AgeGender weights: From InsightFace
  - RetinaFace weights: From InsightFace

## Support

For issues:
1. Check [GitHub Issues](https://github.com/yakhyo/uniface/issues)
2. Ask on [Discord](https://discord.gg/wdzrjr7R5j)
3. See [DeepWiki Q&A](https://deepwiki.com/yakhyo/uniface)
