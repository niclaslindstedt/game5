// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLICE'S SCENE, DRAWN — what the officers lay on the snow round a
// fatal accident (`police-plan.ts` plans it, `rescue-view.ts` draws the
// machine and the people and hands each frame's scene here): the STAKES,
// driven in one by one; the red-and-white TAPE run between them as the lead
// walks it out, sagging a little between each two; the numbered yellow
// TENTS, a number on either face, stood one by one; the CAMERA in the
// photographer's hands and its FLASH, a bright short light at it and a
// glare. (The body bag is `police-bag.ts`'.) Presentation only: it reads
// the plan and the frame it is handed and writes nothing.

import * as THREE from "three";
import type { Level, TapeCut } from "@engine";

import { CROWD_LOOKS } from "./crowd-rig.ts";
import { FlashPoint } from "./flash-lights.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { TAPE_LIFT } from "./police-carry.ts";
import {
  TAPE_SHAPE,
  cutsAt,
  leanAt,
  ribbonOf,
  ropeOf,
  ropeTo,
  spanPoint,
  stripesOf,
  type Rope,
} from "./police-tape.ts";
import { OFFICERS, POLICE } from "./police-defs.ts";
import type { PolicePlan } from "./police-plan.ts";
import type { SceneFrame } from "./police-defs.ts";
import { CAMERA_AT } from "./rescue-crew.ts";
import type { CrewPose } from "./rescue-defs.ts";

const C = POLICE.cordon;
const M = POLICE.marker;

/** The tape's red and white (sRGB); its shape (width, stripes, twist) is
 * `police-tape.ts`' `TAPE_SHAPE`, which its broken halves are drawn from. */
const TAPE = { red: 0xd21f1f, white: 0xf4f4f2, width: TAPE_SHAPE.width } as const;
/** THE TAPE SEEN FROM FAR OFF: real tape is under a pixel wide from a
 * machine overhead, so past about 14 m a span is drawn wider with its
 * distance from the lens — `perMetre` m of width a metre off (about four
 * pixels of a 55° lens at 720 lines seen square, whatever the range), never
 * narrower than the tape itself and at most `most` times it. */
const TAPE_FAR = { perMetre: 0.0055, most: 6 } as const;
/** A stake: its colours, its girth, m. */
const STAKE = { body: 0xe8e6df, band: 0xd21f1f, girth: 0.025 } as const;
/** The marker tents' yellow and their numbers' black (CSS): a bright
 * signal yellow, as the plastic ones are. */
const TENT = { yellow: "#ffd60a", ink: "#111111" } as const;
/** The flash: its light's colour, its peak (candela), its reach, m; the
 * glare's size at full, m. */
const FLASH = { colour: 0xf2f5ff, peak: 900, reach: 30, glare: 0.9 } as const;

/** The tape broken so far and the call's clock to draw it at (the run's
 * less the call's start, never held at a theft: the tape falls on). */
export type TapeAt = { tape: readonly TapeCut[] | undefined; t: number };

export type PoliceDressing = {
  group: THREE.Group;
  /** The scene of `plan` laid out (its stakes, spans and markers built). */
  build(plan: PolicePlan | null): void;
  /** One frame: what is up, the tape run out, the markers, the flash, the
   * photographer's camera (his pose, crew slot `PHOTO`). */
  update(scene: SceneFrame, photo: CrewPose, cut?: TapeAt): void;
  dispose(): void;
};

function paint(g: THREE.BufferGeometry, colour: number): THREE.BufferGeometry {
  const c = new THREE.Color(colour);
  const n = g.getAttribute("position").count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], 3 * i);
  g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3));
  return g;
}

