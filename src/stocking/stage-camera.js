import { PerspectiveCamera, Spherical, Vector3 } from 'three/webgpu';

export function createStageCamera(views, resolveAnchor) {
  const camera = new PerspectiveCamera(35, 1, 0.01, 8);
  const target = new Vector3();
  const orbit = new Spherical();

  function setView(name) {
    const view = views[name];
    if (!view) throw new Error('視点が見つかりません。');
    const { positionM, targetM } = view.anchor ? resolveAnchor(view.anchor) : view;
    camera.position.fromArray(positionM);
    target.fromArray(targetM);
    camera.fov = view.fovDeg;
    camera.near = view.nearM;
    camera.far = view.farM;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }

  function rotate(dx, dy) {
    orbit.setFromVector3(camera.position.clone().sub(target));
    orbit.theta -= dx * 0.006;
    orbit.phi = Math.max(0.26, Math.min(2.84, orbit.phi - dy * 0.006));
    camera.position.setFromSpherical(orbit).add(target);
    camera.lookAt(target);
  }

  function zoom(factor) {
    const offset = camera.position.clone().sub(target);
    const distance = offset.length();
    const next = Math.max(camera.near * 3, Math.min(camera.far * 0.60, distance * factor));
    camera.position.copy(target).addScaledVector(offset, next / distance);
    camera.lookAt(target);
  }

  return { camera, setView, rotate, zoom };
}
