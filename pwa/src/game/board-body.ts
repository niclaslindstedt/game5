// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARD AS DRAWN — the deck, its two strap bindings and the rider's
// soft boots, every one built in code off the numbers in `board-look.ts`
// (the board's own spec, and the class's measured bands), low-poly and
// faceted as the rest of the figure is. `board-model.ts` hangs them on the
// rider and poses them off the engine every frame.
//
//   * THE DECK (`buildDeck`): one mesh, its top, its base and its sidewalls
//     lofted along the board — the sidecut's outline, the hybrid camber, the
//     nose and tail kicked up, the core thinning to the tips — and painted
//     from ONE texture made in code (`paintSheet`): the topsheet's graphic
//     above, the base's below and the sidewall over its steel edge on the
//     strip between. Its heights are laid again when a carve BOWS it
//     (`setBend`), so it lies on the arc its edge cuts.
//   * A STRAP BINDING (`buildBinding`) in its own frame — y out of the deck,
//     z along the foot to the toes, the origin on the deck under the boot's
//     middle: the baseplate on its disc, the heel cup, the HIGHBACK rising
//     behind the calf at its forward lean, and the ankle strap and the toe
//     cap with their ratchets — the straps apart, so a foot out of its
//     binding leaves them hanging open (hidden).
//   * A SOFT BOOT (`buildSoftBoot`) in the boot's frame — its sole's middle
//     the origin, y up its shaft, z to its toes: a faceted loft from the
//     sole and the bulky toe box up the shaft to the padded cuff, the tongue
//     and the laces on its front. The dress's liner stands inside it.

import * as THREE from "three";

import {
  BINDING,
  SOFT_BOOT,
  boardBaseHeight,
  boardHalfWidth,
  boardThickness,
  bowAt,
  type BoardSheet,
  type BoardShape,
} from "./board-look.ts";

/** A material in one flat colour (the merged draw carries it per part). */
export type Paint = (colour: number, name?: string) => THREE.Material;

/** The deck's texture: the top's rows, then the base's, then the sidewall's. */
const TEX = { w: 256, top: 56, base: 56, side: 16 };
const TEX_H = TEX.top + TEX.base + TEX.side;

/** How finely the deck is lofted: stations along it, columns across. */
const ALONG = 56;
const ACROSS = 6;

const hex = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Whether (u, v) is inside the convex outline `poly` (either winding). */
function inside(poly: readonly (readonly [number, number])[], u: number, v: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [u0, v0] = poly[i];
    const [u1, v1] = poly[(i + 1) % poly.length];
    const c = (u1 - u0) * (v - v0) - (v1 - v0) * (u - u0);
    if (c === 0) continue;
    const s = Math.sign(c);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** THE SHEET PAINTED as texels: the deck's top (u along from the tail, v
 * across from its left edge), a fine rule of trim round its edge, its
 * graphic in the trim and the second tone; the base with its bands; the
 * sidewall over the steel edge. Four samples a texel, so the graphic's
 * edges are smooth. */
export function paintSheet(sheet: BoardSheet): Uint8Array {
  const data = new Uint8Array(TEX.w * TEX_H * 4);
  const put = (x: number, y: number, rgb: [number, number, number]) => {
    const k = (y * TEX.w + x) * 4;
    data[k] = rgb[0];
    data[k + 1] = rgb[1];
    data[k + 2] = rgb[2];
    data[k + 3] = 255;
  };
  const shade = (
    rows: number,
    y0: number,
    at: (u: number, v: number) => [number, number, number],
  ): void => {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < TEX.w; x++) {
        const sum = [0, 0, 0];
        for (const [dx, dy] of [
          [0.25, 0.25],
          [0.75, 0.25],
          [0.25, 0.75],
          [0.75, 0.75],
        ]) {
          const c = at((x + dx) / TEX.w, ((y + dy) / rows) * 2 - 1);
          sum[0] += c[0];
          sum[1] += c[1];
          sum[2] += c[2];
        }
        put(x, y0 + y, [sum[0] / 4, sum[1] / 4, sum[2] / 4]);
      }
    }
  };
  const paint = hex(sheet.paint);
  const trim = hex(sheet.trim);
  const second = hex(sheet.second);
  shade(TEX.top, 0, (u, v) => {
    if (Math.abs(v) > 0.93) return trim;
    for (const p of sheet.second2) if (inside(p, u, v)) return second;
    for (const p of sheet.top) if (inside(p, u, v)) return trim;
    return paint;
  });
  const base = hex(sheet.base);
  const art = hex(sheet.baseArt);
  shade(TEX.base, TEX.top, (u, v) => {
    for (const p of sheet.under) if (inside(p, u, v)) return art;
    return base;
  });
  const wall = hex(sheet.sidewall);
  const steel: [number, number, number] = [150, 156, 164];
  shade(TEX.side, TEX.top + TEX.base, (_u, v) => (v < -0.4 ? steel : wall));
  return data;
}

