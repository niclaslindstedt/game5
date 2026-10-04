// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TECHNIQUE LAB'S MEASUREMENT (`scripts/technique-preview.mjs`): each
// riding TECHNIQUE (`engine/game/defs/technique.ts`) skied down one course
// by the bot, and the numbers that say how it skied, held against the
// research TARGETS for its discipline.
//
// The targets are stated ONCE, here, off `docs/disciplines.md` (the
// slalom's section and "Giant slalom, super-G and downhill": the turns, the
// body, the tuck, the peak force and the "For a technique row" table) — a
// band a row, *(est.)* where the page marks its number an estimate or the
// band is derived from two measured numbers (a yaw rate is a speed over a
// radius). The free skier has no discipline and no targets. The speeds are
// a real course's; the game's piste and its slalom are the courses the
// rows are measured on, so a speed outside its band says as much about the
// hill as about the technique.

import { rhythmOf, slideOf } from "./ride-helpers.mjs";

/** The pair each technique skis when none is asked for: its discipline's
 * own class of ski (`defs/skis.ts`) — the slalom on the slalom pair, the
 * giant slalom on the giant slalom pair, the speed events on the downhill
 * pair, the free skier on the all-mountain pair. */
export const NATURAL_SKIS = {
  free: "chamois",
  slalom: "swift",
  giantSlalom: "chough",
  superG: "eagle",
  downhill: "eagle",
};

/** The course each technique skis under `--course=auto`: the slalom (R31)
 * for the slalom racer and the free skier, the open piste — its gates every
 * hundred metres or so, missed ones charged rather than disqualifying — for
 * the giant slalom, super-G and downhill rows, whose 30–50 m sidecuts
 * cannot make a slalom's 5 m turns (on their own pairs they straddle or
 * miss within the first three gates, and the run ends there). */
export const NATURAL_COURSE = {
  free: "slalom",
  slalom: "slalom",
  giantSlalom: "piste",
  superG: "piste",
  downhill: "piste",
};

/** What is measured, in the order the table prints it: the label, the
 * unit and how many decimals. */
export const METRICS = [
  { key: "edgePeak", label: "peak edge", unit: "°", digits: 0 },
  { key: "edgeMost", label: "most edge", unit: "°", digits: 0 },
  { key: "turnS", label: "turn time", unit: "s", digits: 2 },
  { key: "radius", label: "radius p10", unit: "m", digits: 1 },
  { key: "yawMost", label: "max yaw", unit: "rad/s", digits: 2 },
  { key: "speedMean", label: "mean speed", unit: "km/h", digits: 0 },
  { key: "speedPeak", label: "peak speed", unit: "km/h", digits: 0 },
  { key: "skid", label: "mean skid", unit: "°", digits: 1 },
  { key: "skidMost", label: "max skid", unit: "°", digits: 1 },
  { key: "forcePeak", label: "peak force", unit: "BW", digits: 2 },
  { key: "tuck", label: "tucked", unit: "%", digits: 0 },
  // The TURN-SHAPE run (`technique-shape.mjs`): each technique's own turn
  // on the common open slope, read turn by turn — the medians.
  { key: "shapeRadius", label: "shape radius", unit: "m", digits: 1 },
  { key: "shapeTurn", label: "shape turn", unit: "s", digits: 2 },
  { key: "shapeEdge", label: "shape edge", unit: "°", digits: 0 },
  { key: "shapeSpeed", label: "shape speed", unit: "km/h", digits: 0 },
];

/** THE RESEARCH TARGETS, a band per metric per discipline (`lo`..`hi`,
 * `est` where the doc marks it an estimate or the band is derived). */
