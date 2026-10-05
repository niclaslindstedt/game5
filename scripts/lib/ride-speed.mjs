// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB'S SPEED-SKIING SCENARIOS (R34) — the engine at its extreme,
// on the speed ski and the speed skier's technique whatever pair the lab
// is asked for: the straight held in a tuck at 150, 200 and 250 km/h (the
// step, the snow's contacts, the drag, the chatter), a balance correction
// at 200, standing up into the wind at 200 (the air brake's g), the run-out
// skid at 140, the full edge at 200 (all of a speed skier's 20°), and a fall
// at 200 — how far the body slides on the suit. Listed in
// `ride-scenarios.mjs`.

import { TUCK, fmt, schussStrip, onPitch, wipeout } from "./ride-helpers.mjs";

/** THE STRAIGHT HELD: the speed in and out, the most the body drifted off
 * the line, the share of steps all six stations stood on the snow, the
 * deepest sink, the deceleration's peak and whether he went down. */
function straight(run) {
  const f = run.frames;
  const first = f[0];
  const last = f[f.length - 1];
  const drift = Math.max(...f.map((g) => Math.abs(g.x - first.x)));
  const air = f.filter((g) => g.airborne).length / f.length;
  let decel = 0;
  for (let i = 1; i < f.length; i++) {
    decel = Math.max(decel, (f[i - 1].speed - f[i].speed) / (f[i].t - f[i - 1].t || 1));
  }
  return [
    ["in km/h", fmt(first.speed * 3.6, 1)],
    ["out km/h", fmt(last.speed * 3.6, 1)],
    ["drift m", fmt(drift, 2)],
    ["heading deg", fmt(last.heading * 57.3, 2)],
    ["off snow", fmt(air, 3)],
    ["sink m", fmt(Math.max(...f.map((g) => g.sink)), 3)],
    ["decel g", fmt(decel / 9.81, 2)],
    ["thrown", f.some((g) => g.thrown) ? "yes" : "no"],
  ];
}

/** A fall at speed: the straight's figures, and how far the body slid. */
function fallen(run) {
  const f = run.frames;
  const at = f.findIndex((g) => g.thrown);
  const slid =
    at < 0 ? 0 : Math.hypot(f[f.length - 1].rx - f[at].rx, f[f.length - 1].rz - f[at].rz);
  return [...straight(run).slice(0, 2), ["slid m", fmt(slid, 0)], ...wipeout(run)];
}

const speedAt = (kmh) => ({
  level: (S) => schussStrip(S),
  place: () => onPitch(kmh),
  skis: "peregrine",
  technique: "speedSki",
  view: "plan",
});

/** The speed-skiing scenarios, in the ride lab's order. */
export const SPEED_SCENARIOS = [
  ...[150, 200, 250].map((kmh) => ({
    id: `speed-${kmh}`,
    title: `the speed ski held straight in a tuck at ${kmh} km/h down the 20° pitch`,
    ...speedAt(kmh),
    seconds: 4,
    input: () => TUCK,
    measure: straight,
  })),
  {
    id: "speed-correct",
    title: "a balance correction at 200 km/h: a tenth of the edge for half a second",
    ...speedAt(200),
    seconds: 4,
    input: (t) => ({ ...TUCK, steer: t >= 0.5 && t < 1 ? 0.1 : 0 }),
    measure: straight,
  },
  {
    id: "speed-stand",
    title: "stood straight up out of the tuck at 200 km/h on the flat — the air brake",
    ...speedAt(200),
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 200 / 3.6 }),
    seconds: 4,
    input: () => ({ ...TUCK, tuck: 0 }),
    measure: straight,
  },
  {
    id: "speed-skid",
    title: "the run-out's full skid at 140 km/h on the flat",
    ...speedAt(140),
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 140 / 3.6 }),
    seconds: 6,
    input: () => ({ ...TUCK, tuck: 0, brake: 1 }),
    measure: straight,
  },
  {
    id: "speed-edge",
    title: "the full edge at 200 km/h — all of the speed skier's 20°, a wide arc and no more",
    ...speedAt(200),
    seconds: 4,
    input: (t) => ({ ...TUCK, steer: t >= 0.3 ? 1 : 0 }),
    measure: straight,
  },
  {
    id: "speed-fall",
    title: "thrown onto his side at 200 km/h down the pitch — the slide on the suit",
    ...speedAt(200),
    place: () => ({ ...onPitch(200), height: 1.6, roll: 1.35 }),
    seconds: 8,
    input: () => TUCK,
    measure: fallen,
  },
];
