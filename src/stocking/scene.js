import {
  Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshBasicNodeMaterial,
  MeshStandardMaterial, PlaneGeometry, Scene
} from 'three/webgpu';
import { uv, wgslFn } from 'three/tsl';
import { addTissueColors } from './tissue-colors.js';

export function createStudio(config, body, clothGeometry, unloadedGeometry, clothMaterial, tissueDisplay) {
  const scene = new Scene();
  scene.background = new Color(config.background);

  const skin = new MeshStandardMaterial({ color: config.skin, roughness: 0.74, metalness: 0.0 });
  const nailMaterial = new MeshStandardMaterial({ color: config.nail, roughness: 0.40 });
  const map = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const torso = new Mesh(body.loaded, skin);
  scene.add(torso);
  const nails = new Group();
  const textile = new Group();
  for (const side of [1, -1]) {
    const nail = new Mesh(body.nails, nailMaterial);
    nail.position.x = side * body.halfStanceM;
    nail.scale.x = side;
    nails.add(nail);
    const stocking = new Mesh(clothGeometry, clothMaterial);
    stocking.position.x = side * body.halfStanceM;
    stocking.scale.x = side;
    stocking.renderOrder = 2;
    textile.add(stocking);
  }
  scene.add(nails);
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
  const shadowGeometry = new PlaneGeometry(0.36, 0.63);
  const shadows = new Group();
  for (const side of [1, -1]) {
    const shadow = new Mesh(shadowGeometry, contact);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(side * body.halfStanceM, 0.001, 0.050);
    shadows.add(shadow);
  }
  scene.add(shadows);

  scene.add(new HemisphereLight(0xfff3ea, 0xb9a5aa, 1.75));
  const warm = new DirectionalLight(config.warmLight, 2.1);
  warm.position.set(-1.2, 1.6, 1.4);
  scene.add(warm);
  const cool = new DirectionalLight(config.coolLight, 0.75);
  cool.position.set(1.5, 1.1, -0.9);
  scene.add(cool);
  return {
    scene, textile, unloaded,
    setBodyVisible: visible => {
      torso.visible = visible;
      shadows.visible = visible;
    },
    setNailsVisible: visible => { nails.visible = visible; },
    setSkinLoaded: loaded => { torso.geometry = loaded ? body.loaded : body.bare; },
    setBody: next => {
      body = next;
      for (const nail of nails.children) nail.geometry = body.nails;
    },
    setTissueMap: enabled => {
      if (enabled) addTissueColors(body.bare, body.tissueMap, tissueDisplay);
      torso.material = enabled ? map : skin;
      nails.visible = !enabled;
    },
    setClothGeometry: geometry => {
      for (const stocking of textile.children) stocking.geometry = geometry;
    }
  };
}
