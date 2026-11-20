"""Compare the visible yarn widths at the same camera scale in both macro views."""

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

baseline = Path(__file__).resolve().parent
folder = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else baseline.parent / "1a-revision"
views_file = "views-1a.json" if folder == baseline else "views-1a-revision.json"
views = json.loads((baseline.parent / views_file).read_text())
height = views["viewport"]["height"]
result = {}

for key, filename in [
    ("thigh-macro", "05a-thigh-macro.png"),
    ("ankle-macro", "05b-ankle-macro.png"),
]:
    image = np.asarray(Image.open(folder / filename).convert("RGB"))
    assert image.shape[:2] == (height, views["viewport"]["width"])
    luminance = image[75:-100, 90:-90].mean(axis=2)
    dark, light = np.percentile(luminance, [12, 68])
    threshold = (dark + light) / 2
    distance = ndimage.distance_transform_edt(luminance < threshold)
    ridge = distance == ndimage.maximum_filter(distance, size=7)
    widths = 2 * distance[ridge & (distance > 5)]
    view = views["views"][key]
    height_m = 2 * view["anchor"]["distanceM"] * math.tan(math.radians(view["fovDeg"] / 2))
    median_px = float(np.median(widths))
    result[key] = {
        "medianPx": median_px,
        "approxMicrometers": median_px * height_m / height * 1e6,
        "ridgeSamples": len(widths),
    }

thigh = result["thigh-macro"]["medianPx"]
ankle = result["ankle-macro"]["medianPx"]
result["relativeDifferencePercent"] = 100 * abs(thigh - ankle) / ((thigh + ankle) / 2)
assert result["relativeDifferencePercent"] < 7
(folder / "macro-width.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
