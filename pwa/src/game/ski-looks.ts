// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS AS TRACED — each class of ski's silhouette, taken off a studio
// photograph of a real pair of that class seen square from the side and
// from above, traced, and stated as SHARES of the ski's length so one trace
// fits every length the class is sold in. No make or model is kept: what
// is kept is the SHAPE of the class, in metres and in shares.
//
//   tip      the shovel: how far back from the tip the base leaves the snow
//            (a share of the length) and how high the tip stands, m — a
//            downhill ski's is long and low, a powder ski's early and high
//   tail     the same at the tail: a race ski's is flat and square, a park
//            ski's a second tip (`twin`)
//   point    how pointed the tip is in plan, 0 round … 1 a spear
//   thick    the ski's thickness under the boot and at its ends, m
//   camber   how high the middle of an unweighted ski stands off the
//            floor, m — a rockered ski's is nothing or less
//   binding  the toe and heel's length along the ski, how high the boot's
//            sole stands over the topsheet (a race plate lifts it), and
//            whether a plate rides under it
//   boot     the shell's length, the cuff's height over the sole
//   pole     the poles: their length, m, the basket's radius, and whether
//            they are BENT to hug a tuck (a downhill pole)
//
// `lookFrame` carries the ski's own frame (z along the ski from its tail,
// y up from the base) onto a pair's body frame (`defs/skis.ts`: x right,
// y up, z forward, the origin at the centre of gravity of skier and skis):
// the base on the snow at `-cogHeight`, the boot's centre `bootOffset`
// ahead of the ski's middle and under the body's origin — so a drawn ski
// stands where the physics' three stations stand. There is nothing to
// stretch: the trace is stated in shares of the very length the spec
// gives, so the map is a shift and `stretch` is 1 by construction
// (`tests/topsheet_test.ts` holds it).
//
// Three-free: the builders (`skis-body.ts`, `ski-gear.ts`) read it, the
// Blender builder is handed it, and the suite holds every class's trace to
// its spec.

import { bootOffset, type SkiId, type SkiSpec } from "@engine";

export type SkiLook = {
  tip: { rise: number; length: number };
  tail: { rise: number; length: number; twin: boolean };
  point: number;
  thick: { boot: number; end: number };
  camber: number;
  binding: { length: number; height: number; plate: boolean };
  boot: { length: number; height: number };
  pole: { length: number; basket: number; bent: boolean };
};

/** A recreational binding and boot — what every class but the racers
 * carries. */
const TRAIL_BINDING = { length: 0.34, height: 0.035, plate: false };
const RACE_BINDING = { length: 0.36, height: 0.055, plate: true };
const BOOT = { length: 0.32, height: 0.27 };

