// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HURT BY HIS OWN BIKE (`make bike-tangle`, `tests/bike_tangle_test.ts`):
// the downhill bike crashed again and again through the game's own step —
// over the bars off a ledge at 20, 35, 50 and 65 km/h, and
// laid down at full lock on a steep meadow at the same speeds — each crash
// a little off the last (the line a few centimetres aside, so every hash
// is drawn afresh), on a run with its INJURIES on; and each read for what
// the bike did to him: its blows on his body, the parts that caught a limb,
// the strikes dealt at the throw, the injuries it did, the pieces it tore
// off and whether he died of it.

import {
  bikeWorldOf,
  createGame,
  NEUTRAL_INPUT,
  placeBike,
  severityOf,
  step,
  TUNING,
  type GameState,
  type Level,
  type SkierInput,
} from "@engine";
import { shapedLevel } from "./synthetic.ts";

/** What one crash came to. */
export type TangleResult = {
  thrown: boolean;
  how: string | null;
  /** Blows off the bike's parts on his body, and the hardest closing speed
   * of one, m/s. */
  blows: number;
  hardest: number;
  /** The parts that caught a limb, and the strikes dealt at the throw. */
  snags: string[];
  struck: string[];
  /** Injuries taken while a bike blow was on him (the step of one). */
  injuries: string[];
  /** All the injuries of the fall, and the worst severity score. */
  all: number;
  iss: number;
  torn: string[];
  died: boolean;
  /** Whether the hardest blow of the fall the g meter billed was the
   * bike's. */
  billed: boolean;
  /** The hardest yank of a caught limb, m/s. */
  yank: number;
};

export type TangleRow = {
  id: string;
  label: string;
  kmh: number;
  kind: "bars" | "laid";
  runs: number;
};

/** A LEDGE across a gentle meadow: the ground up 0.9 m over 0.15 m at
 * z = 300 — a log or a rock step the front wheel stops dead against. */
const LEDGE = 300;
let bench: Level | null = null;
function ledgeLevel(): Level {
  bench ??= shapedLevel(
    (_x, z) => -0.04 * z + 0.9 * Math.min(1, Math.max(0, (z - LEDGE) / 0.15)),
    {},
  );
  return bench;
}
let meadow: Level | null = null;
/** A steep meadow falling to +x: ridden across it, full lock lays it down. */
function meadowLevel(): Level {
  meadow ??= shapedLevel((x) => -0.3 * x, {});
  return meadow;
}

/** One crash: `k` of a row's runs, its line `off` m aside. */
export function stageTangle(
  kind: "bars" | "laid",
  kmh: number,
  k: number,
  opts: { sfw?: boolean } = {},
): TangleResult {
  const off = ((k * 0.37) % 1) * 0.24 - 0.12;
  const bars = kind === "bars";
  const level = bars ? ledgeLevel() : meadowLevel();
  const x = 300 + off;
  const z = bars ? LEDGE - 7 - k * 0.11 : 300 + k * 0.53;
  let s: GameState = createGame({
    level,
    mode: "free",
    summer: true,
    bike: true,
    spawn: { x, z },
    quiet: true,
    gore: !opts.sfw,
    sfw: opts.sfw,
  });
  placeBike(s.bike!, bikeWorldOf(s.level, 0), x, z, 0, kmh / 3.6);
  s.skier.x = s.bike!.rider.x;
  s.skier.y = s.bike!.rider.y;
  s.skier.z = s.bike!.rider.z;
  const out: TangleResult = {
    thrown: false,
    how: null,
    blows: 0,
    hardest: 0,
    snags: [],
    struck: [],
    injuries: [],
    all: 0,
    iss: 0,
    torn: [],
    died: false,
    billed: false,
    yank: 0,
  };
  const lock: SkierInput = { ...NEUTRAL_INPUT, steer: 1 };
  const steps = Math.round(5 / TUNING.dt);
  for (let i = 0; i < steps; i++) {
    s = step(s, bars || i * TUNING.dt < 0.15 ? NEUTRAL_INPUT : lock);
    const blows = s.bike?.tangle?.blows ?? [];
    for (const b of blows) {
      out.blows++;
      if (b.kind !== "yank") out.hardest = Math.max(out.hardest, b.v);
      else out.yank = Math.max(out.yank, b.v);
    }
    for (const e of s.events) {
      if (e.kind === "wipeout" && !out.thrown) out.thrown = true;
      if (e.kind === "bike" && e.phase === "crash" && e.how && !out.how) out.how = e.how;
      if (e.kind === "bike" && e.phase === "snag" && e.part) out.snags.push(e.part);
      if (e.kind === "bike" && e.phase === "struck" && e.part) out.struck.push(e.part);
      if (e.kind === "injury") {
        out.all++;
        if (blows.length) out.injuries.push(`${e.part}:${e.injury}:${e.ais}`);
      }
      if (e.kind === "gore" && e.what === "torn" && e.piece) out.torn.push(e.piece);
      if (e.kind === "death") out.died = true;
    }
    out.iss = Math.max(out.iss, severityOf(s.skier.body));
    const hit = s.skier.body.impact;
    if (hit && hit.t === 0 && hit.fall) out.billed = hit.source === "bike";
    if (out.died) break;
  }
  return out;
}

export const TANGLE_ROWS: readonly TangleRow[] = [20, 35, 50, 65].flatMap(
  (kmh) =>
    [
      {
        id: `bars-${kmh}`,
        label: `over the bars off a ledge at ${kmh} km/h`,
        kmh,
        kind: "bars",
        runs: 24,
      },
      {
        id: `laid-${kmh}`,
        label: `laid down at full lock at ${kmh} km/h`,
        kmh,
        kind: "laid",
        runs: 24,
      },
    ] as TangleRow[],
);

/** A row's runs summed: the share of crashes the bike hurt him in, caught
 * a limb, dealt a strike, tore a piece off, killed him. */
export type TangleSum = {
  id: string;
  thrown: number;
  hurt: number;
  hit: number;
  snagged: number;
  struck: number;
  injuries: number;
  torn: number;
  died: number;
  parts: Record<string, number>;
  hardest: number;
  /** Every injury of the row's falls, and their mean severity score. */
  all: number;
  iss: number;
  billed: number;
  yank: number;
};

export function sumRow(row: TangleRow, results: readonly TangleResult[]): TangleSum {
  const parts: Record<string, number> = {};
  for (const r of results)
    for (const p of [...r.snags, ...r.struck]) parts[p] = (parts[p] ?? 0) + 1;
  const n = (f: (r: TangleResult) => boolean) => results.filter(f).length;
  return {
    id: row.id,
    thrown: n((r) => r.thrown),
    hurt: n((r) => r.injuries.length > 0),
    hit: n((r) => r.blows > 0),
    snagged: n((r) => r.snags.length > 0),
    struck: n((r) => r.struck.length > 0),
    injuries: results.reduce((a, r) => a + r.injuries.length, 0),
    torn: n((r) => r.torn.length > 0),
    died: n((r) => r.died),
    parts,
    hardest: Math.max(0, ...results.map((r) => r.hardest)),
    all: results.reduce((a, r) => a + r.all, 0),
    iss: results.reduce((a, r) => a + r.iss, 0) / Math.max(1, results.length),
    billed: n((r) => r.billed),
    yank: Math.max(0, ...results.map((r) => r.yank)),
  };
}

export function runRow(row: TangleRow): TangleResult[] {
  return Array.from({ length: row.runs }, (_, k) => stageTangle(row.kind, row.kmh, k));
}
