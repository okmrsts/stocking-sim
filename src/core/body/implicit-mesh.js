import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';
import { cross, difference, normalize } from './swept-surface.js';

const offsets = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
const tetra = [[0,1,3,7],[0,1,5,7],[0,2,3,7],[0,2,6,7],[0,4,5,7],[0,4,6,7]];

export function createImplicitMesh(sample, lower, upper, pitch) {
  const count = upper.map((value, axis) => Math.ceil((value - lower[axis]) / pitch) + 1);
  const step = upper.map((value, axis) => (value - lower[axis]) / (count[axis] - 1));
  const [nx, ny, nz] = count;
  const plane = nx * ny;
  const grid = new Float32Array(plane * nz);
  const vertices = [], normals = [], indices = [];
  const edges = new Map();
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        grid[z * plane + y * nx + x] = sample(
          lower[0] + x * step[0], lower[1] + y * step[1], lower[2] + z * step[2]
        );
      }
    }
  }

  function edgeVertex(first, last, ids, coords) {
    const u = Math.min(ids[first], ids[last]), v = Math.max(ids[first], ids[last]);
    const key = u * grid.length + v;
    if (edges.has(key)) return edges.get(key);
    const a = grid[ids[first]], b = grid[ids[last]];
    const t = a / (a - b);
    const p = coords[first].map((value, axis) => value + t * (coords[last][axis] - value));
    const [x, y, z] = p;
    const e = pitch * 0.90;
    const n = normalize([
      sample(x + e, y, z) - sample(x - e, y, z),
      sample(x, y + e, z) - sample(x, y - e, z),
      sample(x, y, z + e) - sample(x, y, z - e)
    ]);
    const id = vertices.length / 3;
    vertices.push(...p);
    normals.push(...n);
    edges.set(key, id);
    return id;
  }

  function triangle(a, b, c, inside) {
    const origin = vertices.slice(a * 3, a * 3 + 3);
    const face = cross(difference(vertices.slice(b * 3, b * 3 + 3), origin),
      difference(vertices.slice(c * 3, c * 3 + 3), origin));
    const direction = difference(inside, origin);
    if (face[0] * direction[0] + face[1] * direction[1] + face[2] * direction[2] > 0) indices.push(a, c, b);
    else indices.push(a, b, c);
  }

  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      for (let x = 0; x < nx - 1; x++) {
        const origin = z * plane + y * nx + x;
        const ids = offsets.map(([a,b,c]) => origin + a + b * nx + c * plane);
        const signs = ids.map(id => grid[id] < 0);
        const inside = signs.reduce((sum, value) => sum + Number(value), 0);
        if (!inside || inside === 8) continue;
        const coords = offsets.map(([a,b,c]) => [
          lower[0] + (x + a) * step[0], lower[1] + (y + b) * step[1], lower[2] + (z + c) * step[2]
        ]);
        const edge = (a,b) => edgeVertex(a,b,ids,coords);
        for (const cell of tetra) {
          const inner = cell.filter(id => signs[id]);
          const outer = cell.filter(id => !signs[id]);
          const inside = coords[inner[0]];
          if (inner.length === 1) triangle(...outer.map(id => edge(inner[0], id)), inside);
          if (inner.length === 3) triangle(...inner.map(id => edge(outer[0], id)), inside);
          if (inner.length === 2) {
            const [a,b] = inner, [c,d] = outer;
            const ac = edge(a,c), ad = edge(a,d), bd = edge(b,d), bc = edge(b,c);
            triangle(ac, ad, bd, inside);
            triangle(ac, bd, bc, inside);
          }
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return geometry;
}
