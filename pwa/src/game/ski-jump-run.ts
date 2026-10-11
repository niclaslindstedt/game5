// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI JUMPING CONTEST FROM THE APP'S SIDE (R43): one jump a run on the
// hill — the trial round's, round 1's and the final's — what the HUD reads
// of it moment by moment (on the BAR the start light, the wind, the gate,
// the bib and the leader to beat; down the TRACKS the speed; over the EDGE
// its speed and how the push was timed; in the AIR the attitude; DOWN the
// distance), the jump SCORED once it is over (the distance's points, the
// five judges' marks, the gate's and the wind's), the round's board and
// the final ranking, what the plate offers next, and the CONTEST the next
// jump is stood up with (`CreateGameOptions.skiJumpContest`).
//
// THE CONTEST RIDES THE RUN, as the other freestyle formats' do: each jump
// carries the contest as it stood before it (`GameState.skiJumpContest`),
// so a restart and a replay stand the same jump up again from the same
// gate in the same air, and the contest after it is that one with this
// jump filed (`skiJumpContestAfter`). Nothing here judges, deals or flies:
// the engine does all three (`ski-jump-judge.ts`, `ski-jump-contest.ts`).
//
// DOM-free and storage-free: `tests/ski_jump_hud_test.ts` reads it.

import {
  HILL_AIR,
  JUMP,
  SKI_JUMP,
  distancePoints,
  finalists,
  freshSkiJumpContest,
  gatePoints,
  idealAoa,
  levelFor,
  roundPlan,
  rivalJump,
  setSkiJump,
  skiJumpBoard,
  skiJumpContestAfter,
  skiJumpRoundOf,
  skiJumpSetup,
  skiJumpStandings,
  skipTrial,
  judgeSkiJumpRun,
  windAlong,
  type CreateGameOptions,
  type GameState,
  type JumpRun,
  type JumpStage,
  type SkiJumpContest,
  type SkiJumpRound,
} from "@engine";

/** How many of the board the plate shows: the top ten, and the player. */
export const SKI_JUMP_BOARD_ROWS = 10;

/** How long after the edge the take-off's word holds the screen, s. */
export const TAKE_OFF_HOLD = 1.4;

/** An attitude within this many degrees of the ideal reads as held. */
export const ATTITUDE_HELD = 5;

/** How the push off the edge was timed (`JumpRecord.timing`). */
export type TakeOffWord = "early" | "perfect" | "late" | "none";

/** WHAT THE PLATE OFFERS after a jump: the next round (and his place in
 * this one), out of the final at his place, or the contest over. */
export type SkiJumpNext =
  | { kind: "round"; round: SkiJumpRound; place: number }
  | { kind: "out"; place: number }
  | { kind: "done"; place: number };

/** A ROW OF THE BOARD on the plate: his place, who, the jump's distance
 * (the final's both), its points (the final's total), a fall, no start. */
export type SkiJumpBoardRow = {
  place: number;
  id: number;
  you: boolean;
  distances: number[];
  points: number;
  fell: boolean;
  dns: boolean;
};

/** THE LEADER as the bar reads him: his points (in the final his total of
 * both rounds) and the distance the player needs to pass him from this
 * gate in calm air, m to the half metre. */
export type SkiJumpLeader = { points: number; toBeat: number };

/** A SKI JUMP AS THE HUD READS IT. */
export type SkiJumpHud = {
  round: SkiJumpRound;
  stage: JumpStage;
  /** The hill's size, m. */
  hs: number;
  /** The gate sat on (its number). */
  gate: number;
  /** His start number in the round and how many jump it. */
  bib: number;
  of: number;
  /** THE START LIGHT: red while the count runs, green once he may go, null
   * off the bar — and the seconds the count or the window has left. */
  light: "red" | "green" | null;
  left: number;
  /** The wind at the edge, m/s (head positive) and across (to the right),
   * and whether a tail wind is past what the jury lets a jumper go in. */
  wind: number;
  across: number;
  gusty: boolean;
  /** The leader to beat, or null where nobody has jumped before him. */
  leader: SkiJumpLeader | null;
  /** Down the tracks his speed, km/h; over the edge its speed and the
   * push's word, held a moment (null before the edge or once it has gone). */
  speed: number;
  edgeSpeed: number | null;
  takeOff: TakeOffWord | null;
  /** IN THE AIR: the skis' angle to the air and the ideal, deg, and how far
   * the V is open (0..1); null on the snow. */
  attitude: { aoa: number; ideal: number; vee: number } | null;
  /** DOWN: the distance, m, and how he came down. */
  distance: number | null;
  landing: "telemark" | "twoFooted" | "late" | "fall" | null;
  /** THE JUMP SCORED once it is over — null while it is on. */
  judged: JumpRun | null;
  /** His total of both rounds once the final is jumped. */
  total: number | null;
  /** The round's board after this jump (the final's the ranking), best
   * first — the top ten and the player. Empty while the jump is on. */
  board: SkiJumpBoardRow[];
  next: SkiJumpNext | null;
};

