// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BLOW SEEN COMING: the run a moment ahead, so the X-ray cam
// (`xray-shots.ts`) can slow the picture down BEFORE the bone goes rather
// than after. DOM-free and three-free.
//
// The engine is deterministic and every injury it deals is drawn off a hash
// of the blow, never off the run's stream (`body.ts`), so the future is
// there to be read: a COPY of the run (`forkRun`) is stepped on ahead with
// the hands the player holds now, and the first step that breaks a bone,
// does an injury of `FORECAST.ais` or worse, or tears him open (`gore.ts`)
// is the blow coming — read on past it a moment (`FORECAST.after`), through
// the tumble, for whether his wounds will be MORTAL (`GoreState.mortal`):
// the X-ray cam is shot only for a fall he clearly dies of. The copy is the
// player's alone — the field and the
// crowd are left behind (a shoulder into one of them is the one blow this
// cannot see) — shares the map, which nothing in a step writes but its
// memos, and takes a stream of its own wherever the run carries one, so the
// run itself is never touched: its digests do not move.

import {
  bonesOf,
  createRng,
  step,
  TUNING,
  type BodyPart,
  type Bone,
  type DeathCause,
  type GameEvent,
  type GameState,
  type GorePiece,
  type SkierInput,
} from "@engine";

/** How far ahead, how often, and what is worth slowing down for. */
export const FORECAST = {
  /** Seconds of run read ahead. */
  horizon: 0.8,
  /** Steps between two reads. */
  every: 12,
  /** The least AIS rank an injury with no fracture must be. */
  ais: 3,
  /** Seconds read on past the blow for whether it kills him, and the
   * steps a frame that read takes (it is cut short as soon as it knows). */
  after: 1.2,
  afterPer: 40,
  /** Seconds after the first wound that the worst one in them is still
   * taken as the blow's: a rope's wire goes through a hand, an arm and the
   * waist a step or two apart, and the shot is the waist. */
  worst: 0.05,
  /** Seconds read on past a blow he dies of for the strike that comes with
   * it (`Strike`): a trunk breaks bones a step or two before his body is
   * smashed on it. */
  strikeAfter: 0.15,
} as const;

const STRIKE_AFTER = Math.round(FORECAST.strikeAfter / TUNING.dt);

/** A blow seen coming: how many seconds off, the part it lands on, the
 * bones it breaks (none: an organ, a ligament, a wound) and whether it
 * tears him open (`gore.ts`). */
export type Forecast = {
  in: number;
  part: BodyPart | null;
  bones: Bone[];
  gore: boolean;
  /** The wound a blow that tears him open does first-worst (`FORECAST.worst`):
   * the piece torn off (null: the trunk opened, a gash, a spike) and where. */
  tear?: { piece: GorePiece | null; at: { x: number; y: number; z: number } };
  /** Whether he dies of it: mortal by the blow or the tumble after it. */
  fatal: boolean;
  /** Whether a machine takes him apart: the death the SHRED cam is shot
   * for (`mangled`), not the X-ray. */
  mangled: boolean;
  /** What he dies of, as the read ahead found it (null: he lives). */
  cause: DeathCause | null;
  /** Whether it is the helicopter coming down with him on it: no cam of
   * the director's at all — the crash's own lens (`camera-crash.ts`) holds
   * on the machine going up and never goes after him. */
  wrecked: boolean;
  /** Whether he is CRUSHED on a solid (`gore-smash.ts`: a trunk, a mast, a
   * lift's tower, bare rock) or SLICED by a lift's rope (`cable-cut.ts`) —
   * the strikes the IMPACT CAM is shot for with the X-ray switch off — and
   * how far off, where and which way he is going. */
  strike?: Strike;
};

/** A body met by a solid or a rope too fast to hold together: what, how
 * many seconds off, where (world, m), his way then (world, m/s) and, for
 * a solid, its middle. */
export type Strike = {
  kind: "crush" | "slice";
  in: number;
  at: { x: number; y: number; z: number };
  way: { x: number; y: number; z: number };
  solid?: { x: number; z: number };
};

/** A strike as a step finds it, before it is put off the run as it stands. */
type Struck = Omit<Strike, "in">;

/** His way and his middle before a step: a thrown body's, or on his skis. */
const wayOf = (s: GameState): { x: number; y: number; z: number } => {
  const b = s.skier.thrown;
  return b ? { x: b.vx, y: b.vy, z: b.vz } : { x: s.skier.vx, y: s.skier.vy, z: s.skier.vz };
};
const middleOf = (s: GameState): { x: number; y: number; z: number } => {
  const b = s.skier.thrown;
  return b ? { x: b.x, y: b.y, z: b.z } : { x: s.skier.x, y: s.skier.y + 1, z: s.skier.z };
};

/** THE STRIKE IN ONE STEP: a point of him smeared on a solid this step (a
 * smear more than `smears`), or the rope's cut heard; `way` is his way
 * before the step. */
