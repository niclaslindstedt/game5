// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER LAB'S COCKPIT SCENES (`heli-scenes.ts` merges them): the
// COCKPIT lens (`camera-heli.ts`'s HELMET rung, `heli-cockpit.ts`) seen as
// a player sees it — on the pad as the rotor spools up, at the hover over a
// steep face, in cruise, in a banked turn, low over the snow, at night —
// and the cockpit itself from lenses planted in the cabin: the panel close
// enough to read, the pilot and his controls from the guide's seat, the
// pedals and the chin windows, the overhead, the controls thrown to their
// stops, the cabin from the rear bench.

import {
  HELI,
  heliPoint,
  pilotInput,
  type GameState,
  type HeliAim,
  type HeliControls,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { COCKPIT, bodyOf } from "../game/cockpit-plan.ts";
import type { Drive, Stage } from "./heli-scenes.ts";

type P = { x: number; y: number; z: number };

/** A LENS PLANTED IN THE CABIN: `eye` and `at` in the cockpit's visual
 * frame (x to the right as seen), mirrored into the body frame. */
function cabinLens(s: GameState, eye: P, at: P, fov = 60): LensPose {
  const h = s.heli!;
  return { eye: heliPoint(h, bodyOf(eye)), target: heliPoint(h, bodyOf(at)), fov, roll: 0 };
}

const flyTo =
  (aim: HeliAim): Drive =>
  (s) =>
    pilotInput(s, aim);

const bearing = (from: { x: number; z: number }, to: { x: number; z: number }): number =>
  Math.atan2(to.x - from.x, to.z - from.z);

/** In forward flight toward the flat at `height` m, settled `settle` s. */
function cruising(st: Stage, height: number, settle: number): GameState {
  const { pad, flat } = st.spots;
  const s = st.fresh(true);
  const start = { x: pad.x + (flat.x - pad.x) * 0.3, z: pad.z + (flat.z - pad.z) * 0.3 };
  const h = s.heli!;
  const heading = bearing(start, flat);
  const ground = st.level.groundAt(start.x, start.z);
  Object.assign(h, {
    x: start.x,
    y: ground + height,
    z: start.z,
    vx: Math.sin(heading) * 25,
    vy: 0,
    vz: Math.cos(heading) * 25,
    heading,
    grounded: false,
    thrust: HELI.mass * 9.81,
    t: 0,
  });
  st.run(s, settle, flyTo({ x: flat.x, z: flat.z, height }));
  return s;
}

const E = COCKPIT.eye;

export const COCKPIT_VIEWS: Record<string, (st: Stage) => Promise<void> | void> = {
  cockpit(st) {
    // On the pad, the rotor spooling up.
    const s = st.fresh(true);
    st.camera("helmet");
    st.run(s, 1.5);
    st.shoot(s, "pad-spool", "helmet");
    const { pad, steep } = st.spots;
    // Lifting off in its own wash: none of the snow it throws up is in the
    // cabin (`shelter.ts`) — seen from the seat and from the rear bench.
    st.run(s, 2, flyTo({ x: pad.x, z: pad.z, height: 8 }));
    st.shoot(s, "liftoff-wash", "helmet");
    st.shoot(
      s,
      "liftoff-cabin",
      cabinLens(s, { x: 0, y: 1.75, z: 0.65 }, { x: 0.1, y: 1.4, z: 2.6 }, 70),
    );
    st.run(s, 4, flyTo({ x: pad.x, z: pad.z, height: 8 }));
    st.shoot(s, "hover-pad", "helmet");
    // At the hover over a steep face, looking out of the chin.
    const o = st.fresh(true);
    st.camera("helmet");
    st.run(o, 0.2);
    Object.assign(o.heli!, {
      x: steep.x,
      y: steep.y + 25,
      z: steep.z,
      vx: 0,
      vy: 0,
      vz: 0,
      grounded: false,
      thrust: HELI.mass * 9.81,
    });
    st.run(o, 4, flyTo({ x: steep.x, z: steep.z, height: 25 }));
    st.shoot(o, "hover-steep", "helmet");
    // In cruise and banked into a turn.
    const c = cruising(st, 45, 5);
    st.camera("helmet");
    st.run(c, 0.7, flyTo({ x: st.spots.flat.x, z: st.spots.flat.z, height: 45 }));
    st.shoot(c, "cruise", "helmet");
    const h = c.heli!;
    const right = h.heading + Math.PI / 2;
    const aim = { x: h.x + Math.sin(right) * 300, z: h.z + Math.cos(right) * 300, height: 45 };
    st.run(c, 1.6, flyTo(aim));
    st.shoot(c, "turn", "helmet");
    st.camera("chase");
  },

  async "cockpit-night"(st) {
    await st.sky({ hour: 21 });
    const c = cruising(st, 40, 4);
    st.camera("helmet");
    st.run(c, 0.7, flyTo({ x: st.spots.flat.x, z: st.spots.flat.z, height: 40 }));
    st.shoot(c, "night-cruise", "helmet");
    await st.sky(null);
    st.camera("chase");
  },

  "cockpit-controls"(st) {
    const s = cruising(st, 45, 4);
    st.camera("chase");
    // The panel straight on from the pilot's eye, near enough to read.
    st.shoot(s, "panel", cabinLens(s, E, { x: 0.38, y: 1.42, z: 2.4 }, 34));
    st.shoot(s, "panel-middle", cabinLens(s, E, { x: -0.05, y: 1.4, z: 2.4 }, 40));
    // The pilot and his controls from the guide's seat.
    const guide = { x: -E.x, y: E.y - 0.02, z: E.z };
    st.shoot(
      s,
      "pilot",
      cabinLens(s, { x: -0.3, y: 1.8, z: 0.75 }, { x: 0.4, y: 1.25, z: 1.9 }, 60),
    );
    // Down at the pedals and the chin windows.
    st.shoot(s, "pedals", cabinLens(s, E, { x: 0.44, y: 0.9, z: 2.25 }, 70));
    // Up at the overhead.
    st.shoot(
      s,
      "overhead",
      cabinLens(s, { x: 0.2, y: 1.85, z: 1.4 }, { x: 0, y: 2.4, z: 1.9 }, 60),
    );
    // From the rear bench, forward over both seats.
    st.shoot(s, "cabin", cabinLens(s, { x: 0, y: 1.75, z: 0.65 }, { x: 0.1, y: 1.4, z: 2.6 }, 70));
    // The controls thrown to their stops: forward and right cyclic, the
    // collective up, the right pedal pushed — and the other way.
    const thrown: [string, HeliControls][] = [
      ["controls-fwd-right", { collective: 1, pitch: 1, roll: 1, pedal: 1 }],
      ["controls-aft-left", { collective: 0, pitch: -1, roll: -1, pedal: -1 }],
    ];
    for (const [label, c] of thrown) {
      s.heli!.controls = c;
      st.shoot(s, label, cabinLens(s, guide, { x: 0.35, y: 1.15, z: 1.95 }, 62));
    }
  },
};

/** The cockpit's sheets. */
export const COCKPIT_GROUPS: Record<string, readonly string[]> = {
  cockpit: ["cockpit", "cockpit-night", "cockpit-controls"],
};
