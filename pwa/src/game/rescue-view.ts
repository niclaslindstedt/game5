// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESCUES UNDER WAY, DRAWN — every air ambulance a run carries
// (`GameState.rescue`, booked from run to run by `rescue-book.ts`): flown in
// when the run after an injured one starts and set down near where he lay,
// its crew carrying him on a stretcher to it, and a second casualty taken
// by the same machine where it can (`rescue-flight.ts` plans each call;
// each casualty's scoop, carry and loading is `rescue-plan.ts`'; the
// crew's poses are `rescue-crew.ts`'). Drawn here: each helicopter
// (`heli-view.ts` over the air ambulance's model — `MODEL_URL` is the one
// line it and the police machine's are named on), its rotor turning, its lights and its landing lamp
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
// A POLICE call (after a death, `police-plan.ts`) is drawn by the same
// hands: the police helicopter's own model (`scripts/blender/police.py`), three
// officers in dark blue with high-visibility vests and two patrollers, him
// lying where he died (the body he was left as, `police-remains.ts`) and
// then rolled into a body bag (`police-bag.ts`), and the scene they lay
// (`police-view.ts`: the stakes, the tape, the numbered tents, the camera
// and its flash).
//
// Presentation only: it reads the states it is handed and the map, and
// writes nothing. The machine on its skids is a solid to the ENGINE
// (`rescue-call.ts`), never to this view — and its crew, struck at speed,
// are bodies to it (`rescue-tracks.ts`, `engine/game/foot.ts`), drawn here
// off the engine's thrown body as anyone on foot is.

import * as THREE from "three";
import {
  HELI,
  crewKey,
  freshHeli,
  type CrowdBody,
  type GameState,
  type HeliState,
  type Level,
  type RescueCall,
  type RescueCasualty,
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
import { breakPose, footHurtOf } from "./crowd-broken.ts";
import { freshCivilianPose, type CivilianPose } from "./civilian-plan.ts";
import { buildPosedFigure, poseCivilianFigure } from "./civilian-shapes.ts";
import { CROWD_LOOKS } from "./crowd-rig.ts";
import type { Flood } from "./headlamp.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createHeliView, type HeliView, type WashPuff } from "./heli-view.ts";
import { coloursOf, gearOf, type Outfit } from "./outfit.ts";
import { OFFICERS, PHOTO } from "./police-defs.ts";
import { freshPoliceFrame, planPolice, policeAt, type PolicePlan } from "./police-plan.ts";
import { bagGeometries, createBag, poseBag, statueDelta, type Bag } from "./police-bag.ts";
import { bagAt } from "./police-carry.ts";
import { lyingAt, type Lying, type Taken } from "./police-remains.ts";
import { createPoliceDressing, type PoliceDressing } from "./police-view.ts";
import {
  CREW_POSES,
  RESCUE_STRIDE,
  casualtyTargets,
  crewDials,
  crewTargets,
} from "./rescue-crew.ts";
import { BEARERS, RESCUE, freshRescueFrame, type RescueFrame } from "./rescue-defs.ts";
import { scoopAt } from "./rescue-scoop.ts";
import {
  flightAt,
  freshFlightFrame,
  planFlight,
  type FlightFrame,
  type RescueFlight,
} from "./rescue-flight.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import { policeModelUrl, rescueModelUrl } from "./skier-models.ts";
import type { SnowSampler } from "./trail-stamp.ts";

/** EACH CALL'S MODEL (`make models`): the air ambulance's
 * (`scripts/blender/rescue.py`, the heli-ski machine's airframe in a
 * mountain air ambulance's signal yellow, its hoist over the right-hand
 * sliding door it is loaded through) and the police helicopter's
 * (`scripts/blender/police.py`, the same airframe in a police air unit's
 * navy and chequer). The one line their files are named on. */
const MODEL_URL = (kind: Kind): string | null =>
  kind === "police" ? policeModelUrl() : rescueModelUrl();

/** The crew's colours, by slot (`CIVILIAN_SLOT`). The flight crew's: a
 * red suit with dark lower legs, a fluorescent yellow panel over the body
 * (the vest's slot) and silver reflective tape (the accent: the yoke and
 * `PART.bands`), a white helmet. The patrol's: red with the white cross,
 * black pants, white tape. */
export const SKIN = [0xe2b494, 0xc68863, 0xd9a07a, 0xa8714f];
export const HAIR = [0x3a2a1e, 0x6b4a2c, 0x2a211a, 0x9a6232];
export const DRESS: Record<
  "crew" | "patrol",
  { jacket: number; pants: number; head: number; accent: number; vest: number }
> = {
  crew: { jacket: 0xc8261c, pants: 0x2a2d33, head: 0xf1f1ec, accent: 0xd6dade, vest: 0xd4ec1c },
  patrol: { jacket: 0xc4161c, pants: 0x18191c, head: 0xc4161c, accent: 0xffffff, vest: 0xc4161c },
};

/** A police officer's: dark blue, a fluorescent yellow vest over it (the
 * vest's slot), reflective trim, a dark blue helmet. */
export const OFFICER_DRESS = {
  jacket: 0x1b2544,
  pants: 0x151a29,
  head: 0x1b2544,
  accent: 0xd6dade,
  vest: 0xd4ec1c,
} as const;

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
  /** Told where the dead are left lying (`police-remains.ts`): a police
   * call's casualty there is drawn by the remains until its crew have him.
   * Hands back each police call's casualty and whether they have him. */
  police(spots: readonly Lying[]): readonly Taken[];
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
export function box(
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

export function paint(g: THREE.BufferGeometry, colour: number): void {
  const c = new THREE.Color(colour);
  const n = g.getAttribute("position").count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], 3 * i);
  g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3));
}