export const SKI_LOOKS: Record<SkiId, SkiLook> = {
  // THE ALL-MOUNTAIN SKI: a moderate shovel with a little early rise, a
  // flat tail with the corners rounded, a full camber under the boot.
  chamois: {
    tip: { rise: 0.055, length: 0.2 },
    tail: { rise: 0.012, length: 0.06, twin: false },
    point: 0.4,
    thick: { boot: 0.022, end: 0.008 },
    camber: 0.012,
    binding: TRAIL_BINDING,
    boot: BOOT,
    pole: { length: 1.2, basket: 0.045, bent: false },
  },
  // THE SLALOM SKI: short, a low quick shovel, a square tail, stiff camber,
  // on a race plate; the poles carry guards for the gates' poles.
  swift: {
    tip: { rise: 0.045, length: 0.16 },
    tail: { rise: 0.006, length: 0.04, twin: false },
    point: 0.55,
    thick: { boot: 0.024, end: 0.009 },
    camber: 0.014,
    binding: RACE_BINDING,
    boot: BOOT,
    pole: { length: 1.2, basket: 0.04, bent: false },
  },
  // THE GIANT SLALOM SKI: long and narrow, a low pointed tip, the tail
  // flat and square, a hard camber on a plate.
  chough: {
    tip: { rise: 0.045, length: 0.18 },
    tail: { rise: 0.006, length: 0.04, twin: false },
    point: 0.6,
    thick: { boot: 0.024, end: 0.009 },
    camber: 0.015,
    binding: RACE_BINDING,
    boot: BOOT,
    pole: { length: 1.25, basket: 0.04, bent: false },
  },
  // THE SUPER-G SKI: a short, low shovel (the rule asks 30 mm of tip
  // rise of a speed ski, 50 of a giant slalom ski) whose widest point
  // stands close to the tip, so the sidecut runs nearly the whole ski; a
  // square tail, a hard camber on a plate; the speed events' bent poles,
  // a little shorter than a downhill's.
  falcon: {
    tip: { rise: 0.038, length: 0.08 },
    tail: { rise: 0.005, length: 0.04, twin: false },
    point: 0.58,
    thick: { boot: 0.025, end: 0.0095 },
    camber: 0.014,
    binding: RACE_BINDING,
    boot: BOOT,
    pole: { length: 1.28, basket: 0.04, bent: true },
  },
  // THE DOWNHILL SKI: the longest here, a low long shovel, a square tail,
  // on a plate; the poles bent round the body for the tuck.
  eagle: {
    tip: { rise: 0.04, length: 0.22 },
    tail: { rise: 0.005, length: 0.04, twin: false },
    point: 0.55,
    thick: { boot: 0.026, end: 0.01 },
    camber: 0.012,
    binding: RACE_BINDING,
    boot: BOOT,
    pole: { length: 1.3, basket: 0.04, bent: true },
  },
  // THE SKI-CROSS SKI: a giant slalom ski's shape cut down — a shorter,
  // a little higher shovel for the rollers and the landings, a little rise
  // at the tail, a hard camber on a plate as high as the rule's 50 mm
  // allows; the race poles straight, for the start's pull and the skating.
  wolverine: {
    tip: { rise: 0.05, length: 0.14 },
    tail: { rise: 0.012, length: 0.05, twin: false },
    point: 0.55,
    thick: { boot: 0.024, end: 0.009 },
    camber: 0.013,
    binding: { length: 0.36, height: 0.05, plate: true },
    boot: BOOT,
    pole: { length: 1.22, basket: 0.04, bent: false },
  },
  // THE SPEED SKI: the longest by far, a long low shovel and a square
  // tail, thick and heavy through its length to damp it, nearly flat
  // under the boot; its binding raised no more than the rule's 2.5 cm and
  // on no plate; the poles bent round the body and short — the rule's
  // least is a metre.
  peregrine: {
    tip: { rise: 0.045, length: 0.16 },
    tail: { rise: 0.005, length: 0.04, twin: false },
    point: 0.5,
    thick: { boot: 0.03, end: 0.013 },
    camber: 0.006,
    binding: { length: 0.36, height: 0.025, plate: false },
    boot: BOOT,
    pole: { length: 1.1, basket: 0.035, bent: true },
  },
  // THE POWDER SKI: a big round shovel rising early and high, a rockered
  // tail lifted a little too, no camber to speak of, wide baskets.
  marmot: {
    tip: { rise: 0.09, length: 0.34 },
    tail: { rise: 0.03, length: 0.16, twin: false },
    point: 0.15,
    thick: { boot: 0.02, end: 0.008 },
    camber: 0.002,
    binding: TRAIL_BINDING,
    boot: BOOT,
    pole: { length: 1.2, basket: 0.07, bent: false },
  },
  // THE PARK SKI: a twin-tip, both ends rising alike and round, flat and
  // soft, mounted on its centre.
  hare: {
    tip: { rise: 0.065, length: 0.22 },
    tail: { rise: 0.06, length: 0.2, twin: true },
    point: 0.2,
    thick: { boot: 0.02, end: 0.008 },
    camber: 0.006,
    binding: TRAIL_BINDING,
    boot: BOOT,
    pole: { length: 1.15, basket: 0.045, bent: false },
  },
  // THE BIG-AIR SKI: the park ski's twin tips, a little longer and lower,
  // thicker under the boot for its stiffness, a touch more camber to pop
  // off the lip, on a recreational binding with the park's short poles.
  raven: {
    tip: { rise: 0.06, length: 0.2 },
    tail: { rise: 0.055, length: 0.18, twin: true },
    point: 0.22,
    thick: { boot: 0.022, end: 0.009 },
    camber: 0.008,
    binding: TRAIL_BINDING,
    boot: BOOT,
    pole: { length: 1.15, basket: 0.045, bent: false },
  },
  // THE MOGUL SKI: short, a round soft shovel with an early rise to fold
  // over a crest, a low kicked tail, thin and light, a full camber, on a
  // low race plate; the short poles a mogul skier plants every turn.
  ibex: {
    tip: { rise: 0.05, length: 0.17 },
    tail: { rise: 0.018, length: 0.07, twin: false },
    point: 0.35,
    thick: { boot: 0.021, end: 0.008 },
    camber: 0.012,
    binding: RACE_BINDING,
    boot: BOOT,
    pole: { length: 1.12, basket: 0.04, bent: false },
  },
  // THE AERIALS SKI: short and narrow, a low round shovel, a flat tail with
  // the least kick, thin and light (carbon), a little camber, on a low race
  // plate; aerials are jumped without poles, the pair's are short.
  kestrel: {
    tip: { rise: 0.045, length: 0.15 },
    tail: { rise: 0.012, length: 0.06, twin: false },
    point: 0.35,
    thick: { boot: 0.019, end: 0.007 },
    camber: 0.008,
    binding: RACE_BINDING,
    boot: BOOT,
    pole: { length: 1.1, basket: 0.04, bent: false },
  },
};

