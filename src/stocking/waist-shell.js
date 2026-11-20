import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';
import { createImplicitMesh } from '../core/body/implicit-mesh.js';
import { createPelvisField } from '../core/body/pelvis-field.js';
import { smoothRange } from '../core/body/tissue-map.js';
import { stitchRings } from '../core/geometry/stitch-rings.js';
import { textileOptics } from '../config/garments.js';
import { interpolate } from '../core/body/swept-surface.js';

const tau = 2 * Math.PI;
const polar = (x, z) => (Math.atan2(x, z) + tau) % tau;
const mix = (a, b, t) => a + (b - a) * t;

export function createWaistShell(surface, pelvis, garment, frame, legs) {
  const { upper } = garment;
  const skin = createPelvisField(surface, pelvis);
  const halfWidth = Math.max(...pelvis.pelvisSections.map(section => section[1]));
  const clearance = y => mix(garment.material.radialClearanceM, upper.clearanceM,
    smoothRange(y, skin.startY, skin.startY + upper.joinFadeM));
  const patch = createImplicitMesh((x, y, z) => skin.sample(x, y, z) - clearance(y),
    [-halfWidth - 0.050, skin.startY, -0.19], [halfWidth + 0.050, upper.waistY, 0.155], upper.gridM);
  try {
    return assemble(patch, skin.startY, surface.section(pelvis.joinArc), pelvis, garment, frame, legs, clearance);
  } finally {
    patch.dispose();
  }
}

