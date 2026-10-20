// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN AMATEUR DOWN, POSED — the crowd's figure hung on the engine's RAGDOLL
// (`Amateur.thrown`, the player's own body: `ragdoll.ts`) while he goes
// over and lies in the snow, and lifted back onto his skis as he gets up.
// Three-free, so the suite reads it.
//
// The figure's joints are the player's thrown pose (`ragdollPose`, the
// same reading the player's figure is hung by) turned into the crowd's
// joints (`fromPlayer`) and sized to the amateur's body about his hips —
// the ragdoll is the reference man's, and a child's is the same fall
// drawn smaller. Nothing is decided here: where every limb is, is the
// physics'.
//
// GETTING UP is the one motion the physics has no body for: from where the
// ragdoll came to rest he gathers into a crouch on his skis — set across
// the fall line where his feet lay, as the engine stood him — and rises
// out of it into his stance (`RISE`). Each half is a blend of the bones,
// each swung from its way in the one to its way in the other, so a limb
// swings between the two rather than shrinking or flipping through them.

import { CROWD, type Amateur } from "@engine";

import {
  CROWD_LOOKS,
  fromPlayer,
  mapPosed,
  poseCrowd,
  type CrowdLook,
  type Posed,
  type V3,
} from "./crowd-rig.ts";
import { boardUnderFeet } from "./board-thrown.ts";
import { breakPose, type Hurt } from "./crowd-broken.ts";
import { boardPosed, CROWD_BOARD, poseBoard } from "./crowd-board.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import { MOUNTS } from "./skier-pose.ts";
import { smooth } from "./skier-stroke.ts";

/** The player's figure is the reference man's, this tall, m — the
 * ragdoll's measures are his. */
const REFERENCE_HEIGHT = 1.8;

/** How level a ski's way must be before it is laid flat on the snow,
 * from the share of it that is level (`from`, laid not at all) to the
 * share it is laid wholly from (`to`). */
const LAY = { from: 0.1, to: 0.7 };

/** The share of the get-up spent gathering into the crouch; the rest is
 * rising out of it. */
const RISE = { gather: 0.55 };

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const mix = (a: V3, b: V3, t: number): V3 => add(mul(a, 1 - t), mul(b, t));

/** An amateur's own frame where he stands: his right, the snow's normal
 * and his heading's forward on the snow. */
export type StandFrame = { at: V3; right: V3; up: V3; fwd: V3 };

/** Where an amateur stands, as `crowd-view.ts` stands him: on the snow's
 * `normal` there, turned to his heading. */
export function standFrame(
  a: Pick<Amateur, "x" | "y" | "z" | "heading">,
  normal: { x: number; y: number; z: number },
): StandFrame {
  const up: V3 = [normal.x, normal.y, normal.z];
  const ahead: V3 = [Math.sin(a.heading), 0, Math.cos(a.heading)];
  const r: V3 = [
    up[1] * ahead[2] - up[2] * ahead[1],
    up[2] * ahead[0] - up[0] * ahead[2],
    up[0] * ahead[1] - up[1] * ahead[0],
  ];
  const right = mul(r, 1 / (len(r) || 1));
  const fwd: V3 = [
    right[1] * up[2] - right[2] * up[1],
    right[2] * up[0] - right[0] * up[2],
    right[0] * up[1] - right[1] * up[0],
  ];
  return { at: [a.x, a.y, a.z], right, up, fwd: mul(fwd, 1 / (len(fwd) || 1)) };
}

const frame: BodyFrame = {
  origin: { x: 0, y: 0, z: 0 },
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};

/** THE BODY AS IT LIES: the ragdoll's `points` (world frame) read as the
 * crowd's joints of `body` (or of a `look` of its own — a soldier's), in
 * the world frame less `anchor`. */
