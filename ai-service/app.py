import os
import uuid

from flask import Flask, jsonify, request
from flask_cors import CORS

from services.scanner import analyze_face


app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "AmourSkin OpenCV facial scanner is running"})


@app.route("/api/scan/opencv", methods=["POST"])
def scan_face():
    try:
        if "image" not in request.files:
            return jsonify({"success": False, "message": "No image uploaded"}), 400

        image = request.files["image"]

        if image.filename == "":
            return jsonify({"success": False, "message": "Empty image filename"}), 400

        filename = f"{uuid.uuid4()}.jpg"
        image_path = os.path.join(UPLOAD_FOLDER, filename)
        image.save(image_path)

        include_layers = request.args.get("layers", "0") in ("1", "true", "yes")
        result = analyze_face(image_path, include_layers=include_layers)

        if result.get("image_quality") != "Good" or result.get("analysis_confidence", 1.0) < 0.55:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": result.get(
                            "message",
                            "Image quality or analysis confidence is too low. Please retake the photo in better light.",
                        ),
                        "result": result,
                    }
                ),
                400,
            )

        return jsonify({"success": True, "result": result})

    except Exception as error:
        return jsonify({"success": False, "message": str(error)}), 500


if __name__ == "__main__":
    os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
    app.run(debug=False, use_reloader=False, port=5001)

