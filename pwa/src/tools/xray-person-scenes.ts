// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY LAB'S PERSON SCENES (`xray-harness.ts`): the player sent at one
// of the crowd's amateurs, stopped on his run with everyone else up a lift,
// from far enough up the fall line that the read ahead sees the meeting coming
// (`impact-people.ts`) and the IMPACT cam cuts to it — the meeting
// `tests/impact_people_test.ts` holds.

import { NEUTRAL_INPUT, placeRun, step, type GameState } from "@engine";

import type { Stage } from "./gore-scenes.ts";

/** Seconds up his way the player starts from. */
const LEAD = 1.2;

/** A free ride with its INJURIES on and a crowd of 30, one amateur (a grown
 * man, on skis) stopped on his run and the player sent at him at `kmh`. */
export function intoAmateur(st: Stage, kmh: number): GameState {
  const s = st.fresh({ crowd: 30 });
  const crowd = s.crowd!;
  for (const o of crowd.amateurs) o.mode = "lift";
  for (const g of crowd.groups) g.lift = 1e9;
  const a = crowd.amateurs.find((o) => o.rank === 0) ?? crowd.amateurs[0];
  Object.assign(a, { mode: "stop", body: "man", board: null, speed: 0, timer: 1e9, think: 1e9 });
  step(s, NEUTRAL_INPUT);
  // Sent straight down the fall line at him, so the run's own pull holds
  // the player's line rather than bending it off him.
  const n = { x: 0, y: 1, z: 0 };
  s.level.normalAt(a.x, a.z, n);
  const along = Math.hypot(n.x, n.z);
  const h = along > 0.02 ? Math.atan2(n.x, n.z) : a.heading;
  const far = (kmh / 3.6) * LEAD;
  placeRun(s, {
    x: a.x - Math.sin(h) * far,
    z: a.z - Math.cos(h) * far,
    heading: h,
    speed: kmh / 3.6,
  });
  return s;
}