/** The texture's v for a row band: the top's, the base's, the sidewall's,
 * `t` 0..1 inside it. */
const topV = (t: number) => (t * TEX.top) / TEX_H;
const baseV = (t: number) => (TEX.top + t * TEX.base) / TEX_H;
const sideV = (t: number) => (TEX.top + TEX.base + 0.5 + t * (TEX.side - 1)) / TEX_H;

export type Deck = {
  mesh: THREE.Mesh;
  /** Lay the deck bowed by `k` 1/m (`boardBend`). */
  setBend(k: number): void;
  /** The deck's top at `s` m along it, over its base line, m, under the
   * bow last set. */
  topAt(s: number): number;
  dispose(): void;
};

/** THE DECK, in its own frame (x across to its right edge, y out of its
 * top, z along to its nose; the origin on the base's line at its middle). */
export function buildDeck(
  board: BoardShape & { stance: number },
  sheet: BoardSheet,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
): Deck {
  const L = board.length;
  const stations: number[] = [];
  for (let i = 0; i <= ALONG; i++) {
    // Closer together at the ends, where the outline and the kick turn.
    const t = i / ALONG;
    const u = 0.5 - 0.5 * Math.cos(Math.PI * t);
    stations.push((u * 0.6 + t * 0.4 - 0.5) * L);
  }
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  // Per vertex: where along it is, and its height over the base's line
  // before any bow.
  const along: number[] = [];
  const rest: number[] = [];
  const vertex = (x: number, s: number, y: number, u: number, v: number): number => {
    pos.push(x, y, s);
    uv.push(u, v);
    along.push(s);
    rest.push(y);
    return along.length - 1;
  };
  const surface = (top: boolean) => {
    const first = along.length;
    for (const s of stations) {
      const hw = boardHalfWidth(board, s);
      const y = boardBaseHeight(board, s, board.stance) + (top ? boardThickness(board, s) : 0);
      const u = s / L + 0.5;
      for (let j = 0; j <= ACROSS; j++) {
        const v = (j / ACROSS) * 2 - 1;
        // The top seen from above (its left at v = 0); the base from below,
        // the same way round as its graphic is drawn.
        vertex(v * hw, s, y, u, top ? topV((v + 1) / 2) : baseV((v + 1) / 2));
      }
    }
    const row = ACROSS + 1;
    for (let i = 0; i < stations.length - 1; i++) {
      for (let j = 0; j < ACROSS; j++) {
        const a = first + i * row + j;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        if (top) index.push(a, c, b, b, c, d);
        else index.push(a, b, c, b, d, c);
      }
    }
  };
  surface(true);
  surface(false);
  // THE SIDEWALLS: each edge from the base up to the top, the steel at its
  // foot; and the tips closed where the outline comes to a point.
  for (const side of [-1, 1]) {
    const first = along.length;
    for (const s of stations) {
      const hw = boardHalfWidth(board, s) * side;
      const y = boardBaseHeight(board, s, board.stance);
      const u = s / L + 0.5;
      vertex(hw, s, y, u, sideV(0));
      vertex(hw, s, y + boardThickness(board, s), u, sideV(1));
    }
    for (let i = 0; i < stations.length - 1; i++) {
      const a = first + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (side > 0) index.push(a, b, c, b, d, c);
      else index.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.Float32BufferAttribute(pos, 3);
  geometry.setAttribute("position", position);
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const texture = new THREE.DataTexture(paintSheet(sheet), TEX.w, TEX_H, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  const material = wrap(
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.32, metalness: 0.05 }),
    "board",
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  let bend = 0;
  return {
    mesh,
    setBend(k) {
      if (Math.abs(k - bend) < 2e-4) return;
      bend = k;
      for (let i = 0; i < along.length; i++) {
        position.setY(i, rest[i] + bowAt(k, along[i], L));
      }
      position.needsUpdate = true;
      geometry.computeVertexNormals();
    },
    topAt(s) {
      return boardBaseHeight(board, s, board.stance) + boardThickness(board, s) + bowAt(bend, s, L);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

/** A faceted solid as flat-shaded triangles off an indexed list. */
function faceted(pos: number[], index: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  const flat = g.toNonIndexed();
  g.dispose();
  flat.computeVertexNormals();
  return flat;
}

/** A LOFT through rings — each ring `n` points round a centre (x across, z
 * along) at a height, its half length and half width, a squareness (2 an
 * ellipse, more a box) — closed at the bottom and the top. */
type Ring = { y: number; z: number; l: number; w: number; sq?: number; x?: number };
function loft(rings: readonly Ring[], n = 12, cap = true): THREE.BufferGeometry {
  const pos: number[] = [];
  const index: number[] = [];
  for (const r of rings) {
    const p = r.sq ?? 2;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const x = Math.sign(s) * Math.abs(s) ** (2 / p) * r.w + (r.x ?? 0);
      const z = Math.sign(c) * Math.abs(c) ** (2 / p) * r.l + r.z;
      pos.push(x, r.y, z);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < n; k++) {
      const a = i * n + k;
      const b = i * n + ((k + 1) % n);
      const c = a + n;
      const d = b + n;
      index.push(a, b, c, b, d, c);
    }
  }
  if (cap) {
    for (const [i, up] of [
      [0, false],
      [rings.length - 1, true],
    ] as const) {
      const r = rings[i];
      const centre = pos.length / 3;
      pos.push(r.x ?? 0, r.y, r.z);
      for (let k = 0; k < n; k++) {
        const a = i * n + k;
        const b = i * n + ((k + 1) % n);
        if (up) index.push(centre, b, a);
        else index.push(centre, a, b);
      }
    }
  }
  return faceted(pos, index);
}

/** A box, its centre and half sizes. */
function box(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number) {
  const g = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
  g.translate(cx, cy, cz);
  return g;
}

/** A BAND swept along `path` (points) round `centre`: `thick` thick out
 * from it and `width` wide across the path — a strap over a boot. */
function band(path: readonly THREE.Vector3[], centre: THREE.Vector3, width: number, thick: number) {
  const pos: number[] = [];
  const index: number[] = [];
  const t = new THREE.Vector3();
  const out = new THREE.Vector3();
  const across = new THREE.Vector3();
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    t.subVectors(b, a).normalize();
    out.subVectors(path[i], centre);
    out.addScaledVector(t, -out.dot(t)).normalize();
    across.crossVectors(t, out).normalize();
    for (const [w, h] of [
      [-0.5, 0],
      [0.5, 0],
      [0.5, 1],
      [-0.5, 1],
    ]) {
      const p = path[i];
      pos.push(
        p.x + across.x * w * width + out.x * h * thick,
        p.y + across.y * w * width + out.y * h * thick,
        p.z + across.z * w * width + out.z * h * thick,
      );
    }
  }
  for (let i = 0; i < path.length - 1; i++) {
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k;
      const b = i * 4 + ((k + 1) % 4);
      index.push(a, b, a + 4, b, b + 4, a + 4);
    }
  }
  return faceted(pos, index);
}

/** A part: its geometry in one paint, hung in `parent`. */
function part(
  parent: THREE.Object3D,
  g: THREE.BufferGeometry,
  m: THREE.Material,
  keep: (g: THREE.BufferGeometry) => void,
): THREE.Mesh {
  keep(g);
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** The shaft's middle over the sole, along the foot, m: the ankle's, a
 * little behind the boot's middle (`cuffOver`). */
const SHAFT_Z = -SOFT_BOOT.heel;

export type Binding = {
  group: THREE.Group;
  /** The straps and their ratchets — hidden while the foot is out. */
  straps: THREE.Mesh[];
};

/** A STRAP BINDING in its own frame (y out of the deck, z to the toes, the
 * origin on the deck under the boot's middle). */
export function buildBinding(
  sheet: BoardSheet,
  paint: Paint,
  keep: (g: THREE.BufferGeometry) => void,
): Binding {
  const group = new THREE.Group();
  const frame = paint(sheet.binding);
  const disc = paint(0x80868f);
  const back = paint(sheet.highback);
  const strap = paint(sheet.strap);
  const ratchet = paint(0x2f3238);
  const B = BINDING;
  const half = SOFT_BOOT.length / 2;
  // THE BASEPLATE, from under the heel to under the ball of the foot, and
  // its disc screwed to the deck through it.
  part(group, box(0, B.plate / 2, -0.02, B.width / 2, B.plate / 2, B.length / 2), frame, keep);
  const discGeo = new THREE.CylinderGeometry(B.disc, B.disc, B.plate + 0.004, 10);
  discGeo.translate(0, (B.plate + 0.004) / 2, -0.01);
  part(group, discGeo, disc, keep);
  // THE HEEL CUP: a wall behind the heel and its two sides forward.
  const cupBack = -half - 0.012;
  part(group, box(0, B.plate + B.cup / 2, cupBack, B.width / 2, B.cup / 2, 0.008), frame, keep);
  for (const side of [-1, 1]) {
    part(
      group,
      box(
        side * (B.width / 2 - 0.005),
        B.plate + B.cup * 0.4,
        cupBack + 0.06,
        0.006,
        B.cup * 0.4,
        0.06,
      ),
      frame,
      keep,
    );
  }
  // THE HIGHBACK: a shell round the back of the calf, from the heel cup up
  // to `highback`, leaning forward by `lean`.
  const rings: Ring[] = [];
  const shell = (r: number) => {
    const path: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const h = (k / 8) * B.highback;
      const y = B.plate + 0.02 + h;
      const z = SHAFT_Z + h * Math.tan(B.lean);
      path.push(new THREE.Vector3(0, y, z));
    }
    return path.map((p, k) => {
      const t = k / 8;
      const w = 0.07 + 0.008 * Math.sin(Math.PI * t);
      return { y: p.y, z: p.z, l: r + 0.004 * t, w, sq: 2 };
    });
  };
  rings.push(...shell(0.082));
  // Half a ring behind the shaft, as a strip with a thickness.
  const highbackPos: number[] = [];
  const highbackIdx: number[] = [];
  const arc = 7;
  const rowLen = (arc + 1) * 2;
  rings.forEach((r, i) => {
    for (const off of [0, 0.012]) {
      for (let k = 0; k <= arc; k++) {
        const a = Math.PI * (0.5 + k / arc);
        const x = Math.sin(a) * (r.w + off);
        const z = r.z + Math.cos(a) * (r.l + off) * (1 - 0.15 * (i / rings.length));
        highbackPos.push(x, r.y, z);
      }
    }
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < arc; k++) {
      for (const o of [0, arc + 1]) {
        const a = i * rowLen + o + k;
        const b = a + 1;
        const c = a + rowLen;
        const d = b + rowLen;
        if (o === 0) highbackIdx.push(a, c, b, b, c, d);
        else highbackIdx.push(a, b, c, b, d, c);
      }
    }
  }
  // Its top rim closed.
  const top = (rings.length - 1) * rowLen;
  for (let k = 0; k < arc; k++) {
    const a = top + k;
    const b = top + arc + 1 + k;
    highbackIdx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  part(group, faceted(highbackPos, highbackIdx), back, keep);

  // THE STRAPS: the ankle strap over the instep and the toe cap over the
  // toe box, each from one side of the binding over to the other.
  const straps: THREE.Mesh[] = [];
  const arcOver = (
    z0: number,
    zTop: number,
    y0: number,
    yTop: number,
    wide: number,
  ): THREE.Vector3[] => {
    const path: THREE.Vector3[] = [];
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * (k / 10);
      const lift = Math.sin(a);
      path.push(
        new THREE.Vector3(-Math.cos(a) * wide, y0 + (yTop - y0) * lift, z0 + (zTop - z0) * lift),
      );
    }
    return path;
  };
  const ankle = arcOver(-0.07, 0.075, B.plate + 0.05, B.plate + 0.125, SOFT_BOOT.width / 2 + 0.012);
  straps.push(
    part(
      group,
      band(ankle, new THREE.Vector3(0, B.plate + 0.05, -0.07), B.strap, B.strapThick),
      strap,
      keep,
    ),
  );
  const toe = arcOver(
    0.1,
    0.13,
    B.plate + 0.02,
    B.plate + SOFT_BOOT.toe - 0.005,
    SOFT_BOOT.width / 2 + 0.008,
  );
  straps.push(
    part(
      group,
      band(toe, new THREE.Vector3(0, B.plate + 0.02, 0.1), B.strap * 0.8, B.strapThick),
      strap,
      keep,
    ),
  );
  // The ratchets, on the outside of each strap's top.
  straps.push(part(group, box(0.035, B.plate + 0.135, 0.068, 0.022, 0.012, 0.018), ratchet, keep));
  straps.push(
    part(
      group,
      box(0.035, B.plate + SOFT_BOOT.toe + 0.008, 0.125, 0.018, 0.01, 0.014),
      ratchet,
      keep,
    ),
  );
  // The straps' ladders down the inside of the heel cup.
  part(group, box(-0.068, B.plate + 0.05, -0.07, 0.006, 0.03, 0.014), ratchet, keep);
  return { group, straps };
}

/** A SOFT BOOT in its own frame (the sole's middle the origin, y up the
 * shaft, z to the toes). */
export function buildSoftBoot(
  sheet: BoardSheet,
  paint: Paint,
  keep: (g: THREE.BufferGeometry) => void,
): THREE.Group {
  const group = new THREE.Group();
  const shell = paint(sheet.boot);
  const trim = paint(sheet.bootTrim);
  const lace = paint(0xd8d4cc);
  const S = SOFT_BOOT;
  const L = S.length / 2;
  const W = S.width / 2;
  // THE SOLE: a slab under the whole foot, a touch longer than the upper.
  part(
    group,
    loft(
      [
        { y: 0, z: 0, l: L, w: W, sq: 2.6 },
        { y: S.sole, z: 0, l: L, w: W, sq: 2.6 },
      ],
      14,
    ),
    trim,
    keep,
  );
  // THE UPPER: the toe box rising into the shaft over the ankle, up to the
  // cuff's padded top.
  part(
    group,
    loft(
      [
        { y: S.sole, z: -0.004, l: L - 0.004, w: W - 0.002, sq: 2.5 },
        { y: S.sole + 0.035, z: -0.004, l: L - 0.006, w: W, sq: 2.4 },
        { y: S.toe, z: -0.016, l: L - 0.035, w: W - 0.003, sq: 2.2 },
        { y: S.toe + 0.03, z: SHAFT_Z - 0.01, l: 0.095, w: W - 0.004 },
        { y: 0.16, z: SHAFT_Z - 0.004, l: S.ankle + 0.012, w: S.ankle },
        { y: 0.22, z: SHAFT_Z, l: S.top + 0.002, w: S.top - 0.004 },
        { y: S.cuff - 0.022, z: SHAFT_Z, l: S.top + 0.004, w: S.top },
      ],
      14,
      false,
    ),
    shell,
    keep,
  );
  // THE CUFF's padded collar, and the TONGUE up the front of the shaft.
  part(
    group,
    loft(
      [
        { y: S.cuff - 0.024, z: SHAFT_Z, l: S.top + 0.008, w: S.top + 0.004 },
        { y: S.cuff, z: SHAFT_Z - 0.002, l: S.top + 0.006, w: S.top + 0.002 },
      ],
      14,
    ),
    trim,
    keep,
  );
  part(group, box(0, 0.19, SHAFT_Z + S.top - 0.004, 0.032, 0.085, 0.01), trim, keep);
  // The laces across the tongue and down the instep.
  for (let k = 0; k < 5; k++) {
    const y = 0.115 + k * 0.032;
    const z = SHAFT_Z + S.top + 0.004 + (k === 0 ? 0.02 : 0);
    part(group, box(0, y, z, 0.03, 0.004, 0.004), lace, keep);
  }
  return group;
}