/** Every part merged into one, non-indexed, coloured. */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
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
export function stretcherGeometry(): THREE.BufferGeometry {
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
export const STRAPS = [
  { z: 0.42, top: 0.31 },
  { z: 0.0, top: 0.29 },
  { z: -0.48, top: 0.24 },
] as const;

/** One STRAP done up across him: over the top of him and down both sides
 * to the mattress's edge. */
export function strapGeometry(z: number, top: number): THREE.BufferGeometry {
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
export function lyingMatrix(height: number): THREE.Matrix4 {
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 1, 0),
  );
  m.setPosition(0, 0, -height / 2);
  return m;
}

/** HIM, dressed in the player's outfit (his own colours, his helmet on) —
 * or, an amateur of the crowd (`crowd-calls.ts`), in his body and kit
 * (`look`) — at his lying target (its one weight his sprawl), and the matrix that lays
 * his own frame on his back about his middle. */
export function casualtyFigure(
  outfit: Outfit | null,
  look?: RescueCasualty["look"],
): {
  geometry: THREE.BufferGeometry;
  lying: THREE.Matrix4;
} {
  const female = outfit ? gearOf("body", outfit.body).female : false;
  const body: CrowdBody = look ? look.body : female ? "woman" : "man";
  const c = outfit ? coloursOf(outfit) : null;
  const [jacket, pants, head, accent, skin, hair] = look
    ? look.dress
    : [
        c?.jacket ?? 0x2b5fa8,
        c?.pants ?? 0x1c1f24,
        c?.helmet ?? 0xe8e8e8,
        c?.accent ?? 0xffffff,
        c?.skin ?? SKIN[0],
        HAIR[0],
      ];
  const geometry = dressed(
    buildPosedFigure(body, "near", casualtyTargets(body), `casualty:${body}`),
    { jacket, pants, head, accent, vest: jacket, skin, hair },
    [PART.helmet],
  );
  return { geometry, lying: lyingMatrix(CROWD_LOOKS[body].height) };
}

/** How a FakeHeli is handed to `heli-view.ts`: the state it reads. */
type HeliRun = { heli: HeliState; level: Level; tick: number };

/** The crew's empty hand (`rescue-crew.ts`' figure is built holding it). */
const EMPTY_HAND = { tool: "hold", tip: 0 } as const;

/** ONE TRIP's things: the stretcher, its straps, and him — and on a
 * police call the body bag on its frame (`bag`), and where the scoop
 * found him (`found`, what his body left lying is moved from). */