export const TARGETS = {
  free: {},
  slalom: {
    // 65.7 ± 1.7° on 10 m spacing, 71.0 ± 1.9° on 13 m, at about the gate.
    edgePeak: { lo: 64, hi: 73 },
    // 0.88 ± 0.19 s; 0.89–0.92 s; 0.83–0.96 s.
    turnS: { lo: 0.8, hi: 1.0 },
    // The least radius 3.96 ± 0.23 m (10 m) and 4.94 ± 0.59 m (13 m).
    radius: { lo: 3.5, hi: 6 },
    // Speed over the least radius at the gate: 11–14 m/s over 4–5 m.
    yawMost: { lo: 2.2, hi: 3.3, est: true },
    // ~40 km/h on the mean, 54–60 at the peak.
    speedMean: { lo: 35, hi: 45 },
    speedPeak: { lo: 54, hi: 60 },
    // 12–15° early in the turn, 0.5–3° at the transition, under 4° by the
    // gate — a mean over the turn of a few degrees.
    skid: { lo: 3, hi: 8, est: true },
    skidMost: { lo: 10, hi: 16 },
    // ~4 body weights, up to 5.
    forcePeak: { lo: 4, hi: 5 },
    tuck: { lo: 0, hi: 2 },
  },
  giantSlalom: {
    edgePeak: { lo: 65, hi: 72, est: true },
    // 1.46–1.48 s; elite 1.41 ± 0.13 s.
    turnS: { lo: 1.3, hi: 1.6 },
    // ~20 m typical, 12–15 m at the tightest.
    radius: { lo: 11, hi: 16, est: true },
    // 18 ± 2 m/s through the turn over the tightest radius.
    yawMost: { lo: 1.1, hi: 1.7, est: true },
    // 61–70 km/h on the mean, ~80 at the peak.
    speedMean: { lo: 61, hi: 70 },
    speedPeak: { lo: 75, hi: 85 },
    // ~5–10° early on an offset gate, 2–4° steering.
    skid: { lo: 2, hi: 5, est: true },
    skidMost: { lo: 5, hi: 10, est: true },
    // 3.16 body weights a turn.
    forcePeak: { lo: 2.8, hi: 3.6 },
    tuck: { lo: 0, hi: 5 },
  },
  superG: {
    edgePeak: { lo: 55, hi: 65, est: true },
    turnS: { lo: 2.0, hi: 2.3 },
    // The least radius 35 ± 16 m, ~45 m typical.
    radius: { lo: 19, hi: 51 },
    // 24.2 ± 2.6 m/s at turn entry over the least radius.
    yawMost: { lo: 0.5, hi: 1.0, est: true },
    // ~80 km/h on the mean (80–87), ~102 at the peak.
    speedMean: { lo: 75, hi: 87 },
    speedPeak: { lo: 95, hi: 110 },
    // Mostly carved, under 5°, a skid only to check speed.
    skid: { lo: 0, hi: 3, est: true },
    skidMost: { lo: 0, hi: 5, est: true },
    // 2.38–2.79 body weights.
    forcePeak: { lo: 2.38, hi: 2.79 },
    // ~16 % of a super-G tucked.
    tuck: { lo: 10, hi: 22 },
  },
  downhill: {
    edgePeak: { lo: 45, hi: 60, est: true },
    turnS: { lo: 2.4, hi: 2.6 },
    // ~52 m typical; the tightest tenth below it.
    radius: { lo: 35, hi: 55, est: true },
    // 26 ± 4 m/s through the turn over ~52 m.
    yawMost: { lo: 0.35, hi: 0.75, est: true },
    // 86–95 km/h on the mean, 120–130 at the peak on most courses, ~150 on
    // the fastest.
    speedMean: { lo: 86, hi: 95 },
    speedPeak: { lo: 115, hi: 150 },
    skid: { lo: 0, hi: 3, est: true },
    skidMost: { lo: 0, hi: 5, est: true },
    forcePeak: { lo: 2, hi: 2.5, est: true },
    // ~37 % of a downhill tucked.
    tuck: { lo: 30, hi: 45 },
  },
};

/** A NATURAL TURN'S RADIUS at its apex, m — the turn-shape run's target
 * (the "For a technique row" table's preferred radius, ~5 / ~20 / ~45 /
 * ~52 m): the slalom's least 3.96 ± 0.23 and 4.94 ± 0.59 m; the giant
 * slalom's ~20 m typical and 12–15 m tightest; the super-G's 35 ± 16 m
 * tightest and ~45 m typical; the downhill's ~52 m typical. Its turn time
 * and peak edge are the course's own bands. */
