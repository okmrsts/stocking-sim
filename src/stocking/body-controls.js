import { bodyDimensions } from '../config/body-regions.js';

export function connectBodyControls({ initial, onApply, onMap }) {
  const dialog = document.getElementById('body-settings');
  const form = document.getElementById('body-form');
  const message = document.getElementById('body-message');
  const apply = document.getElementById('body-apply');
  const ranges = document.getElementById('body-ranges');
  const map = document.getElementById('body-map');
  const inputs = bodyDimensions.map(({ id, label, min, max }) => {
    const row = document.createElement('label');
    const title = document.createElement('span');
    title.textContent = label;
    const output = document.createElement('output');
    output.setAttribute('aria-hidden', 'true');
    const input = document.createElement('input');
    input.type = 'range';
    input.name = id;
    input.min = min;
    input.max = max;
    input.step = 1;
    input.setAttribute('aria-label', label);
    function update() {
      output.textContent = input.value + '%';
      input.setAttribute('aria-valuetext', output.textContent);
    }
    input.addEventListener('input', update);
    input.value = initial[id];
    update();
    row.append(title, output, input);
    ranges.append(row);
    return { id, input, update };
  });

  document.getElementById('body-open').addEventListener('click', () => dialog.showModal());
  document.getElementById('body-reset').addEventListener('click', () => {
    for (const { input, update } of inputs) {
      input.value = 100;
      update();
    }
  });
  map.addEventListener('click', () => {
    const enabled = map.getAttribute('aria-pressed') !== 'true';
    if (onMap(enabled)) dialog.close();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (apply.disabled) return;
    const values = Object.fromEntries(inputs.map(({ id, input }) => [id, input.valueAsNumber]));
    apply.disabled = true;
    ranges.disabled = true;
    const reset = document.getElementById('body-reset');
    reset.disabled = true;
    form.setAttribute('aria-busy', 'true');
    message.textContent = '形状と着用を再計算しています…';
    try {
      if (await onApply(values)) {
        message.textContent = '';
        dialog.close();
      } else message.textContent = '計測の終了後に適用してください。';
    } catch {
      message.textContent = '体型を更新できませんでした。画面の診断を確認してください。';
    } finally {
      form.removeAttribute('aria-busy');
      reset.disabled = false;
      ranges.disabled = false;
      apply.disabled = false;
    }
  });
  return enabled => map.setAttribute('aria-pressed', String(enabled));
}
