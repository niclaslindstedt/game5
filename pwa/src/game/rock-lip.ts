// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SNOW MEETS THE ROCK — the edge of the ground's bare rock (the
// region's `rock`: a face too steep to hold snow, `snow-glsl.ts`'s
// `snowRock`) drawn as snow and stone really meet, not as a soft fade of
// one colour into the other:
//
//   * THE LIP: snow does not stop where the slope passes what it can hold.
//     Wind carries it over the brink and it builds out past it as a rounded
//     pillow, a breaking wave in profile — so at a rock band's TOP the snow
//     reaches a metre or two DOWN over the stone (`LIP`, broken along the
//     edge by `LIP_VARY`), its nose rolled over and bright.
//   * THE SHADE UNDER IT: the stone right below the lip is in its shadow
//     and sees half the sky (`SHADE`), a cool dark band that is what makes
//     the overhang read as one from across a run.
//   * THE FOOT: at a band's BOTTOM the snow that slid and drifted off it
//     lies banked up against the stone (`FOOT`).
//   * A CRISP, BROKEN EDGE: snow either holds on a patch or it does not,
//     so the share is cut sharp (`EDGE`) along a line jittered by the snow
//     lying in every hollow (`JITTER`), and lodged in RUNNELS down the fall
//     line of the stone (`RUNNEL`).
//
// Stated once here, three ways: the GLSL the ground's shader calls, the
// same in plain numbers for what is laid on the snow (`bare-rock.ts`: a
// trail, the spray, a rider's sink skip the rock and take the lip, which is
// snow), and the node twin's in `rock-lip-tsl.ts`. Three-free and DOM-free.

/** m: how far the lip reaches down over a rock band's top, on the mean. */
export const LIP = 2.2;
/** The lip's reach along the edge, of `LIP`: the least and the most. */
export const LIP_VARY = [0.4, 1.6] as const;
/** m: the band of stone under the lip in its shade, and its darkest core
 * right under the nose. */
export const SHADE = 1.6;
export const CORE = 0.5;
/** m: how far the snow banks up a band's foot, on the mean. */
export const FOOT = 1.1;
/** The slope's rock share the edge is cut between, after the lip and the
 * foot have moved it. */
export const EDGE = [0.38, 0.6] as const;
/** How far the snow in the hollows moves the edge, of the share. */
export const JITTER = 0.55;
/** Of the stone, the share a runnel's snow covers at its heart. */
export const RUNNEL = 0.85;
/** /m: the noise the lip's reach, the foot and the edge are broken by. */
const REACH_F = 0.3;
const FOOT_F = 0.4;
const EDGE_F = 0.35;
/** /m: a runnel's noise, and the steps m down the fall line it is drawn
 * out along (the mean of the noise at each, so a blob is a streak). Off
 * the point itself, never off the world's origin, whose rotation by the
 * slope would scramble it a pixel at a time. */
const RUN_F = 0.3;
const RUN_STEPS = [-3, 0, 3, 6] as const;

const f32 = Math.fround;
const fract = (v: number): number => f32(v - Math.floor(v));

/** `snow-noise-glsl.ts`'s `snowHash1`, in single precision. */
function hash1(x: number, y: number): number {
  let px = fract(f32(x * f32(123.34)));
  let py = fract(f32(y * f32(456.21)));
  const d = f32(f32(px * f32(px + f32(45.32))) + f32(py * f32(py + f32(45.32))));
  px = f32(px + d);
  py = f32(py + d);
  return fract(f32(px * py));
}

