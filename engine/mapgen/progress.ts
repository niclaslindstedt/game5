// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW FAR A MAP HAS GOT — the generator's word on its own progress, for a
// loading card's bar (`GenerateOptions.progress`).
//
// The search is the most expensive thing the engine does and it is ONE
// call: seconds of work that a page can only show as a bar if the work says
// where it is. So it says so at its landmarks — the mountain raised, the
// runs walked, the runs graded, the woods grown, the map checked — and this
// module turns each landmark into a share of the whole, 0–1.
//
// A LANDMARK'S SHARE IS WHAT IT COST, MEASURED. The weights below are the
// stages' measured shares of an accepted attempt across a sweep of seeds,
// so a bar fed by them moves at a steady rate rather than leaping over the
// cheap stages and hanging on the dear one.
//
// A REFUSED ATTEMPT NEVER TAKES THE BAR BACK, and the search's length is
// not known ahead: measured, a seed is accepted on anything from its first
// attempt to its ninth (each two to five seconds). So every attempt is given
// a SLICE of what is left of the bar — the first two fifths of it, the
// next two fifths of the rest, and so on (`SLICE`) — and fills its slice as
// it reaches its landmarks. The bar slows the longer the search runs and
// never reverses, and it reaches the end only when a map is accepted.
//
// IT DRAWS NOTHING AND DECIDES NOTHING: a landmark is a call into the sink
// and back, so no digest can see whether anyone was listening. The sink is
// set for the length of one `generateLevel` (`reportingTo`) and cleared
// after it, even when the search throws.

/** Told the share of the map built so far, 0–1, never decreasing. */
export type MapProgress = (share: number) => void;

/** The landmarks of one attempt, in the order they are reached. */
export type MapStage = keyof typeof WEIGHTS;

/** What each stage costs as a share of an accepted attempt — the time from
 * the landmark before it to its own, measured over seeds 1–6 on generator
 * v8. Read cumulatively: reaching a stage means every stage up to it is
 * paid. */
const WEIGHTS = {
  /** The mountain planned and baked onto the grid (a resort's massif, or
   * the one piste's face). */
  mountain: 0.23,
  /** The station pads pressed and the way to the next lift laid (R26). */
  pads: 0.01,
  /** Every run walked down the mountain, and the lanes between (R27). */
  walked: 0.31,
  /** The runs graded and pressed into the snow, in order (R8). */
  graded: 0.13,
  /** Access reckoned and cured, the stations stood beside the runs. */
  access: 0.11,
  /** The kickers and cliffs off the runs, the hub and its tunnels. */
  features: 0.01,
  /** The woods (R14). */
  woods: 0.12,
  /** The courses composed down the network (R28). */
  courses: 0.01,
  /** The finished map checked against the rule book (`analyzeLevel`). */
  checked: 0.08,
} as const;

const ORDER = Object.keys(WEIGHTS) as MapStage[];
const TOTAL = ORDER.reduce((sum, s) => sum + WEIGHTS[s], 0);
/** The share of an attempt paid by the time each stage is reached. */
const REACHED = new Map<MapStage, number>();
{
  let sum = 0;
  for (const s of ORDER) {
    sum += WEIGHTS[s];
    REACHED.set(s, sum / TOTAL);
  }
}

/** The share of what is left of the bar each attempt is given. */
const SLICE = 0.4;

let sink: MapProgress | null = null;
/** Where this attempt's slice starts. */
let floor = 0;
/** The last share reported. */
let shown = 0;

/** Run `build` with `to` told of its progress — the whole of a
 * `generateLevel`. A call that has no one to tell runs unchanged. A sink
 * already listening (a map built inside another's build) is left alone. */
export function reportingTo<T>(to: MapProgress | undefined, build: () => T): T {
  if (!to || sink) return build();
  sink = to;
  floor = 0;
  shown = 0;
  try {
    const built = build();
    tell(1);
    return built;
  } finally {
    sink = null;
  }
}

/** An attempt is starting: the one before it, if any, was refused, and
 * this one is given its slice of what is left of the bar. */
export function attemptBegun(attempt: number): void {
  if (!sink) return;
  floor = 1 - (1 - SLICE) ** attempt;
}

/** A landmark of the attempt being built is reached. */
export function reached(stage: MapStage): void {
  if (!sink) return;
  tell(floor + (1 - floor) * SLICE * (REACHED.get(stage) ?? 0));
}

/** Part of the way from the landmark before `stage` to `stage` itself — a
 * long stage that can count its own work (the runs walked one by one). */
export function partway(stage: MapStage, done: number): void {
  if (!sink) return;
  const i = ORDER.indexOf(stage);
  const from = i > 0 ? (REACHED.get(ORDER[i - 1]) ?? 0) : 0;
  const to = REACHED.get(stage) ?? 0;
  const f = Math.max(0, Math.min(1, done));
  tell(floor + (1 - floor) * SLICE * (from + (to - from) * f));
}

function tell(share: number): void {
  if (!sink || share <= shown) return;
  shown = share;
  sink(share);
}