/** The look for a pair, its class's. */
export function lookOf(spec: SkiSpec): SkiLook {
  return SKI_LOOKS[spec.id];
}

/**
 * THE SKI'S OWN FRAME ONTO THE BODY FRAME. `z(s)` takes a station along
 * the ski, m from its tail, to the body's z; `y(h)` a height over the base
 * to the body's y; `point` both at once. `tail` and `tip` are where the
 * ski's ends stand in the body frame, and `boot` the boot's centre —
 * `bootOffset` ahead of the ski's middle, under the body's origin.
 */
export function lookFrame(
  spec: SkiSpec,
  look: SkiLook = SKI_LOOKS[spec.id],
): {
  z: (s: number) => number;
  y: (h: number) => number;
  point: (p: readonly [number, number]) => [number, number];
  tail: number;
  tip: number;
  boot: number;
  stretch: number;
  look: SkiLook;
} {
  const tail = -bootOffset(spec) - spec.length / 2;
  const ground = -spec.cogHeight;
  const z = (s: number): number => tail + s;
  const y = (h: number): number => ground + h;
  return {
    z,
    y,
    point: ([s, h]) => [z(s), y(h)],
    tail,
    tip: tail + spec.length,
    boot: 0,
    stretch: 1,
    look,
  };
}

/**
 * THE SKI'S SIDE PROFILE: the base's height over the snow at `s` m from
 * the tail — flat between the shovel and the tail's rise, the tip lifted
 * over its `tip.length` on a curve that stands up harder at the very end,
 * the tail the same the other way, and the camber's arch between them
 * (only what the rocker leaves: a rockered ski's camber is drawn away).
 */
export function baseHeight(spec: SkiSpec, look: SkiLook, s: number): number {
  const L = spec.length;
  const u = Math.min(1, Math.max(0, s / L));
  const tipFrom = 1 - look.tip.length;
  const tailTo = look.tail.length;
  let h = 0;
  if (u > tipFrom) {
    const k = (u - tipFrom) / look.tip.length;
    h = look.tip.rise * (k * k * (0.55 + 0.45 * k));
  } else if (u < tailTo) {
    const k = (tailTo - u) / tailTo;
    h = look.tail.rise * (k * k * (0.55 + 0.45 * k));
  }
  const arch = Math.sin(Math.PI * Math.min(1, Math.max(0, (u - tailTo) / (tipFrom - tailTo))));
  return h + look.camber * (1 - spec.rocker) * arch;
}

/**
 * THE SKI'S PLAN: its half-width at `s` m from the tail — the sidecut's
 * arc from the tail's width through the waist under the boot to the tip's
 * widest, then the tip drawn in to its point over the shovel. A ski's
 * widest is a hand back from the very tip; the tail's corners are rounded
 * off over their last few centimetres.
 */
export function halfWidth(spec: SkiSpec, look: SkiLook, s: number): number {
  const L = spec.length;
  const u = Math.min(1, Math.max(0, s / L));
  const boot = 0.5 + bootOffset(spec) / L;
  const tipWide = 1 - look.tip.length * 0.55;
  const tailWide = look.tail.length * 0.45;
  let w: number;
  if (u >= tipWide) {
    // The shovel drawn in to its point: round at 0, a spear at 1.
    const k = (u - tipWide) / (1 - tipWide);
    const p = 1.2 + 2.5 * (1 - look.point);
    w = (spec.tipWidth / 2) * Math.max(0, 1 - k ** p) ** (0.5 + 0.5 * look.point);
    w = Math.max(w, 0.006 * (1 - k));
  } else if (u <= tailWide) {
    const k = tailWide > 0 ? (tailWide - u) / tailWide : 1;
    const square = look.tail.twin ? 0.2 : 0.75;
    w = (spec.tailWidth / 2) * (square + (1 - square) * Math.sqrt(Math.max(0, 1 - k * k)));
  } else if (u >= boot) {
    // The sidecut ahead of the boot: waist to tip on a cosine arc.
    const k = (u - boot) / (tipWide - boot);
    w = spec.waist / 2 + ((spec.tipWidth - spec.waist) / 2) * (0.5 - 0.5 * Math.cos(Math.PI * k));
  } else {
    const k = (boot - u) / (boot - tailWide);
    w = spec.waist / 2 + ((spec.tailWidth - spec.waist) / 2) * (0.5 - 0.5 * Math.cos(Math.PI * k));
  }
  return w;
}

/** The ski's thickness at `s` m from the tail, m: thickest under the boot,
 * thinning to the ends. */
export function thickness(spec: SkiSpec, look: SkiLook, s: number): number {
  const L = spec.length;
  const u = Math.min(1, Math.max(0, s / L));
  const boot = 0.5 + bootOffset(spec) / L;
  const d = Math.abs(u - boot) / 0.5;
  const k = Math.min(1, d);
  return look.thick.end + (look.thick.boot - look.thick.end) * (1 - k * k);
}