/** How the push off the edge was timed, in the word the screen says it in. */
export function takeOffWord(timing: number | null): TakeOffWord {
  if (timing === null) return "none";
  if (Math.abs(timing) <= JUMP.takeOff.sweet) return "perfect";
  return timing < 0 ? "early" : "late";
}

/** The rounds' cached readouts: the leader is the same for every frame of
 * one jump, the board for every frame after it. */
const leaders = new WeakMap<SkiJumpContest, SkiJumpLeader | null>();
const afters = new WeakMap<
  SkiJumpContest,
  { points: number; distance: number; hud: Pick<SkiJumpHud, "board" | "next" | "total"> }
>();

/** THE SKI JUMP'S READOUTS at this step, or null on any other run. */
export function skiJumpOf(state: GameState): SkiJumpHud | null {
  const c = state.skiJumpContest;
  const j = state.jump;
  const hill = state.level.skiJump;
  if (!c || !j || !hill) return null;
  const round = skiJumpRoundOf(c) ?? "final";
  const plan = roundPlan(c, round);
  const bib = Math.max(0, plan.ids.indexOf(-1)) + 1;
  const r = j.record;
  const wind = windAlong(state, j, 0);
  const counting = state.phase === "countdown";
  const onBar = j.stage === "bar" && !state.progress.out;
  const sinceEdge = j.edgeAt >= 0 ? state.t - j.edgeAt : -1;
  const edging = sinceEdge >= 0 && sinceEdge < TAKE_OFF_HOLD;
  const touched = r.landing !== null;
  const judged = judgeSkiJumpRun(state);
  const after = judged ? afterOf(state, c, judged) : null;
  return {
    round,
    stage: j.stage,
    hs: hill.hs,
    gate: hill.gates[j.gate]?.number ?? j.gate + 1,
    bib,
    of: plan.ids.length,
    light: onBar ? (counting ? "red" : "green") : null,
    left: counting
      ? state.countdown
      : Math.max(0, state.rules.window - (state.t - state.rules.countdown)),
    wind: wind.head,
    across: wind.across,
    gusty: wind.head < -HILL_AIR.holdTail,
    leader: leaderOf(c),
    speed: (j.stage === "tracks" ? j.speed : j.stage === "bar" ? 0 : r.edgeSpeed) * 3.6,
    edgeSpeed: edging ? r.edgeSpeed * 3.6 : null,
    takeOff: edging ? takeOffWord(r.timing) : null,
    attitude:
      j.stage === "air" && !edging
        ? { aoa: (j.aoa * 180) / Math.PI, ideal: idealAoa(Math.max(0, sinceEdge)), vee: j.vee }
        : null,
    distance: touched ? r.distance : null,
    landing: r.landing,
    judged,
    total: after?.total ?? null,
    board: after?.board ?? [],
    next: after?.next ?? null,
  };
}

/** THE LEADER the player jumps against: the best of those before him in
 * the round's start order — in the final on their total of both rounds —
 * and the distance that passes him. */
export function leaderOf(c: SkiJumpContest): SkiJumpLeader | null {
  const kept = leaders.get(c);
  if (kept !== undefined) return kept;
  const round = skiJumpRoundOf(c);
  let found: SkiJumpLeader | null = null;
  if (round) {
    const plan = roundPlan(c, round);
    const me = plan.ids.indexOf(-1);
    const firstPoints = new Map(
      round === "final"
        ? skiJumpBoard(c, "first").map((row) => [row.id, row.jump?.points ?? 0])
        : [],
    );
    let best = -Infinity;
    for (let k = 0; k < me; k++) {
      const id = plan.ids[k];
      const jump = rivalJump(c, id, round, plan.at[k], plan.gates[k], plan.reference);
      const points = jump.points + (firstPoints.get(id) ?? 0);
      if (points > best) best = points;
    }
    if (best > -Infinity) {
      const setup = skiJumpSetup(c);
      const mine = round === "final" ? (c.jumps[c.rounds.indexOf("first")]?.points ?? 0) : 0;
      const v = c.venue;
      const gate = setup ? gatePoints(v, v.inRun[setup.gate], v.inRun[setup.reference]) : 0;
      // The style a clean jump is marked (three judges' 18) and calm air.
      const need = best - mine - gate - 54;
      const base = distancePoints(v, v.w);
      const metres = v.w + (need - base) / v.metre;
      found = { points: Math.round(best * 10) / 10, toBeat: Math.ceil(metres * 2 + 1e-9) / 2 };
    }
  }
  leaders.set(c, found);
  return found;
}

