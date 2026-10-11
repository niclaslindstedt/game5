// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CHALLENGES ON THE MINIMAP, PAINTED — the marks `challenge-hud.ts`
// decides, laid on the plate's canvas in world metres under its pose
// (`minimap.tsx`): every timed line's two gates as a pair of flags (a
// start's in white, a finish's in the gate red, the running line's finish
// in gold and larger), every trick kicker a five-pointed star in the medal
// held there, every lift top not yet stood on a hollow triangle, and every
// hidden spot found a small dot. A spot not found is never drawn.
//
// Every mark is sized like the field's dots — a fixed size on the plate
// whatever the zoom — and the star and the triangle are turned back against
// the map's turn, so they stand upright however the skier is facing.

import type { ChallengeMarks } from "./challenge-hud.ts";
import { MEDAL_LOOK } from "./medal-look.ts";

const LOOK = {
  start: "#ffffff",
  finish: "#e8412c",
  edge: "rgba(0, 0, 0, 0.7)",
  summit: "#ffffff",
  spot: "#7fe0ff",
  /** An unmedalled kicker's star. */
  star: "#ffffff",
} as const;

/** Paint `marks` on `ctx` (posed in world metres): `dot` is a field dot's
 * radius in metres at this zoom, `css` one CSS pixel in metres, and
 * `angle` the map's turn, degrees. */
export function paintChallenges(
  ctx: CanvasRenderingContext2D,
  marks: ChallengeMarks,
  dot: number,
  css: number,
  angle: number,
): void {
  const back = (-angle * Math.PI) / 180;
  ctx.save();
  ctx.lineWidth = 1 * css;
  ctx.strokeStyle = LOOK.edge;
  // THE GATES: a flag at each edge of the run, the pair joined by a hair.
  for (const g of marks.gates) {
    const r = dot * (g.live ? 0.75 : 0.5);
    const paint = g.live ? MEDAL_LOOK.gold.ink : g.role === "start" ? LOOK.start : LOOK.finish;
    ctx.globalAlpha = g.live ? 1 : 0.9;
    ctx.beginPath();
    ctx.moveTo(g.left[0], g.left[1]);
    ctx.lineTo(g.right[0], g.right[1]);
    ctx.strokeStyle = paint;
    ctx.lineWidth = (g.live ? 1.4 : 0.8) * css;
    ctx.stroke();
    ctx.lineWidth = 1 * css;
    ctx.strokeStyle = LOOK.edge;
    ctx.fillStyle = paint;
    for (const [x, z] of [g.left, g.right]) {
      ctx.beginPath();
      ctx.rect(x - r, z - r, 2 * r, 2 * r);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // THE KICKERS: a star, in the medal held there.
  for (const k of marks.kickers) {
    ctx.save();
    ctx.translate(k.x, k.z);
    ctx.rotate(back);
    star(ctx, dot * 1.25);
    ctx.fillStyle = k.medal ? MEDAL_LOOK[k.medal].deep : LOOK.star;
    ctx.fill();
    ctx.strokeStyle = LOOK.edge;
    ctx.stroke();
    ctx.restore();
  }
  // THE SUMMITS still to stand on: a hollow triangle, point up.
  ctx.lineWidth = 1.4 * css;
  for (const s of marks.summits) {
    ctx.save();
    ctx.translate(s.x, s.z);
    ctx.rotate(back);
    const r = dot * 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.9, r * 0.6);
    ctx.lineTo(-r * 0.9, r * 0.6);
    ctx.closePath();
    ctx.strokeStyle = LOOK.edge;
    ctx.lineWidth = 2.6 * css;
    ctx.stroke();
    ctx.strokeStyle = LOOK.summit;
    ctx.lineWidth = 1.3 * css;
    ctx.stroke();
    ctx.restore();
  }
  // THE HIDDEN SPOTS found.
  ctx.lineWidth = 1 * css;
  ctx.fillStyle = LOOK.spot;
  ctx.strokeStyle = LOOK.edge;
  for (const s of marks.spots) {
    ctx.beginPath();
    ctx.arc(s.x, s.z, dot * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** A five-pointed star of outer radius `r` about the origin, point up. */
function star(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const k = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) ctx.moveTo(Math.cos(a) * k, Math.sin(a) * k);
    else ctx.lineTo(Math.cos(a) * k, Math.sin(a) * k);
  }
  ctx.closePath();
}
