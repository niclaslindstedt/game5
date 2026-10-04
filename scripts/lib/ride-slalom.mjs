// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB'S SLALOM SCENARIOS — the slalom racer's technique on the
// ride lab's open pitch, read in the scenarios' own terms: one full edge
// cut hard, and a rhythm of turns. Listed in `ride-scenarios.mjs`.

import { TUCK, fmt, turn, schussStrip, onPitch, rhythmOf } from "./ride-helpers.mjs";

/** A RHYTHM OF TURNS, read after the first two seconds: how long a turn
 * is (the edge from one side to the other), its peak edge, the radius a
 * tenth of the frames turn tighter than, the most yaw, the mean speed, and
 * the skid angle — the skis' line off the way — on the mean and at its
 * most. */
function rhythm(run) {
  const r = rhythmOf(run.frames.filter((f) => f.t >= 2));
  return [
    ["turn s", fmt(r.turnS)],
    ["edge peak deg", fmt((r.edgePeak ?? 0) * 57.3, 0)],
    ["radius m", r.radius === null ? "—" : fmt(r.radius, 1)],
    ["yaw most rad/s", fmt(r.yawMost, 2)],
    ["speed km/h", fmt(r.speed * 3.6, 1)],
    ["skid deg", fmt(r.skid * 57.3, 1)],
    ["skid most deg", fmt(r.skidMost * 57.3, 1)],
    ["thrown", r.thrown ? "yes" : "no"],
  ];
}

/** The slalom scenarios, in the ride lab's order. */
export const SLALOM_SCENARIOS = [
  {
    id: "slalom-cut",
    title: "full edge cut hard at 45 km/h down the 20° pitch, the slalom racer's technique",
    level: (S) => schussStrip(S),
    place: () => onPitch(45),
    seconds: 3,
    view: "plan",
    technique: "slalom",
    input: (t) => ({ ...TUCK, tuck: 0.3, steer: t >= 0.3 ? 1 : 0, carve: t >= 0.3 }),
    measure: turn,
  },
  {
    id: "slalom-rhythm",
    title:
      "a turn every 0.9 s cut hard from 40 km/h down the 20° pitch, the slalom racer's technique",
    level: (S) => schussStrip(S),
    place: () => onPitch(40),
    seconds: 9,
    view: "plan",
    technique: "slalom",
    // Full edge one way, then the other, every 0.9 s — and back toward the
    // fall line whenever he has come more than 50° off it.
    input: (t, st) => {
      const side = Math.floor(t / 0.9) % 2 === 0 ? 1 : -1;
      const h = st.skier.heading;
      return { ...TUCK, tuck: 0.3, steer: Math.abs(h) > 0.9 ? -Math.sign(h) : side, carve: true };
    },
    measure: rhythm,
  },
];