/** THE NUMBERS' ATLAS: a yellow cell a number, black and bold, framed. */
const CELLS = 16;
const CELL = 128;
function atlas(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = CELL * 8;
  cv.height = CELL * 2;
  const g = cv.getContext("2d")!;
  for (let n = 1; n <= CELLS; n++) {
    const x = ((n - 1) % 8) * CELL;
    const y = Math.floor((n - 1) / 8) * CELL;
    g.fillStyle = TENT.yellow;
    g.fillRect(x, y, CELL, CELL);
    g.strokeStyle = TENT.ink;
    g.lineWidth = 6;
    g.strokeRect(x + 5, y + 5, CELL - 10, CELL - 10);
    g.fillStyle = TENT.ink;
    g.font = `bold ${n > 9 ? 68 : 84}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(n), x + CELL / 2, y + CELL / 2 + 6);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const UP = new THREE.Vector3(0, 1, 0);

/** ONE TENT for number `n`: an A-frame on the snow, its ridge across the
 * way its faces look (+z its front), the number on both faces. */
function tentGeometry(n: number): THREE.BufferGeometry {
  const w = M.base / 2;
  const d = M.base * 0.35;
  const h = M.height;
  const k = Math.min(CELLS, Math.max(1, n)) - 1;
  const u0 = (k % 8) / 8;
  const u1 = u0 + 1 / 8;
  const v1 = 1 - Math.floor(k / 8) / 2;
  const v0 = v1 - 1 / 2;
  const pos: number[] = [];
  const uv: number[] = [];
  // Each face from its foot (z ±d) to the ridge (z 0, y h).
  for (const s of [1, -1]) {
    const a = [-w * s, 0, d * s];
    const b = [w * s, 0, d * s];
    const c = [w * s, h, 0];
    const e = [-w * s, h, 0];
    pos.push(...a, ...b, ...c, ...a, ...c, ...e);
    uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  // Lit as the snow it stands on is, more than as its steep faces would
  // be: the face turned from the sun reads yellow, not olive, in the bright
  // light thrown up off the snow round it.
  const nrm = g.getAttribute("normal");
  const v = new THREE.Vector3();
  for (let i = 0; i < nrm.count; i++) {
    v.fromBufferAttribute(nrm, i).multiplyScalar(0.15).add(UP).normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

/** A STAKE: a post with a red band at the tape's height and a cap. */
function stakeGeometry(): THREE.BufferGeometry {
  const parts = [
    paint(
      new THREE.CylinderGeometry(STAKE.girth, STAKE.girth, C.stake, 6).translate(0, C.stake / 2, 0),
      STAKE.body,
    ),
    paint(
      new THREE.CylinderGeometry(STAKE.girth * 1.15, STAKE.girth * 1.15, 0.12, 6).translate(
        0,
        C.tape,
        0,
      ),
      STAKE.band,
    ),
    paint(
      new THREE.CylinderGeometry(STAKE.girth * 1.3, STAKE.girth, 0.05, 6).translate(0, C.stake, 0),
      STAKE.band,
    ),
  ];
  return mergeColoured(parts);
}

function mergeColoured(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  for (const g of flat) {
    pos.push(...(g.getAttribute("position").array as Float32Array));
    nrm.push(...(g.getAttribute("normal").array as Float32Array));
    col.push(...(g.getAttribute("color").array as Float32Array));
  }
  for (const g of [...parts, ...flat]) g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/** ONE SPAN OF TAPE from stake `a` to stake `b`: a ribbon sagging between
 * them (never into the snow), striped red and white, twisting as it goes —
 * off its edge toward its face and back — so that it shows its face from
 * above as well as from the side (and casts a shadow that reads) —
 * non-indexed, a stripe six vertices, so the drawn share of it is a
 * `drawRange`. Where the bag is carried in under it (`lift`: how far along
 * the span, 0 … 1), a morph target holds it lifted there over the
 * carriers' heads, its ends still on the stakes (`TAPE_LIFT`). Returns the
 * geometry and its stripes' count. */
function spanGeometry(
  level: Level,
  a: { x: number; z: number },
  b: { x: number; z: number },
  lift: number | null,
): { geo: THREE.BufferGeometry; stripes: number } {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = stripesOf(len);
  const at = (u: number) => spanPoint(level, a, b, u, [0, 0, 0]);
  const pos: number[] = [];
  const col: number[] = [];
  const raise: number[] = [];
  const wide: number[] = [];
  // The lifted tape: up at the crossing, falling to the stakes either side.
  const up = (u: number): number => {
    if (lift === null) return 0;
    const c = Math.min(0.9, Math.max(0.1, lift));
    const k = u <= c ? u / c : (1 - u) / (1 - c);
    return TAPE_LIFT.height * Math.sin((Math.PI / 2) * k);
  };
  const red = new THREE.Color(TAPE.red);
  const white = new THREE.Color(TAPE.white);
  const h = TAPE.width / 2;
  // Across the span, level; the ribbon's half-width at `u` leaned off the
  // vertical toward it by its twist there (each span its own phase).
  const sx = -(b.z - a.z) / (len || 1);
  const sz = (b.x - a.x) / (len || 1);
  const half = (u: number): number[] => {
    const t = leanAt(a, len, u);
    const c = Math.cos(t) * h;
    const k = Math.sin(t) * h;
    return [sx * k, c, sz * k];
  };
  for (let i = 0; i < n; i++) {
    const [x0, y0, z0] = at(i / n);
    const [x1, y1, z1] = at((i + 1) / n);
    const [ax, ay, az] = half(i / n);
    const [bx, by, bz] = half((i + 1) / n);
    const lo0 = [x0 - ax, y0 - ay, z0 - az];
    const hi0 = [x0 + ax, y0 + ay, z0 + az];
    const lo1 = [x1 - bx, y1 - by, z1 - bz];
    const hi1 = [x1 + bx, y1 + by, z1 + bz];
    pos.push(...lo0, ...lo1, ...hi1, ...lo0, ...hi1, ...hi0);
    // Widened from its middle: each edge out by a half-width a unit.
    wide.push(-ax, -ay, -az, -bx, -by, -bz, bx, by, bz, -ax, -ay, -az, bx, by, bz, ax, ay, az);
    const r0 = up(i / n);
    const r1 = up((i + 1) / n);
    for (const y of [r0, r1, r1, r0, r1, r0]) raise.push(0, y, 0);
    const c = i % 2 ? white : red;
    for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  // Morph 0 widens it seen from afar; morph 1 lifts it over the bag.
  geo.morphAttributes.position = [
    new THREE.Float32BufferAttribute(wide, 3),
    ...(lift !== null ? [new THREE.Float32BufferAttribute(raise, 3)] : []),
  ];
  geo.morphTargetsRelative = true;
  return { geo, stripes: n };
}

const lensAt = new THREE.Vector3();

/** A span drawn wider the further the lens is from it (`TAPE_FAR`), set as
 * it is drawn by the lens that draws it — the shadow's own (a light's, far
 * off and square) leaves it as the picture's lens last had it, so the tape's
 * shadow is the tape's width. */
function widenFromAfar(
  mesh: THREE.Mesh,
  a: { x: number; z: number },
  b: { x: number; z: number },
  level: Level,
): void {
  const mid = new THREE.Vector3(
    (a.x + b.x) / 2,
    level.groundAt((a.x + b.x) / 2, (a.z + b.z) / 2) + C.tape,
    (a.z + b.z) / 2,
  );
  const half = Math.hypot(b.x - a.x, b.z - a.z) / 2;
  mesh.onBeforeRender = (_r, _s, camera) => {
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) return;
    lensAt.setFromMatrixPosition(camera.matrixWorld);
    // The span's nearest reach to the lens, roughly: its middle less half.
    const d = Math.max(0, lensAt.distanceTo(mid) - half);
    const w = (d * TAPE_FAR.perMetre) / TAPE.width - 1;
    mesh.morphTargetInfluences![0] = Math.max(0, Math.min(TAPE_FAR.most - 1, w));
  };
}

/** A BROKEN SPAN DRAWN: its rope (`police-tape.ts`) as a ribbon striped as
 * the span was, written afresh each frame it moves and left alone once it
 * lies still; the span's ends for the far-off widening. */
type Torn = {
  rope: Rope;
  mesh: THREE.Mesh;
  mid: Float32Array;
  half: Float32Array;
  /** The rope's steps when the ribbon was last written. */
  drawn: number;
};

/** The ribbon for a rope of `n` points: non-indexed, a segment six
 * vertices, striped red and white two segments a stripe from the span's
 * first stake (as the span was), its far-off widening a morph. */
function tornGeometry(n: number): THREE.BufferGeometry {
  const segs = n - 1;
  const col = new Float32Array(segs * 18);
  const red = new THREE.Color(TAPE.red);
  const white = new THREE.Color(TAPE.white);
  for (let i = 0; i < segs; i++) {
    const c = Math.floor(i / 2) % 2 ? white : red;
    for (let k = 0; k < 6; k++) col.set([c.r, c.g, c.b], 18 * i + 3 * k);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(segs * 18), 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(segs * 18), 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.morphAttributes.position = [new THREE.Float32BufferAttribute(new Float32Array(segs * 18), 3)];
  geo.morphTargetsRelative = true;
  return geo;
}

/** Write a torn span's ribbon off its rope as it stands. */
function writeTorn(level: Level, t: Torn): void {
  const { rope, mid, half } = t;
  ribbonOf(level, rope, mid, half);
  const geo = t.mesh.geometry;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const wide = geo.morphAttributes.position![0] as THREE.BufferAttribute;
  const p = pos.array as Float32Array;
  const w = wide.array as Float32Array;
  for (let i = 0; i < rope.n - 1; i++) {
    const a = 3 * i;
    const b = a + 3;
    const o = 18 * i;
    if (!rope.linked[i]) {
      // Parted here: nothing drawn across the gap.
      for (let k = 0; k < 6; k++) p.set([mid[a], mid[a + 1], mid[a + 2]], o + 3 * k);
      w.fill(0, o, o + 18);
      continue;
    }
    const lo0 = [mid[a] - half[a], mid[a + 1] - half[a + 1], mid[a + 2] - half[a + 2]];
    const hi0 = [mid[a] + half[a], mid[a + 1] + half[a + 1], mid[a + 2] + half[a + 2]];
    const lo1 = [mid[b] - half[b], mid[b + 1] - half[b + 1], mid[b + 2] - half[b + 2]];
    const hi1 = [mid[b] + half[b], mid[b + 1] + half[b + 1], mid[b + 2] + half[b + 2]];
    p.set([...lo0, ...lo1, ...hi1, ...lo0, ...hi1, ...hi0], o);
    const [ax, ay, az] = [half[a], half[a + 1], half[a + 2]];
    const [bx, by, bz] = [half[b], half[b + 1], half[b + 2]];
    w.set([-ax, -ay, -az, -bx, -by, -bz, bx, by, bz, -ax, -ay, -az, bx, by, bz, ax, ay, az], o);
  }
  pos.needsUpdate = true;
  wide.needsUpdate = true;
  geo.computeVertexNormals();
  t.drawn = rope.steps;
}

/** A soft round glare, white at its heart. */
function glareTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g = cv.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.25, "rgba(235,242,255,0.8)");
  r.addColorStop(1, "rgba(200,215,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

export function createPoliceDressing(level: Level, haze: HazeUniforms): PoliceDressing {
  const group = new THREE.Group();
  group.name = "police-scene";
  const kit = hazeMaterial(
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    haze,
    "police-kit",
  );
  const numbers = atlas();
  const tentMat = hazeMaterial(
    // Signal yellow: the plastic's own glow under a little of its paint, so a
    // tent reads yellow in the shade of its own faces as in the sun.
    new THREE.MeshLambertMaterial({
      map: numbers,
      emissive: 0xffffff,
      emissiveMap: numbers,
      emissiveIntensity: 0.45,
      side: THREE.DoubleSide,
    }),
    haze,
    "police-tent",
  );
  const stakeGeo = stakeGeometry();
  // The camera: a small black body and its lens, in his hands.
  const camera = new THREE.Mesh(
    mergeColoured([
      paint(new THREE.BoxGeometry(0.14, 0.1, 0.08), 0x141518),
      paint(
        new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10)
          .rotateX(Math.PI / 2)
          .translate(0, 0, 0.07),
        0x0b0b0c,
      ),
      paint(new THREE.BoxGeometry(0.06, 0.04, 0.05).translate(0, 0.07, 0.0), 0x2a2b2e),
    ]),
    kit,
  );
  camera.castShadow = true;
  group.add(camera);
  // The flash: a light at the camera, and its glare.
  const light = new FlashPoint(FLASH.colour, 0, FLASH.reach, 2); // a lamp lent it (`flash-lights.ts`)
  group.add(light);
  const glare = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glareTexture(),
      color: FLASH.colour,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glare.visible = false;
  group.add(glare);

  let stakes: THREE.Mesh[] = [];
  let spans: { mesh: THREE.Mesh; stripes: number }[] = [];
  let tents: THREE.Mesh[] = [];
  let ring: { x: number; z: number }[] = [];
  /** The broken spans drawn, by span. */
  const torn = new Map<number, Torn>();
  const untear = (i: number): void => {
    const t = torn.get(i);
    if (!t) return;
    group.remove(t.mesh);
    t.mesh.geometry.dispose();
    torn.delete(i);
  };
  const clear = (): void => {
    for (const i of [...torn.keys()]) untear(i);
    ring = [];
    for (const s of stakes) group.remove(s);
    for (const s of spans) {
      group.remove(s.mesh);
      s.mesh.geometry.dispose();
    }
    for (const t of tents) {
      group.remove(t);
      t.geometry.dispose();
    }
    stakes = [];
    spans = [];
    tents = [];
  };
  const k = CROWD_LOOKS[OFFICERS[2].body].height / 1.8;

  return {
    group,
    build(plan) {
      clear();
      if (!plan) return;
      ring = plan.ring.map((p) => ({ x: p.x, z: p.z }));
      for (const p of plan.ring) {
        const m = new THREE.Mesh(stakeGeo, kit);
        m.position.set(p.x, level.groundAt(p.x, p.z) - 0.05, p.z);
        m.castShadow = true;
        group.add(m);
        stakes.push(m);
      }
      const n = plan.ring.length;
      for (let i = 0; i < n; i++) {
        const gate = plan.carry.gates.find((g) => g.span === i);
        const ends = [plan.ring[i], plan.ring[(i + 1) % n]] as const;
        const { geo, stripes } = spanGeometry(level, ends[0], ends[1], gate ? gate.u : null);
        const mesh = new THREE.Mesh(geo, kit);
        mesh.morphTargetInfluences = gate ? [0, 0] : [0];
        widenFromAfar(mesh, ends[0], ends[1], level);
        mesh.castShadow = true;
        mesh.frustumCulled = false;
        group.add(mesh);
        spans.push({ mesh, stripes });
      }
      for (const m of plan.markers) {
        const t = new THREE.Mesh(tentGeometry(m.n), tentMat);
        t.position.set(m.x, level.groundAt(m.x, m.z), m.z);
        t.rotation.y = m.facing;
        t.castShadow = true;
        group.add(t);
        tents.push(t);
      }
    },
    update(scene, photo, cut) {
      group.visible = scene.up;
      if (!scene.up) {
        light.intensity = 0;
        return;
      }
      // The stakes driven in, in their order of planting round the ring.
      stakes.forEach((s, i) => (s.visible = !!scene.planted[i]));
      // THE TAPE BROKEN: each broken span its rope, stepped on to the
      // call's clock (from its break again where the clock went back).
      const cuts = cutsAt(cut?.tape, cut?.t ?? -Infinity);
      for (const i of [...torn.keys()]) if (torn.get(i)!.rope.cut !== cuts.get(i)) untear(i);
      for (const [i, c] of cuts) {
        if (!spans[i]) continue;
        let t = torn.get(i);
        if (!t) {
          const n = ring.length;
          const [a, b] = [ring[i], ring[(i + 1) % n]];
          const rope = ropeOf(level, a, b, c);
          const mesh = new THREE.Mesh(tornGeometry(rope.n), kit);
          mesh.morphTargetInfluences = [0];
          widenFromAfar(mesh, a, b, level);
          mesh.castShadow = true;
          mesh.frustumCulled = false;
          group.add(mesh);
          t = {
            rope,
            mesh,
            mid: new Float32Array(3 * rope.n),
            half: new Float32Array(3 * rope.n),
            drawn: -1,
          };
          torn.set(i, t);
        }
        ropeTo(level, t.rope, cut!.t);
        if (t.rope.steps !== t.drawn) writeTorn(level, t);
      }
      spans.forEach((s, i) => {
        const run = scene.tape[i] ?? 0;
        s.mesh.visible = run > 0 && !torn.has(i);
        s.mesh.geometry.setDrawRange(0, 6 * Math.ceil(s.stripes * run));
        const w = s.mesh.morphTargetInfluences!;
        if (w.length > 1) w[1] = scene.lift[i] ?? 0;
      });
      tents.forEach((t, i) => (t.visible = i < scene.markers));
      // The camera in his hands: up at his eye, down at his chest.
      camera.visible = photo.shown;
      if (photo.shown) {
        const up = photo.move.shoot ?? 0;
        const low = photo.move.low ?? 0;
        const y = (CAMERA_AT.high.y * (1 - low) + CAMERA_AT.low.y * low) * k;
        const z = (CAMERA_AT.high.z * (1 - low) + CAMERA_AT.low.z * low) * k;
        const cy = 1.08 * k + (y - 1.08 * k) * up;
        const cz = 0.2 * k + (z - 0.2 * k) * up;
        const f = { x: Math.sin(photo.heading), z: Math.cos(photo.heading) };
        camera.position.set(photo.x + f.x * cz, photo.y + cy, photo.z + f.z * cz);
        camera.rotation.set(low * up * 0.7, photo.heading, 0, "YXZ");
      }
      const fl = scene.flash;
      light.intensity = FLASH.peak * fl.power;
      light.position.set(fl.x, fl.y, fl.z);
      glare.visible = fl.power > 0.02;
      glare.position.set(fl.x, fl.y, fl.z);
      glare.scale.setScalar(FLASH.glare * (0.4 + 0.6 * fl.power));
      glare.material.opacity = fl.power;
    },
    dispose() {
      clear();
      stakeGeo.dispose();
      camera.geometry.dispose();
      numbers.dispose();
      glare.material.map?.dispose();
      glare.material.dispose();
      tentMat.dispose();
      kit.dispose();
      light.dispose();
    },
  };
}