const SHAPE_RADIUS = {
  slalom: { lo: 4, hi: 6 },
  giantSlalom: { lo: 13, hi: 22, est: true },
  superG: { lo: 30, hi: 50, est: true },
  downhill: { lo: 40, hi: 65, est: true },
};
for (const [id, band] of Object.entries(SHAPE_RADIUS)) {
  const t = TARGETS[id];
  Object.assign(t, { shapeRadius: band, shapeTurn: t.turnS, shapeEdge: t.edgePeak });
}

/** The two courses a row can ski on seed `seed`'s mountain: the SLALOM set
 * over it (R31; a slalom's seed is built to a red piste) and the open
 * PISTE under that slalom — the same mountain either way. */
export function coursesOf(E, seed) {
  const slalom = E.createGame({ seed, mode: "slalom", rivals: 0, quiet: true }).level;
  return { slalom, piste: slalom.slalom.base };
}

/** A row's run stood up: the slalom course skied under the slalom's rules
 * (the start house, the strict gates), the piste as a time trial — alone,
 * no lights. The harness page (`technique-harness.ts`) stands its run up
 * the same way, and the lab checks the two runs finish together. */
export function gameOf(E, courses, row) {
  return E.createGame({
    level: courses[row.course],
    mode: row.course === "slalom" ? "slalom" : "timeTrial",
    rivals: 0,
    countdown: 0,
    spec: E.SKI_CATALOG.find((s) => s.id === row.skis),
    technique: row.technique,
    quiet: true,
  });
}

/** Ski a row with the bot to the finish (or the end of the run, or
 * `seconds`), recording every step from the start on: what the shared
 * rhythm reads (`rhythmOf`), the tuck and the velocity. */
export function skiRow(E, courses, row, seconds = 400) {
  const state = gameOf(E, courses, row);
  const c = state.skier;
  const frames = [];
  let t0 = null;
  for (let i = 0; i < seconds / E.TUNING.dt && !state.progress.finished; i++) {
    E.step(state, E.botInput(state, E.RIDER_BOT));
    if (!state.progress.started) continue;
    t0 ??= state.t;
    frames.push({
      t: state.t - t0,
      edge: c.edge,
      wy: c.wy,
      speed: c.speed,
      slide: slideOf(c),
      thrown: c.thrown !== null,
      tuck: c.tuck,
      airborne: c.airborne,
      vx: c.vx,
      vy: c.vy,
      vz: c.vz,
    });
  }
  const p = state.progress;
  return {
    frames,
    result: { finished: p.finished && !p.out, out: p.out, time: p.time, end: state.t },
  };
}

/** How long the run-up out of the start is left out of the rhythm, s — the
 * ride lab's `slalom-rhythm` reads from the same second. */
const SETTLE = 2;
/** The window the acceleration is read over before the force's peak is
 * taken, s: a step's jolt off a roller is not a turn's force. */
const FORCE_WINDOW = 0.1;
/** Standard gravity, m/s² — what a body weight is counted in. */
const G = 9.81;
/** A frame is TUCKED at this much of a full tuck or more. */
const TUCKED = 0.5;

/** How long after a landing the force is not read, s: the research's peak
 * is a TURN's, and a landing's jolt is several body weights of its own. */
const LANDED = 0.4;

/** THE PEAK FORCE IN A TURN, body weights: what holds him up and round,
 * read off his motion as a force plate under his feet would read it — the
 * acceleration over `FORCE_WINDOW` less gravity's, over gravity. The
 * engine sums the snow's normal load and the edge's grip as two forces;
 * this is their resultant, with the air's drag in it (a tenth of a body
 * weight at a downhill's speed). The air, the `LANDED` s after it and the
 * frames he is thrown on are left out. */
