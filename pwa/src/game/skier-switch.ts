// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RIDING SWITCH, AS STOOD: the skier going down the hill tails first
// (`engine/game/switch.ts`) looks back over a shoulder to see where he is
// going. Three-free; `skierPose` lays it on the body it stands up.
//
// What a skier riding switch does with his body, as instructors teach it:
//   - HE PICKS A SHOULDER and keeps it — most a favourite side — rather
//     than flicking his head from side to side, which costs the balance
//     (the shoulder is kept by the view's spring, `SkierSpring.backSide`).
//   - THE WHOLE TRUNK TURNS that way, not the neck alone: the shoulder
//     opened and the hips rotated toward it, so the head can come round
//     far enough to see behind him. The neck takes the rest — about as far
//     as a neck turns, some 80° — the chin over the shoulder and the head
//     held UPRIGHT, never ducked to peer down under the arm.
//   - THE STANCE IS THE SAME athletic one as riding forward, if anything
//     lower: knees and ankles bent, the shins on the boots' tongues — never
//     stood up on straight legs.
//   - THE HANDS DROP LOW BY HIS SIDES, a little out from the hips, and the
//     POLES POINT LOW AND BACK — trailing the way he goes, toward his tips,
//     the baskets clear of the snow. Not the forward skier's hands out in
//     front at the steering wheel's quarter to three, and never a tuck's
//     fists ahead of his face: tucked switch, his chest is over his tips and
//     the way he goes is behind him.
//
// TURNING ROUND, too slow to ride switch (the engine's REVERT): a
// freestyler slides out of it — the skis laid flat, unloaded a little and
// pivoted round on their bases under a body that keeps travelling, no edge
// caught. The look leads it: his head is already on the line he travels,
// and it STAYS there while the skis, the hips and then the shoulders come
// round under it, the twist and the look unwound together; the legs
// lengthen a little through the middle, where the skis are light and
// across the way, and his hands come back up in front of him.
//
// HOPPING INTO SWITCH ON PURPOSE (the engine's `hopSwitch`), as a
// freestyler is coached through a hop 180 on the flat: as the legs load
// for the pop he WINDS UP — the shoulders turned against the way he means
// to go, most of the 45° a coach asks for, the head with them —
// and at the pop UNWINDS hard: the HEAD LEADS the turn, coming round to
// look over the shoulder he turns to before the skis are half way, the
// trunk following it, the body kept compact, landed centred and looking
// back down the hill over that shoulder — the shoulder he then rides
// switch on.

/** The look back at its fullest: the head turned in the body's frame,
 * rad (the trunk's turn and the neck's together — the chin over the
 * shoulder, the eyes a little behind square across), the shoulders' turn
 * off the hips', rad, the hips' own turn toward it, rad, and the hips
 * sunk, m. */
export const SWITCH_LOOK = {
  head: 2.15,
  twist: 0.7,
  hips: 0.25,
  sink: 0.06,
} as const;

/** THE HANDS AND POLES carried switch: each fist off the hips, m — out to
 * its side, up (down, negative: the arms let hang near straight), and along
 * toward the tips, and how much further along in a full tuck, where the
 * body is folded over the tips and the fists go down beside the knees —
 * the share of the shoulders' turn they are carried round by, and the
 * pole's lean off the plumb toward the tips, rad (near flat: low, the
 * baskets clear of the snow), and how far it leans out to its side (a share
 * of its drop). */
export const SWITCH_CARRY = {
  out: 0.32,
  up: -0.16,
  fore: 0.14,
  tuckFore: 0.32,
  turn: 0.2,
  lean: 1.15,
  splay: 0.12,
} as const;

/** The legs lengthened through the middle of a revert, m — the skis
 * unloaded as they pivot across the way. */
export const REVERT_RISE = 0.04;

/** THE LOOK THROUGH A REVERT (`SkierState.revert`, `u` of it turning him
 * by `turn` rad, right positive): how far into the look back he still is,
 * 0..1 — the head held on the line he travels as the body comes round under
 * it, once what is left of the turn is within the neck's reach — signed to
 * the side he turns to. */
export function revertLook(u: number, turn: number, share: (u: number) => number): number {
  const left = Math.abs(turn) * (1 - share(u));
  return Math.sign(turn) * Math.min(1, left / SWITCH_LOOK.head);
}