function struckIn(
  run: GameState,
  smears: number,
  way: { x: number; y: number; z: number },
): Struck | null {
  const g = run.gore;
  if (!g) return null;
  if (g.smears.length > smears) {
    const m = g.smears[smears];
    return { kind: "crush", at: { x: m.x, y: m.y, z: m.z }, way, solid: { x: m.cx, z: m.cz } };
  }
  for (const e of run.events)
    if (e.kind === "grind" && e.phase === "cut") return { kind: "slice", at: middleOf(run), way };
  return null;
}

/** The deaths that TAKE A BODY APART rather than break it: under a piste
 * machine, into a helicopter's rotor. (Blown off its skid is the crash's
 * own lens's — `wrecked`.) */
const MANGLING: readonly string[] = ["machine", "rotor"];

/** Whether a run's helicopter or jump plane has come down with its skier on it. */
export const wrecked = (s: GameState): boolean =>
  !!s.heli?.wreck?.aboard || !!s.plane?.wreck?.aboard;

/** Whether a run's skier is being taken apart by a machine — the piste
 * machine's belts and tiller or the helicopter's blades
 * (a blade through any point of him, `HeliState.taken`, whatever he
 * dies of). */
export const mangled = (s: GameState): boolean =>
  !!s.gore &&
  ((s.gore.cause !== null && MANGLING.includes(s.gore.cause)) || (s.heli?.taken ?? 0) !== 0);

const isRng = (o: Record<string, unknown>): boolean =>
  typeof o.next === "function" && typeof o.pick === "function" && typeof o.range === "function";

/** A deep copy of `v`: shared references kept shared, functions shared, a
 * stream (an `Rng`) dealt afresh off `seed`. */
function copy(v: unknown, seen: Map<object, unknown>, seed: { n: number }): unknown {
  if (v === null || typeof v !== "object") return v;
  const known = seen.get(v);
  if (known !== undefined) return known;
  if (ArrayBuffer.isView(v)) {
    const out = (v as unknown as { slice(): unknown }).slice();
    seen.set(v, out);
    return out;
  }
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    seen.set(v, out);
    for (const x of v) out.push(copy(x, seen, seed));
    return out;
  }
  if (v instanceof Map) {
    const out = new Map();
    seen.set(v, out);
    for (const [k, x] of v) out.set(k, copy(x, seen, seed));
    return out;
  }
  if (v instanceof Set) {
    const out = new Set();
    seen.set(v, out);
    for (const x of v) out.add(copy(x, seen, seed));
    return out;
  }
  const o = v as Record<string, unknown>;
  if (isRng(o)) {
    const out = createRng((seed.n = (seed.n * 1103515245 + 12345) >>> 0));
    seen.set(v, out);
    return out;
  }
  const out: Record<string, unknown> = {};
  seen.set(v, out);
  for (const k of Object.keys(o)) out[k] = copy(o[k], seen, seed);
  return out;
}

/** THE RUN COPIED for reading ahead: the player's own, on the same map,
 * the field and the crowd left out; nothing in it shared with the run but
 * the map and the pure functions. */
export function forkRun(state: GameState): GameState {
  const seen = new Map<object, unknown>([[state.level, state.level]]);
  const bare = { ...state, rivals: [], crowd: undefined, field: undefined };
  return copy(bare, seen, { n: (state.seed ^ state.tick) >>> 0 }) as GameState;
}

/** How bad a wound reads, for which of a blow's wounds is its shot: the
 * body cut in two, then the head, a whole leg, the trunk opened, an arm. */
const TEAR_RANK: Partial<Record<string, number>> = {
  lower: 6,
  head: 5,
  legL: 4,
  legR: 4,
  chest: 3,
  abdomen: 3,
  armL: 2,
  armR: 2,
};

type Found = Omit<Forecast, "in" | "fatal" | "mangled" | "cause" | "wrecked">;

/** The blow in one step's events, worse than `was` (the blow found so far)
 * — or `was` again. A skull crushed is shot on the skull. */
function worse(events: readonly GameEvent[], was: Found | null): Found | null {
  let best = was;
  const rank = (f: Found | null): number =>
    !f ? -1 : f.tear ? (TEAR_RANK[f.tear.piece ?? ""] ?? (f.tear.piece ? 1 : 0)) : 0;
  for (const e of events) {
    if (e.kind === "gore") {
      const at = { x: e.x, y: e.y, z: e.z };
      const f: Found =
        e.what === "crush"
          ? { part: "head", bones: [], gore: true }
          : {
              part: null,
              bones: [],
              gore: true,
              tear: {
                piece: e.what === "torn" ? (e.piece as GorePiece) : null,
                at,
              },
            };
      // An opened trunk ranks as its part, kept as the stump's own shot.
      const r = e.what === "open" ? (TEAR_RANK[e.piece ?? ""] ?? 0) : rank(f);
      if (!best || (best.tear && r > rank(best))) best = f;
      continue;
    }
    if (best) continue;
    const bones = e.kind === "injury" ? worth(e) : null;
    if (bones && e.kind === "injury") best = { part: e.part, bones, gore: false };
  }
  return best;
}

