// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANIMATION LAB'S RASTER (`make anim`): the posed model drawn in pure
// Node, no browser — the very three.js tree the game draws, its skinned
// cloth skinned on the CPU (`SkinnedMesh.applyBoneTransform`, three's own
// skinning), turned into the rider's body frame and filled triangle by
// triangle into a z-buffer with a plain key light. Shaded, it is the
// figure's silhouette and cloth as a frame of the game holds it; with its
// HIDDEN-LINE WIREFRAME laid over, the mesh's own faces show where a
// garment folds, tears or turns inside out; with its BONES over that, the
// skeleton it is posed by.
//
// A CAPTURE is the triangles of one frame (`captureModel`), kept as flat
// arrays so a scene's few captures cost little; a VIEW is an orthographic
// camera about the body frame (`VIEWS`).

/** The views the lab draws from: a direction the camera LOOKS (from the
 * camera into the figure) and the up it holds. */
export const VIEWS = {
  side: { say: "side, from his right, forward to the right", d: [-1, 0, 0], up: [0, 1, 0] },
  back: { say: "behind", d: [0, 0, 1], up: [0, 1, 0] },
  front: { say: "front", d: [0, 0, -1], up: [0, 1, 0] },
  top: { say: "above, forward up", d: [0, -1, 0], up: [0, 0, 1] },
  back3: { say: "rear three-quarter", d: norm3([-0.55, -0.3, 0.78]), up: [0, 1, 0] },
  front3: { say: "front three-quarter", d: norm3([-0.55, -0.25, -0.8]), up: [0, 1, 0] },
};

function norm3(v) {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
}
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** A view's camera: screen right, screen up, and depth along the look. */
export function cameraOf(id) {
  const v = VIEWS[id];
  const d = v.d;
  const r = norm3(cross(v.up, d));
  const u = cross(d, r);
  return {
    id,
    say: v.say,
    /** A body-frame point to [screen x, screen y up, depth]. */
    project: (x, y, z) => [
      x * r[0] + y * r[1] + z * r[2],
      x * u[0] + y * u[1] + z * u[2],
      x * d[0] + y * d[1] + z * d[2],
    ],
  };
}

/** The key light, in the body frame: high, ahead and to his right. */
const LIGHT = norm3([0.45, 0.8, 0.4]);

/**
 * The triangles of the posed `model` in the body frame of `at` (`{x, y, z,
 * q}`, the frame the jolt reader reads in) — every visible mesh, the
 * skinned ones skinned — as `{ pos: Float32Array (9 a triangle), rgb:
 * Float32Array (3 a triangle, lit), n }`. `extra` meshes (a bike drawn
 * beside him) are taken the same way.
 */
export function captureModel(THREE, model, at, extra = []) {
  model.root.updateMatrixWorld(true);
  for (const o of extra) o.updateMatrixWorld(true);
  const qi = new THREE.Quaternion(at.q.x, at.q.y, at.q.z, at.q.w).invert();
  const v = new THREE.Vector3();
  const pos = [];
  const rgb = [];
  const colour = new THREE.Color();
  const take = (mesh) => {
    const g = mesh.geometry;
    const p = g?.attributes?.position;
    if (!p) return;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!mat || mat.visible === false || mat.opacity === 0) return;
    const base = mat.color ? mat.color : colour.setRGB(0.8, 0.8, 0.8);
    const vc = mat.vertexColors && g.attributes.color ? g.attributes.color : null;
    const n = p.count;
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(p, i);
      if (mesh.isSkinnedMesh) mesh.applyBoneTransform(i, v);
      v.applyMatrix4(mesh.matrixWorld);
      v.x -= at.x;
      v.y -= at.y;
      v.z -= at.z;
      v.applyQuaternion(qi);
      out[i * 3] = v.x;
      out[i * 3 + 1] = v.y;
      out[i * 3 + 2] = v.z;
    }
    const idx = g.index;
    const tris = idx ? idx.count / 3 : n / 3;
    for (let k = 0; k < tris; k++) {
      const a = idx ? idx.getX(k * 3) : k * 3;
      const b = idx ? idx.getX(k * 3 + 1) : k * 3 + 1;
      const c = idx ? idx.getX(k * 3 + 2) : k * 3 + 2;
      for (const i of [a, b, c]) pos.push(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]);
      let cr = base.r;
      let cg = base.g;
      let cb = base.b;
      if (vc) {
        cr *= (vc.getX(a) + vc.getX(b) + vc.getX(c)) / 3;
        cg *= (vc.getY(a) + vc.getY(b) + vc.getY(c)) / 3;
        cb *= (vc.getZ(a) + vc.getZ(b) + vc.getZ(c)) / 3;
      }
      // The face's own normal, lit two-sided (a garment's inside shows).
      const o = pos.length - 9;
      const ux = pos[o + 3] - pos[o];
      const uy = pos[o + 4] - pos[o + 1];
      const uz = pos[o + 5] - pos[o + 2];
      const wx = pos[o + 6] - pos[o];
      const wy = pos[o + 7] - pos[o + 1];
      const wz = pos[o + 8] - pos[o + 2];
      const nx = uy * wz - uz * wy;
      const ny = uz * wx - ux * wz;
      const nz = ux * wy - uy * wx;
      const l = Math.hypot(nx, ny, nz) || 1;
      const lit = 0.38 + 0.62 * Math.abs((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / l);
      // Linear paint to the screen's curve, roughly.
      rgb.push(gamma(cr * lit), gamma(cg * lit), gamma(cb * lit));
    }
  };
  const visible = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  for (const root of [model.root, ...extra]) {
    root.traverse((o) => {
      if ((o.isMesh || o.isSkinnedMesh) && !o.isInstancedMesh && visible(o)) take(o);
    });
  }
  return { pos: Float32Array.from(pos), rgb: Float32Array.from(rgb), n: rgb.length / 3 };
}