type Litter = {
  group: THREE.Group;
  straps: THREE.Mesh[];
  casualty: THREE.Mesh | null;
  dressed: string;
  bag: Bag | null;
  found: RescueFrame["casualty"] | null;
  /** His figure laid flat on the board, for his body's height. */
  lie: THREE.Matrix4;
};

type Kind = "ambulance" | "police";

/** ONE MACHINE's things: the helicopter, the four (stood, and on the
 * ragdoll when knocked), its trips, the frame it was last posed at. */
type Unit = {
  kind: Kind;
  heli: HeliView;
  run: HeliRun;
  crew: Member[];
  down: THREE.Mesh[];
  litters: Litter[];
  now: FlightFrame;
  /** The frame a knock's `at` last asked for, and its clock. */
  asked: FlightFrame;
  askedAt: number;
  /** A police call's plan and its scene, and his body left lying as the
   * recovery moves it (`police-remains.ts`). */
  police: PolicePlan | null;
  dressing: PoliceDressing | null;
  statue: { delta: number[]; moved: boolean; shut: boolean };
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
  // The body bag: heavy coated cloth, dark, with a sheen.
  const bagMaterial = hazeMaterial(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.32,
      metalness: 0.05,
      side: THREE.DoubleSide,
    }),
    haze,
    "police-bag",
  );
  const frameGeometry = stretcherGeometry();
  const bags = bagGeometries();
  const strapGeometries = STRAPS.map(({ z, top }) => strapGeometry(z, top));
  let outfit: Outfit | null = null;

  const colourOf = (i: number, kind: Kind) => {
    const role = i < BEARERS.length ? BEARERS[i].role : "officer";
    const officer = kind === "police" && role !== "patrol";
    const d = officer ? OFFICER_DRESS : role === "patrol" ? DRESS.patrol : DRESS.crew;
    return {
      colours: { ...d, skin: SKIN[i % 4], hair: HAIR[i % 4], skis: 0x30343a },
      parts: [PART.helmet, PART.bands, ...(role === "patrol" ? [PART.cross] : [])],
    };
  };
  /** Who is drawn for a call: the four, and on a police call the
   * photographer (`PHOTO`) after them. */
  const bodiesOf = (kind: Kind): CrowdBody[] => [
    ...BEARERS.map((b) => b.body),
    ...(kind === "police" ? [OFFICERS[2].body] : []),
  ];

  /** A machine's things, built the first time a rescue needs that many
   * (and again for a call of the other kind). */
  const units: Unit[] = [];
  const unitFor = (i: number, kind: Kind = "ambulance"): Unit => {
    if (units[i]?.kind === kind) return units[i];
    if (units[i]) drop(units[i]);
    const heli = createHeliView(level, haze, {
      pad: false,
      url: MODEL_URL(kind),
      cockpit: false,
    });
    group.add(heli.group);
    const crew: Member[] = [];
    const down: THREE.Mesh[] = [];
    bodiesOf(kind).forEach((body, j) => {
      const { colours, parts } = colourOf(j, kind);
      const role =
        kind === "police" && j !== 2 && j !== 3 ? "police" : (BEARERS[j]?.role ?? "police");
      const mesh = new THREE.Mesh(dressed(bodyOf(body), colours, parts), material);
      mesh.morphTargetInfluences = new Array<number>(CREW_POSES.length).fill(0);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.name = `rescue-${role}-${i}-${j}`;
      group.add(mesh);
      crew.push({ mesh, weights: mesh.morphTargetInfluences });
      // Knocked over: his own copy of the stance, posed off his ragdoll.
      const own = bodyOf(body).clone();
      own.morphAttributes = {};
      const lying = new THREE.Mesh(dressed(own, colours, parts), material);
      lying.castShadow = true;
      lying.frustumCulled = false;
      lying.visible = false;
      lying.name = `rescue-${role}-${i}-${j}-down`;
      group.add(lying);
      down.push(lying);
    });
    const run: HeliRun = { heli: freshHeli({ level } as GameState), level, tick: 0 };
    run.heli.mode = "home";
    run.heli.rider = false;
    const dressing = kind === "police" ? createPoliceDressing(level, haze) : null;
    if (dressing) group.add(dressing.group);
    const u: Unit = {
      kind,
      heli,
      run,
      crew,
      down,
      litters: [],
      now: kind === "police" ? freshPoliceFrame() : freshFlightFrame(),
      asked: kind === "police" ? freshPoliceFrame() : freshFlightFrame(),
      askedAt: NaN,
      police: null,
      dressing,
      statue: { delta: new Array<number>(16).fill(0), moved: false, shut: false },
    };
    units[i] = u;
    return u;
  };

  const litterFor = (u: Unit, k: number): Litter => {
    if (u.litters[k]) return u.litters[k];
    const g = new THREE.Group();
    const police = u.kind === "police";
    const bag = police ? createBag(bags, bagMaterial) : null;
    if (bag) g.add(bag.tray, bag.hinge);
    else {
      const frame = new THREE.Mesh(frameGeometry, kit);
      frame.castShadow = true;
      g.add(frame);
    }
    const straps = (police ? [] : strapGeometries).map((geo) => {
      const m = new THREE.Mesh(geo, kit);
      m.castShadow = true;
      g.add(m);
      return m;
    });
    group.add(g);
    const l: Litter = {
      group: g,
      straps,
      casualty: null,
      dressed: "",
      bag,
      found: null,
      lie: lyingMatrix(1.8),
    };
    u.litters[k] = l;
    return l;
  };

  /** HIM on trip `l` (rebuilt when his colours change): the player, in
   * his own colours — or an amateur of the crowd called for mid-run
   * (`crowd-calls.ts`), in his body and his kit (`look`). */
  const dressCasualty = (l: Litter, look?: RescueCasualty["look"]): void => {
    const key = look ? JSON.stringify(look) : outfit ? JSON.stringify(outfit) : "none";
    if (l.casualty && l.dressed === key) return;
    if (l.casualty) {
      group.remove(l.casualty);
      l.casualty.geometry.dispose();
    }
    const fig = casualtyFigure(outfit, look);
    const mesh = new THREE.Mesh(fig.geometry, material);
    mesh.morphTargetInfluences = [1];
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    l.lie = fig.lying;
    group.add(mesh);
    l.casualty = mesh;
    l.dressed = key;
  };

  // The first machine built with the scene (the run that will call it), so
  // its model is in before the next run flies it in.
  unitFor(0);
  hide(units[0]);

  // THE CALLS this run carries (`GameState.rescue`) and their flights —
  // read again whenever one is made or joined mid-run (`crowd-calls.ts`).
  let last: GameState | null = null;
  let shape = "";
  let calls: readonly RescueCall[] = [];
  let flights: RescueFlight[] = [];
  // THE CREW OF EVERY MACHINE AS PEOPLE ON FOOT a skier knocks over
  // (`civilian-hits.ts`): person `8i + j` is machine `i`'s man `j`.
  let people: Person[] = [];
  const knocks = createKnocks();
  /** Machine `i`'s call `t` s in, into `out`. */
  const frameAt = (i: number, t: number, out: FlightFrame): FlightFrame => {
    const u = units[i];
    if (u.police) return policeAt(level, u.police, t, out as ReturnType<typeof freshPoliceFrame>);
    return flightAt(level, flights[i], t, out);
  };
  /** Man `j` of machine `i` at the run's clock `t`, as a person on foot. */
  const crewAt = (i: number, j: number, t: number, o: CivilianPose): CivilianPose => {
    const u = units[i];
    if (u.askedAt !== t) {
      frameAt(i, callClock(calls[i], t), u.asked);
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
    // The air ambulances' and the police's (the patrol's snowmobiles are
    // `rescue-sleds-view.ts`').
    calls = (state.rescue ?? []).filter((c) => c.kind !== "sled");
    people = [];
    flights = calls.map((c, i) => {
      const u = unitFor(i, c.kind === "police" ? "police" : "ambulance");
      u.askedAt = NaN;
      if (c.kind !== "police") {
        u.police = null;
        return planFlight(level, c.casualties);
      }
      const at = c.casualties[0];
      u.police = planPolice(level, { x: at.x, z: at.z, evidence: c.evidence ?? [] });
      u.statue.moved = false;
      u.statue.shut = false;
      for (const l of u.litters) l.found = null;
      u.dressing?.build(u.police);
      return u.police.flight;
    });
    calls.forEach((c, i) => {
      const u = units[i];
      for (let k = 0; k < c.casualties.length; k++)
        dressCasualty(litterFor(u, k), c.casualties[k].look);
      bodiesOf(u.kind).forEach((body, j) =>
        people.push({
          key: 8 * i + j,
          // The engine keys a man by his call's place among all the run's.
          foot: crewKey((state.rescue ?? []).indexOf(c), j),
          id: 7000 + 8 * i + j,
          body,
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
    if (u.dressing) u.dressing.group.visible = false;
    for (const m of u.crew) m.mesh.visible = false;
    for (const m of u.down) m.visible = false;
    for (const l of u.litters) {
      l.group.visible = false;
      if (l.casualty) l.casualty.visible = false;
    }
  }

  /** Where the dead are left lying, and the police's casualties drawn. */
  let statues: readonly Lying[] = [];
  const moved = new THREE.Matrix4();
  const taken: Taken[] = [];
  let puffs = 0;
  const dummy = { x: 0, z: 0 };
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  const pos = new THREE.Vector3();
  const placed = new THREE.Matrix4();
  const pose = freshCivilianPose();
  const from = freshCivilianPose();

  /** One machine at the run's clock, posed and drawn. */
  const draw = (
    i: number,
    state: GameState,
    dt: number,
    cloud: SnowCloud | null,
    snowAt: SnowSampler,
  ): void => {
    const u = units[i];
    // STOLEN (`steal.ts`): the machine is the skier's now, drawn as his own
    // (`heli-scene.ts`); the four stand where it left them, at what they
    // were doing as it went.
    const gone = calls[i].stolen !== undefined && state.t >= calls[i].stolen!;
    const now = frameAt(i, callClock(calls[i], state.t), u.now);
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
    u.heli.group.visible = f.shown && !gone;
    // The wash raised only while it pulls — coming in to land above all: a
    // third of the player's own, so the scene is never lost in a whiteout.
    if (f.shown && !gone && cloud && f.thrust > 0.5 && h.agl < 40) {
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
      const key = 8 * i + j;
      const knock = knocks.map.get(key);
      if (knock && onRagdoll(knock)) {
        m.mesh.visible = false;
        const b = knock.rag;
        const posed = knockedPose(b.points, knock.body, [b.x, b.y, b.z]);
        // Struck by the engine and hurt (INJURIES on): lying broken.
        const hurt = knock.engine ? footHurtOf(state, knock.engine) : undefined;
        if (hurt) breakPose(posed, hurt);
        poseCivilianFigure(knock.body, "near", posed, lying.geometry, EMPTY_HAND);
        lying.position.set(b.x, b.y, b.z);
        lying.visible = true;
        continue;
      }
      lying.visible = false;
      let move = gone ? { ...c.move, walking: 0 } : c.move;
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
      dressCasualty(l, calls[i].casualties[k]?.look);
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
      // ON A POLICE CALL: the bag's lid swung open beside him and back
      // over him — and him the body he was left lying as, moved as the scoop
      // rolls him onto it (`police-remains.ts`), the call's own figure drawn
      // only where no such body lies (a call whose dead were cleared).
      const trip = flights[i].trips[k];
      const bag = l.bag ? bagAt(trip.plan, callClock(calls[i], state.t) - trip.offset) : null;
      if (l.bag && bag) poseBag(l.bag, bag.open, bag.fill);
      const bagged = !!bag?.shut;
      const left = u.police ? lyingAt(statues, cs.x, cs.z) : null;
      if (left && bag && k === 0) {
        l.found ??= { ...scoopAt(level, trip.plan, 0, freshRescueFrame()).casualty };
        statueDelta(l.found, cs, left.heading, bag.turn, moved);
        moved.toArray(u.statue.delta);
        u.statue.moved = true;
        u.statue.shut = bagged;
      }
      mesh.visible = cs.shown && !bagged && !left;
      euler.set(-cs.pitch, cs.heading, -cs.roll, "YXZ");
      quat.setFromEuler(euler);
      placed.compose(pos.set(cs.x, cs.y, cs.z), quat, ONE);
      mesh.matrix.multiplyMatrices(placed, l.lie);
      mesh.matrixWorldNeedsUpdate = true;
      mesh.morphTargetInfluences![0] = cs.sprawl;
    }
    for (let k = now.trips.length; k < u.litters.length; k++) {
      u.litters[k].group.visible = false;
      if (u.litters[k].casualty) u.litters[k].casualty!.visible = false;
    }
    // THE POLICE'S SCENE, and the photographer's camera.
    if (u.dressing && "scene" in now) {
      const pf = now as ReturnType<typeof freshPoliceFrame>;
      u.dressing.update(pf.scene, pf.crew[PHOTO]);
    }
  };
  /** A machine's things put away for good (its call of another kind). */
  function drop(u: Unit): void {
    u.heli.dispose();
    group.remove(u.heli.group);
    for (const m of [...u.crew.map((c) => c.mesh), ...u.down]) {
      group.remove(m);
      m.geometry.dispose();
    }
    for (const l of u.litters) {
      group.remove(l.group);
      if (l.casualty) {
        group.remove(l.casualty);
        l.casualty.geometry.dispose();
      }
    }
    if (u.dressing) {
      group.remove(u.dressing.group);
      u.dressing.dispose();
    }
  }

  return {
    group,
    frame(state, dt, cloud, snowAt) {
      const now = shapeOf(state);
      if (state !== last || now !== shape) {
        last = state;
        shape = now;
        begin(state);
      }
      group.visible = calls.length > 0;
      if (!calls.length) return;
      updateKnocks(knocks, state, people);
      for (let i = 0; i < calls.length; i++) draw(i, state, dt, cloud, snowAt);
    },
    dress(o) {
      outfit = o;
    },
    lamps(lit, out) {
      if (lit <= 0) return;
      for (let i = 0; i < calls.length; i++) {
        const now = units[i].now;
        if (!now.heli.shown || calls[i].stolen !== undefined) continue;
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
    police(spots) {
      statues = spots;
      taken.length = 0;
      for (let i = 0; i < calls.length; i++) {
        const u = units[i];
        if (!u?.police || !last) continue;
        const c = calls[i].casualties[0];
        const t = callClock(calls[i], last.t);
        const on = t >= flights[i].trips[0].offset;
        taken.push({
          x: c.x,
          z: c.z,
          taken: on,
          delta: on && u.statue.moved ? u.statue.delta : null,
          shut: on && u.statue.shut,
        });
      }
      return taken;
    },
    dispose() {
      for (const u of units) {
        u.heli.dispose();
        for (const m of u.crew) m.mesh.geometry.dispose();
        for (const m of u.down) m.geometry.dispose();
        for (const l of u.litters) l.casualty?.geometry.dispose();
        u.dressing?.dispose();
      }
      frameGeometry.dispose();
      bags.tray.dispose();
      bags.lid.dispose();
      bagMaterial.dispose();
      for (const g of strapGeometries) g.dispose();
      material.dispose();
      kit.dispose();
    },
  };
}

/** What calls a run carries, as a key: each one's casualties. */
function shapeOf(state: GameState): string {
  let key = "";
  for (const r of state.rescue ?? []) key += `${r.start}:${r.casualties.length};`;
  return key;
}

/** The seconds into call `c` its people are at, at the run's clock `t`:
 * held at the moment its machine was stolen from under them. */
function callClock(c: RescueCall, t: number): number {
  return Math.min(t, c.stolen ?? Infinity) - c.start;
}

const HUB = HELI.rotor.hub;
const HELI_WEIGHT = HELI.mass * 9.81;
const NO_HOOKS = { flame: () => {}, strike: () => {} };
const ONE = new THREE.Vector3(1, 1, 1);
