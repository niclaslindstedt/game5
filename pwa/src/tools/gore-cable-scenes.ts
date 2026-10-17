// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GORE LAB'S CABLE SHEET (`gore-scenes.ts`): a skier met by a lift's
// rope faster than `CABLE.cut.speed` and cut like a wire by it
// (`engine/game/cable-cut.ts`, the skis by `ski-cut.ts`) — flown square
// across a chair's down rope at chest height (cut in two) and at shin
// height (the shins off), and dropped onto it from above with his skis
// across it (the skis cut in two, then the body). Each is photographed a
// few frames after the cut from the chase and from close beside him, so
// the cut skis — the piece with the binding laid where the whole ski
// would be, the piece cut off on its own — read as cut skis.

import { NEUTRAL_INPUT, centreOf, liftPlans, ropeOver, standSkier, type GameState } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import type { Drive, Lens, Stage } from "./gore-scenes.ts";

const still: Drive = () => NEUTRAL_INPUT;

/** A free ride flying square across the first chair's down rope half way
 * up its line, mid-span, at `speed` m/s, his feet `feet` m off the rope
 * (negative under it) — or, with `fall`, dropping onto it from above at
 * `fall` m/s, his skis across it ahead of his boots (`tests/cable_cut_test.ts`
 * stages the same, the rope under them). With `lead`, flown that many
 * seconds out from it instead, thrown up so he comes back down to that
 * height at the rope — time for the X-ray cam's read ahead to see the cut
 * coming. Null when the map has no chair. */
export function acrossRope(
  st: Stage,
  o: { speed?: number; feet?: number; fall?: number; lead?: number },
): { s: GameState; heading: number; at: { x: number; y: number; z: number } } | null {
  const chair = liftPlans(st.level).find((p) => p.lift.kind === "chair");
  if (!chair) return null;
  const s = st.fresh();
  // Half way up the line, in the middle of its span — clear of the towers.
  const sup = chair.supports;
  const k = Math.max(
    1,
    sup.findIndex((q) => q.u > chair.length * 0.5),
  );
  const p = ropeOver(chair, 1, (sup[k - 1].u + sup[k].u) / 2);
  const hx = chair.dz;
  const hz = -chair.dx;
  // Dropped half a metre behind it, so the rope comes down across the
  // forebodies clear of the boots and the cut shows.
  const speed = o.fall ? 3 : (o.speed ?? 0);
  const lead = o.fall ? 0 : (o.lead ?? 0);
  const back = o.fall ? 0.5 : 0.6 + speed * lead;
  const heading = Math.atan2(-hx, -hz);
  standSkier(s, p.x + hx * back, p.z + hz * back, heading);
  const c = s.skier;
  c.y = p.y + c.spec.cogHeight + (o.fall ? 0.6 : (o.feet ?? 0));
  c.vx = -hx * speed;
  c.vz = -hz * speed;
  c.vy = o.fall ? -o.fall : (9.81 * lead) / 2;
  c.airborne = true;
  return { s, heading, at: { x: p.x, y: p.y, z: p.z } };
}

/** A lens following his body (or him on his skis), `dist` m out at `yaw`
 * off `heading` (0 ahead, a quarter turn his left), `up` m over it. */
function beside(heading: number, yaw: number, dist: number, up: number, fov = 40): Lens {
  return (s: GameState): LensPose => {
    const b = s.skier.thrown;
    const c = b ? centreOf(b.points) : { x: s.skier.x, y: s.skier.y, z: s.skier.z };
    const a = heading + yaw;
    const ex = c.x + Math.sin(a) * dist;
    const ez = c.z + Math.cos(a) * dist;
    // Kept over the snow where it stands: on a slope falling across his line
    // the ground beside him is above him, and a lens under it sees the
    // mountain from inside.
    return {
      eye: { x: ex, y: Math.max(s.level.groundAt(ex, ez) + 1, c.y + up), z: ez },
      target: c,
      fov,
      roll: 0,
    };
  };
}

/** A lens on his skis and every piece cut off them (the middle of all
 * their ends), `dist` m out at `yaw` off `heading`, `up` m over them. */
