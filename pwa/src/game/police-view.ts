// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLICE'S SCENE, DRAWN — what the officers lay on the snow round a
// fatal accident (`police-plan.ts` plans it, `rescue-view.ts` draws the
// machine and the people and hands each frame's scene here): the STAKES,
// driven in one by one; the red-and-white TAPE run between them as the lead
// walks it out, sagging a little between each two; the numbered yellow
// TENTS, a number on either face, stood one by one; the CAMERA in the
// photographer's hands and its FLASH, a bright short light at it and a
// glare; and the body BAG on the stretcher, open under him and then closed
// over him (`bagGeometries`). Presentation only: it reads the plan and the
// frame it is handed and writes nothing.

import * as THREE from "three";
import type { Level } from "@engine";

import { CROWD_LOOKS } from "./crowd-rig.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { OFFICERS, POLICE } from "./police-defs.ts";
import type { PolicePlan } from "./police-plan.ts";
import type { SceneFrame } from "./police-defs.ts";
import { CAMERA_AT } from "./rescue-crew.ts";
import type { CrewPose } from "./rescue-defs.ts";
import { RESCUE } from "./rescue-defs.ts";

const C = POLICE.cordon;
const M = POLICE.marker;

/** The tape's red and white (sRGB), the length of a stripe and the tape's
 * width, m. */
const TAPE = { red: 0xd21f1f, white: 0xf4f4f2, stripe: 0.3, width: 0.06 } as const;
/** A stake: its colours, its girth, m. */
const STAKE = { body: 0xe8e6df, band: 0xd21f1f, girth: 0.025 } as const;
/** The marker tents' yellow and their numbers' black (CSS). */
const TENT = { yellow: "#f6c81a", ink: "#111111" } as const;
/** The flash: its light's colour, its peak (candela), its reach, m; the
 * glare's size at full, m. */
const FLASH = { colour: 0xf2f5ff, peak: 900, reach: 30, glare: 0.9 } as const;
/** The body bag: a black-grey sheet, closed over him. */
const BAG = 0x1d1f22;
const RAIL = 0x9ea4ab;

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

/** ONE SPAN OF TAPE from stake `a` to stake `b`: a ribbon on its edge,
 * sagging between them (never into the snow), striped red and white —
 * non-indexed, a stripe six vertices, so the drawn share of it is a
 * `drawRange`. Returns the geometry and its stripes' count. */
function spanGeometry(
  level: Level,
  a: { x: number; z: number },
  b: { x: number; z: number },
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
  const red = new THREE.Color(TAPE.red);
  const white = new THREE.Color(TAPE.white);
  const h = TAPE.width / 2;
  for (let i = 0; i < n; i++) {
    const [x0, y0, z0] = at(i / n);
    const [x1, y1, z1] = at((i + 1) / n);
    pos.push(
      x0,
      y0 - h,
      z0,
      x1,
      y1 - h,
      z1,
      x1,
      y1 + h,
      z1,
      x0,
      y0 - h,
      z0,
      x1,
      y1 + h,
      z1,
      x0,
      y0 + h,
      z0,
    );
    const c = i % 2 ? white : red;
    for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
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

/** THE BODY BAG on the stretcher, in the stretcher's frame (x across, y up
 * from its rails, z his head's end): its rails and the bag OPEN flat on
 * them under him, and the bag CLOSED over him, a long low black shape. */
export function bagGeometries(): { open: THREE.BufferGeometry; closed: THREE.BufferGeometry } {
  const S = RESCUE.stretcher;
  const rails: THREE.BufferGeometry[] = [];
  for (const x of [-S.rail, S.rail]) {
    const g = new THREE.CylinderGeometry(0.018, 0.018, S.length + 0.1, 8);
    g.rotateX(Math.PI / 2);
    g.translate(x, 0, 0);
    rails.push(paint(g, RAIL));
  }
  const sheet = paint(
    new THREE.BoxGeometry(0.78, 0.02, S.length - 0.06).translate(0, 0.03, 0),
    BAG,
  );
  const open = mergeColoured([...rails.map((g) => g.clone()), sheet]);
  const body = new THREE.CapsuleGeometry(0.24, S.length - 0.62, 4, 10);
  body.rotateX(Math.PI / 2);
  body.scale(1.1, 0.62, 1);
  body.translate(0, 0.16, 0);
  const zip = paint(
    new THREE.BoxGeometry(0.03, 0.02, S.length - 0.5).translate(0.06, 0.315, 0),
    0x6a6d72,
  );
  const closed = mergeColoured([...rails, paint(body, BAG), zip]);
  return { open, closed };
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
    new THREE.MeshLambertMaterial({ map: numbers, side: THREE.DoubleSide }),
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
        const { geo, stripes } = spanGeometry(level, plan.ring[i], plan.ring[(i + 1) % n]);
        const mesh = new THREE.Mesh(geo, kit);
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
