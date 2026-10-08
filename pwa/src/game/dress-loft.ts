// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LOOM THE SKIER'S KIT IS CUT ON — three-free arithmetic that lays a
// garment as a SKIN on the skier's own rig (`skier-rig.ts`): every piece
// lofted in the pose the rig is BOUND in (`STANDING`, every bone's frame
// off `skierBones`), every vertex WEIGHTED across the bones it lies
// between, so the game's pose bends it at the knee, the hip, the elbow and
// the small of the back as one cloth — the way the Blender suit
// (`scripts/blender/skier.py`) is weighted, the same rule ported here so
// a jacket made in code bends as the modelled one did.
//
//   tube     a piece along a CENTRELINE through the bind pose's joints
//            (a leg from the hip through the knee to the boot's cuff, a
//            sleeve from inside the shoulder to the wrist, the trunk up the
//            spine): rings of a squared ellipse (a superellipse, `square`)
//            laid along it, their half width and their reach ahead and
//            behind read off a few SECTIONS and smoothed between, pushed in
//            and out by a FOLD (a crease, a quilt's baffle, a pad), each
//            face painted by a COLOUR rule — and the rings and the columns
//            laid exactly on every edge a colour stops at (`cuts`,
//            `angles`), so a hem, a cuff, a zip or a yoke is a clean line,
//            not a stair of faces
//   rigid    triangles stated in ONE BONE's frame and riding it wholly (the
//            helmet on the head, a glove on the hand)
//
// The body is never built under the kit: a garment IS his silhouette, cut
// to his measure plus its ease (`dress-body.ts`), and only what no garment
// covers — the face — is skin. Two meshes come out: the CLOTH (matt) and
// the HARD goods (the helmet's shell, the goggles, a visor: a shine of
// their own). A colour is sRGB hex in the catalog and LINEAR here, as a
// vertex colour is read. The bones are `SKIER_BONES`, by index.

import { skierPose, type V3 } from "./skier-pose.ts";
import { BREAK } from "./skier-broken.ts";
import { SKIER_BONES, STANDING, skierBones, type BoneFrame, type SkierBone } from "./skier-rig.ts";

export type { V3 } from "./skier-pose.ts";

/** A vertex's share of a bone, by the bone's index in `SKIER_BONES`. */
export type Influence = { bone: number; w: number };

/** The two meshes a dressed skier is drawn in, every array flat: three a
 * position, a normal and a colour, four bone indices and weights a vertex,
 * three indices a triangle. */
export type DressPart = {
  position: number[];
  normal: number[];
  color: number[];
  skinIndex: number[];
  skinWeight: number[];
  index: number[];
};
export type DressMesh = { cloth: DressPart; hard: DressPart };

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: V3, b: V3): V3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a: V3, k: number): V3 => v(a.x * k, a.y * k, a.z * k);
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: V3, b: V3): V3 =>
  v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const len = (a: V3): number => Math.sqrt(dot(a, a));
export const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
export const lerp = (a: V3, b: V3, t: number): V3 => add(a, mul(sub(b, a), t));
export const smoothstep = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** THE BIND POSE: every bone's frame in the pose the skin is laid in. */
export type Bind = { frames: Record<SkierBone, BoneFrame>; pose: ReturnType<typeof skierPose> };
let bound: Bind | null = null;
export function bindPose(): Bind {
  if (!bound) {
    const pose = skierPose(STANDING);
    bound = { pose, frames: skierBones(pose) };
  }
  return bound;
}

/** A bone's frame's tail. */
export const tailOf = (f: BoneFrame): V3 => add(f.head, mul(f.y, f.length));

/** A point stated in bone `name`'s frame (x, y along it, z where it bends),
 * in the body frame of the bind pose. */
