export function connectOrbit(canvas, onOrbit, onZoom) {
  let pointer = null;
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (pointer?.id !== event.pointerId) return;
    onOrbit(event.clientX - pointer.x, event.clientY - pointer.y);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, event => {
      if (pointer?.id === event.pointerId) pointer = null;
    });
  }
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    onZoom(event.deltaY > 0 ? 1.13 : 0.89);
  }, { passive: false });
}
