// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESCUE ON THE NEXT RUN, DRAWN — a run after one that ended INJURED
// (`GoreState.injured`) passes the spot where he
// fell, and there the AIR AMBULANCE has set down and its crew carry him on
// a stretcher to it (`rescue-plan.ts` decides where and when; the crew's
// poses are `rescue-crew.ts`'). Drawn here: the helicopter (`heli-view.ts`
// over the air ambulance's model — `MODEL_URL` is the one line it is named
// on), its rotor turning, its lights
// and its landing lamp after dark and its wash thrown up as it lifts; the
// four of them — the doctor and the paramedic in the flight crew's red with
// a reflective yoke and white helmets, two patrollers in red with the white
// cross — built on the civilians' bodies (`buildPosedFigure`) and posed by
// morph weights; HIM, in his own colours with his helmet on, lying where he
// fell, rolled onto the board (`rescue-scoop.ts`) and strapped; and the
// stretcher: its rails and an orange vacuum mattress moulded round him.
//
// Presentation only, end to end: it reads the states it is handed and the
// map, and writes nothing. It shows on the ONE run after an injured one —
// a restart after any other ending clears it — and is started on that run's
// clock the first time the player comes within `RESCUE.reach`.

import * as THREE from "three";
import {
  HELI,
  RAGDOLL,
  freshHeli,
  type CrowdBody,
  type GameState,
  type HeliState,
  type Level,
} from "@engine";

import { CIVILIAN_SLOT as SLOT, PART } from "./civilian-dress.ts";
import { buildPosedFigure } from "./civilian-shapes.ts";
import { CROWD_LOOKS } from "./crowd-rig.ts";
import type { Flood } from "./headlamp.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createHeliView, type HeliView, type WashPuff } from "./heli-view.ts";
import { coloursOf, gearOf, type Outfit } from "./outfit.ts";
import { CREW_POSES, casualtyTargets, crewDials, crewTargets } from "./rescue-crew.ts";
import {
  BEARERS,
  RESCUE,
  freshRescueFrame,
  planRescue,
  rescueAt,
  watchRescue,
  type RescueClock,
  type RescuePlan,
} from "./rescue-plan.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import { rescueModelUrl } from "./skier-models.ts";
import type { SnowSampler } from "./trail-stamp.ts";

/** THE AIR AMBULANCE'S MODEL (`make models`, `scripts/blender/rescue.py`):
 * the heli-ski machine's airframe in a mountain air ambulance's signal
 * yellow, its hoist over the right-hand sliding door it is loaded through.
 * The one line its file is named on. */
const MODEL_URL = (): string | null => rescueModelUrl();

/** The crew's colours, by slot (`CIVILIAN_SLOT`): the flight crew's suit,
 * a reflective yoke, a white helmet; the patrol's red with the white cross. */
const SKIN = [0xe2b494, 0xc68863, 0xd9a07a, 0xa8714f];
const HAIR = [0x3a2a1e, 0x6b4a2c, 0x2a211a, 0x9a6232];
const DRESS: Record<
  "crew" | "patrol",
  { jacket: number; pants: number; head: number; accent: number }
> = {
  crew: { jacket: 0xd23c1c, pants: 0xd23c1c, head: 0xf1f1ec, accent: 0xc6cbd2 },
  patrol: { jacket: 0xc4161c, pants: 0x18191c, head: 0xc4161c, accent: 0xffffff },
};

/** The stretcher's own colours. */
const MATTRESS = 0xe9581c;
const BUCKLE = 0xb8bcc2;
const STRAP = 0x1c1d21;
const RAIL = 0x9ea4ab;

/** The landing lamp after dark: its height and reach over the work. */
const LAMP_POWER = 0.9;

export type RescueScene = {
  group: THREE.Group;
  /** One frame: a new run looked at (started after an injured one, cleared
   * after any other), the clock watched, everything posed. */
  frame(state: GameState, dt: number, cloud: SnowCloud | null, snowAt: SnowSampler): void;
  /** The player's outfit, the casualty's — read when a rescue is set up. */
  dress(outfit: Outfit): void;
  /** The landing lamp, after dark (`lit` the dark's share). */
  lamps(lit: number, out: Flood[]): void;
  /** Whether a rescue is under way on this run. */
  active(): boolean;
  dispose(): void;
};

/** One of the four: his mesh, and the weights written into it. */
type Member = { mesh: THREE.Mesh; weights: number[] };

const scratch = new Float32Array(CREW_POSES.length);

/** A body's figure, built once and shared by every one of them in it. */
const bodies = new Map<CrowdBody, THREE.BufferGeometry>();
function bodyOf(body: CrowdBody): THREE.BufferGeometry {
  let g = bodies.get(body);
  if (!g) {
    g = buildPosedFigure(body, "near", crewTargets(body), `rescue:${body}`);
    bodies.set(body, g);
  }
  return g;
}

