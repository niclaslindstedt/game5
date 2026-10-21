// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SOLDIERS' POSES — every pose the army's winter infantry are drawn in
// (`soldier-shapes.ts`), on the crowd's rig (`crowd-rig.ts`'s `Posed`): a
// soldier on his skis is the crowd's skier (the player's own pose, solved
// to a soldier's body and his long touring pair); a soldier on his feet,
// in a doorway or at a door gun is a KEY laid on the same body
// (`party-pose.ts`, `keyPosed`), the way a civilian on foot is. Each pose
// also says where his weapons are — the rifle slung, at the ready or at
// the shoulder, the launcher on his back or on his shoulder — and his
// poles, so the figure builds them where the hands are. Three-free, so the
// suite reads it (`tests/soldier_test.ts`).
//
// THE FRAME is the crowd's: x to his right, y up, z the way he faces, the
// snow (or the cabin's floor) under him at 0.
//
// THE DOOR GUNNER is posed in his SEAT'S frame (`seatFrame`): the floor
// under the seat at 0, facing out of the door — his hands on the gun
// where `gunHolds` (`army-heli-plan.ts`) puts them at the gun's aim, his
// cheek down to its stock.

import { RAGDOLL as R } from "@engine";

import { ARMY_HELI } from "@engine";
import { gunHolds, gunnerSeat, type P3, type Seat, type Side } from "./army-heli-plan.ts";
import { poseCrowd, type CrowdLook, type PoseDials, type Posed, type V3 } from "./crowd-rig.ts";
import { keyPosed } from "./civilian-moves.ts";
import { ANKLE, keyPoints, STAND, v, type Key } from "./party-pose.ts";
import { LAUNCHER, RIFLE } from "./soldier-kit.ts";

/** A SOLDIER'S BODY: a man of 1.8 m in his boots, as wide in the
 * shoulders' joints as the player (so a key's hands land where it says),
 * bulked by his kit — the smock over the uniform, the chest rig — and on
 * a pair of 2.1 m touring skis. */
export const SOLDIER_LOOK: CrowdLook = {
  height: 1.8,
  shoulder: 0.2,
  hip: 0.16,
  girth: 0.15,
  belly: 0,
  head: 0.118,
  ski: 2.1,
  skiWidth: 0.085,
  poles: true,
  hat: "helmet",
  pack: true,
};

/** THE FIGURES: a soldier on skis (rifle on his chest, poles in his hands), one on
 * his feet (rifle in his hands), the door gunner (sat at his gun, no
 * rifle) and the anti-armour man (the launcher, and a rifle). */
export type SoldierKind = "skier" | "foot" | "gunner" | "rocketeer";
export const SOLDIER_KINDS: readonly SoldierKind[] = ["skier", "foot", "gunner", "rocketeer"];

/** EACH FIGURE'S POSES, in the order its morph targets are built (the
 * first its rest):
 *   * skier — `ski` stood on them, `tuck`, `lean` (a turn to his right),
 *     `leanLeft`, `pole` (a double pole's plant), `skiAim` (stood on his
 *     skis aiming, the poles planted beside him), `skiKneel` (aiming off
 *     one knee with his skis on, the right one slid back under it — the
 *     way a ski trooper fires from a stop, and kneels at the dismount),
 *     `seat` (sat on a chair of a lift, the crowd's own), `pin` (knelt
 *     over a man face down, both hands on his back — the arrest);
 *   * foot — `ready` (the rifle at the low ready), `walkA`/`walkB` (a
 *     stride off each foot), `aim` (stood, the rifle at his shoulder),
 *     `kneel` (aiming off one knee), `doorSit` (sat in a doorway's edge,
 *     the legs over the sill, the rifle in his lap), `rope` (on a fast
 *     rope, hand under hand, the rifle slung), `seatAim` (sat in a
 *     paramotor's harness, the rifle shouldered and aimed down ahead at a
 *     man on the snow under him);
 *   * gunner — `sit` (sat at his gun, the hands on his knees), `fire`
 *     (square out of the door, level), `fireDown`, `fireFore`, `fireAft`;
 *   * rocketeer — `carry` (the rifle at the ready, the launcher on his
 *     back), `walkA`/`walkB`, `launch` (stood, the launcher on his
 *     shoulder), `kneelLaunch`. */
