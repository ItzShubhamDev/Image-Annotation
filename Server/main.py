from flask import Flask, request, jsonify, send_file
from flask_cors import CORS, cross_origin
from PIL import Image
from sam2 import load_model
from sam2.sam2_image_predictor import SAM2ImagePredictor
from io import BytesIO
import base64

import numpy as np
import json

model = load_model(
    variant="tiny",
    ckpt_path="models/sam2_hiera_tiny.pt",
    device="cpu"
)
predictor = SAM2ImagePredictor(model)

app = Flask(__name__)
cors = CORS(app)

app.config['CORS_HEADERS'] = 'Content-Type'

def encode_mask(mask):
    """Encode a binary mask to a base64-encoded PNG."""
    img = Image.fromarray(np.array(mask).astype(np.uint8) * 255)  # Assuming 0 and 1 mask
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

@app.route('/sam', methods=['POST'])
@cross_origin()
def sam():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400
    
    image_file = request.files['image']
    image = Image.open(image_file.stream)

    image = image.convert("RGB")
    predictor.set_image(image)

    points = None
    box = None
    negatives = None

    try:
        data = request.form
        if 'points' in data:
            points = json.loads(data['points'])
        if 'boxes' in data:
            box = json.loads(data['boxes'])
    except Exception as e:
        return jsonify({'error': 'Invalid input data', 'message': str(e)}), 400

    if 'negatives' in data:
        negatives = json.loads(data['negatives'])

    if len(points) > 0:
        points = np.array(points)
    else:
        points = np.array([])
    if box:
        box = np.array(box)

    labels = []
    for i in range(len(points)):
        labels.append(1)

    if negatives:
        for i in range(len(negatives)):
            labels.append(0)
        negatives = np.array(negatives)
        if (points.size > 0):
            points = np.vstack([points, negatives])
        else:
            points = negatives

    labels = np.array(labels)
    masks = np.array([])

    if (points.size > 0):
        masks, scores, _ = predictor.predict(
            point_coords=points,
            point_labels=labels,
            box=box,
            multimask_output=False,
        )
    else:
        masks, scores, _ = predictor.predict(
            box=box,
            multimask_output=False,
        )


    if masks.size > 0:
        sorted_ind = np.argsort(scores)[::-1]
        masks_list = [encode_mask(mask) for mask in masks]
        
        return jsonify(content={"masks": masks_list, "scores": scores.tolist()})
    else:
        return jsonify({'error': 'No masks generated'}), 500

# Run the Flask app
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)