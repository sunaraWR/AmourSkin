#!/usr/bin/env python3
"""Test UniFace integration for age and gender detection."""

import cv2
import numpy as np
from services.age_gender import analyze_age_gender

def test_with_sample_image():
    """Test age/gender detection with a sample image."""
    print("Testing UniFace age/gender detection...")
    
    # Create a dummy image (in real use, this would be an actual photo)
    dummy_image = np.zeros((480, 640, 3), dtype=np.uint8)
    
    try:
        result = analyze_age_gender(dummy_image)
        print(f"✓ Function executed successfully")
        print(f"  Result: {result}")
        print(f"  Source: {result['gender_age_source']}")
        return True
    except Exception as e:
        print(f"✗ Error during detection: {e}")
        return False

def test_none_image():
    """Test with None image (should return fallback)."""
    print("\nTesting with None image...")
    result = analyze_age_gender(None)
    assert result['gender_age_source'] == 'fallback'
    print(f"✓ None image handled correctly: {result}")
    return True

def test_invalid_input():
    """Test with invalid input."""
    print("\nTesting with invalid input...")
    result = analyze_age_gender("not an image")
    assert result['gender_age_source'] == 'fallback'
    print(f"✓ Invalid input handled correctly: {result}")
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("UniFace Integration Test Suite")
    print("=" * 60)
    
    tests = [
        test_none_image,
        test_invalid_input,
        test_with_sample_image,
    ]
    
    passed = sum(1 for test in tests if test())
    print("\n" + "=" * 60)
    print(f"Tests passed: {passed}/{len(tests)}")
    print("=" * 60)