export const SOLDIER_POSES = {
  skier: ["ski", "tuck", "lean", "leanLeft", "pole", "skiAim", "skiKneel", "seat", "pin"],
  foot: ["ready", "walkA", "walkB", "aim", "kneel", "doorSit", "rope", "seatAim"],
  gunner: ["sit", "fire", "fireDown", "fireFore", "fireAft"],
  rocketeer: ["carry", "walkA", "walkB", "launch", "kneelLaunch"],
} as const satisfies Record<SoldierKind, readonly string[]>;
export type SoldierPoseName<K extends SoldierKind = SoldierKind> =
  (typeof SOLDIER_POSES)[K][number];

/** A long thing as drawn: its rear end, its front end and the way its top
 * faces — the rifle from its butt to its muzzle, the launcher from its
 * rear to its front. */
export type Carried = { rear: V3; front: V3; up: V3 };

/** A soldier in a pose: his joints, his rifle and his launcher where he
 * has them (`null` for a figure that carries none), and his two poles
 * (the grip's end and the basket's) when he has skis. */
export type SoldierPose = {
  posed: Posed;
  rifle: Carried | null;
  tube: Carried | null;
  poles: [V3, V3][] | null;
};

/** What each figure carries — the same in every one of its poses, since
 * a morph target moves the mesh and never adds to it. */
export const SOLDIER_CARRIES: Readonly<
  Record<SoldierKind, { rifle: boolean; tube: boolean; skis: boolean }>
> = {
  skier: { rifle: true, tube: false, skis: true },
  foot: { rifle: true, tube: false, skis: false },
  gunner: { rifle: false, tube: false, skis: false },
  rocketeer: { rifle: true, tube: true, skis: false },
};

// ── vectors ──────────────────────────────────────────────────────────────
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const mix = (a: V3, b: V3, t: number): V3 => add(mul(a, 1 - t), mul(b, t));
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const tup = (p: { x: number; y: number; z: number }): V3 => [p.x, p.y, p.z];
const obj = (p: V3) => v(p[0], p[1], p[2]);

/** A posed body's chest: its right, up and forward (the crowd's frame). */
export function chestOf(P: Posed): { r: V3; u: V3; f: V3 } {
  const u = norm(sub(P.neck, P.waist));
  const side = sub(P.shoulderR, P.shoulderL);
  const r = norm(sub(side, mul(u, dot(side, u))));
  return { r, u, f: cross(r, u) };
}

/** `axis` with its `up` squared to it. */
function squared(axis: V3, up: V3): V3 {
  const u = sub(up, mul(axis, dot(up, axis)));
  return Math.hypot(...u) < 1e-6 ? [0, 1, 0] : norm(u);
}

// ── the rifle ────────────────────────────────────────────────────────────

/** THE RIFLE IN HIS HANDS: its pistol grip in the right fist, its
 * handguard through the left — the bore `gripDrop` over the grip, the butt
 * `grip` m behind it. `up` is which way its top should face, near enough. */
function rifleInHands(P: Posed, up: V3): Carried {
  const bore = add(P.handR, mul(up, RIFLE.gripDrop));
  const ahead = norm(sub(add(P.handL, mul(up, 0.035)), bore));
  const top = squared(ahead, up);
  const rear = sub(bore, mul(ahead, RIFLE.grip));
  return { rear, front: add(rear, mul(ahead, RIFLE.length)), up: top };
}

/** THE PACK, m: how far out from the chest's back it stands at its belly
 * (its depth — what a launcher slung on the back lies over),
 * how wide and how tall it is (a large-volume patrol rucksack, some 80 to
 * 100 litres: about 0.6 m tall, 0.35 wide and 0.25 deep loaded), and how
 * far under the chest's middle its middle sits. */
export const PACK = { depth: 0.25, width: 0.34, height: 0.6, drop: 0.04 } as const;

/** SLUNG ACROSS THE BACK, over the pack: the rear end low on his right,
 * the front high over his left shoulder (a launcher the other way, so the
 * two never cross when both are carried). */
function slung(P: Posed, length: number, look: CrowdLook, mirror = 1, over = 0): Carried {
  const c = chestOf(P);
  const back = sub(mix(P.waist, P.neck, 0.5), mul(c.f, look.girth + PACK.depth + 0.05 + over));
  const rear = add(add(back, mul(c.r, 0.2 * mirror)), mul(c.u, -0.32));
  const toward = norm(add(mul(c.r, -0.42 * mirror), mul(c.u, 0.9)));
  return { rear, front: add(rear, mul(toward, length)), up: mul(c.f, -1) };
}

