"""Create same-scale crops from the seven fixed views and measure macro yarn widths."""

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

report = Path(__file__).resolve().parent
captures = Path(sys.argv[1] if len(sys.argv) == 2 else '/tmp/stocking-1b-captures')
baseline = report.parent / '1a-foot-fit'
presets = ('pantyhose', 'tights', 'fishnet')
titles = ('20D Knee-high', '20D Pantyhose', '60D Tights', 'Fishnet')
views = json.loads((report.parent / 'views-1a-anatomy.json').read_text())
width, height = views['viewport']['width'], views['viewport']['height']
layouts = {
    '01-front': ((480, 125, 960, 1020), 280),
    '02-oblique': ((450, 125, 980, 1020), 315),
    '03a-ankle': ((420, 220, 1000, 1060), 315),
    '03b-knee': ((410, 150, 1020, 950), 315),
    '04-thigh': ((410, 300, 1010, 820), 365),
    '05a-thigh-macro': ((440, 290, 1000, 790), 480),
    '05b-ankle-macro': ((440, 290, 1000, 790), 480),
}

for name, (crop, panel_width) in layouts.items():
    extension = '.png' if 'macro' in name else '.jpg'
    paths = [baseline / (name + extension)] + [captures / preset / (name + '.png') for preset in presets]
    panel_height = round((crop[3] - crop[1]) * panel_width / (crop[2] - crop[0]))
    gap = 8
    sheet = Image.new('RGB', (4 * panel_width + 3 * gap, panel_height + 34), '#eae4dc')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('DejaVuSans.ttf', 16)
    for i, (path, title) in enumerate(zip(paths, titles, strict=True)):
        with Image.open(path) as source:
            assert source.size == (width, height)
            panel = source.convert('RGB').crop(crop).resize((panel_width, panel_height), Image.Resampling.LANCZOS)
        x = i * (panel_width + gap)
        draw.text((x + panel_width // 2, 17), title, fill='#302a26', font=font, anchor='mm')
        sheet.paste(panel, (x, 34))
    sheet.save(report / (name + '.jpg'), quality=90 if 'macro' not in name else 93, optimize=True, subsampling=0)

macro = [('thigh-macro', '05a-thigh-macro'), ('ankle-macro', '05b-ankle-macro')]
yarn_width = {}
for preset in presets:
    values = {}
    for view, image in macro:
        with Image.open(captures / preset / (image + '.png')) as source:
            rgb = np.asarray(source.convert('RGB'))
        luminance = rgb[75:-100, 90:-90].mean(axis=2)
        if preset == 'fishnet':
            # Net openings contain only skin. Use a wider local background filter
            # than the projected bundle to exclude slow variations from shading.
            background = ndimage.maximum_filter(luminance, size=143)
            occupied = background - luminance > 42
        else:
            dark, light = np.percentile(luminance, [12, 68])
            occupied = luminance < (dark + light) / 2
        distance = ndimage.distance_transform_edt(occupied)
        ridges = distance == ndimage.maximum_filter(distance, size=7)
        widths = 2 * distance[ridges & (distance > 5)]
        config = views['views'][view]
        height_m = 2 * config['anchor']['distanceM'] * math.tan(math.radians(config['fovDeg']) / 2)
        median_px = float(np.median(widths)) if len(widths) else None
        values[view] = {
            'medianPx': median_px, 'ridgeSamples': len(widths),
            'approxMicrometers': median_px * height_m / height * 1e6 if median_px else None,
        }
    a, b = [values[view]['medianPx'] for view, _ in macro]
    values['relativeDifferencePercent'] = 200 * abs(a - b) / (a + b) if a and b else None
    yarn_width[preset] = values

(report / 'macro-width.json').write_text(json.dumps(yarn_width, indent=2) + '\n')
print(json.dumps(yarn_width, indent=2))
