// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A BODY TORN APART IS MADE OF, AS DRAWN — every piece built in code,
// as the trees, the wildlife and the marks are: faceted, a colour a vertex,
// shaded wet. Nothing here is a bought or downloaded model; the shapes and
// colours are read off anatomy (the size of a heart, a lung's lobe, a
// liver's wedge; the yellow of subcutaneous fat round red muscle and the
// white of cortical bone round its marrow) and built to that.
//
//   * A STUMP — the end of a limb torn off, faced along its +y: a ragged
//     rim of skin and fat round a red, uneven face of muscle, the bone's
//     broken end standing out of it with the marrow red in its middle.
//   * A SHARD — a long bone's broken end out through the skin (an open
//     fracture), a rib, a splinter: white, splintered to a point, red where
//     it came out of the flesh.
//   * THE ORGANS — a heart, a lung's lobe, a liver, a kidney, a lump of
//     brain, a piece of the skull's vault, a gobbet of flesh.
//   * A DROP and a SPLAT — the blood in the air and on the snow.
//
// Every geometry is built once a view and shared by every mesh of it.

import * as THREE from "three";

/** The colours, sRGB as read off photographs of each tissue; `THREE.Color`
 * takes them to the working linear space. */
export const GORE_COLOURS = {
  muscle: 0x8a1712,
  deep: 0x4e0907,
  fat: 0xd9c47e,
  skin: 0xd8a890,
  bone: 0xeadfc4,
  marrow: 0xa8322a,
  blood: 0x7a0605,
  clot: 0x3c0303,
  heart: 0x6e1418,
  lung: 0xb4545c,
  liver: 0x4c120e,
  kidney: 0x5e1a14,
  bowel: 0xcc8278,
  brain: 0xcaa2a0,
  skull: 0xe2d6ba,
} as const;

export type GoreColour = keyof typeof GORE_COLOURS;

const colour = (c: GoreColour): THREE.Color => new THREE.Color().setHex(GORE_COLOURS[c]);

/** A small hash in 0 … 1 of three numbers — the raggedness of a rim, the
 * lumps of an organ; the same every build. */
function noise(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise over a lattice of `noise`. */
function lumpy(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const u = (t: number) => t * t * (3 - 2 * t);
  let v = 0;
  for (let k = 0; k < 8; k++) {
    const dx = k & 1;
    const dy = (k >> 1) & 1;
    const dz = (k >> 2) & 1;
    const w = (dx ? u(fx) : 1 - u(fx)) * (dy ? u(fy) : 1 - u(fy)) * (dz ? u(fz) : 1 - u(fz));
    v += w * noise(ix + dx, iy + dy, iz + dz);
  }
  return v;
}

/** Paint a geometry a colour a vertex by `paint(position, normal)`. */
function painted(
  g: THREE.BufferGeometry,
  paint: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color,
): THREE.BufferGeometry {
  const pos = g.getAttribute("position");
  g.computeVertexNormals();
  const nor = g.getAttribute("normal");
  const out = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const c = paint(p, n);
    out[3 * i] = c.r;
    out[3 * i + 1] = c.g;
    out[3 * i + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(out, 3));
  return g;
}

/** A lump: an icosahedron pushed in and out by noise, scaled to (sx, sy,
 * sz), faceted (non-indexed, so every face takes its own normal). */
function knobbly(
  sx: number,
  sy: number,
  sz: number,
  rough: number,
  freq: number,
  seed: number,
  detail = 2,
): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.getAttribute("position");
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const k = 1 + rough * (lumpy(p.x * freq + seed, p.y * freq, p.z * freq) - 0.5);
    pos.setXYZ(i, p.x * k * sx, p.y * k * sy, p.z * k * sz);
  }
  return g;
}

/** A geometry with a vertex a face corner, so every face takes its own normal. */
const flat = (g: THREE.BufferGeometry): THREE.BufferGeometry => (g.index ? g.toNonIndexed() : g);

const mix = (a: THREE.Color, b: THREE.Color, t: number): THREE.Color =>
  a.clone().lerp(b, Math.max(0, Math.min(1, t)));