/** THE RIFLE ON THE CHEST SLING, the way a ski trooper carries it when he
 * is not using it: slung low across the front of him over the chest rig,
 * the butt up on his right breast and the muzzle down past his left hip,
 * steep enough to stay between his arms so the poles swing clear of it.
 * It lies on its side against him, its top toward his left shoulder and
 * its magazine and grip toward his right hip, so nothing of it points
 * into the rig. The point a fall lands on is the stock, not the muzzle,
 * and it comes up to the shoulder from there in one move. */
const SLING = {
  /** How far out from the smock's line its axis lies, m: over the
   * pouches (which stand some 6 cm out) and half its own width more. */
  out: 0.1,
  /** Where the butt sits from the chest's middle: up and to his right, m. */
  up: 0.2,
  right: 0.11,
  /** Its line down across him, in his right and up (unnormalized). */
  across: -0.36,
  down: 0.93,
  /** How far its line swings from the chest's own down toward the
   * ground's, 0..1 (a sling holds the butt, the muzzle hangs). */
  swing: 0.5,
  /** How much further across him it lies the more he bends over. */
  aside: 1.1,
} as const;

function chestSling(P: Posed, look: CrowdLook): Carried {
  const c = chestOf(P);
  const mid = mix(P.waist, P.neck, 0.5);
  const rear = add(
    add(add(mid, mul(c.f, look.girth + SLING.out)), mul(c.u, SLING.up)),
    mul(c.r, SLING.right),
  );
  // Down across him, swung toward the ground as far as the sling lets it
  // when he bends over (a pole plant, a crouch), and never into him.
  const down = norm(mix(mul(c.u, -1), [0, -1, 0], SLING.swing));
  // Bent over, his thighs come up under it: it swings out past the left
  // knee instead of between them (`bent`: 0 upright, 1 the chest flat).
  const bent = Math.max(0, 1 - c.u[1]);
  let a = norm(add(mul(c.r, SLING.across - SLING.aside * bent), mul(down, SLING.down)));
  const into = dot(a, c.f);
  if (into < 0) a = norm(sub(a, mul(c.f, into)));
  // On its side: its top in the chest's plane, square to it, upward.
  const s = cross(a, c.f);
  const top = dot(s, c.u) >= 0 ? s : mul(s, -1);
  return { rear, front: add(rear, mul(a, RIFLE.length)), up: top };
}

/** SAT DOWN on a chair, the same sling let out: the muzzle comes down
 * onto his lap and the rifle lies along his left thigh, the butt at his
 * belt in front of him and the muzzle out past the knee, on its side. */
function lapSling(P: Posed, look: CrowdLook): Carried {
  const c = chestOf(P);
  const rear = add(add(P.waist, mul(c.f, look.girth + 0.08)), mul(c.r, 0.04));
  const thigh = add(P.kneeL, [0, 0.16, 0]);
  const a = norm(sub(thigh, rear));
  const s = cross(a, [0, 1, 0]);
  const top = norm(dot(s, c.r) < 0 ? s : mul(s, -1));
  return { rear, front: add(rear, mul(a, RIFLE.length)), up: top };
}

// ── keys ─────────────────────────────────────────────────────────────────

const key = (k: Partial<Key>): Key => ({ ...STAND, ...k });

/** The shoulders a key puts him at, before his hands are placed. */
function shouldersOf(k: Key): { L: V3; R: V3 } {
  const pts = keyPoints(k, 0);
  const at = (i: number): V3 => [pts[3 * i], pts[3 * i + 1], pts[3 * i + 2]];
  return { L: at(R.shoulderL), R: at(R.shoulderR) };
}

/** His hands for a long thing at his shoulder: its rear in the right
 * shoulder's pocket (`pocket`, from the shoulder joint), its axis along
 * `aim`; the right hand on its grip, the left out along it. */
function handsAtShoulder(
  k: Key,
  aim: V3,
  grip: { at: number; drop: number },
  fore: { at: number; drop: number },
  pocket: V3,
): Key {
  const s = shouldersOf(k);
  const a = norm(aim);
  const up = squared(a, [0, 1, 0]);
  const rear = add(s.R, pocket);
  const right = add(add(rear, mul(a, grip.at)), mul(up, -grip.drop));
  const left = add(add(rear, mul(a, fore.at)), mul(up, -fore.drop));
  return { ...k, hands: [obj(left), obj(right)] };
}

