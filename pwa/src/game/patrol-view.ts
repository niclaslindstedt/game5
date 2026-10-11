// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI PATROL AND THE SEARCH AS DRAWN (`avalanche-rescue.ts`): the two
// patrollers who come for a buried skier — on the civilians' bodies
// (`buildPosedFigure`) in the patrol's red with the white cross, posed by
// morph weights (`patrol-crew.ts`) at where `patrolMan` puts them — their
// skis under them as they ski in, the PROBE in the prober's hands, the
// probes LEFT STANDING in the debris over every body struck (a rescuer
// leaves his probe in as the marker the shovels dig to), and the SPOIL
// HEAP thrown out beside each hole — and the HOLE itself: a slot cut in
// from downhill (`dig-pit.ts`), its walls and floor drawn where the
// ground's shader cuts the snow out (`room-cuts.ts`'s `setHoleCuts`).
//
// Cheap, and nothing of it until it is wanted: built when the first
// patrol shows or the first body is struck, two figures (each two dressed
// copies of one shared geometry — with the shovel and without), a handful
// of boxes and lumps, posed once a frame.

import * as THREE from "three";
import {
  patrolMan,
  type AvalancheState,
  type CrowdBody,
  type GameState,
  type Level,
  type PatrolMan,
} from "@engine";

import { buildPosedFigure } from "./civilian-shapes.ts";
import { PART } from "./civilian-dress.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import {
  PATROL_POSES,
  PROBE_AT,
  PROBE_STROKE,
  patrolDials,
  patrolTargets,
  probeIn,
} from "./patrol-crew.ts";
import { DRESS, HAIR, SKIN, dressed } from "./rescue-view.ts";
import { setHoleCuts } from "./room-cuts.ts";
import { PIT, PIT_VERTS, pitCut, pitShape, type PitCut } from "./dig-pit.ts";

/** The two who come: their bodies. */
const BODIES: readonly CrowdBody[] = ["man", "woman"];
/** The probe: its length and its radius, m, and its alloy. */
const PROBE = { length: 2.6, radius: 0.007, colour: 0xc9ced4 } as const;
/** A probe left in: how much of it stands over the snow, m, and its
 * tip's flag. */
const MARKER = { out: 0.9, flag: 0xe4231b } as const;
/** The patrol's skis: length and width, m, and their colour. */
const SKI = { length: 1.75, width: 0.08, colour: 0x2b2f36 } as const;
/** THE SPOIL: the snow out of a hole thrown out beside it — its colour, and
 * the sky's light it takes in its own shade, so it reads as snow, not stone. */
const SPOIL = { colour: 0xffffff, shade: 0x1c2638 } as const;
/** A heap's shape: a ball shoved in and out by a hash of each corner, so
 * it reads as thrown blocks and clods rather than a smooth dome. */
function lumps(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // A corner shared by several faces moves the same way.
    const k =
      (Math.imul(Math.round(x * 97), 73856093) ^
        Math.imul(Math.round(y * 97), 19349663) ^
        Math.imul(Math.round(z * 97), 83492791)) >>>
      0;
    const f = 0.8 + 0.32 * ((k % 1000) / 1000);
    pos.setXYZ(i, x * f, y * f, z * f);
  }
  g.computeVertexNormals();
  return g;
}

/** The burials a view keeps marks for — the engine's own list's length. */
const MARKS = 8;

export type PatrolView = {
  group: THREE.Group;
  /** One frame: the patrol posed, the marks laid. `lift` is the drawn
   * snow's height over the engine's at a point (the debris, the hole). */
  frame(state: GameState, dt: number, lift: (x: number, z: number) => number): void;
  dispose(): void;
};

type Member = {
  root: THREE.Group;
  bare: THREE.Mesh;
  shovel: THREE.Mesh;
  skis: THREE.Mesh;
  probe: THREE.Mesh;
  weights: Float32Array;
  man: PatrolMan;
  px: number;
  pz: number;
  pace: number;
};

/** Whether a slide's search has anything to draw: the patrol on the
 * snow, or a body struck or being dug. */
export function patrolShown(a: AvalancheState | undefined): boolean {
  if (!a) return false;
  if (a.patrol && a.patrol.phase !== "called") return true;
  for (const b of a.burials) if (b.struck || b.dug > 0) return true;
  return false;
}