export function lyingPose(
  points: readonly number[],
  body: Amateur["body"],
  anchor: V3,
  board = false,
  look: CrowdLook = CROWD_LOOKS[body],
): Posed {
  const pose = ragdollPose(points, frame);
  // A rider's board stays on: laid along his feet, its top square to his
  // shins (`boardUnderFeet`, the player's own).
  const local = board
    ? boardPosed(pose, boardUnderFeet(pose, CROWD_BOARD), look)
    : fromPlayer(pose, look);
  const k = look.height / REFERENCE_HEIGHT;
  const lift = MOUNTS.ground * k;
  const o = frame.origin;
  const X = frame.x;
  const Y = frame.y;
  const Z = frame.z;
  const ox = o.x - anchor[0];
  const oy = o.y - anchor[1];
  const oz = o.z - anchor[2];
  const world = mapPosed(local, (p) => {
    const y = p[1] + lift;
    return [
      ox + X.x * p[0] + Y.x * y + Z.x * p[2],
      oy + X.y * p[0] + Y.y * y + Z.y * p[2],
      oz + X.z * p[0] + Y.z * y + Z.z * p[2],
    ];
  });
  return board ? world : laidSkis(world);
}

/**
 * THE SKIS OF A BODY LYING: still on his boots, square to each shin — but
 * turned about the shin to lie along the snow rather than stand up out of
 * it, as a leg laid flat lays its ski over on its edge. Stood up, the shin
 * plumb, they are as the thrown pose has them.
 */
function laidSkis(p: Posed): Posed {
  for (const [ski, ankle, knee] of [
    ["skiL", "ankleL", "kneeL"],
    ["skiR", "ankleR", "kneeR"],
  ] as const) {
    const s = p[ski];
    const shin = sub(p[knee], p[ankle]);
    const sl = len(shin) || 1;
    const u0 = mul(shin, 1 / sl);
    const ahead = sub(s.tip, s.tail);
    const al = len(ahead) || 1;
    const was = mul(ahead, 1 / al);
    // Square to the shin and as level as that allows: the way it points
    // laid onto the snow's level and squared back to the shin. Where it
    // points nearly straight up or down, no level way is any likelier than
    // another, so it is laid over only as far as it leans — down to the way
    // the thrown pose has it — rather than switched to some way across: a
    // ski swung round through a frame (`make jolt`'s crowd `fall-ski`).
    const level = Math.hypot(was[0], was[2]);
    const lay = smooth((level - LAY.from) / (LAY.to - LAY.from));
    let f: V3 = [was[0], was[1] * (1 - lay), was[2]];
    f = sub(f, mul(u0, f[0] * u0[0] + f[1] * u0[1] + f[2] * u0[2]));
    if (len(f) < 1e-4) continue;
    f = mul(f, 1 / (len(f) || 1));
    const cuff = len(sub(p[ankle], s.mid));
    const mid = sub(p[ankle], mul(u0, cuff));
    const r: V3 = [
      u0[1] * f[2] - u0[2] * f[1],
      u0[2] * f[0] - u0[0] * f[2],
      u0[0] * f[1] - u0[1] * f[0],
    ];
    p[ski] = {
      mid,
      tail: add(mid, mul(f, -len(sub(s.tail, s.mid)))),
      tip: add(mid, mul(f, len(sub(s.tip, s.mid)))),
      side: add(mid, mul(r, len(sub(s.side, s.mid)))),
    };
  }
  return p;
}

/** A pose in the amateur's own frame (`poseCrowd`) put where he stands, in
 * the world frame less `anchor`. */
function placed(p: Posed, f: StandFrame, anchor: V3): Posed {
  const o = sub(f.at, anchor);
  return mapPosed(p, (q) =>
    add(o, add(mul(f.right, q[0]), add(mul(f.up, q[1]), mul(f.fwd, q[2])))),
  );
}

/** The bone from `a0` to `a1` swung toward the bone from `b0` to `b1` by
 * `t` (0 the first, 1 the second): its way turned through the angle
 * between the two, its length blended — never a point blended and the
 * bone stretched back onto it, which flips the bone round wherever the
 * blend passes near its root. A bone of no length takes the other's way. */
function swing(a0: V3, a1: V3, b0: V3, b1: V3, t: number): V3 {
  const da = sub(a1, a0);
  const db = sub(b1, b0);
  const la = len(da);
  const lb = len(db);
  const l = la + (lb - la) * t;
  if (la < 1e-6 && lb < 1e-6) return [0, 0, 0];
  const ua = la < 1e-6 ? mul(db, 1 / lb) : mul(da, 1 / la);
  const ub = lb < 1e-6 ? ua : mul(db, 1 / lb);
  const cos = Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1] + ua[2] * ub[2]));
  const angle = Math.acos(cos);
  const sin = Math.sin(angle);
  const u =
    sin < 1e-4
      ? mix(ua, ub, t)
      : add(mul(ua, Math.sin((1 - t) * angle) / sin), mul(ub, Math.sin(t * angle) / sin));
  return mul(u, l / (len(u) || 1));
}

