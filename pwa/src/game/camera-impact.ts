// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE IMPACT CAM'S LENS: a camera already STANDING beside the place he is
// about to be crushed, sliced or run into a person (`xray-shots.ts` says
// when, the read ahead says where), side on to his way and a little ahead
// of it, so he arrives into a frame that is waiting for him. The picture CUTS to it — no flight
// in — and the eye never moves while the strike plays: only the aim pans,
// a share of the way from the place of the strike to his body, so the
// frame holds him coming in, the strike, and what goes on past it. Then
// the way back carries it home to the game's own camera, as the X-ray
// lens's does.
//
// Three-free: `frameImpact` turns the shot into a `LensPose` and the
// renderer applies it.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { LensPose, LineClear, Vec3 } from "./camera-rigs.ts";
import type { XrayShot } from "./xray-shots.ts";

/** The lens, as numbers: metres, radians, degrees and 1/s. */
export const IMPACT_LENS = {
  /** How far off the strike and over it the camera stands, and its zoom. */
  arm: { crush: 8, slice: 4.5, person: 7 },
  height: 1.3,
  fov: { crush: 46, slice: 42, person: 50 },
  /** How far round from square to his way toward where he is going, rad:
   * a crush is seen from a little behind, so the solid stands beyond him
   * rather than in front of him; a rope from ahead, so the steel is seen
   * across the frame rather than end on; a PERSON from a little ahead and
   * wider, so both bodies are in the frame — the player coming in and the
   * one he strikes thrown on down his way, toward the lens's side of it. */
  front: { crush: -0.3, slice: 0.6, person: 0.35 },
  /** A rope's lens stands higher, looking down the cut. */
  sliceOver: 1,
  /** The most the snow may lift it over where it wants to stand before it
   * is stood in closer, m. */
  lift: 1.5,
  /** The share of the way from the strike to his body the aim is drawn:
   * for a person, half of it, so the aim sits between the two bodies
   * thrown on together down his way. */
  follow: { crush: 0.35, slice: 0.35, person: 0.5 },
  /** How fast the aim and the zoom chase, 1/s. */
  aimRate: 6,
  /** Never closer to the snow than this, m, nor pulled closer to the
   * strike than `pullMin` by what stands between. */
  clearance: 0.4,
  pullMin: 2.5,
  /** The share of the way from the eye that must be clear: the last of it
   * is the solid he meets. */
  near: 0.85,
} as const;

export type ImpactLens = {
  active: boolean;
  /** The strike stood for: a new one is a new cut. */
  strike: object | null;
  eye: Vec3;
  aim: Vec3;
  fov: number;
};

export function createImpactLens(): ImpactLens {
  return {
    active: false,
    strike: null,
    eye: { x: 0, y: 0, z: 0 },
    aim: { x: 0, y: 0, z: 0 },
    fov: IMPACT_LENS.fov.crush,
  };
}

const chase = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/** WHERE THE CAMERA STANDS for a strike at `at` met going `way`: off the
 * side of his way the game's own lens is on (`home`), unless the other side
 * is clearer of what stands between, pulled in to what is clear. */