/** THE HOP INTO SWITCH'S LOOK (`Revert.to` "switch", `u` of it turning
 * him by `turn` rad): the head LEADS — round over the shoulder he turns to
 * by `HOP_LEAD` of the turn, the body coming round after it — signed to
 * that shoulder, 0..1. */
export function hopLook(u: number, turn: number, share: (u: number) => number): number {
  return Math.sign(turn) * share(Math.max(0, Math.min(1, u / HOP_LEAD)));
}

/** How far through the hop into switch the head is all the way round. */
export const HOP_LEAD = 0.55;

/** THE WIND-UP before a hop into switch: the shoulders' turn against the
 * way he means to go, rad (some 35° — most of the coach's 45°, the head
 * taking the rest), the head's own on top of it, as a share of the look's
 * `look` units (`switchShape`), and the seconds of the jump's load he is
 * all the way wound up by (a quick dip, never the whole of a held jump). */
export const WIND_UP = { twist: 0.6, look: 0.5, full: 0.3 } as const;

/** How far the legs are lengthened at `u` of a revert, m. */
export function revertRise(u: number): number {
  return REVERT_RISE * Math.sin(Math.PI * Math.max(0, Math.min(1, u)));
}

export type SwitchShape = {
  /** How far into the look back he is, 0..1. */
  w: number;
  /** Added to the pose's `look` (whose head yaw is half of it). */
  look: number;
  twist: number;
  hips: number;
  sink: number;
  /** The tuck he is in, 0..1 — where his fists go. */
  crouch: number;
};

/** The look back as the pose lays it on, for `switched` −1..1 — how far
 * into it, signed to the shoulder: positive toward the body frame's +x,
 * the side the hips hang to for a positive `hipRight` — how far he is in
 * the air (0..1): a flight is ridden square, the head coming back round —
 * the tuck he is in, and how far he is WOUND UP against a hop into switch
 * (−1..1, signed to the side he means to turn to: the shoulders and the
 * head turned the other way, `WIND_UP`). */
export function switchShape(
  switched: number | undefined,
  air: number,
  crouch = 0,
  windUp = 0,
): SwitchShape {
  const k = Math.max(-1, Math.min(1, switched ?? 0)) * (1 - air);
  const w = Math.abs(k);
  const wind = Math.max(-1, Math.min(1, windUp));
  return {
    w,
    look: 2 * SWITCH_LOOK.head * k - WIND_UP.look * wind,
    twist: SWITCH_LOOK.twist * k - WIND_UP.twist * wind,
    hips: SWITCH_LOOK.hips * k,
    sink: SWITCH_LOOK.sink * w,
    crouch,
  };
}

type P3 = { x: number; y: number; z: number };

/** `v` (x, z) turned about the upright by `a` rad — the way the shoulders'
 * twist and the head's look turn, +z toward +x. */
function turned(v: P3, a: number): P3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

/** A fist carried switch: blended from where the rest of the pose has it
 * to low by his side, off the hips, carried round a share of the
 * shoulders' turn. */
export function switchHand(h: P3, hips: P3, side: number, sw: SwitchShape): P3 {
  if (sw.w === 0) return h;
  const C = SWITCH_CARRY;
  const fore = C.fore + C.tuckFore * sw.crouch;
  const off = turned({ x: side * C.out, y: C.up, z: fore }, C.turn * sw.twist);
  const to = { x: hips.x + off.x, y: hips.y + off.y, z: hips.z + off.z };
  return {
    x: h.x + (to.x - h.x) * sw.w,
    y: h.y + (to.y - h.y) * sw.w,
    z: h.z + (to.z - h.z) * sw.w,
  };
}

/** A pole's hang carried switch: blended from the pose's own to low and
 * back toward his tips, a little out to its side (unit). */
export function switchPole(dir: P3, side: number, sw: SwitchShape): P3 {
  if (sw.w === 0) return dir;
  const C = SWITCH_CARRY;
  const back = turned(
    { x: side * C.splay, y: -Math.cos(C.lean), z: Math.sin(C.lean) },
    C.turn * sw.twist,
  );
  const v = {
    x: dir.x + (back.x - dir.x) * sw.w,
    y: dir.y + (back.y - dir.y) * sw.w,
    z: dir.z + (back.z - dir.z) * sw.w,
  };
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}