/** Whether an injury of `kind` on `part` is worth the cam. */
function worth(e: {
  part: BodyPart;
  injury: Parameters<typeof bonesOf>[0];
  ais: number;
}): Bone[] | null {
  const bones = bonesOf(e.injury, e.part);
  return bones.length > 0 || e.ais >= FORECAST.ais ? bones : null;
}

/** READ THE RUN AHEAD: the first blow worth the cam within `horizon` s if
 * the player holds `input`, or null. */
export function forecast(
  state: GameState,
  input: SkierInput,
  horizon: number = FORECAST.horizon,
): Forecast | null {
  const run = forkRun(state);
  const steps = Math.round(horizon / TUNING.dt);
  const worst = Math.round(FORECAST.worst / TUNING.dt);
  let strike: Strike | undefined;
  /** One step on, the strike in it kept (the first). */
  const on = (i: number): void => {
    const smears = run.gore?.smears.length ?? 0;
    const way = wayOf(run);
    step(run, input);
    const s = strike ? null : struckIn(run, smears, way);
    if (s) strike = { ...s, in: i * TUNING.dt };
  };
  for (let i = 1; i <= steps; i++) {
    on(i);
    let found = worse(run.events, null);
    if (found) {
      const first = i;
      // On through the tumble for whether he dies of it — and through the
      // wounds the same blow does a step or two on for its worst.
      for (let j = 0; j < Math.round(FORECAST.after / TUNING.dt); j++) {
        if (j >= worst && diesOf(run) && (strike || j >= STRIKE_AFTER)) break;
        on(first + j + 1);
        if (j < worst && found.tear) found = worse(run.events, found)!;
      }
      return {
        in: first * TUNING.dt,
        ...found,
        fatal: diesOf(run),
        mangled: mangled(run),
        cause: run.gore?.cause ?? null,
        wrecked: wrecked(run),
        ...(strike ? { strike } : {}),
      };
    }
    if (run.progress.finished) break;
  }
  return null;
}

/** Whether a run's skier is dying (`GoreState.mortal`, or dead). */
const diesOf = (s: GameState): boolean => !!s.gore && (s.gore.mortal >= 0 || s.gore.dead >= 0);

/** THE READ SPREAD OVER FRAMES: a copy of the run stepped on `per` steps a
 * frame rather than all at once, so reading ahead never costs one frame
 * its whole budget. A read that finds a blow says how far it is off the
 * run as it stands now; a read that reaches the horizon clean starts again
 * off the run as it is. */
export type Forecaster = {
  /** Read on for a frame: the blow seen coming, or null. */
  frame(state: GameState, input: SkierInput): Forecast | null;
  /** Forget the read under way (a new run, the cam put down). */
  drop(): void;
};

export function createForecaster(per = 10, horizon: number = FORECAST.horizon): Forecaster {
  let run: GameState | null = null;
  let level: GameState["level"] | null = null;
  let input: SkierInput | null = null;
  let left = 0;
  /** The blow found, while the read goes on for whether it kills him, and
   * the step it lands on. */
  let found: Found | null = null;
  let at = 0;
  /** The strike found in the read, and the step it comes on. */
  let strike: Struck | null = null;
  let struckAt = 0;
  const dies = diesOf;
  const verdict = (state: GameState, fatal: boolean): Forecast => {
    const f: Forecast = {
      ...found!,
      in: Math.max(0, (at - state.tick) * TUNING.dt),
      fatal,
      mangled: !!run && mangled(run),
      cause: run?.gore?.cause ?? null,
      wrecked: !!run && wrecked(run),
      ...(strike
        ? { strike: { ...strike, in: Math.max(0, (struckAt - state.tick) * TUNING.dt) } }
        : {}),
    };
    run = null;
    found = null;
    strike = null;
    return f;
  };
  return {
    frame(state, held) {
      if (!run || level !== state.level || run.tick < state.tick) {
        run = forkRun(state);
        level = state.level;
        input = { ...held };
        left = Math.round(horizon / TUNING.dt);
        found = null;
        strike = null;
      }
      const most = found ? FORECAST.afterPer : per;
      for (let i = 0; i < most && left > 0; i++, left--) {
        const smears = run.gore?.smears.length ?? 0;
        const way = wayOf(run);
        step(run, input!);
        if (!strike) {
          strike = struckIn(run, smears, way);
          if (strike) struckAt = run.tick;
        }
        const settled = !!found && run.tick - at >= Math.round(FORECAST.worst / TUNING.dt);
        if (found) {
          // The same blow's worse wounds a step or two on (`FORECAST.worst`).
          if (!settled && found.tear) found = worse(run.events, found);
          if (settled && dies(run) && (strike || run.tick - at >= STRIKE_AFTER))
            return verdict(state, true);
          continue;
        }
        found = worse(run.events, null);
        if (found) {
          at = run.tick;
          left = Math.round(FORECAST.after / TUNING.dt);
        }
        if (!found && run.progress.finished) left = 0;
      }
      if (left <= 0) {
        if (found) return verdict(state, false);
        run = null;
      }
      return null;
    },
    drop() {
      run = null;
      found = null;
      strike = null;
    },
  };
}
