// Right foot coordinates in meters. Negative X is medial, +Z points to the toes.
const radians = Math.PI / 180;

export const footAnatomy = {
  floorM: 0.0018,
  // Z, medial X, lateral X, plantar Y, dorsal Y, offset of the dorsal ridge toward the medial edge.
  sections: [
    [-0.0560,-0.0004, 0.0004, 0.024, 0.026, 0.00],
    [-0.0530,-0.0140, 0.0130, 0.011, 0.042, 0.04],
    [-0.0470,-0.0230, 0.0210, 0.005, 0.052, 0.06],
    [-0.0380,-0.0280, 0.0260, 0.0022,0.061, 0.07],
    [-0.0280,-0.0310, 0.0290, 0.0018,0.071, 0.08],
    [-0.0186,-0.0314, 0.0290, 0.0018,0.082, 0.09],
    [-0.0050,-0.0300, 0.0293, 0.0035,0.084, 0.14],
    [ 0.0160,-0.0285, 0.0285, 0.0060,0.077, 0.20],
    [ 0.0370,-0.0248, 0.0292, 0.0078,0.066, 0.23],
    [ 0.0580,-0.0277, 0.0345, 0.0070,0.060, 0.21],
    [ 0.0800,-0.0347, 0.0420, 0.0040,0.049, 0.17],
    [ 0.0970,-0.0425, 0.0438, 0.0021,0.044, 0.14],
    [ 0.1060,-0.0449, 0.0438, 0.0018,0.041, 0.10],
    [ 0.1170,-0.0442, 0.0377, 0.0024,0.035, 0.10],
    [ 0.1270,-0.0435, 0.0270, 0.0041,0.027, 0.10],
    [ 0.1350,-0.0385, 0.0085, 0.0072,0.022, 0.10],
    [ 0.1430,-0.0270,-0.0240, 0.0132,0.015, 0.04]
  ],
  ball: { angle: 77.9 * radians, blendZM: [0.042, 0.097] },
  heelPad: { centerM: [-0.001, 0.028, -0.026], radiiM: [0.031, 0.028, 0.030], blendZM: [-0.052, -0.039] },
  arch: { centerZM: 0.050, widthM: 0.031, riseM: 0.017, medialWeight: [-0.36, 0.83] },
  // Height, X/Z center and radii, from the talus to the narrower ankle above the malleoli.
  ankleBase: [
    [0.018,-0.003,-0.024,0.018,0.017],
    [0.036,-0.003,-0.022,0.023,0.023],
    [0.052,-0.004,-0.019,0.025,0.028],
    [0.065,-0.004,-0.016,0.026,0.029],
    [0.078,-0.003,-0.013,0.027,0.029],
    [0.095,-0.002,-0.012,0.026,0.029],
    [0.110,-0.001,-0.010,0.028,0.029]
  ],
  // Lateral fibula is lower and posterior to the medial tibial malleolus.
  // Side, peak Y/Z, transverse prominence, and falloff along Y/Z.
  malleoli: [
    [ 1,0.0654,-0.0215,0.0090,0.0170,0.0150],
    [-1,0.0791,-0.0090,0.0079,0.0190,0.0160]
  ],
  achilles: { centerYM: 0.084, heightM: 0.044, halfWidthM: 0.010, centerXM: -0.002, prominenceM: 0.0070 },
  navicular: { centerYM: 0.036, centerZM: 0.047, spreadYM: 0.011, spreadZM: 0.014, prominenceM: 0.0048 },
  // Root and tip X/Z, plantar Y, maximum half-width and depth, proximal/distal joint positions.
  // Fractions locate surface landmarks along the modeled axis, not isolated bone lengths.
  toes: [
    { root: [-0.0340,0.1080], tip: [-0.0321,0.1778], bottom: 0.0024, width: 0.0117, height: 0.0210,
      joints: [0.68], pad: 0.83, nail: [0.0125,0.0158] },
    { root: [-0.0106,0.1140], tip: [-0.0088,0.1740], bottom: 0.0030, width: 0.0085, height: 0.0177,
      joints: [0.59,0.77], pad: 0.85, nail: [0.0090,0.0108] },
    { root: [ 0.0082,0.1080], tip: [ 0.0096,0.1655], bottom: 0.0034, width: 0.0077, height: 0.0160,
      joints: [0.58,0.76], pad: 0.85, nail: [0.0080,0.0095] },
    { root: [ 0.0258,0.1010], tip: [ 0.0266,0.1561], bottom: 0.0033, width: 0.0070, height: 0.0143,
      joints: [0.58,0.76], pad: 0.84, nail: [0.0071,0.0081] },
    { root: [ 0.0397,0.0885], tip: [ 0.0405,0.1440], bottom: 0.0035, width: 0.0065, height: 0.0127,
      joints: [0.57,0.75], pad: 0.83, nail: [0.0060,0.0067] }
  ],
  contact: {
    forefootStartZM: 0.073, forefootBlendM: 0.032,
    toeTipExtraM: 0.00045, toeCapBlendM: 0.028, toeClearanceM: 0.00085, toeBridgeM: 0.0030,
    toeBridgeBlendZM: [0.114, 0.132],
    toePlantarReserveM: 0.00020,
    footClearanceM: 0.00065, blendClearanceM: 0.00090,
    dorsalBlendHeightM: [0.018, 0.037], dorsalBlendFraction: 0.35,
    ankleFanPivotM: [0.106, 0.061], ankleFanBlendM: [0.112, 0.150],
    samplePitchM: 0.0009, forefootSamplingHeightM: 0.064
  },
  skinJoinM: 0.310, skinGridM: 0.0018,
  bounds: { lower: [-0.061,-0.003,-0.061], upper: [0.060,0.185] },
  samplePitchM: 0.001
};
