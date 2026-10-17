// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESCUES UNDER WAY, DRAWN — every air ambulance a run carries
// (`GameState.rescue`, booked from run to run by `rescue-book.ts`): flown in
// when the run after an injured one starts and set down near where he lay,
// its crew carrying him on a stretcher to it, and a second casualty taken
// by the same machine where it can (`rescue-flight.ts` plans each call;
// each casualty's scoop, carry and loading is `rescue-plan.ts`'; the
// crew's poses are `rescue-crew.ts`'). Drawn here: each helicopter
// (`heli-view.ts` over the air ambulance's model — `MODEL_URL` is the one
// line it is named on), its rotor turning, its lights and its landing lamp
// after dark and its wash thrown up as it comes in and lifts; the four of
// each — the doctor and the paramedic in the flight crew's red with a
// reflective yoke and white helmets, two patrollers in red with the white
// cross — built on the civilians' bodies (`buildPosedFigure`) and posed by
// morph weights, KNOCKED OVER by a skier as anyone on foot is
// (`civilian-hits.ts`: on the ragdoll, up again and walking back to the
// work); HIM, in his own colours with his helmet on, lying where he fell,
// rolled onto the board (`rescue-scoop.ts`) and strapped; and the
// stretcher: its rails and an orange vacuum mattress moulded round him.
//
// Presentation only: it reads the states it is handed and the map, and
// writes nothing. The machine on its skids is a solid to the ENGINE
// (`rescue-call.ts`), never to this view.

import * as THREE from "three";
import {
  HELI,
  freshHeli,
  type CrowdBody,
  type GameState,
  type HeliState,
  type Level,
  type RescueCall,
} from "@engine";

