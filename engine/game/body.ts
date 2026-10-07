// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY — what the skier's body takes when he meets the snow or a trunk,
// part by part: the g of every blow, and the injuries it does.
//
// A BLOW IS A STOP. A part meeting something at `v` m/s is brought to rest
// over a distance — its own give (the flesh, the bone's flex, the clothes,
// `injury.give`) and the give of what it met: the snow's (bare ice, the
// groomer, loose snow by its depth — `injury.snow`) or a solid's by what
// it is made of (`.solid`: a trunk, a tower's bare steel or its pad, a
// cabin's logs — and the helmet's liner on the head). Its mean deceleration is v² / 2s and
// its peak half a sine's (`injury.peak`): that peak, in g, is the blow. The
// same fall is a few g into a deep day's powder, tens on the groomer and a
// hundred on ice, which is the whole of how the snow's depth and hardness
// reach an injury — the curves below know nothing of the snow.
//
// WHERE THE BLOWS COME FROM — every one off something the step has already
// measured, nothing re-measured:
//   - ON THE SKIS: a trunk (`hit`'s closing speed) on the shins and knees
//     when it is square in front of the skis, on the shoulder, the arm, the
//     ribs, the flank and the hip on his side when beside him; the hips, the
//     shoulders or the helmet into the snow (`SkierState.bodyHit`); a
//     LANDING, whose load (`land`'s `g`) runs up the legs into the spine,
//     taken in the back seat or crooked onto the knees (the cruciate's
//     phantom foot and the boot's drawer), whipping the neck; and the falls
//     that are a mechanism rather than a blow — the caught edge's twist on
//     the knee of the ski that bit, the fall at speed's, and the fall over
//     the tips levering the shins over the boots' rims;
//   - THROWN (`Thrown`): every point of the ragdoll meeting the snow or a
//     trunk (`Thrown.impacts`, `.struck`) — the head, the shoulders, the
//     hips, the knees, the feet, the elbows, the hands — with the trunk's
//     share going to the chest and the abdomen when he comes down on his
//     front, to the back and the kidneys on his back, to the ribs and the
//     spleen or the liver on his side;
//   - ANOTHER SKIER, shoulder to shoulder (`feelBumps`);
//   - A CRASHED HELICOPTER (`defs/heli-wreck.ts` says what the research
//     found): sat on its skid, the stop the snow and the gear's crush
//     give the machine's fall goes up the seat into his spine (the
//     vertical crash's compression fracture), the pelvis on the tube and
//     the legs driven up off the snow; and its FIREBALL's heat on him,
//     wherever he lies, summed as a thermal dose while it burns and judged
//     once as it burns out — burns where the clothes let it through, the
//     airway of a body engulfed in it.
//
// A DOSE IS A CHANCE, NOT A LINE. Every injury on a part's ladder
// (`defs/anatomy.ts`) has the dose at which it is an even chance, and the
// chance at any other comes off the log-logistic of the injury-risk curves
// (`injury.steep`) — drawn not from the run's stream but off a hash of the
// step, the part and the map, so a run replays injury for injury and no
// digest moves. The ladder is read worst first and a part takes at most one
// new injury a step, never a lesser one than it already carries; a part
// already hurt is hurt again more easily (`injury.weaken`).
//
// THE WHOLE BODY is summed the way a trauma ward sums it: the INJURY
// SEVERITY SCORE (`severityOf`) — the squares of the worst AIS in each of
// the three worst-hurt regions (the head and the neck, the chest, the
// abdomen, the limbs and the pelvis), 0 … 75.
//
// IT IS A READOUT: nothing in the physics reads it, and it draws nothing
// from the stream. A reset MENDS it (`mendBody`): the skier stood back up
// on the piste is a sound one — only the run's hardest blow is kept.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { hash2 } from "@niclaslindstedt/oss-game-framework/core/noise";
import { rotate, type Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import {
  BODY_PARTS,
  BONES,
  INJURIES,
  ORGANS,
  pairedBone,
  pairedOrgan,
  type BodyPart,
  type Bone,
  type Facing,
  type InjuryDef,
  type InjuryKind,
  type Mechanism,
  type Organ,
} from "./defs/anatomy.ts";
import { MEDIUM_RIDER, shoulderShare } from "./defs/riders.ts";
import { WRECK, fireFlux, fireballAt } from "./defs/heli-wreck.ts";
import { envelopeOf } from "./defs/skis.ts";
import { CROWD_SIZE } from "./defs/crowd.ts";
import { GROOMER } from "./defs/groomer.ts";
import { TUNING } from "./defs/tuning.ts";
import { crashLimit, noseDown } from "./crash.ts";
import { RAGDOLL } from "./ragdoll.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import { depthUnder, packedSnow } from "./snow.ts";
import type {
  BodyState,
  GameEvent,
  GameState,
  ImpactSource,
  Injury,
  SkierState,
  Thrown,
} from "./state.ts";
import { snowNormal } from "./snow-normal.ts";
import { axialOf, facingOf, legAxialOf, torsoOf } from "./body-torso.ts";
import type { Stuff } from "./upright-grid.ts";

const I = TUNING.injury;
const dt = TUNING.dt;
const PARTS = BODY_PARTS.length;
const MECHS: readonly Mechanism[] = ["blunt", "load", "drawer", "twist", "bend", "heat"];
const FACES: readonly Facing[] = ["front", "back", "left", "right"];
/** The hash's own salt: no other draw reads this stream. */
const SALT = 0x6b0d1e5;
const SIDE_SALT = 0x51de0e6;

/** A part's index in `BODY_PARTS`. */
export const PART = Object.fromEntries(BODY_PARTS.map((p, i) => [p, i])) as Record<
  BodyPart,
  number
>;

/** What a paired part is written as on the ladder and in `injury.give`. */
export function baseOf(part: BodyPart): keyof typeof I.give {
  return (
    part.endsWith("L") || part.endsWith("R") ? part.slice(0, -1) : part
  ) as keyof typeof I.give;
}

const KINDS = Object.keys(INJURIES) as InjuryKind[];

/** EVERY PART'S LADDER, worst first (and, within a rank, the dearest dose
 * first): what `judge` reads. */
const LADDER: { kind: InjuryKind; index: number; def: InjuryDef }[][] = BODY_PARTS.map((part) =>
  KINDS.map((kind, index) => ({ kind, index, def: INJURIES[kind] as InjuryDef }))
    .filter((r) => r.def.part === part || r.def.part === baseOf(part))
    .sort((a, b) => b.def.ais - a.def.ais || b.def.at - a.def.at),
);

/** A sound body. */
export function freshBody(): BodyState {
  return {
    worst: new Array<number>(PARTS).fill(0),
    injuries: [],
    impact: null,
    peak: 0,
    fallPeak: 0,
    blows: 0,
    heat: 0,
  };
}

/** HEALED: every injury gone, as a reset stands him back up
 * (`course.ts`' `resetSkier`), and any fire's dose with them. The run's
 * hardest blows and the meter's count are the run's, and stay. */
export function mendBody(body: BodyState): void {
  body.worst.fill(0);
  body.injuries.length = 0;
  body.heat = 0;
}

/** THE BLOW, g: the peak deceleration of a part met at `v` m/s and
 * stopped over `give` m. */
export function blowOf(v: number, give: number): number {
  return (I.peak * v * v) / (2 * give * TUNING.g);
}

/** THE SNOW'S GIVE where a part meets it, m: the ice's, the groomer's and
 * the loose snow's, blended by what lies there — the new fall over the
 * groomer counted in, and loose snow deeper on a deeper day. */
export function snowGive(state: GameState, x: number, z: number): number {
  const level = state.level;
  const p = packedSnow(state, x, z);
  const loose = I.snow.soft + I.snow.deep * depthUnder(state.snowDepth, state.fresh);
  const give = p * I.snow.packed + (1 - p) * loose;
  const ice = level.iceAt ? level.iceAt(x, z) : 0;
  return give + (I.snow.ice - give) * ice;
}

/** THE ENERGY of a dose `d` over that of an injury's even-chance dose
 * `at`: a blow's or a load's g is its energy over the stop it is given
 * (v² / 2s), so it goes as the dose; a twist's or a bend's is a speed, so
 * as its square. */
export function energyOver(mech: Mechanism, d: number, at: number): number {
  const r = d / at;
  return mech === "twist" || mech === "bend" ? r * r : r;
}

/** The chance of an injury of even-chance dose `at` at a dose `d`. */
export function riskOf(d: number, at: number): number {
  if (d < I.floor * at) return 0;
  return 1 / (1 + (at / d) ** I.steep);
}

// THIS STEP'S DOSES, per part and mechanism, and the side each part's
// hardest blow came on (an index in `FACES`, −1 for none).
const dose = new Float64Array(PARTS * MECHS.length);
const faced = new Int8Array(PARTS);
// The hardest blow this step, for the g meter.
let billG = 0;
/** How many injuries this step may take (`judge`): a blow's few, or —
 * a landing past the legs' buckle — every part's, the whole leg loaded
 * at once. */
let cap: number = I.perBlow;
let billPart: BodyPart = "pelvis";
let billSource: ImpactSource = "snow";
let billRival = -1;
let billAmateur = -1;

function clear(): void {
  dose.fill(0);
  faced.fill(-1);
  billG = 0;
  cap = I.perBlow;
}

/** THIS STEP'S DOSE of `mech` on `part` — what `stepBody` has just judged
 * — read after it by `gore.ts`, which asks no blow again. */
export function doseOn(part: BodyPart, mech: Mechanism = "blunt"): number {
  return dose[PART[part] * MECHS.length + MECHS.indexOf(mech)];
}

/** A blow of `g` on `part`, from the `face` side when the trunk's organs
 * care. */
function strike(part: BodyPart, g: number, face: Facing | null = null): void {
  const k = PART[part] * MECHS.length;
  if (g <= dose[k]) return;
  dose[k] = g;
  faced[PART[part]] = face === null ? -1 : FACES.indexOf(face);
}

/** A dose of mechanism `mech` (not a blow) on `part`. */
function charge(part: BodyPart, mech: Mechanism, d: number): void {
  const k = PART[part] * MECHS.length + MECHS.indexOf(mech);
  if (d > dose[k]) dose[k] = d;
}

/** Offer the g meter a blow; the hardest this step is the one billed —
 * and, off another skier, which. */
function offer(g: number, part: BodyPart, source: ImpactSource, rival = -1, amateur = -1): void {
  if (g <= billG) return;
  billG = g;
  billPart = part;
  billSource = source;
  billRival = rival;
  billAmateur = amateur;
}

/** IS ANYONE DOWN over a blow: he is thrown, or the rival or the amateur
 * he shouldered is (`rival` / `amateur` −1 for none). */
function downOver(state: GameState, rival: number, amateur: number): boolean {
  if (state.skier.thrown) return true;
  if (rival >= 0 && state.rivals.find((r) => r.id === rival)?.run.skier.thrown) return true;
  return amateur >= 0 && state.crowd?.amateurs.find((a) => a.id === amateur)?.mode === "down";
}

/** A blow met at `v` m/s on `part`, against snow of give `snow` m (or a
 * trunk), `share` of it reaching the part. */
function blow(part: BodyPart, v: number, against: number, tree: boolean, share = 1): number {
  const base = baseOf(part);
  const helmet = tree && base === "head" ? I.helmet : 0;
  const g = share * blowOf(v, I.give[base] + against + helmet);
  return g;
}

/** The parts the g meter bills: the head and the trunk. */
const CENTRAL = new Set<BodyPart>([
  "head",
  "neck",
  "chest",
  "back",
  "abdomen",
  "pelvis",
  "shoulderL",
  "shoulderR",
]);
const base = (part: BodyPart): boolean => CENTRAL.has(part);

const sided = (base: string, side: number): BodyPart =>
  `${base}${side < 0 ? "L" : "R"}` as BodyPart;
/** The outer side of a part on `side`: his left of a left one. */
const outside = (side: number): Facing => (side < 0 ? "left" : "right");

const n: Vec3 = { x: 0, y: 1, z: 0 };
const way: Vec3 = { x: 0, y: 0, z: 1 };
const near: number[] = [];

/** THE TRUNK'S SHARE of a blow on a shoulder or a hip, by which way he
 * faces what he met: met flat on a SIDE the flank itself meets it — the
 * ribs over the spleen or the liver — and more of it reaches them. */
function trunkShare(hip: boolean, v: number, against: number, tree: boolean, face: Facing): void {
  const s = face === "left" || face === "right" ? I.share.flank : I.share.trunk;
  if (hip) {
    if (face === "back") strike("back", blow("back", v, against, tree, s), face);
    strike("abdomen", blow("abdomen", v, against, tree, s), face);
  } else {
    const part = face === "back" ? "back" : "chest";
    strike(part, blow(part, v, against, tree, s), face);
  }
}

/** ONE POINT OF THE RAGDOLL meeting the snow or a trunk at `v` m/s. */
function pointBlow(
  i: number,
  v: number,
  against: number,
  tree: boolean,
  face: Facing,
  n: Vec3,
  points: readonly number[],
): void {
  const R = RAGDOLL;
  const S = I.share;
  const source: ImpactSource = tree ? "tree" : "snow";
  const side =
    i === R.hipL ||
    i === R.shoulderL ||
    i === R.kneeL ||
    i === R.footL ||
    i === R.elbowL ||
    i === R.handL
      ? -1
      : 1;
  let part: BodyPart;
  if (i === R.head) {
    part = "head";
    // The neck is whipped by any blow on the head, and LOADED by one that
    // runs down the spine — the head met first in a dive.
    const axial = axialOf(n.x, n.y, n.z, true);
    strike("neck", blow("neck", v, against, tree, S.neck + S.neckAxial * axial), face);
  } else if (i === R.shoulderL || i === R.shoulderR) {
    part = sided("shoulder", side);
    trunkShare(false, v, against, tree, face);
  } else if (i === R.hipL || i === R.hipR) {
    part = "pelvis";
    trunkShare(true, v, against, tree, face);
    // Sat down on it, the trunk upright over the seat: the blow runs up the
    // spine as a load — the seated fall's compression fracture.
    const axial = axialOf(n.x, n.y, n.z, false);
    if (axial > 0) charge("back", "load", blow("pelvis", v, against, tree) * I.seat * axial);
  } else if (i === R.kneeL || i === R.kneeR) {
    part = sided("knee", side);
    strike(sided("thigh", side), blow(sided("thigh", side), v, against, tree, S.kneeThigh));
    strike(sided("shin", side), blow(sided("shin", side), v, against, tree, S.kneeShin));
  } else if (i === R.footL || i === R.footR) {
    part = sided("foot", side);
    strike(sided("shin", side), blow(sided("shin", side), v, against, tree, S.footShin));
    // Met sole first along a straight body — feet first into a trunk, or
    // stood down onto them — the blow runs UP THE LEG as a landing's does:
    // the heel, the pilon, the plateau, the femur and the hip socket.
    const axial = legAxialOf(points, i, n.x, n.y, n.z);
    if (axial > 0) {
      const leg = blow(part, v, against, tree) * S.legAxial * axial;
      for (const p of ["foot", "shin", "knee", "thigh"]) charge(sided(p, side), "load", leg);
      charge("pelvis", "load", leg);
    }
  } else if (i === R.elbowL || i === R.elbowR) {
    part = sided("arm", side);
    // ...up the arm into the shoulder from its outer end, as a blow on the
    // point of the shoulder is.
    strike(
      sided("shoulder", side),
      blow(sided("shoulder", side), v, against, tree, S.elbowShoulder),
      outside(side),
    );
  } else {
    part = sided("hand", side);
    strike(sided("arm", side), blow(sided("arm", side), v, against, tree, S.handArm));
    strike(
      sided("shoulder", side),
      blow(sided("shoulder", side), v, against, tree, S.handShoulder),
      outside(side),
    );
  }
  const g = blow(part, v, against, tree);
  strike(part, g, face);
  // The meter bills the body's own blows — the head and the trunk — and
  // not a limb's whip, which is a small mass flung far faster than he is.
  if (i <= R.head) offer(g, part, source);
}

/** THROWN: every point of his body that met the snow or a trunk this step. */
function ragdollBlows(state: GameState, b: Thrown): void {
  const P = b.points;
  torsoOf(P);
  const level = state.level;
  for (let i = 0; i < RAGDOLL.count; i++) {
    const x = P[3 * i];
    const z = P[3 * i + 2];
    const v = b.impacts[i];
    if (v > I.touch) {
      level.normalAt(x, z, n);
      pointBlow(i, v, snowGive(state, x, z), false, facingOf(n.x, n.y, n.z), n, P);
    }
    const t = b.struck[i];
    if (t > I.touch) {
      // The solid's way out toward him: from the nearest one's centre — and
      // what it is made of.
      let best = Infinity;
      let ux = 0;
      let uz = 0;
      let stuff: Stuff = "trunk";
      solidsNear(level, x, z, 2, near);
      const solids = solidsOf(level);
      for (const k of near) {
        const tree = solids[k];
        const dx = x - tree.x;
        const dz = z - tree.z;
        const d = hypot(dx, dz);
        if (d < best) {
          best = d;
          ux = dx / (d || 1);
          uz = dz / (d || 1);
          stuff = tree.stuff ?? "trunk";
        }
      }
      way.x = ux;
      way.y = 0;
      way.z = uz;
      pointBlow(i, t, I.solid[stuff], true, facingOf(ux, 0, uz), way, P);
    }
  }
}

/** A TRUNK — or any solid, of `stuff` and `radius` — MET ON THE SKIS at
 * `v` m/s closing: in front of the skis, square enough on that the tips
 * meet it, it takes the legs; beside him — or ahead but wide enough of his
 * line for the skis to pass it (`front.lane`) — his side. */
function trunkOnSkis(
  c: SkierState,
  v: number,
  tx: number,
  tz: number,
  stuff: Stuff = "trunk",
  radius = 0,
): void {
  const dx = tx - c.x;
  const dz = tz - c.z;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const across = dx * fz - dz * fx;
  const ahead =
    dx * fx + dz * fz > 0.4 * (envelopeOf(c.spec).length / 2) &&
    Math.abs(across) < radius + I.front.lane;
  const side = across >= 0 ? 1 : -1;
  let top = 0;
  let topPart: BodyPart = "shinL";
  const hit = (part: BodyPart, share: number, face: Facing | null): void => {
    const g = blow(part, v, I.solid[stuff], true, share);
    strike(part, g, face);
    if (g > top && base(part)) {
      top = g;
      topPart = part;
    }
  };
  if (ahead) {
    // The tips meet it and the skis stop: the shins are levered over the
    // boots and the knees wrenched; the body goes on into it thrown
    // (`ragdollBlows`), or — slow enough — is jarred on its skis.
    for (const s of [-1, 1]) {
      charge(sided("shin", s), "bend", v);
      charge(sided("knee", s), "twist", v * I.noseTwist);
    }
    top = (v * v) / (2 * I.front.stop * TUNING.g);
    topPart = "pelvis";
  } else {
    const S = I.side;
    const face: Facing = side < 0 ? "left" : "right";
    hit(sided("shoulder", side), S.shoulder, face);
    hit(sided("arm", side), S.arm, face);
    hit("chest", S.chest, face);
    hit("abdomen", S.abdomen, face);
    hit("pelvis", S.pelvis, face);
    hit(sided("thigh", side), S.thigh, face);
    hit("head", S.head, face);
  }
  offer(top, topPart, "tree");
}

/** The skis' roll against the snow under them, rad (right side up
 * positive). */
function rollOf(state: GameState): number {
  const c = state.skier;
  snowNormal(state.level, c, n);
  const r = rotate(c.q, { x: 1, y: 0, z: 0 });
  return Math.asin(clamp(r.x * n.x + r.y * n.y + r.z * n.z, -1, 1));
}

/** A LANDING ON THE SKIS, of load `g`: up the legs' bones into the spine, onto
 * the knees as far as he came down in the back seat or crooked, and the
 * neck whipped — the spine handed more when the legs folded under it
 * (`legsFold`). A landing that came down on the body (`bodyHit`) is the
 * body's: its blow is struck below, and the legs carried only `onBody` of
 * the load. */
function landing(state: GameState, g: number, airTime: number): void {
  const L = TUNING.landing;
  const c = state.skier;
  const folded = g >= crashLimit(c, "legsFold");
  if (c.bodyHit > I.touch) g = 1 + (g - 1) * I.onBody;
  const tip = noseDown(state);
  const back = clamp(-tip / L.tailsDown, 0, 1);
  const crooked = clamp(Math.abs(rollOf(state)) / L.rolled, 0, 1);
  const drawer = g * (I.square + I.backSeat * back + I.crooked * crooked);
  charge("kneeL", "drawer", drawer);
  charge("kneeR", "drawer", drawer);
  charge("back", "load", folded ? g * I.folded : g);
  // UP THE LEGS: each carries half his weight's stop — the heel, the
  // pilon, the plateau, the femur and the hip socket loaded at once, a
  // heavier skier harder for the same g.
  const leg = g * (c.spec.skierMass / MEDIUM_RIDER.mass);
  for (const s of [-1, 1]) {
    charge(sided("foot", s), "load", leg);
    charge(sided("shin", s), "load", leg);
    charge(sided("knee", s), "load", leg);
    charge(sided("thigh", s), "load", leg);
  }
  charge("pelvis", "load", leg);
  // THE ORGANS stopped with him: the trunk's deceleration, the landing's g.
  charge("chest", "load", g);
  charge("abdomen", "load", g);
  if (g >= TUNING.landing.buckle) cap = PARTS;
  strike("neck", (g - 1) * I.neck);
  if (airTime >= L.air && g >= I.landingShown) offer(g, "back", "landing");
}

/** THE FALLS THAT TWIST AND LEVER: a caught edge, a fall at speed, a fall
 * over the tips. */
function fall(c: SkierState, cause: string, speed: number): void {
  if (cause === "catch") {
    // The outside ski is the one that bites: the left in a turn right.
    const s = c.edge > 0 ? -1 : 1;
    const slide = Math.max(c.sideSlip, TUNING.crash.catchSlip);
    charge(sided("knee", s), "twist", slide);
    charge(sided("knee", -s), "twist", slide * 0.5);
  } else if (cause === "roll") {
    const s = c.roll > 0 ? 1 : -1;
    charge(sided("knee", s), "twist", speed * I.rollTwist);
    charge(sided("knee", -s), "twist", speed * I.rollTwist * 0.5);
  } else if (cause === "groomer") {
    steel(speed);
  } else if (cause === "nose") {
    for (const s of [-1, 1]) {
      charge(sided("shin", s), "bend", speed);
      charge(sided("knee", s), "twist", speed * I.noseTwist);
    }
  }
}

/** RIDDEN INTO A PISTE MACHINE (`groomer.ts`), or met by its blade: the
 * steel square on — the chest and the belly, the arms flung up before it,
 * the hips, the legs and the head in its helmet — at `strike.least` m/s at
 * the least and `strike.hard` times over (twelve tonnes do not give),
 * against the blade's next to nothing; and three blows' worth of injuries
 * taken off it rather than one. */
function steel(speed: number): void {
  const S = GROOMER.strike;
  const v = Math.max(S.least, speed) * S.hard;
  const hit = (part: BodyPart, share: number, face: Facing | null): number => {
    const g = blow(part, v, S.give, true, share);
    strike(part, g, face);
    return g;
  };
  const g = hit("chest", 1, "front");
  hit("abdomen", 0.9, "front");
  hit("pelvis", 0.8, "front");
  hit("head", 0.7, "front");
  hit("neck", I.share.neck, null);
  for (const s of [-1, 1]) {
    hit(sided("shoulder", s), 0.9, "front");
    hit(sided("arm", s), 0.8, null);
    hit(sided("thigh", s), 0.7, null);
    hit(sided("knee", s), 0.6, null);
    hit(sided("shin", s), 0.7, null);
  }
  cap = I.perBlow * 3;
  offer(g, "chest", "groomer");
}

/** READ THIS STEP'S DOSES against every part's ladder: the injuries taken,
 * onto the body and `events` — at most `most` of them — and the hardest
 * blow onto the g meter. */
function judge(state: GameState, events: GameEvent[], most: number = I.perBlow): void {
  const body = state.skier.body;
  if (billG >= (billSource === "landing" ? I.landingShown : I.shown)) {
    // A blow he went down on takes the meter from one he rode out, and
    // one he rode out never takes it from a fall's.
    const fall = downOver(state, billRival, billAmateur);
    const cur = body.impact && body.impact.t < I.hold ? body.impact : null;
    const left = cur ? cur.g * (1 - cur.t / I.hold) : 0;
    if (!cur || (fall && !cur.fall) || (fall === cur.fall && billG >= left)) {
      body.blows += 1;
      body.impact = {
        g: billG,
        part: billPart,
        source: billSource,
        t: 0,
        id: body.blows,
        fall,
        rival: billRival,
        amateur: billAmateur,
      };
    }
    if (billG > body.peak) body.peak = billG;
    if (fall && billG > body.fallPeak) body.fallPeak = billG;
  }
  // A FRACTURE STRUCK AGAIN breaks worse: every one already on the body
  // takes the energy of this step's dose on its part, if harder.
  for (const h of body.injuries) {
    const def = INJURIES[h.kind] as InjuryDef;
    if (!def.fracture) continue;
    const p = PART[h.part];
    const d = dose[p * MECHS.length + MECHS.indexOf(def.mech)];
    if (d <= 0 || !struckOn(def, p)) continue;
    const e = energyOver(def.mech, d, def.at * (1 - I.weaken * body.worst[p]));
    if (e > (h.energy ?? 1)) h.energy = e;
  }
  // Every part's worst injury drawn this step, then the worst `perBlow`
  // of them taken: one blow does a few things, and a body thrown into a
  // trunk is not every risk drawn at once.
  found.length = 0;
  for (let p = 0; p < PARTS; p++) {
    const worst = body.worst[p];
    for (const { kind, index, def } of LADDER[p]) {
      if (def.ais < worst) break;
      const d = dose[p * MECHS.length + MECHS.indexOf(def.mech)];
      if (d <= 0) continue;
      if (!struckOn(def, p)) continue;
      const part = BODY_PARTS[p];
      if (body.injuries.some((h) => h.kind === kind && h.part === part)) continue;
      const at = def.at * (1 - I.weaken * worst);
      const u = hash2(state.tick, p * 64 + index, (state.seed ^ SALT) | 0);
      if (u >= riskOf(d, at)) continue;
      found.push({
        p,
        kind,
        ais: def.ais,
        energy: energyOver(def.mech, d, at),
        side: sideOf(def, faced[p], state, p * 64 + index),
      });
      break;
    }
  }
  found.sort((a, b) => b.ais - a.ais || a.p - b.p);
  for (let k = 0; k < Math.min(found.length, most); k++) {
    const { p, kind, ais, energy, side } = found[k];
    const part = BODY_PARTS[p];
    body.injuries.push(
      side
        ? { part, kind, ais, t: state.t, energy, side }
        : { part, kind, ais, t: state.t, energy },
    );
    if (ais > body.worst[p]) body.worst[p] = ais;
    events.push({ kind: "injury", t: state.t, part, injury: kind, ais });
  }
}

/** Whether this step's blow on part `p` came from a side `def` is done
 * from: its organ's `face`, and the sides a bone breaks on (`on`) — the
 * point of the shoulder for the collarbone, behind for the shoulder blade,
 * the front of the knee for the kneecap. */
function struckOn(def: InjuryDef, p: number): boolean {
  if (!def.face && !def.on) return true;
  const f = faced[p] < 0 ? null : FACES[faced[p]];
  if (f === null) return false;
  if (def.face && f !== def.face) return false;
  if (!def.on) return true;
  const out = BODY_PARTS[p].endsWith("L") ? "left" : "right";
  return def.on.some((o) => o === f || (o === "outside" && f === out));
}

const found: {
  p: number;
  kind: InjuryKind;
  ais: number;
  energy: number;
  side: "L" | "R" | null;
}[] = [];

/** WHICH SIDE a paired organ an injury names is hurt on: the side the blow
 * came from, or — from the front, from behind or up through the legs — one
 * drawn off a hash of the step (never the stream). Null for an injury that
 * names none. */
function sideOf(def: InjuryDef, face: number, state: GameState, k: number): "L" | "R" | null {
  if (!def.organs?.some(pairedOrgan)) return null;
  if (face >= 0 && FACES[face] === "left") return "L";
  if (face >= 0 && FACES[face] === "right") return "R";
  return hash2(state.tick, k, (state.seed ^ SIDE_SALT) | 0) < 0.5 ? "L" : "R";
}

/** ONE STEP OF THE BODY, after the run's own (`run.ts`): `off` is the body
 * he was thrown on at the start of the step — its ragdoll stepped — or
 * null while he was on his skis. */
export function stepBody(state: GameState, events: GameEvent[], off: Thrown | null): void {
  const c = state.skier;
  if (c.body.impact) c.body.impact.t += dt;
  clear();
  if (off) ragdollBlows(state, off);
  else {
    for (const e of events) {
      if (e.kind === "hit") trunkOnSkis(c, e.speed, e.x, e.z, e.stuff, e.radius);
      else if (e.kind === "land") landing(state, e.g, e.airTime);
      else if (e.kind === "wipeout") fall(c, e.cause, e.speed);
    }
    // The hips, the shoulders or the helmet into the snow.
    if (c.bodyHit > I.touch) {
      const give = snowGive(state, c.x, c.z);
      const s = c.bodySide;
      if (s === 0) {
        const g = blow("head", c.bodyHit, give, false);
        strike("head", g, "back");
        strike("neck", blow("neck", c.bodyHit, give, false, I.share.neck));
        offer(g, "head", "snow");
      } else {
        const face: Facing = s < 0 ? "left" : "right";
        const g = blow("pelvis", c.bodyHit, give, false);
        strike("pelvis", g, face);
        strike(
          sided("shoulder", s),
          blow(sided("shoulder", s), c.bodyHit, give, false, I.share.trunk),
          face,
        );
        strike("abdomen", blow("abdomen", c.bodyHit, give, false, I.share.trunk), face);
        offer(g, "pelvis", "snow");
      }
    }
  }
  wreckSeat(state, events);
  judge(state, events, cap);
  wreckFire(state, events);
}

/** THE CRASH ON THE SKID, on the step a helicopter he sat on went down:
 * the snow's stop of its fall, as the AIRFRAME met it (`HeliState.wreck`).
 * Up through its belly — level, or near it — the skid gear's crush and the
 * snow's give are the load up his spine, the pelvis's blow on the tube,
 * the neck's whip and his feet and shins driven up; rolled toward his side,
 * the airframe comes down on him; rolled away, he is thrown back against
 * its side; nose or tail first, he is thrown along the skid into its cross
 * tube flank first. A crash on its side hands the spine nothing. */
function wreckSeat(state: GameState, events: GameEvent[]): void {
  const w = state.heli?.wreck;
  if (!w?.aboard || !events.some((e) => e.kind === "heli" && e.phase === "crash")) return;
  const snow = snowGive(state, w.x, w.z);
  let top = 0;
  let topPart: BodyPart = "back";
  const hit = (part: BodyPart, g: number, face: Facing | null): void => {
    strike(part, g, face);
    if (g > top && base(part)) {
      top = g;
      topPart = part;
    }
  };
  if (w.seat > 0) {
    const give = WRECK.stroke + snow;
    const g = blowOf(w.seat, give);
    charge("back", "load", g);
    if (g > top) top = g;
    hit("pelvis", blow("pelvis", w.seat, give, false), null);
    hit("neck", g * I.share.neck, null);
    for (const s of [-1, 1]) {
      const legs = WRECK.legs;
      strike(sided("foot", s), blow(sided("foot", s), w.seat, give, false, legs));
      strike(
        sided("shin", s),
        blow(sided("shin", s), w.seat, give, false, legs * I.share.footShin),
      );
    }
  }
  if (w.out > 0) {
    // Pitched out face first, the airframe's side on his back.
    const P = WRECK.pinned;
    const give = WRECK.side + snow;
    hit("back", blow("back", w.out, give, false, P.back), "back");
    hit("chest", blow("chest", w.out, give, false, P.chest), "front");
    hit("abdomen", blow("abdomen", w.out, give, false, P.abdomen), "back");
    hit("pelvis", blow("pelvis", w.out, give, false, P.pelvis), "back");
    hit("head", blow("head", w.out, snow, false, P.head), "front");
    for (const s of [-1, 1]) {
      hit(sided("shoulder", s), blow(sided("shoulder", s), w.out, give, false, P.shoulder), "back");
      hit(sided("thigh", s), blow(sided("thigh", s), w.out, give, false, P.thigh), "back");
    }
  } else if (w.out < 0) {
    const T = WRECK.thrown;
    const v = -w.out;
    hit("back", blow("back", v, WRECK.side, false, T.back), "back");
    hit("pelvis", blow("pelvis", v, WRECK.side, false, T.pelvis), "back");
    hit("head", blow("head", v, WRECK.side, true, T.head), "back");
    for (const s of [-1, 1])
      hit(
        sided("shoulder", s),
        blow(sided("shoulder", s), v, WRECK.side, false, T.shoulder),
        "back",
      );
  }
  if (w.across !== 0) {
    // Along the skid into its cross tube, the flank that leads first — a
    // trunk met beside him (`I.side`).
    const S = I.side;
    const side = Math.sign(w.across);
    const v = Math.abs(w.across);
    const face: Facing = side < 0 ? "left" : "right";
    const at = (part: BodyPart, share: number): void =>
      hit(part, blow(part, v, WRECK.side, true, share), face);
    at(sided("shoulder", side), S.shoulder);
    at(sided("arm", side), S.arm);
    at("chest", S.chest);
    at("abdomen", S.abdomen);
    at("pelvis", S.pelvis);
    at(sided("thigh", side), S.thigh);
    at("head", S.head);
  }
  offer(top, topPart, "heli");
}

/** THE WRECK'S FIREBALL on him, every step it burns: its heat where he is
 * summed into the dose (`BodyState.heat`), and judged ONCE, on the step it
 * burns out — the whole exposure one draw, every part's burn taken. */
function wreckFire(state: GameState, events: GameEvent[]): void {
  const h = state.heli;
  const w = h?.wreck;
  if (!h || !w || h.mode !== "wreck") return;
  const ball = fireballAt(h.t);
  if (h.t - dt >= ball.life) return;
  const c = state.skier;
  const b = c.thrown;
  // His body's middle: thrown, the ragdoll's; on his skis, a metre up.
  const x = b ? b.x : c.x;
  const y = b ? b.y : c.y + 1;
  const z = b ? b.z : c.z;
  const d = hypot3(x - w.x, y - (w.y + ball.height), z - w.z);
  c.body.heat += fireFlux(d, ball.radius, ball.glow) ** (4 / 3) * dt;
  if (h.t < ball.life || c.body.heat <= 0) return;
  clear();
  for (const part of BODY_PARTS) charge(part, "heat", c.body.heat);
  judge(state, events, PARTS);
}

/** SKIER AGAINST SKIER: the player's own shoulder into a rival's or an
 * amateur's (`rivals.ts`' and `crowd.ts`' `bump`), after the field and the
 * crowd have moved. */
export function feelBumps(state: GameState, events: GameEvent[]): void {
  let any = false;
  const c = state.skier;
  for (const e of events) {
    if (e.kind !== "bump") continue;
    // A rival, or (`rival` −1) an amateur of the crowd.
    const o =
      e.rival >= 0
        ? state.rivals.find((x) => x.id === e.rival)?.run.skier
        : state.crowd?.amateurs.find((a) => a.id === e.amateur);
    if (!o) continue;
    if (!any) clear();
    any = true;
    const side =
      (o.x - c.x) * Math.cos(c.heading) - (o.z - c.z) * Math.sin(c.heading) >= 0 ? 1 : -1;
    const shoulder = sided("shoulder", side);
    // His share of the exchange by the two riders' weights, against what
    // the medium rider's would be: a heavy rider is jolted less.
    const other = "spec" in o ? o.spec.skierMass : CROWD_SIZE[o.body].mass;
    const speed =
      e.speed * (shoulderShare(c.spec.skierMass, other) / shoulderShare(MEDIUM_RIDER.mass, other));
    // A shoulder against a shoulder: two of them give.
    const g = blow(shoulder, speed, I.give.shoulder, false);
    strike(shoulder, g, side < 0 ? "left" : "right");
    strike(sided("arm", side), blow(sided("arm", side), speed, I.give.shoulder, false, 0.6));
    offer(g, shoulder, "skier", e.rival, e.amateur ?? -1);
  }
  if (any) judge(state, events);
}

/** A FALL A MOMENT AFTER THE BLOW: the blow on the meter that he — or the
 * skier he shouldered — went down within `fallWindow` of is the fall's,
 * and is shown from then for the meter's whole hold. After the field and
 * the crowd have moved, every step. */
export function markFall(state: GameState): void {
  const body = state.skier.body;
  const b = body.impact;
  if (!b || b.fall || b.t > I.fallWindow || !downOver(state, b.rival, b.amateur)) return;
  b.fall = true;
  b.t = 0;
  if (b.g > body.fallPeak) body.fallPeak = b.g;
}

/** The ISS's regions, by part: the head and neck, the chest (the thoracic
 * spine with it), the abdomen, and the limbs with the pelvis. */
const REGION: number[] = BODY_PARTS.map((p) =>
  p === "head" || p === "neck" ? 0 : p === "chest" || p === "back" ? 1 : p === "abdomen" ? 2 : 3,
);

/** THE BONES an injury cracks or breaks — on a paired part, its side of
 * each — or none. */
export function bonesOf(kind: InjuryKind, part: BodyPart): Bone[] {
  const def = INJURIES[kind] as InjuryDef;
  if (!def.bones) return [];
  const side = part.endsWith("L") ? "L" : part.endsWith("R") ? "R" : "";
  return def.bones.map((b) => (pairedBone(b) ? `${b}${side}` : b) as Bone);
}

/** Whether an injury is SAID in words: anything but a bone's fracture,
 * which the body drawn shows on the bone — the spinal cord, more than its
 * vertebra, is said. */
export function saidOf(kind: InjuryKind): boolean {
  const def = INJURIES[kind] as InjuryDef;
  return !def.fracture || def.said === true;
}

/** THE ORGANS an injury hurts — a paired one on its side — or none. */
export function organsOfInjury(h: Injury): Organ[] {
  const def = INJURIES[h.kind] as InjuryDef;
  if (!def.organs) return [];
  return def.organs.map((o) => (pairedOrgan(o) ? `${o}${h.side ?? "L"}` : o) as Organ);
}

/** EVERY ORGAN'S STATE, in `ORGANS` order: the worst AIS any injury on the
 * body did to it, 0 sound. */
export function organsOf(body: BodyState): number[] {
  const worst = new Array<number>(ORGANS.length).fill(0);
  for (const h of body.injuries)
    for (const o of organsOfInjury(h)) {
      const i = ORGANS.indexOf(o);
      if (h.ais > worst[i]) worst[i] = h.ais;
    }
  return worst;
}

/** WHAT A FRACTURE SHOWS on its bone: sound, a HAIRLINE crack, a SIMPLE
 * break, a WEDGE (a butterfly fragment knocked out) or SHATTERED
 * (multifragmentary) — the last three a break graded by the energy that
 * did it (`injury.comminute`). */
export const FRACTURE_GRADE = { sound: 0, hairline: 1, simple: 2, wedge: 3, shatter: 4 } as const;

/** One injury's grade on its bones. */
function gradeOf(def: InjuryDef, energy: number): number {
  if (def.fracture !== "break") return FRACTURE_GRADE.hairline;
  const C = I.comminute;
  if (energy >= C.shatter) return FRACTURE_GRADE.shatter;
  return energy >= C.wedge ? FRACTURE_GRADE.wedge : FRACTURE_GRADE.simple;
}

/** Every bone's grade and the energy of the fracture behind it. */
function boneFractures(body: BodyState): { grade: number[]; energy: number[] } {
  const grade = new Array<number>(BONES.length).fill(0);
  const energy = new Array<number>(BONES.length).fill(0);
  for (const h of body.injuries) {
    const def = INJURIES[h.kind] as InjuryDef;
    if (!def.fracture) continue;
    const e = h.energy ?? 1;
    const g = gradeOf(def, e);
    for (const b of bonesOf(h.kind, h.part)) {
      const i = BONES.indexOf(b);
      if (g > grade[i] || (g === grade[i] && e > energy[i])) {
        grade[i] = g;
        energy[i] = e;
      }
    }
  }
  return { grade, energy };
}

/** EVERY BONE'S STATE, in `BONES` order (`FRACTURE_GRADE`): 0 sound, 1 a
 * hairline crack, 2 a simple break, 3 a wedge, 4 shattered — the worst any
 * injury on the body did to it. */
export function fracturesOf(body: BodyState): number[] {
  return boneFractures(body).grade;
}

/** EVERY BONE'S FRACTURE ENERGY, in `BONES` order: the energy of the
 * fracture it shows over that fracture's even chance (0 sound) — how far
 * the drawing throws its pieces apart. */
export function fractureEnergyOf(body: BodyState): number[] {
  return boneFractures(body).energy;
}

/** THE INJURY SEVERITY SCORE: the squares of the worst AIS in each of the
 * three worst-hurt regions, summed — 0 unhurt, 16 and up major trauma, 75
 * the scale's top. */
export function severityOf(body: BodyState): number {
  const top = [0, 0, 0, 0];
  for (let p = 0; p < PARTS; p++) top[REGION[p]] = Math.max(top[REGION[p]], body.worst[p]);
  top.sort((a, b) => b - a);
  return top[0] * top[0] + top[1] * top[1] + top[2] * top[2];
}
