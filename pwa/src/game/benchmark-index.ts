// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INDEX — the benchmark's time, turned into a number that compares —
// and the two lines the card draws it as.
//
// The run is a fixed piece of riding and a stopwatch (`benchmark.ts`): thirty
// seconds of a scripted race drawn as fast as the machine will draw it, and
// the answer is how long that took. That is the honest measurement and a
// poor SCORE — lower is better, and nobody can say what twice as fast looks
// like without dividing in their head. So it is reported as an index pinned
// at the one point that means something on its own:
//
//   INDEX 100 IS REAL TIME — the machine draws the race in the time it
//   takes to ride it. 200 is twice that, 50 half.
//
// A ratio, not a unit: the same number whatever the run's length, higher is
// better, and two of them divide into "this machine is 2.4× that one".
//
// AND IT IS READ WHILE IT RUNS: what is plotted is the score OF THE RUN SO
// FAR, which walks steadily onto the final number — the LAST point on the
// line, not a separate sum. Beside it goes the SNAPSHOT — the rate of the one
// frame at that reading, remembering nothing — because a running average is
// a memory and a stretch that halves the frame rate moves it by a few points
// and never says where. The two share a box because an index IS a frame rate
// (`INDEX_REAL · step` per frame a second): at a sixtieth, 100 is 60 fps.
//
// DOM-free, so `tests/benchmark_test.ts` holds the whole model.

/** The index a machine scores drawing the race in the time it takes to ride. */
export const INDEX_REAL = 100;

/** How often a reading is taken, in measured frames: four a second of riding
 * at a sixtieth — fine enough that a stumble shows as a kink, coarse enough
 * that redrawing the card is nothing against the frames it sits over. */
export const SAMPLE_EVERY = 15;

/** One reading: the run's score by that frame, and the rate of the frame. */
export type BenchSample = {
  /** Measured frames drawn when the reading was taken. */
  frame: number;
  /** The whole run so far, scored. */
  index: number;
  /** Frames a second THAT ONE FRAME was drawn at. */
  fps: number;
};

/** Seconds of riding drawn over seconds of wall clock spent drawing them, on
 * the 100-is-real-time scale; 0 before there is anything to divide. */
export function benchIndex(riding: number, wall: number): number {
  if (!(wall > 0) || !(riding > 0)) return 0;
  return (INDEX_REAL * riding) / wall;
}

/** The same measurement in the other unit — exact, one number in two hats. */
export function indexOfFps(fps: number, step: number): number {
  return INDEX_REAL * step * fps;
}

/** …and back. */
export function fpsOfIndex(index: number, step: number): number {
  if (!(step > 0)) return 0;
  return index / (INDEX_REAL * step);
}

/** Headroom the axis keeps above the score, so the line never runs along
 * the ceiling. */
const HEADROOM = 50;

/** …quantised to this, so the axis holds still through the small drift a
 * converging average makes and moves once when the score has actually gone
 * somewhere. A multiple of five, so the right-hand axis lands on whole
 * frames a second too (25 index is 15 fps at a sixtieth). */
const AXIS_STEP = 25;

/** The lines, ready to draw, in a unit box: the card owns the pixels. */
export type BenchPlot = {
  /** The index at the top of the LEFT axis; the floor is always 0. */
  top: number;
  /** The same ceiling in frames a second — the right-hand axis. */
  topFps: number;
  /** The score line: `x` runs 0 (the green) to 1 (the run's last frame);
   * `y` is 0 at the TOP and 1 on the floor, as a screen measures. */
  points: { x: number; y: number }[];
  /** The snapshot line, on the same scale. */
  rate: { x: number; y: number }[];
  /** Where real time sits in the box, or null when the axis does not reach
   * it. */
  real: number | null;
  /** The score at the leading edge — on the last reading, the run's. */
  index: number;
  /** …and the rate of the frame that reading was taken on. */
  fps: number;
};

/** Fit the readings to the box. The x axis is the RUN (`frames` long), not
 * the readings, so a line a third of the way across is a run a third of the
 * way through. */
export function benchPlot(
  samples: readonly BenchSample[],
  frames: number,
  step: number,
): BenchPlot {
  const last = samples.length > 0 ? samples[samples.length - 1] : null;
  const index = last?.index ?? 0;
  // A spike earlier in the run still fits under the ceiling: the first
  // readings of a cold machine are its wildest, and a graph that clips them
  // hides the one thing worth looking at.
  let peak = index;
  for (const s of samples) {
    peak = Math.max(peak, s.index, indexOfFps(s.fps, step));
  }
  const top = Math.max(
    AXIS_STEP,
    Math.ceil((index + HEADROOM) / AXIS_STEP) * AXIS_STEP,
    Math.ceil(peak / AXIS_STEP) * AXIS_STEP,
  );
  const span = Math.max(1, frames);
  const at = (frame: number, value: number): { x: number; y: number } => ({
    x: Math.min(1, frame / span),
    y: 1 - Math.min(1, value / top),
  });
  return {
    top,
    topFps: fpsOfIndex(top, step),
    points: samples.map((s) => at(s.frame, s.index)),
    rate: samples.map((s) => at(s.frame, indexOfFps(s.fps, step))),
    real: INDEX_REAL <= top ? 1 - INDEX_REAL / top : null,
    index,
    fps: last?.fps ?? 0,
  };
}