function onSkis(heading: number, yaw: number, dist: number, up: number, fov = 40): Lens {
  return (s: GameState): LensPose => {
    const b = s.skier.thrown;
    const all = b ? [...b.skis, ...(b.halves ?? [])] : [];
    const c = { x: s.skier.x, y: s.skier.y, z: s.skier.z };
    if (all.length) {
      c.x = c.y = c.z = 0;
      for (const k of all) {
        c.x += (k.ends[0] + k.ends[3]) / (2 * all.length);
        c.y += (k.ends[1] + k.ends[4]) / (2 * all.length);
        c.z += (k.ends[2] + k.ends[5]) / (2 * all.length);
      }
    }
    const a = heading + yaw;
    const ex = c.x + Math.sin(a) * dist;
    const ez = c.z + Math.cos(a) * dist;
    return {
      eye: { x: ex, y: Math.max(s.level.groundAt(ex, ez) + 1, c.y + up), z: ez },
      target: c,
      fov,
      roll: 0,
    };
  };
}

/** A lens planted `dist` m off the rope's point, at `yaw` off `heading`. */
function atRope(
  heading: number,
  at: { x: number; y: number; z: number },
  yaw: number,
  dist: number,
  up: number,
  fov = 50,
): LensPose {
  const a = heading + yaw;
  return {
    eye: { x: at.x + Math.sin(a) * dist, y: at.y + up, z: at.z + Math.cos(a) * dist },
    target: at,
    fov,
    roll: 0,
  };
}

/** Staged, stepped to the cut and a few frames past it, and shot from the
 * chase, close beside him and back at the rope. */
function cut(st: Stage, o: { speed?: number; feet?: number; fall?: number }): void {
  const staged = acrossRope(st, o);
  if (!staged) {
    st.shoot(st.fresh(), "no-chair-on-this-map", "chase");
    return;
  }
  const { s, heading, at } = staged;
  st.shoot(s, "coming", atRope(heading, at, Math.PI / 2, 7, 0.5));
  st.until(s, (q) => !!q.skier.thrown, 1, still);
  st.run(s, 0.05, still);
  st.shoot(s, "+0.05s-side", beside(heading, Math.PI / 2, 4, 0.6));
  st.shoot(s, "+0.05s-rope", atRope(heading, at, Math.PI / 2 + 0.5, 6, 1));
  st.run(s, 0.15, still);
  st.shoot(s, "+0.2s-side", beside(heading, Math.PI / 2, 4.5, 0.8));
  st.shoot(s, "+0.2s-chase", "chase");
  st.shoot(s, "+0.2s-skis", onSkis(heading, Math.PI / 2 + 0.3, 3, 1));
  st.run(s, 0.4, still);
  st.shoot(s, "+0.6s-side", beside(heading, Math.PI / 2, 6, 1.5, 45));
  st.shoot(s, "+0.6s-skis", onSkis(heading, Math.PI / 2 + 0.3, 3.5, 1.5));
  st.run(s, 0.9, still);
  st.shoot(s, "+1.5s-above", beside(heading, Math.PI / 2 + 0.6, 6, 4, 45));
  st.shoot(s, "+1.5s-skis", onSkis(heading, Math.PI / 2 + 0.3, 4, 2.5, 45));
  st.shoot(s, "+1.5s-chase", "chase");
}

export const CABLE_VIEWS: Record<string, (st: Stage) => void> = {
  /** Flown square across a chair's rope at 90 km/h at chest height: cut in two. */
  "cable-chest"(st) {
    cut(st, { speed: 25, feet: -1.3 });
  },
  /** ...at shin height: the shins off, the skis with them. */
  "cable-shins"(st) {
    cut(st, { speed: 25, feet: -0.2 });
  },
  /** Dropped onto the rope from above at 90 km/h, his skis across it:
   * the skis cut in two, then the body. */
  "cable-drop"(st) {
    cut(st, { fall: 25 });
  },
};

export const CABLE_GROUPS: Record<string, readonly string[]> = {
  cable: ["cable-chest", "cable-shins", "cable-drop"],
};
