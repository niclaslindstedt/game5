// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE CHALLENGES' numbers (`engine/game/challenges/`): what a
// map deals — the timed lines, the trick goals on its kickers, its hidden
// spots and its lift tops — and what each one is judged by. Every number
// carries its unit, and the ones the bot was measured against say so.

export const CHALLENGES = {
  /** ── THE LINES ─────────────────────────────────────────────────────
   * A timed line between two flag gates down one run. */
  line: {
    /** How many a map deals: one for every `perRuns` runs it can be dealt
     * on, `least` to `most`. */
    perRuns: 2,
    least: 3,
    most: 5,
    /** Where the start gate stands: past the last summit ramp's join onto
     * the run (or the run's head) by `fromRamp` m, and never nearer the
     * head than `fromHead` m — clear of the lift's unload pad, on the
     * run's own snow. */
    fromRamp: 30,
    fromHead: 40,
    /** How long a line is, m: dealt in `[want0, want1]`, held to
     * `[shortest, longest]`, and ended `beforeEnd` m short of the run's
     * foot (where it merges, the snow is the other run's). */
    want: [500, 1400] as const,
    shortest: 300,
    longest: 1500,
    beforeEnd: 25,
    /** The least a line drops, m, and the least it drops per metre of
     * its length — a line is downhill all the way from gate to gate. */
    drop: 25,
    dropPer: 0.06,
    /** THE CORRIDOR: how far outside the run's edge a skier may stray
     * before the attempt is void, m — the woods a line cuts through are
     * fine, a different valley is not. */
    corridor: 60,
    /** A run no longer than this many times bronze is void, as is a run
     * paused or teleported: a step longer than `jump` m is a skier set
     * down somewhere else, never skied. */
    stall: 3,
    jump: 30,
  },

  /** ── THE PAR (`challenges/par.ts`) ────────────────────────────────
   * The time a good free skier takes down a line, off the line's own
   * pitch, bends and snow and what the reference pair can do there. A
   * reckoning in the slalom par's mould (`par.ts`), on the free skier's
   * technique. */
  par: {
    /** The step the line is walked in, m. */
    step: 2,
    /** How far into his tuck he skis, 0 tall … 1 folded. */
    crouch: 0.6,
    /** The speed he crosses the start gate at, m/s — skied in from above. */
    entry: 8,
    /** The fastest a free skier lets a line run, m/s (about 75 km/h —
     * the bot's own on a free run, measured). */
    most: 21,
    /** The share of the corner grip a bend is skied at. */
    corner: 0.6,
    /** The share of the fall to a bend counted against the skid's room. */
    fall: 0.5,
    /** A good free skier's time as a share of the profile's own: the
     * measured median of the bot's over every line seeds 1–8 deal (`make
     * challenges-table ARGS=--count=8`) — its time 0.89–1.14 of par on
     * every line it finished, the corner, fall and top speed above fitted
     * to that spread. */
    scale: 1.26,
    /** The slowest any bend asks of him, m/s (the bot's `CRAWL`). */
    crawl: 4,
    /** The share of the pitch's pull out of a turn across it taken off the
     * grip he turns on, and the least share of that grip left him (the
     * bot's `PITCH_PULL` and `PITCH_FLOOR`). */
    pitchPull: 0.5,
    pitchFloor: 0.35,
    /** How far past what his skid needs to stop he looks for a bend, m,
     * and how far short of a bend the skid is begun, m (the bot's own). */
    reach: 30,
    runup: 6,
  },

  /** THE MEDALS on a line as shares of its par, s per s of par. Par is
   * the bot's (a competent skier's) clean run, so he lands silver mostly
   * and gold now and then; gold is a strong, clean run, and bronze any
   * steady one. */
  medals: { gold: 0.96, silver: 1.12, bronze: 1.45 },

  /** ── THE TRICKS ────────────────────────────────────────────────────
   * Trick goals on kickers: how many a map deals, and the kicker sizes,
   * by its lip's height over the ground it was shaped on, m. */
  trick: {
    least: 2,
    most: 3,
    /** One goal for every `perKickers` kickers on the map. */
    perKickers: 8,
    /** A small kicker is under `small` m of lip, a big one over `big`. */
    small: 1.5,
    big: 2.5,
    /** How near the lip a flight must leave the snow to be off it, m:
     * `near` plus half the kicker's width. */
    near: 6,
  },

  /** ── THE SPOTS ─────────────────────────────────────────────────────
   * Hidden spots off the pistes. */
  spots: {
    /** How many a map deals (fewer where it has no place for one). */
    count: 5,
    /** How near a spot a skier must stand to find it, m. */
    radius: 22,
    /** How far from every run's edge a spot lies, m — off the piste. */
    offRun: 60,
    /** How far in from the map's edge, m. */
    margin: 200,
    /** The steepest ground a spot stands on, as the snow's normal's
     * upward share (cos 35°): a place a skier can stop on. */
    flat: 0.82,
    /** The least room from any trunk, m. */
    clear: 5,
    /** How far under the highest lift top a spot may lie at the most
     * — the ridge a skier traverses to, never climbs a summit for, m. */
    under: 15,
    /** The grid the map is sampled over for candidates, m. */
    sample: 40,
    /** A GLADE: an opening of no trunk within `open` m, with at least
     * `woods` trunks within `ring` m round it. */
    glade: { open: 14, ring: 60, woods: 30 },
    /** The least drop a cliff top is offered for, m. */
    cliff: 6,
    /** How far back from a cliff's edge its spot stands, m. */
    cliffBack: 8,
    /** THE FAR CORNER: low ground no more than `low` m over the lowest
     * lift bottom. */
    low: 80,
    /** How far apart two spots lie at the least, m. */
    apart: 400,
    /** The shares of the spots found for each medal. */
    medals: { bronze: 0.4, silver: 0.8, gold: 1 },
  },

  /** ── THE SUMMITS ───────────────────────────────────────────────────
   * Every lift top stood off, as shares of the ski area's lifts. */
  summits: { bronze: 1 / 3, silver: 2 / 3, gold: 1 },
} as const;