/** A STUMP of radius `r`, faced along +y, its face at y = 0: the skin's
 * ragged rim, the fat under it, the muscle's face, the bone's end out of
 * it `bone` m (0: none — the neck's is the spine, the waist's the gut). */
export function stumpGeometry(r: number, bone: number, seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // The face: a disc of rings, its middle sunk, the rim torn ragged up
  // and down, the flesh bulging out over the cut a little.
  const rings = 5;
  const around = 14;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const muscle = colour("muscle");
  const deep = colour("deep");
  const fat = colour("fat");
  const skin = colour("skin");
  const blood = colour("blood");
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const tear = lumpy(Math.cos(a) * 3 + seed, Math.sin(a) * 3, u * 2);
      const rr = r * u * (u > 0.85 ? 0.9 + 0.35 * tear : 1 + 0.08 * (tear - 0.5));
      const y =
        u < 0.85
          ? r * (0.18 * Math.sin(u * Math.PI) - 0.1 * (1 - u)) + r * 0.15 * (tear - 0.5)
          : -r * (0.15 + 0.5 * tear) * (u - 0.85) * 4;
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      const c =
        u < 0.2
          ? mix(deep, muscle, u * 5)
          : u < 0.78
            ? mix(muscle, blood, 0.5 * tear)
            : u < 0.9
              ? mix(fat, muscle, 0.3 * tear)
              : mix(skin, blood, 0.6 + 0.4 * tear);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      idx.push(a, a + around, b, b, a + around, b + around);
    }
  }
  const face = new THREE.BufferGeometry();
  face.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  face.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  face.setIndex(idx);
  parts.push(flat(face));
  if (bone > 0) {
    // The bone's end: a hollow shaft broken off at a slant, splintered.
    const br = r * 0.3;
    const shaft = new THREE.CylinderGeometry(br * 0.9, br, bone, 9, 3, false);
    shaft.translate(0, bone / 2 - r * 0.1, 0);
    const sp = shaft.getAttribute("position");
    const v = new THREE.Vector3();
    for (let i = 0; i < sp.count; i++) {
      v.fromBufferAttribute(sp, i);
      if (v.y > bone * 0.3) {
        const a = Math.atan2(v.z, v.x);
        const splinter = lumpy(Math.cos(a) * 4 + seed, Math.sin(a) * 4, 7);
        v.y -= bone * (0.55 * splinter + 0.25 * (Math.cos(a) * 0.5 + 0.5));
      }
      sp.setXYZ(i, v.x, v.y, v.z);
    }
    const bc = colour("bone");
    const marrow = colour("marrow");
    parts.push(
      painted(flat(shaft), (p) =>
        p.y < r * 0.05 ? mix(blood, bc, (p.y + r * 0.1) / (r * 0.15)) : bc,
      ),
    );
    // The marrow in its end.
    const core = new THREE.CircleGeometry(br * 0.6, 8);
    core.rotateX(-Math.PI / 2);
    core.translate(0, bone * 0.25, 0);
    parts.push(painted(flat(core), () => marrow));
  }
  return merge(parts);
}

/** A SHARD of bone `length` long and `r` thick, standing on +y from y = 0,
 * splintered to a point, red at its foot. */
export function shardGeometry(length: number, r: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r * 0.25, r, length, 7, 4, false);
  g.translate(0, length / 2, 0);
  const pos = g.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const k = v.y / length;
    // The far end broken off at a slant and splintered into points.
    if (k > 0.6) v.y -= length * 0.35 * lumpy(Math.cos(a) * 3 + seed, Math.sin(a) * 3, 2) * k;
    const bow = 0.15 * r * Math.sin(k * Math.PI);
    pos.setXYZ(i, v.x + bow, v.y, v.z);
  }
  const bone = colour("bone");
  const blood = colour("blood");
  return painted(flat(g), (p) =>
    mix(blood, bone, p.y / (length * 0.35) - 0.15 * lumpy(p.x * 40, p.y * 40, seed)),
  );
}