/** The board, the total and what comes next, once the jump is scored —
 * worked out once a jump. */
function afterOf(state: GameState, c: SkiJumpContest, judged: JumpRun) {
  const kept = afters.get(c);
  if (kept && kept.points === judged.points && kept.distance === judged.distance) return kept.hud;
  const round = skiJumpRoundOf(c) ?? "final";
  const filed = skiJumpContestAfter(state)!;
  const hud = {
    board: round === "final" ? rankingRows(filed) : roundRows(filed, round),
    total: round === "final" ? totalOf(filed) : null,
    next: nextOf(filed, round),
  };
  afters.set(c, { points: judged.points, distance: judged.distance, hud });
  return hud;
}

function roundRows(c: SkiJumpContest, round: SkiJumpRound): SkiJumpBoardRow[] {
  const rows = skiJumpBoard(c, round).map((row) => ({
    place: row.place,
    id: row.id,
    you: row.id === -1,
    distances: [row.jump?.distance ?? 0],
    points: row.jump?.points ?? 0,
    fell: row.jump?.fell ?? false,
    dns: row.jump?.dns ?? true,
  }));
  return topAndYou(rows);
}

/** THE FINAL RANKING: the finalists on both rounds, then the rest. */
function rankingRows(c: SkiJumpContest): SkiJumpBoardRow[] {
  const rows = skiJumpStandings(c).map((s) => ({
    place: s.place,
    id: s.id,
    you: s.id === -1,
    distances: [s.first?.distance ?? 0, ...(s.final ? [s.final.distance] : [])],
    points: s.total,
    fell: Boolean(s.first?.fell || s.final?.fell),
    dns: s.first?.dns ?? true,
  }));
  return topAndYou(rows);
}

/** The board's cut: the first ten, and the player's own row under them
 * wherever he stands. */
function topAndYou(rows: SkiJumpBoardRow[]): SkiJumpBoardRow[] {
  const top = rows.slice(0, SKI_JUMP_BOARD_ROWS);
  const you = rows.find((r) => r.you);
  return you && !top.includes(you) ? [...top, you] : top;
}

function totalOf(c: SkiJumpContest): number {
  return skiJumpStandings(c).find((s) => s.id === -1)?.total ?? 0;
}

function placeIn(c: SkiJumpContest, round: SkiJumpRound): number {
  if (round === "final") return skiJumpStandings(c).find((s) => s.id === -1)?.place ?? 0;
  return skiJumpBoard(c, round).find((row) => row.id === -1)?.place ?? 0;
}

function nextOf(c: SkiJumpContest, round: SkiJumpRound): SkiJumpNext {
  const going = skiJumpRoundOf(c);
  if (going) return { kind: "round", round: going, place: placeIn(c, round) };
  if (round === "final") return { kind: "done", place: placeIn(c, "final") };
  // Out of the final: where the first round left him.
  return { kind: "out", place: placeIn(c, "first") };
}

/** THE CONTEST THE NEXT JUMP IS STOOD UP WITH: this jump filed — or null
 * where the jump is still on, or the contest is over for him. */
export function nextSkiJumpContest(state: GameState): SkiJumpContest | null {
  const after = skiJumpContestAfter(state);
  return after && skiJumpRoundOf(after) !== null ? after : null;
}

/** Whether `c` has put the player through to the final. */
export function inFinal(c: SkiJumpContest): boolean {
  return finalists(c).includes(-1);
}

/** A SKI JUMP'S OPTIONS WITH ITS CONTEST: the map built (or the one
 * handed), the hill set over it, and a fresh contest dealt off the run's
 * seed — begun at `round` (the trial round unless asked otherwise). Any
 * other mode's options, or a jump that carries its contest, come back as
 * they were. */
export function withJumpContest(
  opts: CreateGameOptions,
  round: SkiJumpRound | null = null,
): CreateGameOptions {
  if (opts.mode !== "skiJump" || opts.skiJumpContest) return opts;
  const level = levelFor(opts);
  const hill = setSkiJump(level, opts.hill ?? SKI_JUMP.hill);
  const fresh = freshSkiJumpContest(opts.seed ?? level.seed, hill);
  return { ...opts, level, skiJumpContest: round === "first" ? skipTrial(fresh) : fresh };
}