import { CIVILIAN_SLOT as SLOT, PART } from "./civilian-dress.ts";
import {
  createKnocks,
  homeFrom,
  updateKnocks,
  walkBackPose,
  type Person,
} from "./civilian-hits.ts";
import { onRagdoll } from "./civilian-knock.ts";
import { knockedPose } from "./civilian-knock-pose.ts";
import { freshCivilianPose, type CivilianPose } from "./civilian-plan.ts";
import { buildPosedFigure, poseCivilianFigure } from "./civilian-shapes.ts";
import { CROWD_LOOKS } from "./crowd-rig.ts";
import type { Flood } from "./headlamp.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createHeliView, type HeliView, type WashPuff } from "./heli-view.ts";
import { coloursOf, gearOf, type Outfit } from "./outfit.ts";
import {
  CREW_POSES,
  RESCUE_STRIDE,
  casualtyTargets,
  crewDials,
  crewTargets,
} from "./rescue-crew.ts";
import { BEARERS, RESCUE } from "./rescue-defs.ts";
import {
  flightAt,
  freshFlightFrame,
  planFlight,
  type FlightFrame,
  type RescueFlight,
} from "./rescue-flight.ts";
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
export const SKIN = [0xe2b494, 0xc68863, 0xd9a07a, 0xa8714f];
export const HAIR = [0x3a2a1e, 0x6b4a2c, 0x2a211a, 0x9a6232];
export const DRESS: Record<
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
  /** One frame: a new run's calls read, the knocks stepped, every machine,
   * its crew and its casualties posed at the run's clock. */
  frame(state: GameState, dt: number, cloud: SnowCloud | null, snowAt: SnowSampler): void;
  /** The player's outfit, every casualty's. */
  dress(outfit: Outfit): void;
  /** The landing lamp, after dark (`lit` the dark's share). */
  lamps(lit: number, out: Flood[]): void;
  /** Whether any rescue is under way on this run. */
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
export function dressed(
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

/** The crew's empty hand (`rescue-crew.ts`' figure is built holding it). */
const EMPTY_HAND = { tool: "hold", tip: 0 } as const;

/** ONE TRIP's things: the stretcher, its straps, and him. */
type Litter = {
  group: THREE.Group;
  straps: THREE.Mesh[];
  casualty: THREE.Mesh | null;
  dressed: string;
};

/** ONE MACHINE's things: the helicopter, the four (stood, and on the
 * ragdoll when knocked), its trips, the frame it was last posed at. */
type Unit = {
  heli: HeliView;
  run: HeliRun;
  crew: Member[];
  down: THREE.Mesh[];
  litters: Litter[];
  now: FlightFrame;
  /** The frame a knock's `at` last asked for, and its clock. */
  asked: FlightFrame;
  askedAt: number;
};

export function createRescueScene(level: Level, haze: HazeUniforms): RescueScene {
  const group = new THREE.Group();
  group.name = "rescue";
  group.visible = false;
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
  const frameGeometry = stretcherGeometry();
  const strapGeometries = STRAPS.map(({ z, top }) => strapGeometry(z, top));
  let outfit: Outfit | null = null;

  const colourOf = (i: number) => {
    const b = BEARERS[i];
    const d = b.role === "patrol" ? DRESS.patrol : DRESS.crew;
    return {
      colours: { ...d, vest: d.jacket, skin: SKIN[i % 4], hair: HAIR[i % 4], skis: 0x30343a },
      parts: [PART.helmet, ...(b.role === "patrol" ? [PART.cross] : [])],
    };
  };

  /** A machine's things, built the first time a rescue needs that many. */
  const units: Unit[] = [];
  const unitFor = (i: number): Unit => {
    if (units[i]) return units[i];
    const heli = createHeliView(level, haze, { pad: false, url: MODEL_URL(), cockpit: false });
    group.add(heli.group);
    const crew: Member[] = [];
    const down: THREE.Mesh[] = [];
    BEARERS.forEach((b, j) => {
      const { colours, parts } = colourOf(j);
      const mesh = new THREE.Mesh(dressed(bodyOf(b.body), colours, parts), material);
      mesh.morphTargetInfluences = new Array<number>(CREW_POSES.length).fill(0);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.name = `rescue-${b.role}-${i}-${j}`;
      group.add(mesh);
      crew.push({ mesh, weights: mesh.morphTargetInfluences });
      // Knocked over: his own copy of the stance, posed off his ragdoll.
      const own = bodyOf(b.body).clone();
      own.morphAttributes = {};
      const lying = new THREE.Mesh(dressed(own, colours, parts), material);
      lying.castShadow = true;
      lying.frustumCulled = false;
      lying.visible = false;
      lying.name = `rescue-${b.role}-${i}-${j}-down`;
      group.add(lying);
      down.push(lying);
    });
    const run: HeliRun = { heli: freshHeli({ level } as GameState), level, tick: 0 };
    run.heli.mode = "home";
    run.heli.rider = false;
    const u: Unit = {
      heli,
      run,
      crew,
      down,
      litters: [],
      now: freshFlightFrame(),
      asked: freshFlightFrame(),
      askedAt: NaN,
    };
    units[i] = u;
    return u;
  };

  const litterFor = (u: Unit, k: number): Litter => {
    if (u.litters[k]) return u.litters[k];
    const g = new THREE.Group();
    const frame = new THREE.Mesh(frameGeometry, kit);
    frame.castShadow = true;
    g.add(frame);
    const straps = strapGeometries.map((geo) => {
      const m = new THREE.Mesh(geo, kit);
      m.castShadow = true;
      g.add(m);
      return m;
    });
    group.add(g);
    const l: Litter = { group: g, straps, casualty: null, dressed: "" };
    u.litters[k] = l;
    return l;
  };

  /** HIM, in the player's colours, on trip `l` (rebuilt when they change). */
  let lying = lyingMatrix(1.8);
  const dressCasualty = (l: Litter): void => {
    const key = outfit ? JSON.stringify(outfit) : "none";
    if (l.casualty && l.dressed === key) return;
    if (l.casualty) {
      group.remove(l.casualty);
      l.casualty.geometry.dispose();
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
    const mesh = new THREE.Mesh(g, material);
    mesh.morphTargetInfluences = [1];
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    lying = lyingMatrix(CROWD_LOOKS[body].height);
    group.add(mesh);
    l.casualty = mesh;
    l.dressed = key;
  };

  // The first machine built with the scene (the run that will call it), so
  // its model is in before the next run flies it in.
  unitFor(0);
  hide(units[0]);

  // THE CALLS this run carries (`GameState.rescue`) and their flights.
  let last: GameState | null = null;
  let calls: readonly RescueCall[] = [];
  let flights: RescueFlight[] = [];
  // THE FOUR OF EVERY MACHINE AS PEOPLE ON FOOT a skier knocks over
  // (`civilian-hits.ts`): person `4i + j` is machine `i`'s bearer `j`.
  let people: Person[] = [];
  const knocks = createKnocks();
  /** Bearer `j` of machine `i` at the run's clock `t`, as a person on foot. */
  const crewAt = (i: number, j: number, t: number, o: CivilianPose): CivilianPose => {
    const u = units[i];
    if (u.askedAt !== t) {
      flightAt(level, flights[i], t - calls[i].start, u.asked);
      u.askedAt = t;
    }
    const c = u.asked.crew[j];
    o.x = c.x;
    o.y = c.y;
    o.z = c.z;
    o.heading = c.heading;
    o.shown = c.shown;
    o.activity = c.move.walking > 0.5 ? "walk" : "stand";
    o.clock = 0;
    o.span = 1;
    o.walked = 0;
    o.carry = "none";
    o.seat = null;
    o.bag = false;
    o.since = Infinity;
    return o;
  };
  const begin = (state: GameState): void => {
    calls = state.rescue ?? [];
    flights = calls.map((c) => planFlight(level, c.casualties));
    people = [];
    calls.forEach((c, i) => {
      const u = unitFor(i);
      u.askedAt = NaN;
      for (let k = 0; k < c.casualties.length; k++) dressCasualty(litterFor(u, k));
      BEARERS.forEach((b, j) =>
        people.push({
          key: 4 * i + j,
          id: 7000 + 4 * i + j,
          body: b.body,
          skis: false,
          rx: c.site.x,
          rz: c.site.z,
          rr: RESCUE.flight.reach + 20,
          at: (t, o) => crewAt(i, j, t, o),
        }),
      );
    });
    // The machines no call has this run, put away.
    for (let i = calls.length; i < units.length; i++) hide(units[i]);
  };
  function hide(u: Unit): void {
    u.heli.group.visible = false;
    for (const m of u.crew) m.mesh.visible = false;
    for (const m of u.down) m.visible = false;
    for (const l of u.litters) {
      l.group.visible = false;
      if (l.casualty) l.casualty.visible = false;
    }
  }

  let puffs = 0;
  const dummy = { x: 0, z: 0 };
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  const pos = new THREE.Vector3();
  const placed = new THREE.Matrix4();
  const pose = freshCivilianPose();
  const from = freshCivilianPose();

  /** One machine, `t` s into its call, posed and drawn. */
  const draw = (
    i: number,
    state: GameState,
    t: number,
    dt: number,
    cloud: SnowCloud | null,
    snowAt: SnowSampler,
  ): void => {
    const u = units[i];
    const now = flightAt(level, flights[i], t, u.now);
    // THE MACHINE, through the heli-ski machine's own drawing.
    const h = u.run.heli;
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
    u.run.tick += 1;
    u.heli.update(u.run as unknown as GameState, 1, dt, dummy, NO_HOOKS);
    u.heli.group.visible = f.shown;
    // The wash raised only while it pulls — coming in to land above all: a
    // third of the player's own, so the scene is never lost in a whiteout.
    if (f.shown && cloud && f.thrust > 0.5 && h.agl < 40) {
      const puff: WashPuff = (x, y, z, vx, vy, vz, size) => {
        if (++puffs % 3 === 0) cloud.blow(x, y, z, vx, vy, vz, size);
      };
      u.heli.blow(u.run as unknown as GameState, dt, puff, (x, z) => 0.4 * snowAt(x, z).loose);
    }
    // THE FOUR: where the call has them, or knocked over and getting back.
    for (let j = 0; j < u.crew.length; j++) {
      const c = now.crew[j];
      const m = u.crew[j];
      const lying = u.down[j];
      const key = 4 * i + j;
      const knock = knocks.map.get(key);
      if (knock && onRagdoll(knock)) {
        m.mesh.visible = false;
        const b = knock.rag;
        const posed = knockedPose(b.points, knock.body, [b.x, b.y, b.z]);
        poseCivilianFigure(knock.body, "near", posed, lying.geometry, EMPTY_HAND);
        lying.position.set(b.x, b.y, b.z);
        lying.visible = true;
        continue;
      }
      lying.visible = false;
      let move = c.move;
      let x = c.x;
      let z = c.z;
      let y = c.y;
      let heading = c.heading;
      let shown = c.shown;
      if (knock) {
        // Up again and walking back to where the work has him.
        walkBackPose(knock, level.groundAt(knock.bx, knock.bz), from);
        x = from.x;
        z = from.z;
        y = from.y;
        heading = from.heading;
        shown = true;
        move = { rise: 1, stride: knock.walked / RESCUE_STRIDE, walking: 1, hand: null, raise: 0 };
      } else if (knocks.home.has(key)) {
        pose.x = c.x;
        pose.y = c.y;
        pose.z = c.z;
        pose.heading = c.heading;
        const share = homeFrom(knocks, key, state.t, pose, from);
        x = pose.x;
        z = pose.z;
        heading = pose.heading;
        y = level.groundAt(x, z) + (c.y - level.groundAt(c.x, c.z));
        if (share < 1) move = { ...c.move, walking: Math.max(c.move.walking, 1 - share) };
      }
      m.mesh.visible = shown;
      m.mesh.position.set(x, y, z);
      m.mesh.rotation.set(0, heading, 0);
      crewDials(move, scratch);
      for (let k = 0; k < scratch.length; k++) m.weights[k] = scratch[k];
    }
    // EACH TRIP'S STRETCHER and him on it.
    for (let k = 0; k < now.trips.length; k++) {
      const l = litterFor(u, k);
      dressCasualty(l);
      const tf = now.trips[k];
      const st = tf.stretcher;
      l.group.visible = st.shown;
      l.group.position.set(st.x, st.y, st.z);
      euler.set(-st.pitch, st.heading, -st.roll, "YXZ");
      quat.setFromEuler(euler);
      l.group.quaternion.copy(quat);
      for (let s = 0; s < l.straps.length; s++) l.straps[s].visible = s < st.straps;
      const cs = tf.casualty;
      const mesh = l.casualty!;
      mesh.visible = cs.shown;
      euler.set(-cs.pitch, cs.heading, -cs.roll, "YXZ");
      quat.setFromEuler(euler);
      placed.compose(pos.set(cs.x, cs.y, cs.z), quat, ONE);
      mesh.matrix.multiplyMatrices(placed, lying);
      mesh.matrixWorldNeedsUpdate = true;
      mesh.morphTargetInfluences![0] = cs.sprawl;
    }
    for (let k = now.trips.length; k < u.litters.length; k++) {
      u.litters[k].group.visible = false;
      if (u.litters[k].casualty) u.litters[k].casualty!.visible = false;
    }
  };

  return {
    group,
    frame(state, dt, cloud, snowAt) {
      if (state !== last) {
        last = state;
        begin(state);
      }
      group.visible = calls.length > 0;
      if (!calls.length) return;
      updateKnocks(knocks, state, people);
      for (let i = 0; i < calls.length; i++)
        draw(i, state, state.t - calls[i].start, dt, cloud, snowAt);
    },
    dress(o) {
      outfit = o;
    },
    lamps(lit, out) {
      if (lit <= 0) return;
      for (let i = 0; i < calls.length; i++) {
        const now = units[i].now;
        if (!now.heli.shown) continue;
        // The landing lamp under the nose, aimed down at the work beside it.
        const f = now.heli;
        const st = now.trips[Math.max(0, now.active)]?.stretcher ?? f;
        const fx = Math.sin(f.heading);
        const fz = Math.cos(f.heading);
        const tx = (st.x - f.x) * 0.6 + fx * 2;
        const tz = (st.z - f.z) * 0.6 + fz * 2;
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
      }
    },
    active: () => calls.length > 0,
    dispose() {
      for (const u of units) {
        u.heli.dispose();
        for (const m of u.crew) m.mesh.geometry.dispose();
        for (const m of u.down) m.geometry.dispose();
        for (const l of u.litters) l.casualty?.geometry.dispose();
      }
      frameGeometry.dispose();
      for (const g of strapGeometries) g.dispose();
      material.dispose();
      kit.dispose();
    },
  };
}

const HUB = HELI.rotor.hub;
const HELI_WEIGHT = HELI.mass * 9.81;
const NO_HOOKS = { flame: () => {}, strike: () => {} };
const ONE = new THREE.Vector3(1, 1, 1);
