import { OrthographicCamera, Vector3 } from 'three/webgpu';

export function createComparisonView(referenceMesh, { heightM, minHeightM, minWidthM, cameraDistanceM }) {
  const camera = new OrthographicCamera();
  const right = new Vector3();
  const back = new Vector3();

  function synchronize(orbitCamera, target, zoomRatio, referenceDepth = 0) {
    const width = Math.max(minWidthM, orbitCamera.aspect * Math.max(minHeightM, heightM * zoomRatio));
    const height = width / orbitCamera.aspect;
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.near = orbitCamera.near;
    camera.far = orbitCamera.far;
    camera.quaternion.copy(orbitCamera.quaternion);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    back.set(0, 0, 1).applyQuaternion(camera.quaternion);
    const separation = width / 2;
    referenceMesh.position.copy(right).multiplyScalar(separation);
    referenceMesh.position.z -= referenceDepth;
    camera.position.copy(target).addScaledVector(back, cameraDistanceM).addScaledVector(right, separation / 2);
    camera.updateProjectionMatrix();
    return camera;
  }

  return { synchronize };
}
