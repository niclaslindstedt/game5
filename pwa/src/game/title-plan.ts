// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TITLE SCENE, DECIDED: every number the title stage moves by, as pure
// functions of the title clock and the screen — what part of the plate a
// screen sees, how the lens drifts and pushes in, where it re-frames when
// the front door opens, how many flakes fall, how far the picture's
// resolution steps down on a slow machine, and the reveal's beats.
//
// The scene is a CINEMAGRAPH: one path-traced plate (`pwa/src/title/`), the
// skier frozen in his carve, and the air, the light and the snow around him
// alive. Everything that moves is a function of `t` (seconds since the
// reveal began) and of nothing stored, which is what lets `?titleT=` freeze
// any frame of it for a lab and lets the shader hash its noise rather than
// draw it from a stream.
//
// DOM-free and three-free, so `tests/title_plan_test.ts` holds it: every
// crop inside the plate at every aspect from a tall phone to an ultrawide,
// the drift inside the crop's margin, the beats in order, and stillness
// under reduced motion.

import type { PlateRect, TitlePlate } from "../title/plates.ts";

/** THE REVEAL, in ms from the moment the scene is let in (`reveal`):
 *
 *   publisherOut  the house's lockup fades off the dark (`title.css`)
 *   exposure      the scene's exposure ramps up from black
 *   logo          the logo's own reveal starts (`title.css`'s five beats)
 *   prompt        the invitation arrives and starts to breathe
 *   pulse         one breath of the invitation, in and out
 *   flash         the invitation flashing white as it is pressed
 *   flip          the logo flown from the title into the front door's header
 *   reframe       the lens easing to its front-door framing */
export const TITLE_BEATS = {
  publisherOut: 300,
  exposure: 1800,
  logo: 900,
  prompt: 2400,
  pulse: 1600,
  flash: 120,
  flip: 520,
  reframe: 1400,
} as const;

/** The plate is cropped this much tighter than its safe rect at rest, so
 * the drift and the parallax always have plate to move into. */
const ZOOM_REST = 1.04;
/** The push-in over the first seconds: from the rest framing to this much
 * tighter, eased out, over `PUSH_S`. */
const PUSH = 1.06;
const PUSH_S = 6;
/** The front door's framing: tighter still, which is the room the subject
 * needs to be slid aside into — right of centre on a wide screen (the
 * column of slabs on the left), and below it on a tall one (the logo
 * above). Shares of the visible frame. */
const ZOOM_MENU = 1.1;
const MENU_SLIDE = { landscape: [0.08, 0], portrait: [0, 0.06] } as const;
/** The drift: a slow Lissajous of the lens, a share of the visible frame —
 * about one per cent of it every ten seconds. */
const DRIFT = { ax: 0.0065, ay: 0.0045, px: 23, py: 31, qx: 41, qy: 53 } as const;

/** A framing: what part of the plate is on screen, and the lens's offset
 * for the depth parallax — in plate UV, positive right and down. */
export type Framing = {
  rect: PlateRect;
  parallax: [number, number];
};

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const smooth = (x: number): number => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
const easeOut = (x: number): number => 1 - (1 - clamp01(x)) ** 3;

/** How far a screen of this aspect (width ÷ height) is from wide to tall:
 * 0 at the landscape crop's aspect or wider, 1 at the portrait crop's or
 * taller, eased between on the log of the aspect. */
export function tallness(aspect: number, plate: TitlePlate): number {
  const wide = plate.crops.landscape[2] / plate.crops.landscape[3];
  const tall = plate.crops.portrait[2] / plate.crops.portrait[3];
  return smooth(Math.log(wide / aspect) / Math.log(wide / tall));
}

/** THE CROP a screen of this aspect is shown: a rect of exactly that aspect
 * that COVERS the screen and stays inside the plate — the landscape safe
 * rect's full width on a wide screen, the portrait one's full height on a
 * tall one, and a crop grown between the two (about both centres) on
 * anything between. The plate is square, so a rect's aspect in plate units
 * is the screen's. */
export function cropFor(aspect: number, plate: TitlePlate): PlateRect {
  const [lx, ly, lw, lh] = plate.crops.landscape;
  const [px, py, pw, ph] = plate.crops.portrait;
  const k = tallness(aspect, plate);
  // The height that shows the landscape rect's whole width at this aspect,
  // grown toward the portrait rect's height; then the most the plate gives.
  const h = Math.min(lerp(Math.min(1, lw / aspect), ph, k), 1, 1 / aspect);
  const w = h * aspect;
  const cx = lerp(lx + lw / 2, px + pw / 2, k);
  const cy = lerp(ly + lh / 2, py + ph / 2, k);
  return fit([cx - w / 2, cy - h / 2, w, h]);
}

/** A rect slid back inside the plate (it is never larger than the plate). */
function fit([x, y, w, h]: PlateRect): PlateRect {
  return [Math.max(0, Math.min(1 - w, x)), Math.max(0, Math.min(1 - h, y)), w, h];
}

/** THE LENS'S DRIFT at a title time: a share of the visible frame, each
 * axis two slow sines out of step, so it never visibly repeats. Nothing
 * under reduced motion. */
