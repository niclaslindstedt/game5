// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE THUMBS SHOW — DOM-free, so the suite reads it
// (`tests/thumb_glyphs_test.ts`); drawn by `hud-touch.tsx`.
//
// The edge thumb draws what the player steers, seen from above and turned
// with the edge: the PAIR OF SKIS on the snow — but no skis go with him in
// a WINGSUIT, so there it is the SUIT's planform (the head, the two arm
// wings out to the hands and the leg wing between the feet), under a
// canopy the CANOPY over him, and down on his boots the BOOTS he walks on.
// And flying the suit the lever's knob is the suit again, its arm wings
// swept back to the hips at a full tuck and spread wide on the back key, so
// the thumb sees the shape it is asking the suit for.
//
// The drawings are in the edge thumb's hundred-unit box (`.hud-bar-svg`),
// centred on (50, 50), forward UP the glass.

import type { GameState } from "@engine";

/** What the edge thumb draws under the finger. */
export type PadGlyph = "skis" | "suit" | "canopy" | "boots" | "bike";

/** The edge thumb's drawing for the player at this step: the skis unless he
 * is in a wingsuit (the suit; stood on its exit too), under a canopy of any
 * jump (opening or open), or down out of a wingsuit on his boots — and on
 * a summer ride the downhill bike's handlebar while he rides it, his boots
 * while he walks beside it. */
export function padGlyphOf(state: GameState): PadGlyph {
  const b = state.bike;
  if (b && !state.skier.thrown && !state.skier.lift) {
    if (b.onIt) return "bike";
    if (b.afoot) return "boots";
  }
  const ch = state.chute;
  if (!ch || ch.done || ch.fell || state.skier.thrown) return "skis";
  if (ch.mode === "deploying" || ch.mode === "open" || ch.mode === "snagged") return "canopy";
  if (ch.suit !== "wingsuit") return "skis";
  return ch.mode === "landed" ? "boots" : "suit";
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const f = (v: number): string => (Math.round(v * 10) / 10).toString();

/** The arm wing's hand, half-span from the spine and down the glass, at
 * the suit flown NEUTRAL, SWEPT (the arms back to the hips: the dive) and
 * SPREAD (the arms full and pushed forward: the flare). A large suit's
 * measure on the box's scale — 1.7 m of span over a 1.8 m flyer, a root
 * chord near a metre and a 0.3 m tip (`wingsuit-look.ts`'s `suitMeasures`). */
const HAND = {
  neutral: { x: 31, y: 34 },
  swept: { x: 17, y: 46 },
  spread: { x: 34, y: 29 },
} as const;
/** The wing's tip chord, units, and the shoulder and hip it is sewn to. */
const TIP = 10;
const SHOULDER = { x: 6, y: 27 };
const HIP = { x: 7, y: 57 };
/** The leg wing's tips at the feet and the notch between them. */
const FOOT = { x: 13, y: 84 };
const NOTCH = 78;

/** THE SUIT'S PLANFORM, seen from above, as one SVG outline — the neck,
 * each arm wing out to its hand and back to the hip, the leg wing out to
 * the feet with its trailing edge notched between them — at `spread` −1
 * (swept) … 0 … +1 (spread). The helmet is drawn over the neck apart. */
export function suitPlanform(spread: number): string {
  const s = Math.max(-1, Math.min(1, spread));
  const to = s < 0 ? HAND.swept : HAND.spread;
  const k = Math.abs(s);
  const hx = lerp(HAND.neutral.x, to.x, k);
  const hy = lerp(HAND.neutral.y, to.y, k);
  // The tip's chord shortens as the arm folds back along the body.
  const tip = TIP * (s < 0 ? 1 - 0.4 * k : 1);
  const p = (side: 1 | -1, dx: number, y: number): string => `${f(50 + side * dx)} ${f(y)}`;
  // The trailing edge scalloped in between the hand and the hip, as the
  // cloth pulls taut.
  const bow = (side: 1 | -1): string => p(side, (hx + HIP.x) / 2 + 3, (hy + tip + HIP.y) / 2 - 5);
  return (
    `M${p(1, 3, 24)}L${p(1, SHOULDER.x, SHOULDER.y)}L${p(1, hx, hy)}` +
    `L${p(1, hx - 3, hy + tip)}Q${bow(1)} ${p(1, HIP.x, HIP.y)}` +
    `L${p(1, FOOT.x, FOOT.y)}L${p(1, 0, NOTCH)}L${p(-1, FOOT.x, FOOT.y)}` +
    `L${p(-1, HIP.x, HIP.y)}Q${bow(-1)} ${p(-1, hx - 3, hy + tip)}` +
    `L${p(-1, hx, hy)}L${p(-1, SHOULDER.x, SHOULDER.y)}L${p(-1, 3, 24)}Z`
  );
}

/** The lever's suit: how far the arms are swept (−) or spread (+) by the
 * tuck and the back key the lever is asking for. */
export function leverSpread(tuck: number, brake: number): number {
  return brake > 0 ? Math.min(1, brake) : -Math.min(1, Math.max(0, tuck));
}