/** THE RIFLE AT THE SHOULDER along `aim`: the butt in the pocket inside
 * the right shoulder joint, the grip `RIFLE.grip` out, the left hand on
 * the handguard. */
function aimKey(k: Key, aim: V3): Key {
  return handsAtShoulder(
    k,
    aim,
    { at: RIFLE.grip, drop: RIFLE.gripDrop },
    { at: RIFLE.stock + RIFLE.receiver + 0.12, drop: 0.035 },
    [-0.05, 0.02, 0.03],
  );
}

/** THE LAUNCHER ON THE SHOULDER along `aim`: the tube over the right
 * shoulder — its rear behind it, its grip under it out front. */
function launchKey(k: Key, aim: V3): Key {
  return handsAtShoulder(
    k,
    aim,
    { at: LAUNCHER.grip, drop: LAUNCHER.gripDrop + 0.03 },
    { at: LAUNCHER.grip + 0.28, drop: 0.07 },
    [-0.02, 0.09, -0.38],
  );
}

/** The launcher placed off the posed body it was keyed for. */
function launcherOn(P: Posed, aim: V3): Carried {
  const a = norm(aim);
  const up = squared(a, [0, 1, 0]);
  const rear = add(P.shoulderR, [-0.02, 0.09, -0.38]);
  // Snapped to the grip in his hand, so it moves with the arm.
  const grip = add(add(rear, mul(a, LAUNCHER.grip)), mul(up, -(LAUNCHER.gripDrop + 0.03)));
  const fix = sub(P.handR, grip);
  const r = add(rear, fix);
  return { rear: r, front: add(r, mul(a, LAUNCHER.length)), up };
}

/** The rifle at the low ready: the butt in the shoulder, the right fist on
 * the grip at the chest, the left on the handguard, the muzzle down ahead
 * of his feet. */
const READY_HANDS: Key["hands"] = [v(0.0, 0.98, 0.5), v(0.15, 1.12, 0.2)];

const READY = key({ hipY: 0.92, pitch: 0.1, nod: 0.05, hands: READY_HANDS });
const walk = (lead: 0 | 1): Key => {
  const f = lead === 0 ? 1 : -1;
  return key({
    hipY: 0.9,
    pitch: 0.14,
    nod: 0.05,
    twist: 0.08 * f,
    hipZ: 0.02,
    feet: [
      v(-0.12, ANKLE + (f > 0 ? 0 : 0.06), 0.3 * f),
      v(0.12, ANKLE + (f > 0 ? 0.06 : 0), -0.3 * f),
    ],
    hands: READY_HANDS,
  });
};
/** Stood to aim: the left foot forward, the body bladed (the right
 * shoulder back), the head rolled down onto the stock. */
const AIM = aimKey(
  key({
    hipY: 0.9,
    hipZ: -0.02,
    pitch: 0.12,
    roll: 0.1,
    twist: 0.3,
    nod: 0.25,
    feet: [v(-0.17, ANKLE, 0.2), v(0.17, ANKLE, -0.18)],
  }),
  [0.05, -0.01, 1],
);
/** Off one knee: sat back on the right heel, the right knee down, the left
 * foot forward under its knee, the left elbow toward it. */
const KNEEL_BODY: Partial<Key> = {
  hipY: 0.54,
  hipZ: -0.12,
  pitch: 0.22,
  roll: 0.1,
  twist: 0.32,
  nod: 0.25,
  feet: [v(-0.18, ANKLE, 0.4), v(0.15, 0.14, -0.5)],
};
const KNEEL = aimKey(key(KNEEL_BODY), [0.05, -0.02, 1]);
/** Stood on skis to aim: the feet side by side as the skis hold them. */
const SKI_AIM = aimKey(
  key({
    hipY: 0.88,
    pitch: 0.14,
    roll: 0.1,
    twist: 0.32,
    nod: 0.25,
    feet: [v(-0.15, ANKLE, 0.04), v(0.15, ANKLE, -0.04)],
  }),
  [0.05, -0.01, 1],
);
/** Off one knee ON HIS SKIS: the left ski ahead under its knee, the right
 * slid back under the knee that is down, both flat on the snow. */