function peakForce(frames) {
  let most = 0;
  let j = 0;
  let flew = -Infinity;
  for (const f of frames) {
    if (f.airborne) flew = f.t;
    while (frames[j].t < f.t - FORCE_WINDOW) j += 1;
    const g = frames[j];
    const dt = f.t - g.t;
    if (dt < FORCE_WINDOW * 0.5 || f.thrown || g.thrown || f.t - flew < LANDED) continue;
    const ax = (f.vx - g.vx) / dt;
    const ay = (f.vy - g.vy) / dt + G;
    const az = (f.vz - g.vz) / dt;
    most = Math.max(most, Math.hypot(ax, ay, az) / G);
  }
  return most;
}

/** THE NUMBERS a run says, in the table's units. */
export function statsOf(frames) {
  const after = frames.filter((f) => f.t >= SETTLE);
  const r = rhythmOf(after);
  const deg = 180 / Math.PI;
  return {
    edgePeak: r.edgePeak === null ? null : r.edgePeak * deg,
    edgeMost: after.reduce((m, f) => Math.max(m, Math.abs(f.edge)), 0) * deg,
    turnS: r.turnS,
    radius: r.radius,
    yawMost: r.yawMost,
    speedMean: r.speed * 3.6,
    speedPeak: frames.reduce((m, f) => Math.max(m, f.speed), 0) * 3.6,
    skid: r.skid * deg,
    skidMost: r.skidMost * deg,
    forcePeak: peakForce(after),
    tuck: (100 * after.filter((f) => f.tuck >= TUCKED).length) / Math.max(1, after.length),
    turns: r.turns,
    thrown: r.thrown,
  };
}

/** How a run ended, in a word or three. */
export function resultOf(result) {
  if (result.out) return `${result.out.status.toUpperCase()} g${result.out.gate} ${result.out.why}`;
  return result.finished ? `fin ${result.time.toFixed(1)} s` : `unfinished`;
}

/** Where a value stands against its band: "" inside it (or no band), "▲"
 * above, "▼" below. */
export function markOf(value, band) {
  if (!band || value === null || value === undefined) return "";
  return value > band.hi ? "▲" : value < band.lo ? "▼" : "";
}

const pad = (s, n) => (s.length >= n ? s : s + " ".repeat(n - s.length));
const num = (v, d) => (v === null || v === undefined ? "—" : v.toFixed(d));
const bandText = (b, d) =>
  b ? `${b.lo.toFixed(Math.min(d, 2))}–${b.hi.toFixed(Math.min(d, 2))}${b.est ? "*" : ""}` : "";

/** THE TABLE, as lines: a column a row (its technique, its pair, its
 * course, how it ended), a line a metric — each cell the value, the change
 * since `before` (a saved `--json`) when given, the target band in
 * brackets and a mark when outside it. */
export function tableOf(rows, before = null) {
  const w = before ? 30 : 26;
  const lw = 16;
  const head = [
    pad("", lw),
    ...rows.map((r) => pad(`${r.technique}/${r.skis}/${r.course}`, w)),
  ].join(" ");
  const res = [pad("result", lw), ...rows.map((r) => pad(resultOf(r.result), w))].join(" ");
  const turns = [pad("turns", lw), ...rows.map((r) => pad(String(r.stats.turns), w))].join(" ");
  const lines = [head, res, turns];
  for (const m of METRICS) {
    const cells = rows.map((r) => {
      const v = r.stats[m.key];
      const band = TARGETS[r.technique]?.[m.key];
      const was = before?.rows?.find((b) => b.technique === r.technique)?.stats?.[m.key];
      // The change since the saved run, where it shows at the table's
      // precision.
      const moved = was === null || was === undefined || v === null ? 0 : v - was;
      const delta =
        Math.abs(moved) * 10 ** m.digits < 0.5
          ? ""
          : ` (${moved > 0 ? "+" : ""}${moved.toFixed(m.digits)})`;
      const target = band ? ` [${bandText(band, m.digits)}]` : "";
      return pad(`${num(v, m.digits)}${delta}${target} ${markOf(v, band)}`.trimEnd(), w);
    });
    lines.push([pad(`${m.label} ${m.unit}`, lw), ...cells].join(" "));
  }
  lines.push(
    "[band] the research target (docs/disciplines.md), * an estimate; ▲ above it, ▼ below it",
  );
  return lines;
}