/** A RIB'S PIECE: a thin bowed rod `length` long, splintered at both ends. */
export function ribGeometry(length: number, seed: number): THREE.BufferGeometry {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(length * 0.5, 0, length * 0.18),
    new THREE.Vector3(length, 0, 0),
  );
  const g = new THREE.TubeGeometry(curve, 8, 0.007, 5, false);
  const bone = colour("bone");
  const blood = colour("blood");
  return painted(flat(g), (p) =>
    mix(bone, blood, 0.6 * lumpy(p.x * 30 + seed, p.y * 30, p.z * 30) - 0.1),
  );
}

/** The organs: what they are called and how big each is, m. */
export type OrganKind =
  | "heart"
  | "lung"
  | "liver"
  | "kidney"
  | "brain"
  | "skull"
  | "gobbet"
  | "eye"
  | "spleen";

/** AN ORGAN of its kind, `seed` its own lumps. Each about its real size: a
 * heart a fist (12 × 8 × 6 cm), a lung's lobe a hand long, the liver a
 * wedge of 20 × 15 × 8 cm, a kidney a bean of 11 × 6 cm. */
export function organGeometry(kind: OrganKind, seed: number): THREE.BufferGeometry {
  switch (kind) {
    case "heart": {
      const g = knobbly(0.045, 0.06, 0.04, 0.25, 3, seed);
      const pos = g.getAttribute("position");
      const v = new THREE.Vector3();
      // A blunt cone: broad at its base, its apex down and to the left.
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const k = 0.65 + 0.35 * (v.y / 0.06 + 1) * 0.5;
        pos.setXYZ(i, v.x * k + (v.y < 0 ? v.y * 0.25 : 0), v.y, v.z * k);
      }
      const red = colour("heart");
      const fat = colour("fat");
      const deep = colour("deep");
      return painted(flat(g), (p) =>
        p.y > 0.035 ? mix(red, fat, 0.7) : mix(red, deep, lumpy(p.x * 60, p.y * 60, seed) * 0.6),
      );
    }
    case "lung": {
      const g = knobbly(0.05, 0.1, 0.035, 0.35, 5, seed);
      const pink = colour("lung");
      const blood = colour("blood");
      return painted(flat(g), (p) =>
        mix(pink, blood, 0.8 * lumpy(p.x * 70 + seed, p.y * 70, p.z * 70) - 0.15),
      );
    }
    case "liver": {
      const g = knobbly(0.1, 0.035, 0.07, 0.2, 2, seed);
      const pos = g.getAttribute("position");
      const v = new THREE.Vector3();
      // A wedge: thick on its right lobe, thinning to the left.
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        pos.setY(i, v.y * (1.35 - (v.x / 0.1 + 1) * 0.45));
      }
      const liver = colour("liver");
      const deep = colour("clot");
      return painted(flat(g), (p) => mix(liver, deep, lumpy(p.x * 40, p.y * 40, seed) * 0.5));
    }
    case "kidney": {
      const g = knobbly(0.032, 0.055, 0.022, 0.12, 3, seed);
      const pos = g.getAttribute("position");
      const v = new THREE.Vector3();
      // The bean's notch, its hilum, pressed into one side.
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        if (v.x > 0) pos.setX(i, v.x * (1 - 0.55 * Math.exp(-((v.y / 0.025) ** 2))));
      }
      const k = colour("kidney");
      return painted(flat(g), (p) => mix(k, colour("deep"), lumpy(p.x * 50, 0, seed) * 0.5));
    }
    case "spleen": {
      const g = knobbly(0.06, 0.03, 0.035, 0.2, 3, seed);
      return painted(flat(g), (p) =>
        mix(colour("heart"), colour("clot"), lumpy(p.x * 50, p.y * 50, seed) * 0.6),
      );
    }
    case "brain": {
      // A lump of it torn off: the folds pressed deep into a soft lobe.
      const g = knobbly(0.04, 0.028, 0.035, 0.55, 14, seed, 3);
      const brain = colour("brain");
      const blood = colour("blood");
      return painted(flat(g), (p) =>
        mix(brain, blood, 0.9 * lumpy(p.x * 45 + seed, p.y * 45, p.z * 45) - 0.35),
      );
    }
    case "skull": {
      // A piece of the vault: a patch of a sphere's shell, bone without
      // and blood within, its edges broken.
      const a0 = noise(seed, 1, 2) * Math.PI * 2;
      const g = new THREE.SphereGeometry(0.095, 7, 5, a0, 0.9, 0.4, 0.7);
      const pos = g.getAttribute("position");
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const k = 1 + 0.08 * (lumpy(v.x * 60 + seed, v.y * 60, v.z * 60) - 0.5);
        pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
      }
      // Recentred on its own middle so it tumbles about it.
      g.computeBoundingBox();
      const c = new THREE.Vector3();
      g.boundingBox!.getCenter(c);
      g.translate(-c.x, -c.y, -c.z);
      const bone = colour("skull");
      return painted(flat(g), (_, n) =>
        n.dot(c.clone().normalize()) > 0 ? bone : colour("blood"),
      );
    }
    case "eye": {
      const g = new THREE.IcosahedronGeometry(0.012, 2);
      return painted(flat(g), (p) =>
        p.z > 0.008 ? new THREE.Color(0x101010) : p.z > 0.005 ? new THREE.Color(0x5a7a8a) : new THREE.Color(0xf0eadc),
      );
    }
    case "gobbet":
    default: {
      const g = knobbly(0.025, 0.018, 0.022, 0.6, 6, seed, 1);
      const muscle = colour("muscle");
      const fat = colour("fat");
      const deep = colour("deep");
      return painted(flat(g), (p) => {
        const t = lumpy(p.x * 80 + seed, p.y * 80, p.z * 80);
        return t > 0.72 ? fat : mix(muscle, deep, t);
      });
    }
  }
}

