const quarterTurn = Math.PI / 2;
const mix = (a, b, amount) => a + (b - a) * amount;

export function smoothRange(value, start, end) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function createTissueMap(sections) {
  return function sample(height, angle) {
    let row = 0;
    while (row < sections.length - 2 && height > sections[row + 1][0]) row++;
    const low = sections[row], high = sections[row + 1];
    const vertical = smoothRange(height, low[0], high[0]);
    const sector = ((angle / quarterTurn) % 4 + 4) % 4;
    const index = Math.floor(sector);
    const next = (index + 1) % 4;
    const around = smoothRange(sector, index, index + 1);
    return [0, 1].map(channel => 0.001 * mix(
      mix(low[index + 1][channel], low[next + 1][channel], around),
      mix(high[index + 1][channel], high[next + 1][channel], around), vertical
    ));
  };
}