/** `snowNoise`: value noise, 0..1. */
export function noise(x: number, y: number): number {
  x = f32(x);
  y = f32(y);
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash1(ix, iy);
  const b = hash1(ix + 1, iy);
  const c = hash1(ix, iy + 1);
  const d = hash1(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The slope's own rock share at a plan point, 0..1 (the share before the
 * lip, the foot and the edge are drawn). */
export type SlopeRock = (x: number, z: number) => number;
/** The ground's slope (dh/dx, dh/dz) at a plan point. */
export type GradAt = (x: number, z: number) => readonly [number, number];

/** The rock left bare at (x, z), 0..1, and the lip and the shade there: the
 * plain-number twin of `ROCK_LIP_GLSL`'s `rockLip`. `r` is the slope's
 * share there (as the shader has it), `foot` m a pixel spans (0 off the
 * screen: nothing fades). */
export function rockLip(
  x: number,
  z: number,
  r: number,
  grad: readonly [number, number],
  at: SlopeRock,
  foot = 0,
): { bare: number; lip: number; under: number } {
  if (r <= 0) return { bare: 0, lip: 0, under: 0 };
  const s = Math.max(Math.hypot(grad[0], grad[1]), 1e-4);
  const dx = -grad[0] / s;
  const dz = -grad[1] / s;
  const reach = LIP * (LIP_VARY[0] + (LIP_VARY[1] - LIP_VARY[0]) * noise(x * REACH_F, z * REACH_F));
  const bank = FOOT * (0.5 + noise(x * FOOT_F + 7, z * FOOT_F + 7));
  const up = at(x - dx * reach, z - dz * reach);
  const down = at(x + dx * bank, z + dz * bank);
  const j = (noise(x * EDGE_F + 11, z * EDGE_F + 11) - 0.5) * JITTER;
  const cut = (v: number): number => smooth(EDGE[0], EDGE[1], v + j);
  let bare = cut(Math.min(r, up, down));
  const lip = Math.max(0, cut(Math.min(r, down)) - bare);
  let run = 0;
  for (const k of RUN_STEPS) run += noise((x + dx * k) * RUN_F, (z + dz * k) * RUN_F);
  run /= RUN_STEPS.length;
  bare *= 1 - RUNNEL * smooth(0.62, 0.74, run) * (1 - smooth(0.4, 1.2, foot * RUN_F * 2));
  const core = reach + CORE;
  const shade = reach + SHADE;
  const under =
    bare *
    (0.5 * (1 - at(x - dx * core, z - dz * core)) + 0.5 * (1 - at(x - dx * shade, z - dz * shade)));
  return { bare, lip, under };
}

/** THE GLSL (`snow-glsl.ts` grafts it after the noise): `rockLipAt` the
 * slope's share at a point off the ground map, and `rockLip` the edge —
 * returning the rock left bare and writing the lip's and the shade's
 * shares into `snowLip` and `snowUnder`. */
export const ROCK_LIP_GLSL = /* glsl */ `
float rockLipAt(vec2 q) {
  vec4 gq = texture2D(uGround, (q - uHeightOrigin + 0.5 * uCell) / (uHeightCount * uCell));
  return smoothstep(uRockSlope.x, uRockSlope.y, length(gq.rg)) * (1.0 - clamp(gq.b, 0.0, 1.0));
}
float rockLip(vec2 p, float r, vec2 gr, float foot) {
  float s = max(length(gr), 1e-4);
  vec2 d = -gr / s;
  float reach = ${LIP.toFixed(3)} * mix(${LIP_VARY[0].toFixed(3)}, ${LIP_VARY[1].toFixed(3)}, snowNoise(p * ${REACH_F.toFixed(3)}));
  float bank = ${FOOT.toFixed(3)} * (0.5 + snowNoise(p * ${FOOT_F.toFixed(3)} + 7.0));
  float up = rockLipAt(p - d * reach);
  float down = rockLipAt(p + d * bank);
  float j = (snowNoise(p * ${EDGE_F.toFixed(3)} + 11.0) - 0.5) * ${JITTER.toFixed(3)};
  float bare = smoothstep(${EDGE[0].toFixed(3)}, ${EDGE[1].toFixed(3)}, min(r, min(up, down)) + j);
  snowLip = max(0.0, smoothstep(${EDGE[0].toFixed(3)}, ${EDGE[1].toFixed(3)}, min(r, down) + j) - bare);
  float run = (${RUN_STEPS.map((k) => `snowNoise((p + d * ${k.toFixed(1)}) * ${RUN_F.toFixed(3)})`).join(" + ")}) / ${RUN_STEPS.length.toFixed(1)};
  bare *= 1.0 - ${RUNNEL.toFixed(3)} * smoothstep(0.62, 0.74, run) * (1.0 - smoothstep(0.4, 1.2, foot * ${(RUN_F * 2).toFixed(3)}));
  snowUnder = bare * (0.5 * (1.0 - rockLipAt(p - d * (reach + ${CORE.toFixed(3)})))
    + 0.5 * (1.0 - rockLipAt(p - d * (reach + ${SHADE.toFixed(3)}))));
  return bare;
}`;

/** For the node twin (`rock-lip-tsl.ts`): the noise's frequencies. */
export const LIP_NOISE = { REACH_F, FOOT_F, EDGE_F, RUN_F, RUN_STEPS } as const;
