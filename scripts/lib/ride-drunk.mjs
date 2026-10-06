// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB'S BUZZED SCENARIOS — the afterski's beer in the skier
// (`buzz.ts`), on the open pitch, on the free ride's terms (the lodges
// open, no course): a straight run he cannot hold, a rhythm of turns he
// over- and under-cooks, and a fall he gets up from, walks to his skis
// after and skis on. Each is dealt its `buzz`; `ride -- <id> --buzz 0` skis
// the same scenario sober, which is the comparison every one of them is
// read against. Listed in `ride-scenarios.mjs`.

import { TUCK, fmt, hold, rhythmOf, schussStrip, onPitch, wipeout } from "./ride-helpers.mjs";

/** How far he strayed off the line he set off on, m, and his heading's
 * swing, deg, while still on his skis. */
function strayed(run) {
  const f0 = run.frames[0];
  const on = run.frames.filter((f) => !f.thrown);
  const most = on.reduce((m, f) => Math.max(m, Math.abs(f.x - f0.x)), 0);
  const hs = on.map((f) => f.heading);
  return [
    ["strayed m", fmt(most, 1)],
    ["heading swing deg", fmt((Math.max(...hs) - Math.min(...hs)) * 57.3, 0)],
  ];
}

/** The turns' spread: each turn's radius, its tightest and widest — what
 * over- and under-steering does to a rhythm a sober skier holds. */
function spread(run) {
  const r = rhythmOf(run.frames.filter((f) => f.t >= 2 && !f.thrown));
  const xs = [];
  let side = 0;
  let peak = 0;
  for (const f of run.frames) {
    if (f.thrown || f.t < 2) continue;
    const s = Math.sign(f.edge);
    if (s !== 0 && s !== side) {
      if (side !== 0) xs.push(peak);
      side = s;
      peak = 0;
    }
    peak = Math.max(peak, Math.abs(f.edge));
  }
  return [
    ["turn s", fmt(r.turnS)],
    ["radius m", r.radius === null ? "—" : fmt(r.radius, 1)],
    ["edge peak least deg", xs.length ? fmt(Math.min(...xs) * 57.3, 0) : "—"],
    ["edge peak most deg", xs.length ? fmt(Math.max(...xs) * 57.3, 0) : "—"],
  ];
}

/** THE FALL AND THE FETCH: when he went down, got up, had each ski and was
 * back in the bindings, and how far he walked. */
function fetched(run) {
  const at = (phase) => run.events.find((e) => e.kind === "fetch" && e.phase === phase)?.t;
  const skis = run.events.filter((e) => e.kind === "fetch" && e.phase === "ski");
  const down = run.events.find((e) => e.kind === "wipeout")?.t;
  const resets = run.events.filter((e) => e.kind === "reset").length;
  return [
    ["down s", fmt(down, 1)],
    ["up s", fmt(at("up"), 1)],
    ["skis s", skis.length ? skis.map((e) => fmt(e.t, 1)).join(" ") : "—"],
    ["in s", fmt(at("in"), 1)],
    ["resets", String(resets)],
  ];
}

/** A rhythm of turns, the edge thrown side to side every `half` s. */
const rhythm = (half, edge) => (t) => ({
  ...TUCK,
  tuck: 0.3,
  steer: Math.floor(t / half) % 2 === 0 ? edge : -edge,
});

/** The buzzed scenarios, in the ride lab's order. */
export const DRUNK_SCENARIOS = [
  {
    id: "drunk-straight",
    title: "straight down the 20° pitch at 30 km/h, the edge left flat, well buzzed (0.8)",
    level: (S) => schussStrip(S),
    place: () => onPitch(30),
    buzz: 0.8,
    seconds: 10,
    view: "plan",
    input: () => ({ ...TUCK, tuck: 0.2 }),
    measure: (run) => [...strayed(run), ...wipeout(run).slice(0, 2)],
  },
  {
    id: "drunk-turn",
    title: "a rhythm of 0.6 edges every 1.3 s, held to 40 km/h, well buzzed (0.8)",
    level: (S) => schussStrip(S),
    place: () => onPitch(40),
    buzz: 0.8,
    seconds: 12,
    view: "plan",
    input: (t, st) => ({ ...rhythm(1.3, 0.6)(t), ...hold(st, 40) }),
    measure: (run) => [...spread(run), ...wipeout(run).slice(0, 2)],
  },
  {
    id: "drunk-fall",
    title: "hard turns at 45 km/h as drunk as he gets (1): down, up, the skis fetched, on",
    level: (S) => schussStrip(S),
    place: () => onPitch(45),
    buzz: 1,
    seconds: 80,
    view: "plan",
    // Hard turns until he goes down, then his hands off: he gets up and
    // the walk to his skis goes on by itself; back on them, he cruises.
    input: (t, st) =>
      st.skier.fetch || st.events.some((e) => e.kind === "wipeout") || st.skier.thrown
        ? { ...TUCK, tuck: 0 }
        : rhythm(1.1, 0.9)(t),
    measure: (run) => [...fetched(run), ...wipeout(run).slice(0, 1)],
  },
];