/** A WOUND IN THE TRUNK opened from the inside: a ragged hole's rim of skin
 * and fat round a red depth, `r` across, faced along +y. With `ribs`, the
 * ribs' broken ends stand out of it. */
export function openingGeometry(r: number, ribs: boolean, seed: number): THREE.BufferGeometry {
  const parts = [stumpGeometry(r, 0, seed)];
  if (ribs) {
    for (let i = 0; i < 5; i++) {
      const s = shardGeometry(0.06 + 0.05 * noise(seed, i, 3), 0.012, seed + i);
      const a = (i / 5) * Math.PI * 2 + noise(seed, i, 1);
      s.rotateZ(0.6 + 0.5 * noise(i, seed, 2));
      s.rotateY(-a);
      s.translate(Math.cos(a) * r * 0.7, 0, Math.sin(a) * r * 0.7);
      parts.push(s);
    }
  }
  return merge(parts);
}

/** THE TREE'S TOP through the body: a bark-dark cone `length` long from y =
 * 0 to its point, the blood running down it thickest at its point. */
export function spikeGeometry(length: number, r: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, length, 7, 4, true);
  g.translate(0, length / 2, 0);
  const bark = new THREE.Color(0x3a2a1c);
  const blood = colour("blood");
  return painted(flat(g), (p) =>
    mix(bark, blood, 0.35 + 0.7 * (p.y / length) + 0.3 * (lumpy(p.x * 90, p.y * 20, p.z * 90) - 0.5)),
  );
}

/** A DROP: a small faceted bead of radius 1 (scaled per drop). */
export function dropGeometry(): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(1, 0);
}

/** A SPLAT on the snow: a flat disc of radius 1 lying in x–z. */
export function splatGeometry(): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(1, 12);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** THE SPLAT'S SHAPE: a blot with a soaked middle, a fringe of lobes and
 * the satellite drops a falling drop leaves round it — drawn once into a
 * canvas as an alpha mask (white where the blood is). */
