import {
  Color, DirectionalLight, HemisphereLight, Mesh, MeshBasicNodeMaterial,
  MeshStandardMaterial, PlaneGeometry, Scene
} from 'three/webgpu';
import { uv, wgslFn } from 'three/tsl';

export function createStudio(config, bodyParts, clothGeometry, unloadedGeometry, clothMaterial) {
  const scene = new Scene();
  scene.background = new Color(config.background);

  const skin = new MeshStandardMaterial({ color: config.skin, roughness: 0.74, metalness: 0.0 });
  for (const geometry of bodyParts) scene.add(new Mesh(geometry, skin));

  const textile = new Mesh(clothGeometry, clothMaterial);
  textile.renderOrder = 2;
  scene.add(textile);
  const unloaded = new Mesh(unloadedGeometry, clothMaterial);
  unloaded.renderOrder = 2;
  unloaded.visible = false;
  scene.add(unloaded);

  const contact = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  contact.fragmentNode = wgslFn(`
    fn softContact(uvPoint: vec2<f32>) -> vec4<f32> {
      let ellipse = (uvPoint - vec2<f32>(0.5)) * vec2<f32>(3.2, 2.55);
      let weight = pow(max(0.0, 1.0 - dot(ellipse, ellipse)), 3.0);
      return vec4<f32>(0.20, 0.125, 0.115, 0.31 * weight);
    }
  `)({ uvPoint: uv() });
  const shadow = new Mesh(new PlaneGeometry(0.40, 0.63), contact);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0.015, 0.001, 0.050);
  scene.add(shadow);

  scene.add(new HemisphereLight(0xfff3ea, 0xb9a5aa, 1.75));
  const warm = new DirectionalLight(config.warmLight, 2.1);
  warm.position.set(-1.2, 1.6, 1.4);
  scene.add(warm);
  const cool = new DirectionalLight(config.coolLight, 0.75);
  cool.position.set(1.5, 1.1, -0.9);
  scene.add(cool);
  return { scene, textile, unloaded };
}