export function createPatrolView(level: Level, haze: HazeUniforms): PatrolView {
  const group = new THREE.Group();
  group.name = "patrol";
  const material = hazeMaterial(
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    haze,
    "patrol",
  );
  const plain = (hex: number): THREE.Material =>
    hazeMaterial(new THREE.MeshLambertMaterial({ color: hex }), haze, "patrol-kit");
  const probeMat = plain(PROBE.colour);
  const skiMat = plain(SKI.colour);
  const flagMat = plain(MARKER.flag);
  const spoilMat = hazeMaterial(
    new THREE.MeshLambertMaterial({
      color: SPOIL.colour,
      emissive: SPOIL.shade,
      flatShading: true,
    }),
    haze,
    "patrol-spoil",
  );
  const probeGeo = new THREE.CylinderGeometry(PROBE.radius, PROBE.radius, PROBE.length, 5);
  probeGeo.translate(0, -PROBE.length / 2, 0);
  const skiGeo = (() => {
    const a = new THREE.BoxGeometry(SKI.width, 0.02, SKI.length);
    const b = a.clone();
    a.translate(-0.12, 0.01, 0.05);
    b.translate(0.12, 0.01, -0.03);
    const pos = [...a.getAttribute("position").array, ...b.getAttribute("position").array];
    const nrm = [...a.getAttribute("normal").array, ...b.getAttribute("normal").array];
    const ia = Array.from(a.index!.array);
    const n = a.getAttribute("position").count;
    const idx = [...ia, ...ia.map((i) => i + n)];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    g.setIndex(idx);
    a.dispose();
    b.dispose();
    return g;
  })();
  const flagGeo = new THREE.BoxGeometry(0.012, 0.09, 0.06);
  flagGeo.translate(0, -0.06, 0.03);
  const spoilGeo = lumps(new THREE.IcosahedronGeometry(1, 2));
  const owned: THREE.BufferGeometry[] = [probeGeo, skiGeo, flagGeo, spoilGeo];

  // THE TWO, built at the first frame they are wanted.
  let crew: Member[] | null = null;
  function build(): Member[] {
    return BODIES.map((body, i) => {
      const base = buildPosedFigure(body, "near", patrolTargets(body), `patrol:${body}`);
      owned.push(base);
      const colours = {
        ...DRESS.patrol,
        vest: DRESS.patrol.jacket,
        skin: SKIN[(i + 1) % 4],
        hair: HAIR[(i + 2) % 4],
        skis: SKI.colour,
      };
      const root = new THREE.Group();
      const mesh = (parts: number[]): THREE.Mesh => {
        const g = dressed(base, colours, parts);
        owned.push(g);
        const m = new THREE.Mesh(g, material);
        m.morphTargetInfluences = new Array<number>(PATROL_POSES.length).fill(0);
        m.castShadow = true;
        m.frustumCulled = false;
        root.add(m);
        return m;
      };
      const bare = mesh([PART.helmet, PART.cross]);
      const shovel = mesh([PART.helmet, PART.cross, PART.shovel]);
      const skis = new THREE.Mesh(skiGeo, skiMat);
      skis.castShadow = true;
      root.add(skis);
      const probe = new THREE.Mesh(probeGeo, probeMat);
      root.add(probe);
      root.name = `patrol-${i}`;
      group.add(root);
      return {
        root,
        bare,
        shovel,
        skis,
        probe,
        weights: new Float32Array(PATROL_POSES.length),
        man: { shown: false, x: 0, z: 0, heading: 0, act: "stand", work: 0 },
        px: Number.NaN,
        pz: 0,
        pace: 0,
      };
    });
  }

  // THE MARKS: a probe left standing and a spoil heap a burial.
  const markers: THREE.Group[] = [];
  const heaps: THREE.Mesh[] = [];
  const pits: THREE.Mesh[] = [];
  /** How far each pit was dug when it was last written, m. */
  const pitDug: number[] = [];
  const pitMat = hazeMaterial(
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
    haze,
    "patrol-pit",
  );
  for (let i = 0; i < MARKS; i++) {
    const m = new THREE.Group();
    const pole = new THREE.Mesh(probeGeo, probeMat);
    pole.position.y = MARKER.out;
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.y = MARKER.out;
    m.add(pole, flag);
    m.visible = false;
    group.add(m);
    markers.push(m);
    const h = new THREE.Mesh(spoilGeo, spoilMat);
    h.visible = false;
    h.receiveShadow = true;
    group.add(h);
    heaps.push(h);
    // The hole: its walls and floor, written afresh as it goes down.
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PIT_VERTS * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PIT_VERTS * 3), 3));
    owned.push(g);
    const pit = new THREE.Mesh(g, pitMat);
    pit.visible = false;
    pit.frustumCulled = false;
    pit.receiveShadow = true;
    group.add(pit);
    pits.push(pit);
    pitDug.push(-1);
  }
  const cut: PitCut = { x: 0, z: 0, heading: 0, hw: 0, hd: 0 };
  const cuts: PitCut[] = [];
  const n = { x: 0, y: 1, z: 0 };
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();
  const yaw = new THREE.Quaternion();

  return {
    group,
    frame(state, dt, lift) {
      const a = state.avalanche;
      const p = a?.patrol ?? null;
      const ground = (x: number, z: number): number => level.groundAt(x, z) + lift(x, z);
      if (p && p.phase !== "called" && !crew) crew = build();
      for (let i = 0; i < (crew?.length ?? 0); i++) {
        const c = crew![i];
        if (!p) {
          c.root.visible = false;
          c.px = Number.NaN;
          continue;
        }
        const man = patrolMan(p, i as 0 | 1, c.man);
        c.root.visible = man.shown;
        if (!man.shown) continue;
        // How fast he goes over the snow, eased: the walk paced to it.
        if (Number.isNaN(c.px) || dt <= 0) c.pace = 0;
        else {
          const v = Math.hypot(man.x - c.px, man.z - c.pz) / dt;
          c.pace += (Math.min(v, 15) - c.pace) * Math.min(1, dt * 6);
        }
        c.px = man.x;
        c.pz = man.z;
        c.root.position.set(man.x, ground(man.x, man.z), man.z);
        c.root.rotation.set(0, man.heading, 0);
        patrolDials(man, c.pace, c.weights);
        const digging = man.act === "dig";
        c.bare.visible = !digging;
        c.shovel.visible = digging;
        const w = (digging ? c.shovel : c.bare).morphTargetInfluences!;
        for (let k = 0; k < w.length; k++) w[k] = c.weights[k];
        c.skis.visible = man.act === "ski" || (man.act === "stand" && p.phase === "coming");
        // The probe in both hands, upright before him, pushed in a stroke.
        c.probe.visible = man.act === "probe";
        if (c.probe.visible) {
          const top = 1.3 - PROBE_STROKE * probeIn(man.work);
          c.probe.position.set(PROBE_AT.x, top, PROBE_AT.z);
        }
      }
      // A probe left in over every body struck, and the snow thrown out of
      // every hole downhill of it.
      const list = a?.burials ?? [];
      cuts.length = 0;
      for (let i = 0; i < MARKS; i++) {
        const b = list[i];
        const mk = markers[i];
        const heap = heaps[i];
        const pit = pits[i];
        const dug = !!b && b.dug > 0.02;
        level.normalAt(b?.x ?? 0, b?.z ?? 0, n);
        const fl = Math.hypot(n.x, n.z) || 1;
        const fx = n.x / fl;
        const fz = n.z / fl;
        // The probe stands in the hole's floor as it goes down.
        const share = b && b.depth > 0 ? Math.min(1, b.dug / b.depth) : 0;
        mk.visible = !!b && b.struck && b.phase === "buried";
        if (mk.visible) {
          const floor = ground(b.x, b.z) - share * Math.max(PIT.least, lift(b.x, b.z));
          mk.position.set(b.x, floor, b.z);
        }
        pit.visible = dug;
        heap.visible = !!b && b.dug > 0.05;
        if (!dug) {
          pitDug[i] = -1;
          continue;
        }
        // THE HOLE, the ground's snow cut out of it.
        if (cuts.length < MARKS) cuts.push({ ...pitCut(b, fx, fz, cut) });
        if (Math.abs(b.dug - pitDug[i]) > 0.01) {
          pitDug[i] = b.dug;
          const g = pit.geometry;
          const pos = g.getAttribute("position") as THREE.BufferAttribute;
          const col = g.getAttribute("color") as THREE.BufferAttribute;
          pitShape(b, fx, fz, ground, lift, pos.array as Float32Array, col.array as Float32Array);
          pos.needsUpdate = true;
          col.needsUpdate = true;
          g.computeVertexNormals();
        }
        if (!heap.visible) continue;
        // As much snow as has come out: a hole about twice as long as deep
        // and a metre and a half wide, heaped loose — thrown out to the
        // side of the ramp, down the fall line from the body.
        const vol = Math.max(0.05, b.dug * 1.5 * Math.max(1.2, 2 * b.depth) * 1.3);
        const r = Math.cbrt((3 * vol) / (2 * Math.PI * 0.35));
        const along = 0.6 + 0.9 * b.depth;
        const side = (i % 2 === 0 ? 1 : -1) * (PIT.half + 0.2 + 0.8 * r);
        const hx = b.x + fx * along + fz * side;
        const hz = b.z + fz * along - fx * side;
        // Lying on the slope, half sunk into it.
        heap.position.set(hx, ground(hx, hz) - 0.15 * r, hz);
        heap.scale.set(r * 1.1, r * 0.45, r * 0.9);
        normal.set(n.x, n.y, n.z).normalize();
        heap.quaternion.setFromUnitVectors(up, normal);
        heap.quaternion.multiply(yaw.setFromAxisAngle(up, Math.atan2(fx, fz) + i));
      }
      setHoleCuts(cuts);
    },
    dispose() {
      setHoleCuts([]);
      for (const g of owned) g.dispose();
      for (const m of [material, probeMat, skiMat, flagMat, spoilMat, pitMat]) m.dispose();
    },
  };
}