function assemble(patch, startY, join, pelvis, garment, frame, legs, clearance) {
  const { upper } = garment;
  const positions = [], normals = [], uvs = [], fields = [], details = [], contact = [], indices = [];
  const rims = { 1: [], [-1]: [] };
  const pitch = textileOptics(garment).cellPitchM[0];
  const ringLength = Math.round(tau * upper.relaxedRadiusM / pitch) * pitch;
  const legLength = tau * garment.relaxedRadiusM;
  const lastArc = frame.relaxedArc.at(-1);
  const index = patch.index.array;
  const points = patch.attributes.position;
  const n = patch.attributes.normal;
  const waistData = [];
  function append(p, normal, uv, strain, data, correction = 0) {
    const id = positions.length / 3;
    positions.push(...p);
    normals.push(...normal);
    uvs.push(...uv);
    fields.push(...strain);
    details.push(...data);
    contact.push(correction);
    return id;
  }

  const lastRow = frame.rows * (frame.columns + 1);
  for (let id = 0; id < points.count; id++) {
    const x = points.getX(id), y = points.getY(id), z = points.getZ(id);
    const normal = [n.getX(id), n.getY(id), n.getZ(id)];
    const [, front, back] = interpolate(pelvis.pelvisSections, y);
    const torsoBlend = smoothRange(y, startY + 0.074, startY + 0.126);
    const panel = smoothRange(y, startY + 0.018, startY + 0.074);
    const legX = Math.abs(x) - pelvis.halfStanceM - join.x;
    const legZ = z - join.z;
    const legAngle = polar(legX / join.width, legZ / join.depth);
    const centreZ = mix(join.z, (front + back) / 2, torsoBlend);
    const radialX = mix(legX, Math.abs(x), torsoBlend);
    const radialZ = z - centreZ;
    const theta = polar(mix(legX / join.width, radialX / upper.relaxedRadiusM, torsoBlend),
      mix(legZ / join.depth, radialZ / upper.relaxedRadiusM, torsoBlend));
    const radius = Math.max(0.002, Math.hypot(radialX, radialZ));
    const horizontal = Math.hypot(normal[0], normal[2]);
    const radialNormal = Math.abs((normal[0] * Math.sign(x) * radialX + normal[2] * radialZ) / radius);
    const localLength = mix(legLength, ringLength, torsoBlend);
    const hoop = radius * horizontal / Math.max(0.40, radialNormal) / (localLength / tau);
    const axial = Math.min(1.8, Math.hypot(1, normal[1] / Math.max(0.40, radialNormal))) / garment.axialEase;
    const band = smoothRange(y, upper.waistY - upper.hemWidthM, upper.waistY - upper.hemWidthM + 0.008);
    const reinforcement = mix(1, mix(upper.dyeReinforcement, upper.bandYarnCount, band), panel);
    const tension = Math.max(0, hoop - 1) * garment.material.hoopModulusNpm;
    const legNode = lastRow + Math.round(legAngle / tau * frame.columns);
    const fromLeg = frame.state.subarray(legNode * 16 + 4, legNode * 16 + 8);
    const strain = [hoop, axial, tension, 0].map((value, axis) => mix(fromLeg[axis], value, panel));
    const v = lastArc + (y - startY) * garment.axialEase;
    const vertex = {
      p: [x, y, z], normal, uv: [theta / tau * localLength, v], turn: theta / tau, localLength, strain,
      data: [clearance(y), 0, reinforcement, garment.relaxedRadiusM]
    };
    waistData.push(vertex);
    append(vertex.p, vertex.normal, vertex.uv, vertex.strain, vertex.data);
    if (Math.abs(y - startY) < 1e-7) rims[x >= 0 ? 1 : -1].push({ id, angle: legAngle });
  }

  const duplicates = new Map();
  for (let i = 0; i < index.length; i += 3) {
    const face = [index[i], index[i + 1], index[i + 2]];
    const values = face.map(id => waistData[id].turn);
    const crossesSeam = Math.max(...values) - Math.min(...values) > 0.5;
    for (const id of face) {
      if (!crossesSeam || waistData[id].turn > 0.5) {
        indices.push(id);
      } else {
        if (!duplicates.has(id)) {
          const v = waistData[id];
          duplicates.set(id, append(v.p, v.normal, [v.uv[0] + v.localLength, v.uv[1]], v.strain, v.data));
        }
        indices.push(duplicates.get(id));
      }
    }
  }

  const attributes = legs.attributes;
  const legPosition = attributes.position;
  const read = (name, id) => {
    const { itemSize, array } = attributes[name];
    return array.subarray(id * itemSize, (id + 1) * itemSize);
  };
  for (const side of [1, -1]) {
    const offset = positions.length / 3;
    for (let id = 0; id < legPosition.count; id++) {
      const [x, y, z] = read('position', id);
      const [nx, ny, nz] = read('normal', id);
      append([side * (x + pelvis.halfStanceM), y, z], [side * nx, ny, nz],
        read('materialUV', id), read('clothFields', id), read('clothDetails', id), attributes.selfContact.getX(id));
    }
    const face = (a, b, c) => side > 0 ? indices.push(a, b, c) : indices.push(a, c, b);
    const triangles = legs.index.array;
    for (let i = 0; i < triangles.length; i += 3) face(offset + triangles[i], offset + triangles[i + 1], offset + triangles[i + 2]);

    // The sewn edge uses the leg chart on both sides of each join triangle.
    const first = offset + frame.rows * (frame.columns + 1);
    const legRing = Array.from({ length: frame.columns }, (_, column) => ({
      id: first + column, angle: tau * column / frame.columns
    }));
    const rim = rims[side].sort((a, b) => a.angle - b.angle);
    const sewing = new Map();
    for (const { id, angle } of rim) {
      const [x, y, z] = waistData[id].p;
      const near = Math.round(angle / tau * frame.columns);
      const point = first + near;
      const legFields = fields.slice(point * 4, point * 4 + 4);
      const legDetails = details.slice(point * 4, point * 4 + 4);
      const normal = normals.slice(point * 3, point * 3 + 3);
      sewing.set(id, append([x, y, z], normal, [angle / tau * legLength, lastArc], legFields, legDetails));
    }
    const edge = new Map(legRing.map(({ id }) => [id, id]));
    for (const [id, copy] of sewing) edge.set(id, copy);
    const wrap = new Map([[first, first + frame.columns]]);
    stitchRings(legRing, rim, (...triangle) => {
      const mapped = triangle.map(id => edge.get(id));
      const angles = mapped.map(id => uvs[id * 2]);
      const seam = Math.max(...angles) - Math.min(...angles) > legLength / 2;
      face(...mapped.map(id => {
        if (!seam || uvs[id * 2] > legLength / 2) return id;
        if (!wrap.has(id)) {
          wrap.set(id, append(positions.slice(id * 3, id * 3 + 3), normals.slice(id * 3, id * 3 + 3),
            [uvs[id * 2] + legLength, uvs[id * 2 + 1]], fields.slice(id * 4, id * 4 + 4), details.slice(id * 4, id * 4 + 4)));
        }
        return wrap.get(id);
      }));
    });
  }

  const result = new BufferGeometry();
  result.setIndex(indices);
  for (const [name, array, width] of [
    ['position', positions, 3], ['normal', normals, 3], ['materialUV', uvs, 2],
    ['clothFields', fields, 4], ['clothDetails', details, 4], ['selfContact', contact, 1]
  ]) result.setAttribute(name, new Float32BufferAttribute(array, width));
  return result;
}