const SKI_KNEEL = aimKey(
  key({ ...KNEEL_BODY, hipY: 0.6, feet: [v(-0.17, ANKLE, 0.3), v(0.17, ANKLE, -0.42)] }),
  [0.05, -0.02, 1],
);
/** KNELT OVER A MAN face down in front of him, his skis on: both hands
 * down on the man's back, the weight over them, the rifle slung. */
const PIN = key({
  hipY: 0.58,
  hipZ: -0.1,
  pitch: 0.75,
  nod: 0.35,
  feet: [v(-0.17, ANKLE, 0.22), v(0.17, ANKLE, -0.4)],
  hands: [v(-0.14, 0.3, 0.55), v(0.14, 0.3, 0.6)],
});
/** Sat on a doorway's edge (the floor at 0 under his seat, the sill's edge
 * just ahead), the legs down over it, the rifle across his lap. */
const DOOR_SIT = key({
  hipY: 0.1,
  hipZ: -0.08,
  pitch: 0.18,
  nod: 0.1,
  feet: [v(-0.15, -0.38, 0.42), v(0.15, -0.4, 0.4)],
  hands: [v(-0.16, 0.2, 0.36), v(0.16, 0.17, 0.2)],
});
/** THE AIM OUT OF A HARNESS: down ahead, as a rifleman circling a man on
 * the snow some 60 m under him and 150 m out sees him (about 0.4 rad). */
const SEAT_AIM_AT: V3 = [0.05, -0.42, 1];
/** SAT IN THE HARNESS TO FIRE: the seat's hips and hanging legs, the
 * trunk bladed and leant into the stock, the head down on it. */
const SEAT_AIM = aimKey(
  key({
    hipY: 0.1,
    hipZ: -0.08,
    pitch: 0.28,
    roll: 0.1,
    twist: 0.3,
    nod: 0.45,
    feet: [v(-0.15, -0.38, 0.42), v(0.15, -0.4, 0.4)],
  }),
  SEAT_AIM_AT,
);
/** WHERE THE FAST ROPE RUNS through a man on it, in his frame: plumb,
 * this far in front of his spine, m. */
export const ROPE_AHEAD = 0.16;
/** Hand under hand down a fast rope, the boots clamping it, the knees up. */
const ROPE = key({
  hipY: 0.78,
  hipZ: -0.04,
  pitch: 0.05,
  nod: -0.15,
  feet: [v(-0.06, ANKLE + 0.04, ROPE_AHEAD - 0.02), v(0.06, ANKLE, ROPE_AHEAD)],
  hands: [v(-0.03, 1.55, ROPE_AHEAD), v(0.03, 1.82, ROPE_AHEAD)],
});
const LAUNCH_AIM: V3 = [0.03, 0.02, 1];
const LAUNCH = launchKey(
  key({
    hipY: 0.9,
    hipZ: -0.03,
    pitch: 0.1,
    roll: 0.12,
    twist: 0.25,
    nod: 0.2,
    feet: [v(-0.17, ANKLE, 0.24), v(0.17, ANKLE, -0.2)],
  }),
  LAUNCH_AIM,
);
const KNEEL_LAUNCH = launchKey(key({ ...KNEEL_BODY, nod: 0.2 }), LAUNCH_AIM);

const AIMS: Readonly<Record<string, V3>> = {
  aim: [0.05, -0.01, 1],
  seatAim: SEAT_AIM_AT,
  kneel: [0.05, -0.02, 1],
  skiAim: [0.05, -0.01, 1],
  skiKneel: [0.05, -0.02, 1],
};

// ── the poses ────────────────────────────────────────────────────────────

const SKI_DIALS: Readonly<Record<string, PoseDials>> = {
  ski: {},
  // Under a loaded pack a soldier's tuck is a taller one than a racer's.
  tuck: { crouch: 0.65 },
  lean: { lean: 1 },
  leanLeft: { leanLeft: 1 },
  pole: { pole1: 1 },
  seat: { seat: 1 },
};

/** The poles planted upright beside him, a pace out to each side. */
function planted(P: Posed): [V3, V3][] {
  const c = chestOf(P);
  return [-1, 1].map((s) => {
    const foot = s < 0 ? P.ankleL : P.ankleR;
    const at = add(foot, mul(c.r, 0.32 * s));
    return [
      [at[0], 1.2, at[2]],
      [at[0], -0.08, at[2]],
    ] as [V3, V3];
  });
}