const gamma = (x) => Math.round(255 * Math.min(1, Math.max(0, x)) ** (1 / 2.2));

/**
 * Draw a capture into the drawing `d` in the box (`x0`, `y0`, `w`, `h`)
 * through `cam`, `fit` mapping screen metres to pixels (`{ sx(x), sy(y) }`
 * — the box's own fit, shared by a strip so every cell is at one scale).
 * `mode` is "shade", "wire" (hidden-line over a dimmed fill) or "ghost"
 * (the fill faint, for bones over it). Returns the z-buffer, for lines
 * drawn after it to be hidden by.
 */
export function drawCapture(d, cap, cam, box, fit, mode = "shade") {
  const { x0, y0, w, h } = box;
  const z = new Float32Array(w * h).fill(Infinity);
  const P = new Float32Array(cap.n * 9);
  for (let k = 0; k < cap.n * 3; k++) {
    const [sx, sy, dz] = cam.project(cap.pos[k * 3], cap.pos[k * 3 + 1], cap.pos[k * 3 + 2]);
    P[k * 3] = fit.sx(sx) - x0;
    P[k * 3 + 1] = fit.sy(sy) - y0;
    P[k * 3 + 2] = dz;
  }
  const dim = mode === "wire" ? 0.55 : mode === "ghost" ? 0.35 : 1;
  const colour = [0, 0, 0];
  for (let t = 0; t < cap.n; t++) {
    const o = t * 9;
    colour[0] = cap.rgb[t * 3] * dim;
    colour[1] = cap.rgb[t * 3 + 1] * dim;
    colour[2] = cap.rgb[t * 3 + 2] * dim;
    fillTri(d, z, w, h, x0, y0, P, o, colour);
  }
  if (mode === "wire") {
    const ink = [120, 220, 255];
    for (let t = 0; t < cap.n; t++) {
      const o = t * 9;
      for (const [a, b] of [
        [0, 3],
        [3, 6],
        [6, 0],
      ]) {
        edge(d, z, w, h, x0, y0, P, o + a, o + b, ink);
      }
    }
  }
  return z;
}

/** One triangle into the z-buffer: its bounding box, the edge functions. */
function fillTri(d, z, w, h, x0, y0, P, o, colour) {
  const ax = P[o];
  const ay = P[o + 1];
  const az = P[o + 2];
  const bx = P[o + 3];
  const by = P[o + 4];
  const bz = P[o + 5];
  const cx = P[o + 6];
  const cy = P[o + 7];
  const cz = P[o + 8];
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-9) return;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
  for (let y = minY; y <= maxY; y++) {
    const py = y + 0.5;
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
      const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const depth = w0 * az + w1 * bz + w2 * cz;
      const i = y * w + x;
      if (depth >= z[i]) continue;
      z[i] = depth;
      d.set(x0 + x, y0 + y, colour);
    }
  }
}

/** One edge, drawn only where it is not behind the fill. */
function edge(d, z, w, h, x0, y0, P, a, b, ink) {
  const ax = P[a];
  const ay = P[a + 1];
  const az = P[a + 2];
  const bx = P[b];
  const by = P[b + 1];
  const bz = P[b + 2];
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
  for (let k = 0; k <= n; k++) {
    const s = k / n;
    const x = Math.floor(ax + (bx - ax) * s);
    const y = Math.floor(ay + (by - ay) * s);
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const depth = az + (bz - az) * s;
    if (depth > z[y * w + x] + 0.012) continue;
    d.set(x0 + x, y0 + y, [...ink, 150]);
  }
}

/** The box `pts` (screen metres) fill, with a margin: `{ sx, sy, scale }`
 * mapping into a `w` × `h` box at (`x0`, `y0`), screen y up. */
export function fitBox(bounds, box, margin = 0.08) {
  const { x0, y0, w, h } = box;
  const bw = Math.max(0.3, bounds.x1 - bounds.x0);
  const bh = Math.max(0.3, bounds.y1 - bounds.y0);
  const scale = Math.min(w / (bw * (1 + 2 * margin)), h / (bh * (1 + 2 * margin)));
  const cx = (bounds.x0 + bounds.x1) / 2;
  const cy = (bounds.y0 + bounds.y1) / 2;
  return {
    scale,
    sx: (x) => x0 + w / 2 + (x - cx) * scale,
    sy: (y) => y0 + h / 2 - (y - cy) * scale,
  };
}

/** The screen bounds of every point of `caps` and `pointSets` through `cam`. */
export function boundsOf(cam, caps, pointSets = []) {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const put = (x, y, z) => {
    const [sx, sy] = cam.project(x, y, z);
    if (sx < b.x0) b.x0 = sx;
    if (sx > b.x1) b.x1 = sx;
    if (sy < b.y0) b.y0 = sy;
    if (sy > b.y1) b.y1 = sy;
  };
  for (const c of caps) {
    // A vertex in seven is plenty to find the box.
    for (let k = 0; k < c.pos.length; k += 21) put(c.pos[k], c.pos[k + 1], c.pos[k + 2]);
  }
  for (const s of pointSets) for (const p of Object.values(s)) if (p) put(p.x, p.y, p.z);
  if (!Number.isFinite(b.x0)) return { x0: -1, y0: -1, x1: 1, y1: 1 };
  return b;
}