export function splatMask(size = 128): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (!g) return null;
  const h = size / 2;
  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);
  // The body: a few soft blots run together, as a drop's blood wicks out
  // into the snow's grains — a soaked middle and a ragged, paler edge.
  for (let i = 0; i < 7; i++) {
    const a = noise(i, 4, 2) * Math.PI * 2;
    const d = i === 0 ? 0 : h * 0.18 * noise(i, 9, 1);
    const r = h * (i === 0 ? 0.42 : 0.18 + 0.14 * noise(i, 3, 8));
    const x = h + Math.cos(a) * d;
    const y = h + Math.sin(a) * d;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.6, "rgba(235,235,235,0.95)");
    grad.addColorStop(0.85, "rgba(150,150,150,0.6)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "lighten";
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // The grains at the edge: speckle where the blood wicked furthest.
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i];
    if (v > 20 && v < 230) {
      const k = 0.55 + 0.9 * noise(i, 1, 3);
      const w = Math.min(255, v * k);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = w;
    }
  }
  g.putImageData(img, 0, 0);
  g.globalCompositeOperation = "source-over";
  // The satellites flung off it.
  g.fillStyle = "#eee";
  for (let i = 0; i < 8; i++) {
    const a = noise(i, 2, 3) * Math.PI * 2;
    const r = h * (0.62 + 0.3 * noise(i, 5, 1));
    g.beginPath();
    g.arc(h + Math.cos(a) * r, h + Math.sin(a) * r, h * (0.02 + 0.05 * noise(i, 7, 7)), 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** Merge non-indexed geometries with position and colour into one. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0;
  for (const p of parts) n += p.getAttribute("position").count;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    const pp = p.getAttribute("position");
    const cc = p.getAttribute("color");
    for (let i = 0; i < pp.count; i++) {
      pos[3 * (o + i)] = pp.getX(i);
      pos[3 * (o + i) + 1] = pp.getY(i);
      pos[3 * (o + i) + 2] = pp.getZ(i);
      col[3 * (o + i)] = cc ? cc.getX(i) : 1;
      col[3 * (o + i) + 1] = cc ? cc.getY(i) : 1;
      col[3 * (o + i) + 2] = cc ? cc.getZ(i) : 1;
    }
    o += pp.count;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** A TUBE along a rope's points — the bowel: `around` sides of radius
 * `r`, its positions rewritten every frame by `layTube`. */
export function tubeGeometry(count: number, around = 6): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * around * 3), 3));
  const col = new Float32Array(count * around * 3);
  const bowel = colour("bowel");
  const blood = colour("blood");
  for (let i = 0; i < count * around; i++) {
    const c = mix(bowel, blood, 0.55 * noise(i, 3, 9) + (i < around * 2 ? 0.6 : 0));
    col[3 * i] = c.r;
    col[3 * i + 1] = c.g;
    col[3 * i + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const idx: number[] = [];
  for (let i = 0; i + 1 < count; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      idx.push(a, b, a + around, b, b + around, a + around);
    }
  }
  g.setIndex(idx);
  return g;
}

const t = new THREE.Vector3();
const nn = new THREE.Vector3();
const bb = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

/** Lay a tube's rings round the points `p`, `r` thick, bulging and pinched
 * along it as a bowel's loops are. */
export function layTube(
  g: THREE.BufferGeometry,
  p: readonly { x: number; y: number; z: number }[],
  r: number,
  around = 6,
): void {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)];
    const b = p[Math.min(p.length - 1, i + 1)];
    t.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
    nn.crossVectors(t, up);
    if (nn.lengthSq() < 1e-6) nn.set(1, 0, 0);
    nn.normalize();
    bb.crossVectors(t, nn);
    const rr = r * (0.8 + 0.35 * Math.sin(i * 1.9));
    for (let j = 0; j < around; j++) {
      const ang = (j / around) * Math.PI * 2;
      const c = Math.cos(ang) * rr;
      const s = Math.sin(ang) * rr;
      pos.setXYZ(
        i * around + j,
        p[i].x + nn.x * c + bb.x * s,
        p[i].y + nn.y * c + bb.y * s,
        p[i].z + nn.z * c + bb.z * s,
      );
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}