/** HIS SKIS FLAT ON THE SNOW under his boots, pointing the way he faces:
 * a key's boot is squared to its shin, so a knee bent far forward over a
 * ski would stand the ski up on its tail — a kneel on skis keeps the skis
 * on the snow and lets the heel lift off them. */
function flatSkis(P: Posed, look: CrowdLook): Posed {
  const ski = (ankle: V3) => {
    const mid: V3 = [ankle[0], 0.02, ankle[2]];
    return {
      tail: add(mid, [0, 0, -look.ski * 0.45]),
      tip: add(mid, [0, 0, look.ski * 0.55]),
      mid,
      side: add(mid, [look.skiWidth / 2, 0, 0]),
    };
  };
  return { ...P, skiL: ski(P.ankleL), skiR: ski(P.ankleR) };
}

/** THE SKIER'S poses. */
function skierPose(name: SoldierPoseName<"skier">): SoldierPose {
  if (name === "skiAim" || name === "skiKneel") {
    const keyed = keyPosed(name === "skiAim" ? SKI_AIM : SKI_KNEEL, SOLDIER_LOOK);
    const posed = name === "skiKneel" ? flatSkis(keyed, SOLDIER_LOOK) : keyed;
    return {
      posed,
      rifle: rifleInHands(posed, chestOf(posed).u),
      tube: null,
      poles: planted(posed),
    };
  }
  if (name === "pin") {
    const posed = flatSkis(keyPosed(PIN, SOLDIER_LOOK), SOLDIER_LOOK);
    return {
      posed,
      rifle: chestSling(posed, SOLDIER_LOOK),
      tube: null,
      poles: planted(posed),
    };
  }
  const posed = poseCrowd(SOLDIER_LOOK, SKI_DIALS[name]);
  return {
    posed,
    rifle: name === "seat" ? lapSling(posed, SOLDIER_LOOK) : chestSling(posed, SOLDIER_LOOK),
    tube: null,
    poles: [
      [posed.handL, posed.basketL],
      [posed.handR, posed.basketR],
    ],
  };
}

/** A SOLDIER LYING as his body lies (`posed`, the ragdoll read as his
 * joints — `army-ground-view.ts`), carrying what his figure carries: the
 * rifle on his chest sling, the launcher across his back, and a skier's poles
 * still in his fists, along his forearms. */
export function lyingSoldier(posed: Posed, kind: SoldierKind): SoldierPose {
  const pole = (hand: V3, elbow: V3): [V3, V3] => {
    const along = norm(sub(hand, elbow));
    return [add(hand, mul(along, -0.08)), add(hand, mul(along, 1.15))];
  };
  const c = SOLDIER_CARRIES[kind];
  return {
    posed,
    rifle: c.rifle ? chestSling(posed, SOLDIER_LOOK) : null,
    tube: c.tube ? slung(posed, LAUNCHER.length, SOLDIER_LOOK, -1) : null,
    poles: c.skis ? [pole(posed.handL, posed.elbowL), pole(posed.handR, posed.elbowR)] : null,
  };
}

/** THE SOLDIER ON FOOT's poses. */
function footPose(name: SoldierPoseName<"foot">): SoldierPose {
  const k =
    name === "ready"
      ? READY
      : name === "walkA"
        ? walk(0)
        : name === "walkB"
          ? walk(1)
          : name === "aim"
            ? AIM
            : name === "kneel"
              ? KNEEL
              : name === "doorSit"
                ? DOOR_SIT
                : name === "seatAim"
                  ? SEAT_AIM
                  : ROPE;
  const posed = keyPosed(k, SOLDIER_LOOK);
  const rifle =
    name === "rope" ? chestSling(posed, SOLDIER_LOOK) : rifleInHands(posed, chestOf(posed).u);
  return { posed, rifle, tube: null, poles: null };
}

/** THE ANTI-ARMOUR MAN's poses. */
function rocketeerPose(name: SoldierPoseName<"rocketeer">): SoldierPose {
  if (name === "launch" || name === "kneelLaunch") {
    const posed = keyPosed(name === "launch" ? LAUNCH : KNEEL_LAUNCH, SOLDIER_LOOK);
    return {
      posed,
      rifle: slung(posed, RIFLE.length, SOLDIER_LOOK),
      tube: launcherOn(posed, LAUNCH_AIM),
      poles: null,
    };
  }
  const posed = keyPosed(name === "carry" ? READY : walk(name === "walkA" ? 0 : 1), SOLDIER_LOOK);
  return {
    posed,
    rifle: rifleInHands(posed, chestOf(posed).u),
    tube: slung(posed, LAUNCHER.length, SOLDIER_LOOK, -1),
    poles: null,
  };
}

