export const dressingConfig = Object.freeze({
  seconds: 4.4, travelStep: 0.012, clearSweep: 0.19, insertionArcM: -0.036,
  packedLengthRatio: 0.24, packingSpanM: 0.095, bodyClearanceM: 0.003,
  seatToeArcM: 0.091, gatherSpanM: 0.064, gatherHeightM: 0.0024,
  detachedDepthM: 0.32, drapeWidthRatio: 0.27, foldPitchM: 0.203, lateralFoldM: 0.039,
  gravity: 9.81, settleSeconds: 1.5,
  drapePoints: 53, drapeIterations: 4, drapeStepS: 1 / 90,
  floorClearanceM: 0.008, foldSpacingM: 0.0018, drapeDamping: 0.985,
  view: {
    label: '着脱', positionM: [1.64, 1.04, 1.52], targetM: [0, 0.416, 0.33],
    fovDeg: 36, minHorizontalFovDeg: 39, nearM: 0.018, farM: 8
  },
  detachedView: {
    label: '脱衣後の布', positionM: [0.88, 0.62, 1.18], targetM: [0, 0.07, 0.54],
    fovDeg: 33, minHorizontalFovDeg: 39, nearM: 0.015, farM: 8
  },
  splitView: {
    label: '素脚と布', positionM: [0.81, 0.63, 1.83], targetM: [0, 0.438, 0],
    fovDeg: 32, minHorizontalFovDeg: 36, nearM: 0.018, farM: 8
  }
});
