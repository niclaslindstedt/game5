// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW A ROTOR LOOKS AS IT TURNS (three-free): what an eye — or the camera a
// game is watched as if through — makes of blades turning faster than it
// can follow, worked out a frame at a time for `heli-view.ts` to draw.
//
// Three things happen as a rotor spools up, and each is a number here:
//
//   * THE SMEAR. Each picture is gathered over an exposure, and a blade
//     sweeps `smear = ω × EXPOSURE` radians while it is. At a crawl that is
//     less than the blade's own width and the blade is sharp; by a few
//     radians a second it is a wedge, its darkness spread across the wedge
//     (the same ink over more disc), so the blades THIN AWAY as they come up.
//     Photographers of helicopters find a whole disc at 1/10–1/40 s and
//     blades "blurred, but still distinctively, individually, visible" at
//     1/80 s; at 1/30 s this rotor's 390 rpm smears each blade over about
//     two thirds of the gap to the next, so the disc is a faint haze with
//     pale wedges in it rather than a solid sheet.
//   * THE STROBE. Pictures come at a rate, and a rotor of `n` blades looks
//     the same every 2π/n. Where it turns most of that between two pictures,
//     the nearest reading is that it turned BACK a little (the wagon-wheel
//     effect): the pattern drawn is the true turn folded into ±π/n a
//     picture. STROBE is set just under this rotor's blade-pass rate at full
//     rpm (19.5 a second), so a rotor at speed creeps slowly backwards, as
//     it does on film — and, spooling up, runs forward, dissolves, then
//     comes back the other way, fast at first and slowing.
//   * THE DISSOLVE. Where a picture's turn is near half a blade-gap, the
//     forward and the backward readings are equally near and the eye gets
//     neither: the pattern dissolves into an even haze (`contrast` → 0) and
//     re-forms on the far side, so the turn's reversal is never a jump.
//
// The blades themselves (the model's meshes) are drawn while they are still
// sharp and handed over to the drawn smear as they blur (`blades` / `disc`).
//
// IN SLOW MOTION (the replay's, the X-ray's, the shred cam's) the eye is a
// high-speed camera: the rotor it sees turns at its true rate times the
// PACE (game seconds a wall second), so slowed far enough the smear thins
// to nothing and the blades come out one by one, sweeping round.

/** How long one picture is gathered over, s. */
export const EXPOSURE = 1 / 30;
/** Pictures a second — just under the main rotor's blade-pass rate at full
 * rpm, so a rotor at speed creeps backwards. */
export const STROBE = 20.25;
/** The smear, in blade widths, over which the model's blades hand over to
 * the drawn smear. */
const HAND_OVER = [1.2, 3.5] as const;
/** Where a picture's turn, as a share of half a blade-gap, dissolves the
 * pattern: from the first to fully gone at the second. */
const DISSOLVE = [0.72, 0.97] as const;

/** A rotor as the eye is handed it. */
export type RotorSpec = {
  /** Blades. */
  blades: number;
  /** Full speed, rpm. */
  rpm: number;
  /** A blade's width as seen from the hub, rad — its chord over the radius
   * the eye reads it at. */
  width: number;
};

/** A rotor as seen this frame. */
export type RotorLook = {
  /** The turn the pattern is drawn at, rad — the strobed one, not the
   * true one. */
  phase: number;
  /** The arc a blade smears over in one picture, rad. */
  smear: number;
  /** How solid the model's blades are drawn, 0..1. */
  blades: number;
  /** How strongly the drawn smear is drawn, 0..1 (the hand-over's other
   * half). */
  disc: number;
  /** The pattern's contrast against an even haze, 0..1. */
  contrast: number;
};

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The true turn a picture, folded into ±π/blades: what the eye reads. */
export function strobedTurn(omega: number, blades: number, strobe = STROBE): number {
  const gap = (2 * Math.PI) / blades;
  const turn = omega / strobe;
  return turn - gap * Math.round(turn / gap);
}

/** The pattern's apparent rate, rad/s — the true one below the strobe's
 * fold, backwards past it. */
export function apparentRate(omega: number, blades: number, strobe = STROBE): number {
  return strobedTurn(omega, blades, strobe) * strobe;
}

/** The look of a rotor turning at `omega`, rad/s, with its pattern at
 * `phase` (rad). */
export function lookAt(spec: RotorSpec, omega: number, phase: number): RotorLook {
  const smear = Math.abs(omega) * EXPOSURE;
  const hand = smoothstep(HAND_OVER[0], HAND_OVER[1], smear / spec.width);
  const fold = Math.abs(strobedTurn(omega, spec.blades)) / (Math.PI / spec.blades);
  return {
    phase,
    smear,
    blades: 1 - hand,
    disc: hand,
    contrast: 1 - smoothstep(DISSOLVE[0], DISSOLVE[1], fold),
  };
}

/** An eye on one rotor: stepped a frame at a time with the rotor's spool
 * (0..1 of full rpm), `dt` game seconds on at `pace` game seconds a wall
 * second, it carries the strobed pattern's turn. */
export function createRotorEye(spec: RotorSpec): {
  step(spool: number, dt: number, pace?: number): RotorLook;
} {
  const full = (spec.rpm / 60) * 2 * Math.PI;
  const gap = (2 * Math.PI) / spec.blades;
  let phase = 0;
  return {
    step(spool, dt, pace = 1) {
      // The turn as the eye sees it, on the wall's clock.
      const k = Math.max(1e-3, pace);
      const omega = full * spool * k;
      // Kept within a blade-gap: the pattern repeats every gap, so this is
      // the same picture with no float lost to a long run.
      phase = (phase + apparentRate(omega, spec.blades) * (dt / k)) % gap;
      return lookAt(spec, omega, phase);
    },
  };
}