export function inBone(name: SkierBone, p: V3): V3 {
  const f = bindPose().frames[name];
  return add(f.head, add(mul(f.x, p.x), add(mul(f.y, p.y), mul(f.z, p.z))));
}
/** A direction stated in bone `name`'s frame, in the body frame. */
export function dirInBone(name: SkierBone, d: V3): V3 {
  const f = bindPose().frames[name];
  return add(mul(f.x, d.x), add(mul(f.y, d.y), mul(f.z, d.z)));
}

// ---------------------------------------------------------------- weights
// THE CLOTH'S WEIGHTS, as the Blender suit's: a vertex is shared between
// the bone it lies nearest and that bone's neighbours by how much nearer
// each is (an exponential of the difference, `BLEND` its 1/e); across a
// joint with a HALF BONE the pair's share is laid over three (the
// quadratic Bernstein weights of how far toward the far bone it lies),
// and the TRUNK's share split between the pelvis and the chest by how far
// up the spine it lies.

type Seg = { a: V3; b: V3 };
const HALF: Record<string, SkierBone> = {
  "spine|thigh_l": "hip_l",
  "spine|thigh_r": "hip_r",
  "thigh_l|shin_l": "knee_l",
  "thigh_r|shin_r": "knee_r",
  "spine|upperarm_l": "shoulder_l",
  "spine|upperarm_r": "shoulder_r",
  "upperarm_l|forearm_l": "elbow_l",
  "upperarm_r|forearm_r": "elbow_r",
};
const NEAR: Record<string, string[]> = {
  spine: ["head", "thigh_l", "thigh_r", "upperarm_l", "upperarm_r"],
  head: ["spine"],
};
for (const s of ["l", "r"]) {
  NEAR[`thigh_${s}`] = ["spine", `shin_${s}`];
  NEAR[`shin_${s}`] = [`thigh_${s}`];
  NEAR[`upperarm_${s}`] = ["spine", `forearm_${s}`];
  NEAR[`forearm_${s}`] = [`upperarm_${s}`];
}
/** How wide the blend across a joint is, m: a hinge (a knee, an elbow)
 * tight, or its cloth shrinks to a candy wrapper as it folds; a ball joint
 * (the trunk against a thigh or an arm) wide, so a deep fold spreads over a
 * hand's width. */
const BLEND = { hinge: 0.04, ball: 0.075 };
/** Half the width the cloth is eased over across a break, m. */
const CUT = 0.03;

let segments: Record<string, Seg> | null = null;
function segs(): Record<string, Seg> {
  if (segments) return segments;
  const F = bindPose().frames;
  const out: Record<string, Seg> = {};
  for (const n of [
    "head",
    "thigh_l",
    "shin_l",
    "thigh_r",
    "shin_r",
    "upperarm_l",
    "forearm_l",
    "upperarm_r",
    "forearm_r",
  ] as SkierBone[]) {
    out[n] = { a: F[n].head, b: tailOf(F[n]) };
  }
  out.spine = { a: F.pelvis.head, b: tailOf(F.chest) };
  segments = out;
  return out;
}

function along(p: V3, s: Seg): { t: number; d: number } {
  const d = sub(s.b, s.a);
  const t = Math.max(0, Math.min(1, dot(sub(p, s.a), d) / dot(d, d)));
  return { t, d: len(sub(p, add(s.a, mul(d, t)))) };
}

const boneIndex = (n: string): number => (SKIER_BONES as readonly string[]).indexOf(n);