/** A DRESSED COPY of a body's figure: its own colours (each slot's off
 * `colours`, times the shade the builder painted) and its own index, which
 * leaves out every part he does not wear; the positions and the poses are
 * the body's, shared. */
function dressed(
  base: THREE.BufferGeometry,
  colours: Partial<Record<keyof typeof SLOT, number>>,
  parts: readonly number[],
): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", base.getAttribute("position"));
  g.setAttribute("normal", base.getAttribute("normal"));
  // A figure built with no poses but its stance has none to share.
  if (base.morphAttributes.position?.length) {
    g.morphAttributes = base.morphAttributes;
    g.morphTargetsRelative = true;
  }
  const shade = base.getAttribute("color");
  const slot = base.getAttribute("aSlot");
  const part = base.getAttribute("aPart");
  const n = shade.count;
  const palette: (THREE.Color | null)[] = [];
  for (const [name, at] of Object.entries(SLOT)) {
    const hex = colours[name as keyof typeof SLOT];
    palette[at] = hex === undefined ? null : new THREE.Color(hex);
  }
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = palette[Math.round(slot.getX(i))];
    col[3 * i] = shade.getX(i) * (p ? p.r : 1);
    col[3 * i + 1] = shade.getY(i) * (p ? p.g : 1);
    col[3 * i + 2] = shade.getZ(i) * (p ? p.b : 1);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const index: number[] = [];
  for (let t = 0; t + 2 < n; t += 3) {
    const k = Math.round(part.getX(t));
    if (k === PART.body || parts.includes(k)) index.push(t, t + 1, t + 2);
  }
  g.setIndex(index);
  g.boundingSphere = base.boundingSphere?.clone() ?? null;
  return g;
}

/** A box from its two corners, in a colour, into a list of parts. */
function box(
  geos: THREE.BufferGeometry[],
  colour: number,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): void {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  paint(g, colour);
  geos.push(g);
}

function paint(g: THREE.BufferGeometry, colour: number): void {
  const c = new THREE.Color(colour);
  const n = g.getAttribute("position").count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], 3 * i);
  g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3));
}

/** Every part merged into one, non-indexed, coloured. */
function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of flat) n += g.getAttribute("position").count;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let at = 0;
  for (const g of flat) {
    const c = g.getAttribute("position").count;
    pos.set(g.getAttribute("position").array as Float32Array, at * 3);
    nrm.set(g.getAttribute("normal").array as Float32Array, at * 3);
    col.set(g.getAttribute("color").array as Float32Array, at * 3);
    at += c;
  }
  for (const g of [...geos, ...flat]) g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/** THE STRETCHER in its own frame (x across, y up from its rails, z ahead
 * — his head's end): the rails and their ends, and the vacuum mattress on
 * them moulded up a hand's breadth round him and round his head, low enough
 * that all of him shows. */
function stretcherGeometry(): THREE.BufferGeometry {
  const S = RESCUE.stretcher;
  const L = S.length / 2;
  const geos: THREE.BufferGeometry[] = [];
  for (const x of [-S.rail, S.rail]) {
    const g = new THREE.CylinderGeometry(0.018, 0.018, S.length + 0.1, 8);
    g.rotateX(Math.PI / 2);
    g.translate(x, 0, 0);
    paint(g, RAIL);
    geos.push(g);
  }
  for (const z of [-L + 0.02, L - 0.02])
    box(geos, RAIL, -S.rail, -0.02, z - 0.02, S.rail, 0.01, z + 0.02);
  // The mattress: its base, then its sides, its foot and its head moulded up.
  box(geos, MATTRESS, -0.29, -0.07, -L + 0.03, 0.29, 0.05, L - 0.03);
  for (const s of [-1, 1]) box(geos, MATTRESS, s * 0.24, 0.04, -L + 0.08, s * 0.3, 0.13, L - 0.15);
  box(geos, MATTRESS, -0.29, 0.04, L - 0.12, 0.29, 0.12, L - 0.03);
  for (const s of [-1, 1]) box(geos, MATTRESS, s * 0.13, 0.05, L - 0.36, s * 0.22, 0.2, L - 0.12);
  box(geos, MATTRESS, -0.29, 0.04, -L + 0.03, 0.29, 0.14, -L + 0.08);
  return merge(geos);
}

/** Along the board, m, and how high over its rails his front is there:
 * the straps over his chest, his hips and his shins. */
const STRAPS = [
  { z: 0.42, top: 0.31 },
  { z: 0.0, top: 0.29 },
  { z: -0.48, top: 0.24 },
] as const;

/** One STRAP done up across him: over the top of him and down both sides
 * to the mattress's edge. */