// ── the door gunner ──────────────────────────────────────────────────────

/** A SEAT'S FRAME in the machine: the floor under the seat its origin,
 * facing the way the seat does — `toBody` takes a point in it to the body
 * frame, `toSeat` back. */
export function seatFrame(seat: Seat): { toBody: (p: V3) => P3; toSeat: (p: P3) => V3 } {
  const fx = Math.sin(seat.facing);
  const fz = Math.cos(seat.facing);
  // His right, facing (fx, fz): x right, z forward, heading clockwise.
  const rx = fz;
  const rz = -fx;
  const floor = ARMY_HELI.sill;
  return {
    toBody: (p) => ({
      x: seat.x + p[0] * rx + p[2] * fx,
      y: floor + p[1],
      z: seat.z + p[0] * rz + p[2] * fz,
    }),
    toSeat: (q) => {
      const dx = q.x - seat.x;
      const dz = q.z - seat.z;
      return [dx * rx + dz * rz, q.y - floor, dx * fx + dz * fz];
    },
  };
}

/** The gunner's aims his morph targets are built at: yaw (toward the nose
 * positive) and pitch (up positive), rad. */
export const GUNNER_AIMS = {
  fire: { yaw: 0, pitch: 0 },
  fireDown: { yaw: 0, pitch: -0.6 },
  fireFore: { yaw: 0.7, pitch: -0.2 },
  fireAft: { yaw: -0.7, pitch: -0.2 },
} as const;

/** How high the gunner's hip joints are over his seat's pan, m. */
const SEAT_HIP = 0.09;

/** THE DOOR GUNNER AT HIS GUN on `side` at an aim: sat on his seat in its
 * frame (`seatFrame(gunnerSeat(side))`), his fists where `gunHolds` puts
 * them, his trunk leant down toward the stock — bent forward and rolled
 * to it — and his head nodded onto it. */
export function gunnerPosed(side: Side, yaw: number, pitch: number): SoldierPose {
  const seat = gunnerSeat(side);
  const f = seatFrame(seat);
  const holds = gunHolds(side, yaw, pitch);
  const R0 = f.toSeat(holds.right);
  const L0 = f.toSeat(holds.left);
  const cheek = f.toSeat(holds.cheek);
  const hip: V3 = [0, seat.y - ARMY_HELI.sill + SEAT_HIP, -0.04];
  // The trunk's line from the hips toward a point behind and above the
  // cheek (the head sits that far over the stock), its length the spine's
  // and the neck's.
  const to = sub(add(cheek, [0, 0.08, -0.09]), hip);
  const up = norm(to);
  const k = key({
    hipY: hip[1],
    hipZ: hip[2],
    pitch: Math.atan2(up[2], up[1]),
    roll: Math.asin(Math.max(-0.5, Math.min(0.5, up[0]))),
    twist: 0.1,
    nod: 0.3,
    feet: [v(-0.2, ANKLE, 0.42), v(0.2, ANKLE, 0.36)],
    hands: [obj(L0), obj(R0)],
  });
  return { posed: keyPosed(k, SOLDIER_LOOK), rifle: null, tube: null, poles: null };
}

/** Sat at the gun, not on it: the hands on his knees. */
function gunnerRest(): SoldierPose {
  const seat = gunnerSeat(1);
  const hipY = seat.y - ARMY_HELI.sill + SEAT_HIP;
  const k = key({
    hipY,
    hipZ: -0.04,
    pitch: 0.12,
    nod: 0.05,
    feet: [v(-0.2, ANKLE, 0.42), v(0.2, ANKLE, 0.36)],
    hands: [v(-0.17, hipY + 0.1, 0.36), v(0.17, hipY + 0.1, 0.36)],
  });
  return { posed: keyPosed(k, SOLDIER_LOOK), rifle: null, tube: null, poles: null };
}

