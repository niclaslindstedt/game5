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
import type { Level } from "@engine";

import { CROWD_LOOKS } from "./crowd-rig.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { TAPE_LIFT } from "./police-carry.ts";
import { OFFICERS, POLICE } from "./police-defs.ts";
import type { PolicePlan } from "./police-plan.ts";
import type { SceneFrame } from "./police-defs.ts";
import { CAMERA_AT } from "./rescue-crew.ts";
import type { CrewPose } from "./rescue-defs.ts";

const C = POLICE.cordon;
const M = POLICE.marker;

/** The tape's red and white (sRGB), the length of a stripe and the tape's
 * width, m; and its twist along a span (as real tape hangs, turning its
 * face up and over): its lean off its edge, rad, about `lean` by up to
 * `turn` either way, a turn every `every` m. */
const TAPE = {
  red: 0xd21f1f,
  white: 0xf4f4f2,
  stripe: 0.3,
  width: 0.075,
  lean: 0.8,
  turn: 0.6,
  every: 2.6,
} as const;
/** A stake: its colours, its girth, m. */
const STAKE = { body: 0xe8e6df, band: 0xd21f1f, girth: 0.025 } as const;
/** The marker tents' yellow and their numbers' black (CSS): a bright
 * signal yellow, as the plastic ones are. */
const TENT = { yellow: "#ffd60a", ink: "#111111" } as const;
/** The flash: its light's colour, its peak (candela), its reach, m; the
 * glare's size at full, m. */
const FLASH = { colour: 0xf2f5ff, peak: 900, reach: 30, glare: 0.9 } as const;

export type PoliceDressing = {
  group: THREE.Group;
  /** The scene of `plan` laid out (its stakes, spans and markers built). */
  build(plan: PolicePlan | null): void;
  /** One frame: what is up, the tape run out, the markers, the flash, the
   * photographer's camera (his pose, crew slot `PHOTO`). */
  update(scene: SceneFrame, photo: CrewPose): void;
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
  const n = Math.max(2, Math.ceil(len / TAPE.stripe));
  const ya = level.groundAt(a.x, a.z) + C.tape;
  const yb = level.groundAt(b.x, b.z) + C.tape;
  const sag = Math.min(C.sagMost, C.sag * len);
  const at = (u: number) => {
    const x = a.x + (b.x - a.x) * u;
    const z = a.z + (b.z - a.z) * u;
    const y = Math.max(ya + (yb - ya) * u - 4 * sag * u * (1 - u), level.groundAt(x, z) + 0.25);
    return [x, y, z];
  };
  const pos: number[] = [];
  const col: number[] = [];
  const raise: number[] = [];
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
  const phase = (a.x * 0.37 + a.z * 0.71) % (Math.PI * 2);
  const half = (u: number): number[] => {
    const t = TAPE.lean + TAPE.turn * Math.sin(((u * len) / TAPE.every) * Math.PI * 2 + phase);
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
  if (lift !== null) {
    geo.morphAttributes.position = [new THREE.Float32BufferAttribute(raise, 3)];
    geo.morphTargetsRelative = true;
  }
  return { geo, stripes: n };
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
  const light = new THREE.PointLight(FLASH.colour, 0, FLASH.reach, 2);
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
  const clear = (): void => {
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
        if (gate) mesh.morphTargetInfluences = [0];
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
    update(scene, photo) {
      group.visible = scene.up;
      if (!scene.up) {
        light.intensity = 0;
        return;
      }
      // The stakes driven in, in their order of planting round the ring.
      stakes.forEach((s, i) => (s.visible = !!scene.planted[i]));
      spans.forEach((s, i) => {
        const run = scene.tape[i] ?? 0;
        s.mesh.visible = run > 0;
        s.mesh.geometry.setDrawRange(0, 6 * Math.ceil(s.stripes * run));
        if (s.mesh.morphTargetInfluences) s.mesh.morphTargetInfluences[0] = scene.lift[i] ?? 0;
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
    },
  };
}