function strapGeometry(z: number, top: number): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  box(geos, STRAP, -0.27, top, z - 0.025, 0.27, top + 0.015, z + 0.025);
  for (const s of [-1, 1])
    box(geos, STRAP, s * 0.255, 0.1, z - 0.025, s * 0.275, top + 0.015, z + 0.025);
  box(geos, BUCKLE, -0.035, top + 0.01, z - 0.03, 0.035, top + 0.025, z + 0.03);
  return merge(geos);
}

/** His own frame (x right, y up, z his face) laid on his back with his
 * middle at the origin: his up along +z (the way his head points), his face
 * up, his right to the left — `height` m tall in his boots. */
function lyingMatrix(height: number): THREE.Matrix4 {
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 1, 0),
  );
  m.setPosition(0, 0, -height / 2);
  return m;
}

/** How a FakeHeli is handed to `heli-view.ts`: the state it reads. */
type HeliRun = { heli: HeliState; level: Level; tick: number };

export function createRescueScene(level: Level, haze: HazeUniforms): RescueScene {
  const group = new THREE.Group();
  group.name = "rescue";
  group.visible = false;
  const heli: HeliView = createHeliView(level, haze, {
    pad: false,
    url: MODEL_URL(),
    cockpit: false,
  });
  group.add(heli.group);
  const material = hazeMaterial(
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    haze,
    "rescue",
  );
  const kit = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 }),
    haze,
    "rescue-kit",
  );

  // THE FOUR, each a dressed copy of his body.
  const crew: Member[] = BEARERS.map((b, i) => {
    const d = b.role === "patrol" ? DRESS.patrol : DRESS.crew;
    const g = dressed(
      bodyOf(b.body),
      { ...d, vest: d.jacket, skin: SKIN[i % 4], hair: HAIR[i % 4], skis: 0x30343a },
      [PART.helmet, ...(b.role === "patrol" ? [PART.cross] : [])],
    );
    const mesh = new THREE.Mesh(g, material);
    mesh.morphTargetInfluences = new Array<number>(CREW_POSES.length).fill(0);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.name = `rescue-${b.role}-${i}`;
    group.add(mesh);
    return { mesh, weights: mesh.morphTargetInfluences };
  });

  // THE STRETCHER, and him on it (dressed when a rescue is set up).
  const stretcher = new THREE.Group();
  const frame = new THREE.Mesh(stretcherGeometry(), kit);
  frame.castShadow = true;
  stretcher.add(frame);
  const straps = STRAPS.map(({ z, top }) => {
    const m = new THREE.Mesh(strapGeometry(z, top), kit);
    m.castShadow = true;
    stretcher.add(m);
    return m;
  });
  group.add(stretcher);
  let casualty: THREE.Mesh | null = null;
  let outfit: Outfit | null = null;
  let lying = lyingMatrix(1.8);
  const placed = new THREE.Matrix4();

  function dressCasualty(): void {
    if (casualty) {
      group.remove(casualty);
      casualty.geometry.dispose();
    }
    const o = outfit;
    const female = o ? gearOf("body", o.body).female : false;
    const body: CrowdBody = female ? "woman" : "man";
    const c = o ? coloursOf(o) : null;
    const g = dressed(
      buildPosedFigure(body, "near", casualtyTargets(body), `casualty:${body}`),
      {
        jacket: c?.jacket ?? 0x2b5fa8,
        pants: c?.pants ?? 0x1c1f24,
        head: c?.helmet ?? 0xe8e8e8,
        accent: c?.accent ?? 0xffffff,
        vest: c?.jacket ?? 0x2b5fa8,
        skin: c?.skin ?? SKIN[0],
        hair: HAIR[0],
      },
      [PART.helmet],
    );
    casualty = new THREE.Mesh(g, material);
    casualty.morphTargetInfluences = [1];
    casualty.matrixAutoUpdate = false;
    casualty.castShadow = true;
    casualty.frustumCulled = false;
    lying = lyingMatrix(CROWD_LOOKS[body].height);
    group.add(casualty);
  }

  let plan: RescuePlan | null = null;
  const clock: RescueClock = { started: null };
  const now = freshRescueFrame();
  let last: GameState | null = null;
  const run: HeliRun = { heli: freshHeli({ level } as GameState), level, tick: 0 };
  let puffs = 0;
  run.heli.mode = "home";
  run.heli.rider = false;
  const dummy = { x: 0, z: 0 };
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  const pos = new THREE.Vector3();

  /** Where he lay as the run ended: his hips off his thrown body, else
   * where he was. */
  function spotOf(s: GameState): { x: number; z: number } {
    const P = s.skier.thrown?.points;
    if (!P) return { x: s.skier.x, z: s.skier.z };
    const a = 3 * RAGDOLL.hipL;
    const b = 3 * RAGDOLL.hipR;
    return { x: (P[a] + P[b]) / 2, z: (P[a + 2] + P[b + 2]) / 2 };
  }

  const start = (s: GameState): void => {
    plan = planRescue(level, spotOf(s));
    clock.started = null;
    dressCasualty();
  };

  return {
    group,
    frame(state, dt, cloud, snowAt) {
      if (state !== last) {
        // A NEW RUN: the rescue of the last one if it ended INJURED, else none.
        const was = last;
        last = state;
        plan = null;
        if (was && was.level === level && (was.gore?.injured ?? -1) >= 0) start(was);
      }
      group.visible = !!plan;
      if (!plan) return;
      const t = watchRescue(plan, clock, state.skier.x, state.skier.z, state.t);
      rescueAt(level, plan, t, now);
      // THE MACHINE, through the heli-ski machine's own drawing.
      const h = run.heli;
      const f = now.heli;
      h.x = f.x;
      h.y = f.y;
      h.z = f.z;
      h.heading = f.heading;
      h.pitch = f.pitch;
      h.roll = f.roll;
      h.spool = f.spool;
      h.thrust = f.thrust * HELI_WEIGHT;
      h.agl = f.y + HUB - level.groundAt(f.x, f.z);
      h.grounded = h.agl < HUB + 0.3;
      run.tick += 1;
      heli.update(run as unknown as GameState, 1, dt, dummy, NO_HOOKS);
      heli.group.visible = f.shown;
      // The wash raised only once it pulls: flat on its skids it stirs
      // little. A third of the player's own — the crew stamp a landing zone
      // down before it is flown into, and a whiteout would hide the scene.
      if (f.shown && cloud && f.thrust > 0.5) {
        const puff: WashPuff = (x, y, z, vx, vy, vz, size) => {
          if (++puffs % 3 === 0) cloud.blow(x, y, z, vx, vy, vz, size);
        };
        heli.blow(run as unknown as GameState, dt, puff, (x, z) => 0.4 * snowAt(x, z).loose);
      }
      // THE FOUR.
      for (let j = 0; j < crew.length; j++) {
        const c = now.crew[j];
        const m = crew[j];
        m.mesh.visible = c.shown;
        m.mesh.position.set(c.x, c.y, c.z);
        m.mesh.rotation.set(0, c.heading, 0);
        crewDials(c.move, scratch);
        for (let k = 0; k < scratch.length; k++) m.weights[k] = scratch[k];
      }
      // THE STRETCHER and him on it.
      const st = now.stretcher;
      stretcher.visible = st.shown;
      stretcher.position.set(st.x, st.y, st.z);
      euler.set(-st.pitch, st.heading, -st.roll, "YXZ");
      quat.setFromEuler(euler);
      stretcher.quaternion.copy(quat);
      for (let k = 0; k < straps.length; k++) straps[k].visible = k < st.straps;
      // HIM: on the snow as found, rolled, laid on the board.
      const c = now.casualty;
      if (casualty) {
        casualty.visible = c.shown;
        euler.set(-c.pitch, c.heading, -c.roll, "YXZ");
        quat.setFromEuler(euler);
        placed.compose(pos.set(c.x, c.y, c.z), quat, ONE);
        casualty.matrix.multiplyMatrices(placed, lying);
        casualty.matrixWorldNeedsUpdate = true;
        casualty.morphTargetInfluences![0] = c.sprawl;
      }
    },
    dress(o) {
      outfit = o;
    },
    lamps(lit, out) {
      if (!plan || lit <= 0 || !now.heli.shown) return;
      // The landing lamp under the nose, aimed down at the work beside it.
      const f = now.heli;
      const fx = Math.sin(f.heading);
      const fz = Math.cos(f.heading);
      const tx = (now.stretcher.x - f.x) * 0.6 + fx * 2;
      const tz = (now.stretcher.z - f.z) * 0.6 + fz * 2;
      const d = Math.hypot(tx, tz) || 1;
      out.push({
        x: f.x + fx * 2.6,
        y: f.y + 1.1,
        z: f.z + fz * 2.6,
        dx: (tx / d) * 0.8,
        dy: -0.6,
        dz: (tz / d) * 0.8,
        power: LAMP_POWER * lit,
      });
    },
    active: () => !!plan,
    dispose() {
      heli.dispose();
      for (const m of crew) m.mesh.geometry.dispose();
      if (casualty) casualty.geometry.dispose();
      frame.geometry.dispose();
      for (const m of straps) m.geometry.dispose();
      material.dispose();
      kit.dispose();
    },
  };
}

const HUB = HELI.rotor.hub;
const HELI_WEIGHT = HELI.mass * 9.81;
const NO_HOOKS = { flame: () => {}, strike: () => {} };
const ONE = new THREE.Vector3(1, 1, 1);