/** Up to four bones a point of the cloth rides, summing to one. */
export function clothWeights(p: V3, among?: string[]): Influence[] {
  const S = segs();
  const names = among ?? Object.keys(S).filter((n) => n !== "head");
  let b0 = names[0];
  let d0 = Infinity;
  for (const n of names) {
    const d = along(p, S[n]).d;
    if (d < d0) {
      d0 = d;
      b0 = n;
    }
  }
  const raw: [string, number][] = [b0, ...(NEAR[b0] ?? [])]
    .filter((n) => n === b0 || names.includes(n) || n === "head")
    .map((n) => {
      const trunk = n === "spine" || b0 === "spine";
      const limb = /^(thigh|upperarm)/.test(n) || /^(thigh|upperarm)/.test(b0);
      const k = trunk && limb ? BLEND.ball : BLEND.hinge;
      return [n, Math.exp(-(along(p, S[n]).d - d0) / k)];
    });
  raw.sort((a, b) => b[1] - a[1]);
  const top = raw.slice(0, 3);
  const total = top.reduce((s, [, w]) => s + w, 0);
  const out = new Map<string, number>(top.map(([n, w]) => [n, w / total]));
  for (const [pair, h] of Object.entries(HALF)) {
    const [a, b] = pair.split("|");
    if (!out.has(a) || !out.has(b)) continue;
    const wa = out.get(a)!;
    const wb = out.get(b)!;
    out.delete(a);
    out.delete(b);
    const c = wb / (wa + wb);
    out.set(a, (wa + wb) * (1 - c) ** 2);
    out.set(b, (wa + wb) * c * c);
    out.set(h, (out.get(h) ?? 0) + (wa + wb) * 2 * c * (1 - c));
  }
  if (out.has("spine")) {
    const t = along(p, S.spine).t;
    const c = smoothstep((t - 0.25) / 0.45);
    const share = out.get("spine")!;
    out.delete("spine");
    out.set("pelvis", (out.get("pelvis") ?? 0) + share * (1 - c));
    out.set("chest", (out.get("chest") ?? 0) + share * c);
  }
  // PAST A BREAK (`skier-broken.ts`): an arm bone's share past where it
  // would break goes to the bone below the break, eased over a few
  // centimetres — on a sound arm the two move as one.
  for (const s of ["l", "r"]) {
    for (const [bone, at] of [
      [`upperarm_${s}`, BREAK.upper],
      [`forearm_${s}`, BREAK.fore],
    ] as const) {
      const share = out.get(bone);
      if (!share) continue;
      const seg = S[bone];
      const m = along(p, seg).t * len(sub(seg.b, seg.a));
      const c = smoothstep((m - at + CUT) / (2 * CUT));
      if (c <= 0) continue;
      if (c >= 1) out.delete(bone);
      else out.set(bone, share * (1 - c));
      out.set(bone.replace("arm_", "arm_lo_"), share * c);
    }
  }
  const four = [...out.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = four.reduce((s, [, w]) => s + w, 0);
  return four.map(([n, w]) => ({ bone: boneIndex(n), w: w / sum }));
}

/** A point riding one bone wholly. */
export const rides = (bone: SkierBone): Influence[] => [{ bone: boneIndex(bone), w: 1 }];

// ---------------------------------------------------------------- colour
/** An sRGB hex colour as linear RGB. */
export function linear(hex: number): [number, number, number] {
  const c = (k: number) => {
    const u = k / 255;
    return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  return [c((hex >> 16) & 255), c((hex >> 8) & 255), c(hex & 255)];
}

// ---------------------------------------------------------------- the loom
/** One control ring of a tube: `s` m along its centreline, its half width
 * `w`, its reach `f` ahead (the ring's +z) and `b` behind, m, and its
 * centre shifted `x` across and `z` ahead. */
export type Section = { s: number; w: number; f: number; b: number; x?: number; z?: number };

export type TubeSpec = {
  /** The centreline through the bind pose, and the way each point's ring
   * faces (its +z: a knee's front, the chest, an elbow's point). */
  path: V3[];
  face: V3[];
  /** How far either side of an inner point the centreline is rounded, m. */
  round?: number;
  sections: Section[];
  /** The most room between two rings, m: a number or a function of `s`. */
  step: number | ((s: number) => number);
  /** Where along it a ring must lie: every edge a colour stops at. */
  cuts?: number[];
  /** Columns round a ring (the parameter's even turns), and the turns a
   * column must lie on (rad, 0 the ring's +x, π/2 its +z). */
  segments: number;
  angles?: number[];
  /** The squareness of a section: 2 an ellipse, higher boxier. */
  square?: number;
  /** A ring pushed out (positive) or in, m, at `s` along and `t` round. */
  fold?: (s: number, t: number) => number;
  /** A face's colour (sRGB hex) by where it is. */
  colour: (s: number, t: number, p: V3) => number;
  /** Close the first and the last ring. */
  cap?: [boolean, boolean];
  /** The bones a point rides — the cloth's rule when left out, or the
   * cloth's rule among `among`'s bones. */
  weights?: (p: V3) => Influence[];
  among?: string[];
  hard?: boolean;
};

/** The centreline at `s` m along: the point and its direction, every inner
 * corner rounded over `round` m either side. */
function centreline(path: V3[], round: number) {
  const lens: number[] = [0];
  for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + len(sub(path[i], path[i - 1])));
  const total = lens[lens.length - 1];
  const raw = (s: number): V3 => {
    const c = Math.max(0, Math.min(total, s));
    let i = 1;
    while (i < path.length - 1 && lens[i] < c) i++;
    const u = (c - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
    return lerp(path[i - 1], path[i], u);
  };
  const at = (s: number): { p: V3; d: V3; k: number } => {
    for (let i = 1; i < path.length - 1; i++) {
      const r = Math.min(round, (lens[i] - lens[i - 1]) * 0.45, (lens[i + 1] - lens[i]) * 0.45);
      if (Math.abs(s - lens[i]) < r) {
        // A quadratic Bezier from r before the corner to r after it.
        const a = raw(lens[i] - r);
        const c = raw(lens[i] + r);
        const u = (s - (lens[i] - r)) / (2 * r);
        const p = add(add(mul(a, (1 - u) ** 2), mul(path[i], 2 * u * (1 - u))), mul(c, u * u));
        const d = add(mul(sub(path[i], a), 2 * (1 - u)), mul(sub(c, path[i]), 2 * u));
        return { p, d: norm(d), k: i - 1 + u };
      }
    }
    let i = 1;
    while (i < path.length - 1 && lens[i] < s) i++;
    return {
      p: raw(s),
      d: norm(sub(path[i], path[i - 1])),
      k: i - 1 + (Math.max(0, Math.min(total, s)) - lens[i - 1]) / (lens[i] - lens[i - 1] || 1),
    };
  };
  return { at, total };
}

function smoothSection(secs: Section[], s: number): Required<Section> {
  const at = (i: number) => secs[Math.max(0, Math.min(secs.length - 1, i))];
  let i = 0;
  while (i < secs.length - 2 && secs[i + 1].s < s) i++;
  const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
  const u = p2.s === p1.s ? 0 : Math.max(0, Math.min(1, (s - p1.s) / (p2.s - p1.s)));
  const cr = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b +
      (c - a) * u +
      (2 * a - 5 * b + 4 * c - d) * u * u +
      (3 * b - a - 3 * c + d) * u * u * u);
  const k = (f: (q: Section) => number) => cr(f(p0), f(p1), f(p2), f(p3));
  return {
    s,
    w: Math.max(
      0.002,
      k((q) => q.w),
    ),
    f: Math.max(
      0.002,
      k((q) => q.f),
    ),
    b: Math.max(
      0.002,
      k((q) => q.b),
    ),
    x: k((q) => q.x ?? 0),
    z: k((q) => q.z ?? 0),
  };
}

/** The loom: pieces are laid into it, and `mesh()` hands back the two
 * meshes. */
export function createLoom() {
  const parts: DressMesh = { cloth: emptyPart(), hard: emptyPart() };

  /** A grid of positions and its faces, emitted into a part: smooth
   * normals over the grid, every vertex split by the colours of the faces
   * round it, so a colour stops on an edge. */
  function emit(
    part: DressPart,
    pts: V3[],
    faces: { q: number[]; colour: number }[],
    weightOf: (p: V3) => Influence[],
    normals?: V3[],
  ) {
    const nrm: V3[] = normals ?? pts.map(() => v(0, 0, 0));
    if (!normals) {
      for (const f of faces) {
        const [a, b, c] = f.q;
        const n = cross(sub(pts[b], pts[a]), sub(pts[c], pts[a]));
        for (const k of f.q) nrm[k] = add(nrm[k], n);
        if (f.q.length === 4) {
          const n2 = cross(sub(pts[c], pts[a]), sub(pts[f.q[3]], pts[a]));
          for (const k of f.q) nrm[k] = add(nrm[k], n2);
        }
      }
    }
    const made = new Map<string, number>();
    const w = new Map<number, Influence[]>();
    const vertex = (k: number, colour: number): number => {
      const key = `${k}:${colour}`;
      const known = made.get(key);
      if (known !== undefined) return known;
      const idx = part.position.length / 3;
      const p = pts[k];
      const n = norm(nrm[k]);
      part.position.push(p.x, p.y, p.z);
      part.normal.push(n.x, n.y, n.z);
      part.color.push(...linear(colour));
      let inf = w.get(k);
      if (!inf) {
        inf = weightOf(p);
        w.set(k, inf);
      }
      for (let j = 0; j < 4; j++) {
        part.skinIndex.push(inf[j]?.bone ?? 0);
        part.skinWeight.push(inf[j]?.w ?? 0);
      }
      made.set(key, idx);
      return idx;
    };
    for (const f of faces) {
      const ids = f.q.map((k) => vertex(k, f.colour));
      part.index.push(ids[0], ids[1], ids[2]);
      if (ids.length === 4) part.index.push(ids[0], ids[2], ids[3]);
    }
  }

  return {
    /** A lofted piece. */
    tube(o: TubeSpec): void {
      const line = centreline(o.path, o.round ?? 0.06);
      const secs = [...o.sections].sort((a, b) => a.s - b.s);
      const s0 = secs[0].s;
      const s1 = secs[secs.length - 1].s;
      // The rings: every section, every cut, and enough between.
      const room = typeof o.step === "number" ? () => o.step as number : o.step;
      const must = [...new Set([...secs.map((q) => q.s), ...(o.cuts ?? [])])]
        .filter((s) => s >= s0 && s <= s1)
        .sort((a, b) => a - b);
      const ss: number[] = [];
      for (let i = 0; i + 1 < must.length; i++) {
        const gap = must[i + 1] - must[i];
        let want = Infinity;
        for (let k = 0; k <= 4; k++) want = Math.min(want, room(must[i] + (gap * k) / 4));
        const n = Math.max(1, Math.ceil(gap / want - 1e-6));
        for (let k = 0; k < n; k++) ss.push(must[i] + (gap * k) / n);
      }
      ss.push(must[must.length - 1]);
      // The columns: even turns and every turn asked for.
      const ts: number[] = [];
      for (let k = 0; k < o.segments; k++) ts.push((k / o.segments) * Math.PI * 2);
      for (const a of o.angles ?? []) {
        const t = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (!ts.some((q) => Math.abs(q - t) < 0.02)) ts.push(t);
      }
      ts.sort((a, b) => a - b);
      const e = 2 / (o.square ?? 2.4);
      const faceAt = (k: number): V3 => {
        const i = Math.max(0, Math.min(o.face.length - 2, Math.floor(k)));
        return lerp(o.face[i], o.face[i + 1], Math.max(0, Math.min(1, k - i)));
      };
      const pts: V3[] = [];
      for (const s of ss) {
        const c = line.at(s);
        const sec = smoothSection(secs, s);
        let z = faceAt(c.k);
        z = norm(sub(z, mul(c.d, dot(z, c.d))));
        const x = cross(c.d, z);
        const centre = add(c.p, add(mul(x, sec.x), mul(z, sec.z)));
        for (const t of ts) {
          const ca = Math.cos(t);
          const sa = Math.sin(t);
          const f = o.fold ? o.fold(s, t) : 0;
          const u = Math.sign(ca) * Math.abs(ca) ** e * (sec.w + f);
          const r = Math.sign(sa) * Math.abs(sa) ** e * ((sa > 0 ? sec.f : sec.b) + f);
          pts.push(add(centre, add(mul(x, u), mul(z, r))));
        }
      }
      const n = ts.length;
      const faces: { q: number[]; colour: number }[] = [];
      for (let i = 0; i + 1 < ss.length; i++) {
        for (let k = 0; k < n; k++) {
          const k2 = (k + 1) % n;
          const q = [i * n + k, i * n + k2, (i + 1) * n + k2, (i + 1) * n + k];
          const tMid = k2 === 0 ? (ts[k] + Math.PI * 2) / 2 : (ts[k] + ts[k2]) / 2;
          const mid = mul(add(add(pts[q[0]], pts[q[1]]), add(pts[q[2]], pts[q[3]])), 0.25);
          faces.push({
            q: [q[0], q[3], q[2], q[1]],
            colour: o.colour((ss[i] + ss[i + 1]) / 2, tMid, mid),
          });
        }
      }
      // The caps: a fan round a point just past each end ring.
      const caps = o.cap ?? [true, true];
      for (const [end, dir] of [
        [0, -1],
        [ss.length - 1, 1],
      ] as const) {
        if (!caps[end === 0 ? 0 : 1]) continue;
        const ring = Array.from({ length: n }, (_, k) => end * n + k);
        let c = v(0, 0, 0);
        for (const k of ring) c = add(c, pts[k]);
        c = mul(c, 1 / n);
        const d = line.at(ss[end]).d;
        const centre = pts.length;
        pts.push(add(c, mul(d, dir * 0.004)));
        const colour = o.colour(ss[end], 0, c);
        for (let k = 0; k < n; k++) {
          const a = ring[k];
          const b = ring[(k + 1) % n];
          faces.push({ q: dir > 0 ? [a, b, centre] : [b, a, centre], colour });
        }
      }
      const among = o.among;
      emit(
        o.hard ? parts.hard : parts.cloth,
        pts,
        faces,
        o.weights ?? ((p) => clothWeights(p, among)),
      );
    },

    /** Triangles in bone `bone`'s frame, riding it wholly; `colour` one
     * sRGB hex for every face, or one a triangle. */
    rigid(
      bone: SkierBone,
      position: number[],
      normal: number[] | null,
      index: number[],
      colour: number | ((tri: number) => number),
      hard = false,
    ): void {
      const pts: V3[] = [];
      const nrm: V3[] = [];
      for (let i = 0; i < position.length; i += 3) {
        pts.push(inBone(bone, v(position[i], position[i + 1], position[i + 2])));
        if (normal) nrm.push(dirInBone(bone, v(normal[i], normal[i + 1], normal[i + 2])));
      }
      const faces = [];
      for (let i = 0; i < index.length; i += 3) {
        faces.push({
          q: [index[i], index[i + 1], index[i + 2]],
          colour: typeof colour === "number" ? colour : colour(i / 3),
        });
      }
      emit(
        hard ? parts.hard : parts.cloth,
        pts,
        faces,
        () => rides(bone),
        normal ? nrm : undefined,
      );
    },

    mesh(): DressMesh {
      return parts;
    },
  };
}

export type Loom = ReturnType<typeof createLoom>;

function emptyPart(): DressPart {
  return { position: [], normal: [], color: [], skinIndex: [], skinWeight: [], index: [] };
}

/** How many triangles a dressed skier carries, by mesh. */
export function triangles(m: DressMesh): { cloth: number; hard: number } {
  return { cloth: m.cloth.index.length / 3, hard: m.hard.index.length / 3 };
}