export function impactEye(
  strike: Extract<XrayShot, { kind: "impact" }>["strike"],
  home: Vec3,
  groundAt: (x: number, z: number) => number,
  clear?: LineClear,
): Vec3 {
  const L = IMPACT_LENS;
  const at = strike.at;
  let wx = strike.way.x;
  let wz = strike.way.z;
  const len = Math.hypot(wx, wz);
  if (len < 1e-3) {
    // No way along the snow (straight down onto it): off the home side.
    wx = at.x - home.x;
    wz = at.z - home.z;
  }
  const s = Math.hypot(wx, wz) || 1;
  wx /= s;
  wz /= s;
  const front = L.front[strike.kind];
  const over = strike.kind === "slice" ? L.sliceOver : 0;
  const arm = L.arm[strike.kind];
  /** The eye off side `k` (+1 his right, −1 his left), how clear, and how
   * far the snow under it lifts it over where it wants to be, m. Uphill of
   * a steep face the snow would put it high over him: it is stood in
   * closer, down to half its arm. */
  const stand = (k: number): { eye: Vec3; share: number; lift: number } => {
    // Square to his way on that side, swung toward where he is going.
    const nx = wz * k;
    const nz = -wx * k;
    const dx = nx * Math.cos(front) + wx * Math.sin(front);
    const dz = nz * Math.cos(front) + wz * Math.sin(front);
    const y = at.y + L.height + over;
    let eye = { x: at.x, y, z: at.z };
    let lift = Infinity;
    for (const reach of [1, 0.75, 0.5]) {
      const e = { x: at.x + dx * arm * reach, y, z: at.z + dz * arm * reach };
      const up = Math.max(0, groundAt(e.x, e.z) + L.clearance - y);
      if (up < lift) {
        lift = up;
        eye = e;
      }
      if (up <= L.lift) break;
    }
    eye.y += lift;
    // Looked along from the eye: the solid he is about to meet stands at
    // the far end of the line, and is not in the way of seeing him meet it.
    const share = clear ? clear(eye, at) : 1;
    return { eye, share: share >= L.near ? 1 : share, lift };
  };
  const right = (home.x - at.x) * wz - (home.z - at.z) * wx >= 0 ? 1 : -1;
  const a = stand(right);
  const b = stand(-right);
  // The clearer side, then the one the snow does not lift; else his own.
  const better =
    b.share > a.share + 0.15 || (b.share >= a.share - 0.15 && b.lift + L.lift < a.lift);
  const pick = better ? b : a;
  if (pick.share < 1) {
    const e = pick.eye;
    const d = Math.hypot(e.x - at.x, e.y - at.y, e.z - at.z);
    // In past what stands between, from the strike's side of it.
    const k = Math.min(1, Math.max(L.pullMin / d, (1 - pick.share) * 0.9));
    e.x = at.x + (e.x - at.x) * k;
    e.y = at.y + (e.y - at.y) * k;
    e.z = at.z + (e.z - at.z) * k;
    e.y = Math.max(e.y, groundAt(e.x, e.z) + L.clearance);
  }
  return pick.eye;
}

/** One frame of the lens, `dt` wall seconds after the last: the shot (an
 * impact, or the body on the way back), where his body is (null: not
 * known), the game's own lens this frame (`home`, drawn toward by `back`),
 * or null to put it down. */
export function frameImpact(
  st: ImpactLens,
  shot: XrayShot | null,
  body: Vec3 | null,
  home: LensPose,
  back: number,
  dt: number,
  groundAt: (x: number, z: number) => number,
  clear?: LineClear,
): LensPose | null {
  if (!shot || (shot.kind !== "impact" && !st.active)) {
    st.active = false;
    st.strike = null;
    return null;
  }
  const L = IMPACT_LENS;
  if (shot.kind === "impact") {
    const s = shot.strike;
    // THE CUT: stood where it will watch from, already looking.
    if (!st.active || st.strike !== s) {
      st.active = true;
      st.strike = s;
      st.eye = impactEye(s, home.eye, groundAt, clear);
      st.aim = body ? mixed(s.at, body, L.follow[s.kind]) : { ...s.at };
      st.fov = L.fov[s.kind];
    }
  }
  const strikeAt = shot.kind === "impact" ? shot.strike.at : st.aim;
  // On the way back, still drawn as the strike stood for was.
  const stood = (st.strike as { kind?: keyof typeof L.follow } | null)?.kind ?? "crush";
  const follow = L.follow[shot.kind === "impact" ? shot.strike.kind : stood];
  const want = body ? mixed(strikeAt, body, follow) : strikeAt;
  const ka = chase(L.aimRate, dt);
  st.aim.x += (want.x - st.aim.x) * ka;
  st.aim.y += (want.y - st.aim.y) * ka;
  st.aim.z += (want.z - st.aim.z) * ka;
  // On the way back it is carried toward the game's own lens, all the way
  // at `back` = 1: the frame the cam lets go is the frame the two meet.
  const k = clamp(back, 0, 1);
  const mix = (a: number, b: number): number => a + (b - a) * k;
  return {
    eye: {
      x: mix(st.eye.x, home.eye.x),
      y: mix(st.eye.y, home.eye.y),
      z: mix(st.eye.z, home.eye.z),
    },
    target: {
      x: mix(st.aim.x, home.target.x),
      y: mix(st.aim.y, home.target.y),
      z: mix(st.aim.z, home.target.z),
    },
    fov: mix(st.fov, home.fov),
    roll: home.roll * k,
  };
}

const mixed = (a: Vec3, b: Vec3, k: number): Vec3 => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  z: a.z + (b.z - a.z) * k,
});