/** THE GUNNER'S poses (the right door's; in his seat's frame). */
function gunnerPose(name: SoldierPoseName<"gunner">): SoldierPose {
  if (name === "sit") return gunnerRest();
  const a = GUNNER_AIMS[name];
  return gunnerPosed(1, a.yaw, a.pitch);
}

/** A FIGURE IN A NAMED POSE: his joints, where his weapons are, and his
 * poles. */
export function soldierPose<K extends SoldierKind>(kind: K, name: SoldierPoseName<K>): SoldierPose {
  switch (kind) {
    case "skier":
      return skierPose(name as SoldierPoseName<"skier">);
    case "foot":
      return footPose(name as SoldierPoseName<"foot">);
    case "gunner":
      return gunnerPose(name as SoldierPoseName<"gunner">);
    default:
      return rocketeerPose(name as SoldierPoseName<"rocketeer">);
  }
}

/** Every pose a figure's morph targets are built from, in
 * `SOLDIER_POSES`' order (the first the base). */
export function soldierTargets(kind: SoldierKind): SoldierPose[] {
  return (SOLDIER_POSES[kind] as readonly string[]).map((n) =>
    soldierPose(kind, n as SoldierPoseName),
  );
}

/** Where a pose aims along, in his frame — the rifle's or the launcher's
 * axis, `null` when he is not aiming. */
export function aimOf(kind: SoldierKind, name: string): V3 | null {
  if (kind === "rocketeer" && (name === "launch" || name === "kneelLaunch"))
    return norm(LAUNCH_AIM);
  const a = AIMS[name];
  return a ? norm(a) : null;
}

/** A point from the crowd's tuple to the plan's object. */
export const asP3 = (p: V3): P3 => ({ x: p[0], y: p[1], z: p[2] });
/** And back. */
export const asV3 = tup;

// ── on a snowmobile ──────────────────────────────────────────────────────

/** THE ARMY'S SNOWMOBILE'S SEATS in the machine's traced frame
 * (`sled-look.ts`: z forward from the tunnel's end, y up from the snow
 * under the belt), m: where each man sits along it, the seat's top under
 * him, his boots on the running boards and the driver's fists on the
 * grips (`SLED_LOOK.grip`, the bar's width). Each figure is drawn in its
 * own frame at (0, 0, `z`) of the machine's, facing its nose. */
export const SLED_SEATS = {
  driver: { z: 1.42, seat: 0.8 },
  gunner: { z: 0.92, seat: 0.9 },
  boards: 0.345,
  grip: { x: 0.33, y: 1.135, z: 1.978 },
} as const;

/** The two men astride: the hips on the seat, the knees out round the
 * machine, the boots on the boards. */
function astride(seat: { z: number; seat: number }, ahead: number, k: Partial<Key>): Key {
  const B = SLED_SEATS.boards + ANKLE;
  return key({
    hipY: seat.seat + 0.09,
    hipZ: 0,
    kneesOut: 0.6,
    feet: [v(-0.3, B, ahead), v(0.3, B, ahead)],
    ...k,
  });
}

/** THE DRIVER: astride the seat, leant over the bars, a fist on each grip. */
export function sledDriverPose(): SoldierPose {
  const S = SLED_SEATS;
  const g = S.grip;
  const k = astride(S.driver, 0.32, {
    pitch: 0.38,
    nod: -0.15,
    elbowsOut: 0.4,
    hands: [v(-g.x, g.y, g.z - S.driver.z), v(g.x, g.y, g.z - S.driver.z)],
  });
  return { posed: keyPosed(k, SOLDIER_LOOK), rifle: null, tube: null, poles: null };
}

/** THE GUNNER ON THE PILLION, his light machine gun at his shoulder laid
 * `yaw` off the nose (right positive) and `pitch` up, rad: turned in his
 * seat toward it as far as his hips let him, the rest in his arms. */
export function sledGunnerPose(yaw: number, pitch: number): SoldierPose {
  const S = SLED_SEATS;
  const aim: V3 = [
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ];
  const k = aimKey(
    astride(S.gunner, S.driver.z - S.gunner.z - 0.12, {
      pitch: 0.12,
      roll: 0.06,
      twist: Math.max(-0.75, Math.min(0.75, yaw * 0.6)) + 0.2,
      nod: 0.25,
    }),
    aim,
  );
  const posed = keyPosed(k, SOLDIER_LOOK);
  return { posed, rifle: rifleInHands(posed, chestOf(posed).u), tube: null, poles: null };
}