/** Two poses blended at `t` (0 `a`, 1 `b`): the pelvis moved between the
 * two, and every bone out from it swung from its way in `a` to its way in
 * `b` (`swing`) — the trunk out from the pelvis, the legs and the arms
 * down their chains, each ski about its middle. */
function blendPosed(a: Posed, b: Posed, t: number): Posed {
  const out = mapPosed(a, (q) => q);
  type Joint = Exclude<keyof Posed, "skiL" | "skiR">;
  out.pelvis = mix(a.pelvis, b.pelvis, t);
  const bone = (from: Joint, to: Joint): void => {
    out[to] = add(out[from], swing(a[from], a[to], b[from], b[to], t));
  };
  bone("pelvis", "waist");
  bone("waist", "neck");
  bone("neck", "head");
  bone("pelvis", "hipL");
  bone("pelvis", "hipR");
  bone("hipL", "kneeL");
  bone("kneeL", "ankleL");
  bone("hipR", "kneeR");
  bone("kneeR", "ankleR");
  bone("neck", "shoulderL");
  bone("neck", "shoulderR");
  bone("shoulderL", "elbowL");
  bone("elbowL", "handL");
  bone("shoulderR", "elbowR");
  bone("elbowR", "handR");
  bone("handL", "basketL");
  bone("handR", "basketR");
  for (const [ski, ankle] of [
    ["skiL", "ankleL"],
    ["skiR", "ankleR"],
  ] as const) {
    const sa = a[ski];
    const sb = b[ski];
    const mid = add(out[ankle], swing(a[ankle], sa.mid, b[ankle], sb.mid, t));
    out[ski] = {
      mid,
      tail: add(mid, swing(sa.mid, sa.tail, sb.mid, sb.tail, t)),
      tip: add(mid, swing(sa.mid, sa.tip, sb.mid, sb.tip, t)),
      side: add(mid, swing(sa.mid, sa.side, sb.mid, sb.side, t)),
    };
  }
  return out;
}

/**
 * AN AMATEUR DOWN, as the figure is drawn: lying where his body lies — or,
 * getting up (`Amateur.rise`), gathered into a crouch on his skis where
 * the engine stood him (`stand`) and risen into his stance — in the world
 * frame less `anchor`. Run into and HURT (`hurt`, the INJURIES on), he
 * lies broken (`crowd-broken.ts`) and never rises. Null when he is on his
 * skis.
 */
export function fallenPose(
  a: Pick<Amateur, "body" | "thrown" | "rise" | "board">,
  stand: StandFrame,
  anchor: V3,
  hurt?: Hurt,
): Posed | null {
  if (!a.thrown) return null;
  const board = a.board !== null;
  const lying = lyingPose(a.thrown.points, a.body, anchor, board);
  if (hurt) return breakPose(lying, hurt);
  if (a.rise <= 0) return lying;
  const look = CROWD_LOOKS[a.body];
  const u = Math.min(1, a.rise / CROWD.fall.rise);
  // A rider gathers onto his board as one on skis onto his skis — a goofy
  // one mirrored, as he is drawn.
  const side = a.board === "goofy" ? -1 : 1;
  const mirrored = (p: Posed): Posed => (side > 0 ? p : mapPosed(p, (q) => [-q[0], q[1], q[2]]));
  const shape = (crouch: boolean): Posed =>
    board
      ? mirrored(poseBoard(look, crouch ? { crouch: 1 } : {}))
      : poseCrowd(look, crouch ? { crouch: 1 } : {});
  const crouched = placed(shape(true), stand, anchor);
  if (u < RISE.gather) return blendPosed(lying, crouched, smooth(u / RISE.gather));
  const stood = placed(shape(false), stand, anchor);
  return blendPosed(crouched, stood, smooth((u - RISE.gather) / (1 - RISE.gather)));
}