export function driftAt(t: number, still = false): [number, number] {
  if (still) return [0, 0];
  const tau = Math.PI * 2;
  return [
    DRIFT.ax * (0.7 * Math.sin((tau * t) / DRIFT.px) + 0.3 * Math.sin((tau * t) / DRIFT.qx + 1.3)),
    DRIFT.ay * (0.7 * Math.sin((tau * t) / DRIFT.py + 0.6) + 0.3 * Math.sin((tau * t) / DRIFT.qy)),
  ];
}

/** The zoom over the plate's crop at a title time and a share of the way
 * into the front door's framing: the rest, the push-in, the menu's. */
export function zoomAt(t: number, menu: number, still = false): number {
  const push = still ? PUSH : lerp(1, PUSH, easeOut(t / PUSH_S));
  return ZOOM_REST * push * lerp(1, ZOOM_MENU, smooth(menu));
}

/**
 * THE FRAMING at title time `t` on a screen of `aspect`, `menu` of the way
 * (0..1) into the front door's framing, with the pointer (−1..1 each way,
 * or zero) leaning the lens: the visible rect of the plate, and the
 * parallax offset the shader slides the near snow by against the far
 * ridges. The subject stays put under the parallax — the lens orbits him.
 */
export function framingAt(
  t: number,
  aspect: number,
  plate: TitlePlate,
  menu = 0,
  pointer: readonly [number, number] = [0, 0],
  still = false,
): Framing {
  const crop = cropFor(aspect, plate);
  const z = zoomAt(t, menu, still);
  const w = crop[2] / z;
  const h = crop[3] / z;
  const k = tallness(aspect, plate);
  // At rest the frame is centred on the crop; in the menu it is set so the
  // subject sits slid aside by the share the door's layout wants.
  const slide = [
    lerp(MENU_SLIDE.landscape[0], MENU_SLIDE.portrait[0], k),
    lerp(MENU_SLIDE.landscape[1], MENU_SLIDE.portrait[1], k),
  ];
  const m = smooth(menu);
  const restX = crop[0] + crop[2] / 2;
  const restY = crop[1] + crop[3] / 2;
  const [sx, sy] = plate.subject;
  const cx = lerp(restX, sx - slide[0] * w, m);
  const cy = lerp(restY, sy - slide[1] * h, m);
  const [dx, dy] = driftAt(t, still);
  const lean = still ? [0, 0] : pointer;
  const rect = fit([cx - w / 2 + dx * w, cy - h / 2 + dy * h, w, h]);
  return {
    rect,
    // The lens's own travel (the drift) and the pointer's lean, as plate UV:
    // the shader multiplies it by how much nearer than the subject a pixel is.
    parallax: [(dx * 0.7 + lean[0] * 0.005) * w, (dy * 0.7 + lean[1] * 0.0035) * h],
  };
}

/** The exposure at a title time: black until the reveal, up over its beat.
 * Under reduced motion the same fade — a crossfade is not travel. */
export function exposureAt(t: number): number {
  return smooth(t / (TITLE_BEATS.exposure / 1000));
}

/** The resolution steps, the most first: a share of the screen's pixels the
 * scene is drawn at, stepped down when a machine cannot hold it. */
export const RENDER_SCALES = [1, 0.75, 0.5] as const;
/** The device pixel ratio is capped here before the scale applies: past it
 * the plate itself has no more to give. */
export const DPR_CAP = 1.5;
/** A frame slower than this counts against the step, ms... */
export const SLOW_FRAME_MS = 20;
/** ...and this many in a row drop it one. */
export const SLOW_FRAMES = 30;

/** The canvas's pixel ratio at a scale step. */
export function pixelRatio(dpr: number, step: number): number {
  const scale = RENDER_SCALES[Math.max(0, Math.min(RENDER_SCALES.length - 1, step))];
  return Math.min(Math.max(1, dpr || 1), DPR_CAP) * scale;
}

/** One frame's say in the scale: the step and the run of slow frames after
 * a frame of `frameMs`. Never steps back up within a visit — a machine
 * that could not hold it once will not hold it the next minute either, and
 * a picture that keeps changing its sharpness reads as a fault. */
export function scaleAfter(
  step: number,
  slow: number,
  frameMs: number,
): { step: number; slow: number } {
  if (frameMs <= SLOW_FRAME_MS) return { step, slow: 0 };
  if (slow + 1 < SLOW_FRAMES || step >= RENDER_SCALES.length - 1) return { step, slow: slow + 1 };
  return { step: step + 1, slow: 0 };
}

/** How many particles a screen of this size gets: the falling snow in its
 * three layers (far, middle, near) and the grains breathing off the
 * spray. Scaled by the screen's area about a desktop's, so a phone is
 * not crowded, and none at all under reduced motion. */
export function particleCounts(
  width: number,
  height: number,
  still = false,
): { snow: [number, number, number]; spray: number } {
  if (still) return { snow: [0, 0, 0], spray: 0 };
  const k = Math.max(0.5, Math.min(1.2, Math.sqrt((width * height) / (1280 * 720))));
  const n = (base: number): number => Math.round(base * k);
  return { snow: [n(150), n(90), n(40)], spray: n(44) };
}
