// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE LAB'S COCKPIT SHEET (`plane-scenes.ts` lists it): the
// cockpit (`plane-cockpit.ts`) through the HELMET rung — the pilot's eye —
// on the strip, in the climb, in a bank, upside down at the top of a loop
// and after dark; over his shoulder; the panel, its displays, the quadrant,
// the pedals and the overhead close; the controls thrown; and the pilot in
// his seat seen from outside, from the door's side and his own.

import {
  NEUTRAL_INPUT,
  TUNING,
  planeAloft,
  planeFlight,
  type GameState,
  type PlaneControls,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { neutralTouch } from "../game/input-model.ts";
import {
  NO_PLANE_KEYS,
  createPlaneModel,
  samplePlane,
  seatPlaneModel,
  type PlaneKeysHeld,
} from "../game/input-plane.ts";
import type { Drive, Stage } from "./plane-scenes.ts";

/** What the sheet borrows from the lab's own scenes. */
export type CockpitKit = {
  /** A lens riding the plane in its own frame (the engine's body frame: x
   * the pilot's left, y up, z forward), from `eye` to `at`. */
  riding(
    eye: [number, number, number],
    at: [number, number, number],
    fov?: number,
  ): (s: GameState) => LensPose;
  /** Climbed out on the pilot's hands for `seconds`, then a moment drawn. */
  aloft(st: Stage, seconds?: number): GameState;
};

const pilot: Drive = (s) => ({ ...NEUTRAL_INPUT, plane: planeFlight(s) });
const held =
  (o: Partial<PlaneControls>): Drive =>
  (s) => ({ ...NEUTRAL_INPUT, plane: { ...planeFlight(s), ...o } });
const still: Drive = () => NEUTRAL_INPUT;

export function cockpitViews(k: CockpitKit): Record<string, (st: Stage) => void | Promise<void>> {
  const { riding, aloft } = k;
  return {
    // ── THE PILOT'S EYE through the flight ──────────────────────────────
    "cockpit-eye"(st) {
      const s = st.fresh();
      st.run(s, 0.5, still);
      st.shoot(s, "on the strip", "helmet");
      const c = aloft(st, 22);
      st.shoot(c, "climbing", "helmet");
      const b = aloft(st, 60);
      st.run(b, 1.6, held({ roll: 0.8, pitch: -0.3 }));
      st.shoot(b, "banked", "helmet");
      // THE LOOP'S TOP, flown: over the strip at full power, pushed into a
      // dive to 120 kt and then the stick held back on the player's own
      // hand (`samplePlane`) until it hangs upside down over the top.
      const l = st.fresh();
      const p0 = l.plane!;
      planeAloft(l, { x: p0.x, y: p0.y + 700, z: p0.z, heading: p0.heading, speed: 50, power: 1 });
      const p = l.plane!;
      const hand = createPlaneModel();
      seatPlaneModel(hand, { throttle: 1, flaps: 0 });
      const keyed =
        (k: Partial<PlaneKeysHeld>): Drive =>
        (s) => {
          const q = s.plane!;
          const plane = samplePlane(
            hand,
            { ...NO_PLANE_KEYS, ...k },
            neutralTouch(),
            TUNING.dt,
            q.airspeed,
            q.stalled,
          );
          return { ...NEUTRAL_INPUT, plane };
        };
      for (let t = 0; t < 30 && p.airspeed < 62; t += 0.1)
        st.run(l, 0.1, keyed({ stickForward: true }));
      let over = false;
      for (let t = 0; t < 20 && !over; t += 0.05) {
        st.run(l, 0.05, keyed({ stickBack: true }));
        over = Math.abs(p.roll) > 2.6 && Math.abs(p.pitch) < 0.25;
      }
      st.shoot(l, "loop's top", "helmet");
    },
    async "cockpit-night"(st) {
      await st.sky({ hour: 21, weather: "clear" });
      const s = st.fresh();
      st.run(s, 0.5, still);
      st.shoot(s, "strip at night", "helmet");
      const up = aloft(st, 40);
      st.shoot(up, "aloft at night", "helmet");
      st.shoot(up, "panel at night", riding([0.12, 2.2, 0.5], [0.0, 1.8, 1.15], 58));
      await st.sky(null);
    },
    // ── THE COCKPIT itself, close ───────────────────────────────────────
    "cockpit-close"(st) {
      const s = aloft(st, 45);
      st.shoot(s, "over the shoulder", riding([0.48, 2.5, -0.05], [0.0, 1.8, 1.2], 68));
      st.shoot(s, "panel", riding([0.12, 2.2, 0.5], [0.0, 1.8, 1.15], 58));
      st.shoot(s, "flight display", riding([0.29, 2.02, 0.78], [0.29, 1.86, 1.2], 40));
      st.shoot(s, "engine page", riding([-0.04, 2.02, 0.78], [-0.04, 1.86, 1.2], 40));
      st.shoot(s, "quadrant", riding([0.18, 2.05, 0.55], [-0.01, 1.55, 0.88], 52));
      st.shoot(s, "overhead", riding([0.2, 2.3, 0.62], [0.02, 2.62, 0.05], 66));
      st.shoot(s, "pedals", riding([-0.05, 1.75, 0.5], [0.3, 1.2, 1.15], 62));
      st.run(s, 0.5, held({ roll: 1, pitch: -1, yaw: 1, flaps: 1, throttle: 1 }));
      st.shoot(s, "controls thrown", riding([-0.32, 2.3, 0.3], [0.25, 1.45, 0.9], 66));
      st.run(s, 0.5, held({ roll: -1, pitch: 1, yaw: -1, flaps: 0, throttle: 0 }));
      st.shoot(s, "thrown the other way", riding([-0.32, 2.3, 0.3], [0.25, 1.45, 0.9], 66));
      st.run(s, 0.3, pilot);
    },
    // ── THE PILOT seen from outside ─────────────────────────────────────
    "cockpit-pilot"(st) {
      const s = st.fresh();
      st.run(s, 0.5, still);
      st.shoot(s, "from his side", riding([3.0, 2.5, 1.1], [0.3, 2.05, 0.5], 36));
      st.shoot(s, "from the door's side", riding([-3.2, 2.6, 0.9], [0.2, 2.05, 0.5], 36));
      st.shoot(s, "front quarter", riding([2.4, 3.4, 4.6], [0.15, 2.1, 0.5], 32));
      const up = aloft(st, 45);
      st.shoot(up, "aloft from his side", riding([3.2, 2.6, 1.4], [0.3, 2.05, 0.5], 36));
    },
  };
}

/** The views of the cockpit sheet, in order. */
export const COCKPIT_SHEET = ["cockpit-eye", "cockpit-night", "cockpit-close", "cockpit-pilot"];
