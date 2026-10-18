// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE A DRAWN ANIMAL STANDS — the engine's plan (`engine/game/beast-plan.ts`:
// the groups, their rounds, the fright) stood on the DRAWN snow, pitched
// with the slope and its gait kept in time with the ground going by, as
// plain numbers. Three-free: `beasts.ts` turns what comes back into instance
// matrices, and `tests/birds_test.ts` holds it without a renderer in sight.

import {
  CALM,
  TAU,
  beastById,
  beastPlace,
  fromEuler,
  hash2,
  type BeastGroup,
  type Quat,
  type Spook,
} from "@engine";

import type { WildGround } from "./wild-ground.ts";

/** The step a heading and a slope are read over, m. */
const LOOK = 0.6;

function smooth(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

export type BeastPose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  q: Quat;
  /** Where in its gait cycle it is, rad, and how hard it is going, 0..1. */
  gait: number;
  stride: number;
  /** How far the head is down, 0..1. */
  graze: number;
};

export function freshBeastPose(): BeastPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    q: { x: 0, y: 0, z: 0, w: 1 },
    gait: 0,
    stride: 0,
    graze: 0,
  };
}

/**
 * Where animal `i` of `group` is at `t`, written into `out`: stood on the
 * DRAWN snow (sunk in by its own `sink`), pitched with the slope it stands
 * on, its gait read off the distance it has covered so the legs keep time
 * with the ground going by.
 */
export function beastPose(
  group: BeastGroup,
  i: number,
  t: number,
  ground: WildGround,
  out: BeastPose,
  spook: Spook = CALM,
): BeastPose {
  const spec = beastById(group.species);
  const p = beastPlace(group, spec, i, t, spook);
  const hx = Math.sin(p.heading);
  const hz = Math.cos(p.heading);
  const half = Math.max(LOOK, spec.length * 0.5);
  const size = ground.level.size;
  const clampXZ = (v: number): number => Math.min(Math.max(v, 0), size);
  const ahead = ground.snowY(clampXZ(p.x + hx * half), clampXZ(p.z + hz * half));
  const behind = ground.snowY(clampXZ(p.x - hx * half), clampXZ(p.z - hz * half));
  const covered = Math.abs(p.s) + p.flight;
  const gait = (TAU * covered) / spec.stride + hash2(i, 3, group.scatter) * TAU;
  const stride = Math.min(1, p.pace);
  // A hare's bound lifts it clear of the snow at the top of every leap.
  const bounce = spec.gait === "bound" ? Math.abs(Math.sin(gait / 2)) * 0.18 * stride : 0;
  out.x = p.x;
  out.z = p.z;
  out.y = (ahead + behind) / 2 - spec.sink + bounce;
  out.heading = p.heading;
  out.pitch = Math.atan2(ahead - behind, 2 * half);
  out.gait = gait;
  out.stride = stride;
  out.graze = spec.grazes ? smooth(1 - stride * 4) : 0;
  const q = fromEuler(p.heading, out.pitch, 0);
  out.q.x = q.x;
  out.q.y = q.y;
  out.q.z = q.z;
  out.q.w = q.w;
  return out;
}
