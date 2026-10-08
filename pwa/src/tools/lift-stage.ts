// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT LABS' STAGES — the six moments a skier gets on and off a lift,
// each stood up the way the game stands one up and ridden on the engine's
// own clock, for the picture lab (`lift-ride-harness.ts`, `make lift-board`)
// and the measuring lab (`scripts/lift-flow-lab.mjs`, `make lift-flow`)
// alike — so both judge the same ride. Three-free and DOM-free.
//
//   chair-load     rolled into a chair's boarding ring, up the queue's lane
//                  to the load line, the chair coming and scooping him up
//   chair-unload   a free ride begun on the chair, carried to its top and
//                  stood off down the unload ramp
//   tbar-pick      rolled into a drag's boarding ring, onto its track, the
//                  bar coming round and the pull taken up
//   tbar-release   a free ride begun on the drag, towed to the let-go and
//                  skiing away
//   gondola-in     rolled into a gondola's boarding ring, through its door
//                  onto the platform, the cabin coming round and stepped into
//   gondola-out    a free ride begun in a cabin, carried into the top station
//                  and out onto its pad
//
// A stage's WINDOW is the stretch of the run its moment fills, in seconds
// on the run's clock: from a little before its first event to a little
// after its last, found by riding it once.

import {
  boardingRing,
  createGame,
  liftPlans,
  NEUTRAL_INPUT,
  queueLane,
  standSkier,
  step,
  type GameState,
  type LiftKind,
  type RegionId,
} from "@engine";

export type StageId =
  "chair-load" | "chair-unload" | "tbar-pick" | "tbar-release" | "gondola-in" | "gondola-out";

export const STAGES: readonly StageId[] = [
  "chair-load",
  "chair-unload",
  "tbar-pick",
  "tbar-release",
  "gondola-in",
  "gondola-out",
];

/** The kind of lift a stage rides, and whether it is the lift's top. */
export function stageOf(id: StageId): { kind: LiftKind; top: boolean } {
  const kind: LiftKind = id.startsWith("chair")
    ? "chair"
    : id.startsWith("tbar")
      ? "drag"
      : "gondola";
  return { kind, top: id.endsWith("unload") || id.endsWith("release") || id.endsWith("out") };
}

/** A free ride stood at a lift's foot: just outside its boarding ring on
 * the queue's lane, rolling in from beyond the corral — `approach` `lane`
 * facing in (the default), `wrong` from the corral's side facing away,
 * `side` across it. Null where the map has no such lift. */
export function atFoot(
  seed: number,
  region: RegionId | undefined,
  kind: LiftKind,
  approach = "lane",
  crowd?: number,
): GameState | null {
  const state = createGame({
    seed,
    region,
    mode: "free",
    quiet: true,
    ...(crowd !== undefined ? { crowd } : {}),
  });
  const plan = liftPlans(state.level).find((p) => p.lift.kind === kind);
  if (!plan) return null;
  const ring = boardingRing(plan);
  const lane = queueLane(plan);
  const a = lane[lane.length - 2];
  const b = lane[lane.length - 1];
  const len = Math.hypot(b.u - a.u, b.v - a.v) || 1;
  // Outward along the lane's last leg, in the world.
  const ou = (b.u - a.u) / len;
  const ov = (b.v - a.v) / len;
  const ox = plan.dx * ou + plan.dz * ov;
  const oz = plan.dz * ou - plan.dx * ov;
  const [fx, fz, out] =
    approach === "wrong" ? [ox, oz, 5] : approach === "side" ? [oz, -ox, 5] : [-ox, -oz, 7];
  standSkier(state, ring.x - fx * out, ring.z - fz * out, Math.atan2(fx, fz));
  state.skier.vx = fx * 3.5;
  state.skier.vz = fz * 3.5;
  return state;
}

/** A free ride begun on a lift of `kind`, a few seconds short of its top:
 * up the first run its top serves (`createGame`'s `byLift`, `run`). Null
 * where the map has no such lift serving a run. */
export function onLift(
  seed: number,
  region: RegionId | undefined,
  kind: LiftKind,
  crowd?: number,
): GameState | null {
  const probe = createGame({ seed, region, mode: "free", quiet: true, crowd: 0 });
  const lift = probe.level.resort?.lifts.find((l) => l.kind === kind);
  const run = probe.level.resort?.runs.find((r) => r.from === lift?.id && r.kind === "piste");
  if (!lift || !run) return null;
  const state = createGame({
    seed,
    region,
    mode: "free",
    byLift: true,
    run: run.id,
    quiet: true,
    ...(crowd !== undefined ? { crowd } : {}),
  });
  return state.skier.lift?.kind === kind ? state : null;
}

/** A stage stood up at its start. */
export function stageState(
  id: StageId,
  seed: number,
  region?: RegionId,
  crowd?: number,
): GameState | null {
  const { kind, top } = stageOf(id);
  return top ? onLift(seed, region, kind, crowd) : atFoot(seed, region, kind, "lane", crowd);
}

/** The stretch of the run a stage's moment fills, s on the run's clock —
 * found by riding it once with nothing drawn: from `before` s before its
 * key event (the carrier taking him at a foot, stood off at a top) to
 * `after` s after it — or, `whole`, a foot's from the run's start (the
 * roll in, the skate up the lane, the wait). Each event the lift reported
 * on the way, with its time. */
export function stageWindow(
  id: StageId,
  seed: number,
  region?: RegionId,
  opts: { before?: number; after?: number; crowd?: number; whole?: boolean } = {},
): { from: number; to: number; events: { t: number; phase: string }[] } | null {
  const state = stageState(id, seed, region, opts.crowd);
  if (!state) return null;
  const { top } = stageOf(id);
  const events: { t: number; phase: string }[] = [];
  const before = opts.before ?? 3;
  const after = opts.after ?? 4;
  let begin = NaN;
  let end = NaN;
  while (state.t < 240 && !Number.isFinite(end)) {
    step(state, NEUTRAL_INPUT);
    for (const e of state.events) {
      if (e.kind !== "lift") continue;
      events.push({ t: e.t, phase: e.phase });
      if ((!top && e.phase === "take") || (top && e.phase === "off")) {
        begin = e.t - before;
        end = e.t + after;
      }
    }
  }
  if (!Number.isFinite(end)) return null;
  return { from: opts.whole && !top ? 0 : Math.max(0, begin), to: end, events };
}
