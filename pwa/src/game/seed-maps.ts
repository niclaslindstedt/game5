// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE'S MAPS, BUILT AHEAD — the one worker the start card's
// charts are generated in (`seed-preview-worker.ts`), what it is doing and
// what it does next, and everything it has handed back: the charts, and
// the maps themselves.
//
// A MAP IS BUILT ONCE. Generating a mountain is seconds of work, and a free
// ride used to pay it twice: once in the worker for the chart, and again on
// the loading card when RIDE was pressed. The worker now hands the map back
// with the chart (`portableLevel`), it is kept here, and a free ride stood
// up on that seed rides it (`heldLevel`) — or waits for the worker if it is
// building that very map (`buildingLevel`) rather than building it a second
// time beside it.
//
// THE NEXT MOUNTAIN IS BUILT BEFORE IT IS ASKED FOR. Once the map on the
// card is built, the worker builds the one ANOTHER MOUNTAIN deals next
// (`nextFreeSeed`), so the press finds it waiting. That work is a guess and
// gives way the moment it is wrong: a seed asked for while the worker is on
// any other is the worker's next job, and the job it was on is abandoned
// with the worker itself (a worker cannot be interrupted, only ended).
//
// THE CHARTS ARE KEPT between visits (`seed-store.ts`), so a mountain seen
// before shows at once and the worker builds only its map, which is a
// little quicker than building and painting it.
//
// AND A MAP THIS THREAD ALREADY HAS IS NEVER BUILT IN THE WORKER: the
// front door stands on the first free ride mountain, and any course of the
// ski area this thread built last is stood up off it in milliseconds
// (`levelIsCached`) and handed to the worker to paint.

import {
  DEFAULT_REGION,
  boundLevel,
  generateLevel,
  levelIsCached,
  portableLevel,
  realFaceLoaded,
  type CreateGameOptions,
  type GeneratedLevel,
  type Level,
  type RunGrade,
  type RegionId,
} from "@engine";

import { buildPooled, poolOn } from "./attempt-pool.ts";
import { nextFreeSeed } from "./free-ride.ts";
import { gameOrder, type MapJob, type MapOrder } from "./map-order.ts";
import { rememberBoard } from "./map-board-picture.ts";
import { MAP_QUALITY, MAP_TYPE } from "./minimap-bake.ts";
import type {
  PreviewPainted,
  PreviewPicture,
  PreviewProgress,
  PreviewRefused,
  PreviewReply,
  PreviewRequest,
} from "./seed-preview-worker.ts";
import { readChart, writeChart } from "./seed-store.ts";

/** One map the card can ask for: a seed, in a region (R21), on a real
 * face (R25) — null or absent the dealt massif — to a grade (R23) — null
 * the seed's own. */
export type SeedAsk = {
  seed: number;
  region: RegionId;
  face?: string | null;
  grade: RunGrade | null;
};

/** What names a map. */
export const askKey = (a: SeedAsk): string =>
  `${a.face ?? a.region}:${a.grade ?? "dealt"}:${a.seed}`;

/** A chart as the card draws it: its two pictures as URLs an `<image>`
 * takes, or the seed's refusal. */
export type SeedAnswer = (PreviewPainted & { url: string; panoUrl: string }) | PreviewRefused;

/** How many charts are kept in memory — a skier walks tens of seeds, not
 * thousands — and how many maps (each two grids of nine megabytes): the
 * one on the card and the one built ahead of it. */
const KEPT = 40;
const MAPS = 2;

/** How long the worker is kept with nothing to do, ms, before it is let go
 * with the ski area it holds. */
const IDLE_MS = 30_000;

type Job = SeedAsk & { key: string; paint: boolean; behind?: Level };

let worker: Worker | null = null;
/** The map being raised by the attempt pool (`attempt-pool.ts`) rather than
 * the worker — DEVELOPER's — painted by the worker once it is in. */
let pool: MapJob | null = null;
let busy: Job | null = null;
let idle = 0;
let wanted: SeedAsk | null = null;
/** THE MAP BEING RIDDEN, to be painted behind the ride (`paintBehind`):
 * a ride stood up with no chart of its map — QUICK START's, a link's —
 * has it painted while it rides, so the pause card's PISTE MAP opens on
 * it rather than on a bar. */
let behind: { ask: SeedAsk; level: Level } | null = null;
const answers = new Map<string, SeedAnswer>();
const levels = new Map<string, GeneratedLevel>();
/** THE MAP LAST RIDDEN, kept past the ride: back on the start card for the
 * same mountain (the main menu and PLAY again), the ride stands up on it at
 * once rather than raising it again. Let go the moment another mountain is
 * asked for (`wantSeed`, `quietSeedMaps`) — one map's grids, never two. */
let ridden: { key: string; level: Level } | null = null;
/** How far the map being built has got, 0–1, by key — the job in hand's. */
const shares = new Map<string, number>();
/** Keys whose kept chart has been looked for, and those being read. */
const looked = new Set<string>();
const reading = new Set<string>();
const listeners = new Set<() => void>();
/** Whoever waits on a map being built (`buildingLevel`). */
const waiting = new Map<string, ((level: GeneratedLevel | null) => void)[]>();

/** Be told whenever a chart or a map arrives. */
export function onSeedMaps(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const notify = (): void => {
  for (const l of listeners) l();
};

/** The chart for `ask`, if one is kept. */
export function seedAnswer(ask: SeedAsk): SeedAnswer | null {
  return answers.get(askKey(ask)) ?? null;
}

/** THE MAP ON THE CARD: what the worker builds first, and what it builds
 * ahead of it once that is done. */
export function wantSeed(ask: SeedAsk): void {
  wanted = ask;
  if (ridden && ridden.key !== askKey(ask)) ridden = null;
  // A job on another mountain is a guess that was wrong, or a map nobody
  // is looking at any more: it gives way. One on this mountain in another
  // grade is let finish — the ski area it is raising is this one's too,
  // and the worker keeps it (`buildResort`'s cache).
  if (
    busy &&
    (busy.seed !== ask.seed ||
      busy.region !== ask.region ||
      (busy.face ?? null) !== (ask.face ?? null))
  ) {
    stop();
  }
  pump();
}

/** How far the worker has got building the map for `ask`, 0–1, or null
 * while it is not building it. */
export function seedShare(ask: SeedAsk): number | null {
  return shares.get(askKey(ask)) ?? null;
}

/** The map built for `ask`, if one is held. */
export function heldLevel(ask: SeedAsk): GeneratedLevel | null {
  return levels.get(askKey(ask)) ?? null;
}

/** The map last ridden, where it is the one `ask` names. */
export function riddenLevel(ask: SeedAsk): Level | null {
  return ridden?.key === askKey(ask) ? ridden.level : null;
}

/** A FREE RIDE STOOD UP on `level` for `ask`: kept for the next one. */
export function keepRidden(ask: SeedAsk, level: Level): void {
  ridden = { key: askKey(ask), level };
}

/** A FREE RIDE IS BEING STOOD UP on `ask`: nothing more is built ahead —
 * the snow is about to take every core it can get — no map is held (the
 * ride has taken the one it rides, `freeRideLevel`, or is waiting on the
 * worker for it), and the worker is ended the moment it has nothing left
 * to hand the ride. */
export function quietSeedMaps(ask: SeedAsk): void {
  const key = askKey(ask);
  wanted = null;
  behind = null;
  if (busy && busy.key !== key) stop();
  levels.clear();
  if (ridden?.key !== key) ridden = null;
  pump();
}

/** THE START CARD LEFT FOR THE RIDER CARD on `ask`: the ride is decided
 * but for the skier, and its world is about to be built behind the rider
 * and gear cards (`free-stage.ts`) — the heaviest thing the tab does. So
 * nothing more is built ahead, the map ahead is let go, and the worker goes
 * the moment it has nothing left to hand this ride (it may be raising its
 * very map), with the ski area it holds: on a phone the stage and a worker
 * raising the next mountain beside it were more than the tab was given.
 * Back on the start card, the card asks again (`wantSeed`). */
export function leaveSeedCard(ask: SeedAsk): void {
  const key = askKey(ask);
  wanted = null;
  if (busy && busy.key !== key) stop();
  for (const k of [...levels.keys()]) if (k !== key) levels.delete(k);
  if (ridden && ridden.key !== key) ridden = null;
  pump();
}

/** A FREE RIDE IS UNDER WAY on `level`, the map `ask` names: if no chart
 * of it is held or kept, the worker paints one off that very map (never
 * building it again) and is let go — so the pause card's PISTE MAP and the
 * start card find it painted. A ride stood up off the start card has its
 * chart already, and nothing is done. */
export function paintBehind(ask: SeedAsk, level: Level): void {
  if (answers.has(askKey(ask))) return;
  behind = { ask, level };
  pump();
}

/** The map the worker is building for `ask` — null at once if it is not
 * building it, so the caller builds it itself. */
export function buildingLevel(ask: SeedAsk): Promise<GeneratedLevel | null> | null {
  const key = askKey(ask);
  if (busy?.key !== key) return null;
  return new Promise((resolve) => {
    const list = waiting.get(key) ?? [];
    list.push(resolve);
    waiting.set(key, list);
  });
}

function settle(key: string, level: GeneratedLevel | null): void {
  const list = waiting.get(key);
  waiting.delete(key);
  for (const done of list ?? []) done(level);
}

/** The worker ended, and whatever it was doing with it. */
function stop(): void {
  worker?.terminate();
  worker = null;
  pool?.cancel();
  pool = null;
  shares.clear();
  if (busy) settle(busy.key, null);
  busy = null;
}

/** The map after the one on the card: ANOTHER MOUNTAIN's. */
const aheadOf = (ask: SeedAsk): SeedAsk => ({ ...ask, seed: nextFreeSeed(ask.seed) });

/** What the worker should do next, and set it doing it. */
function pump(): void {
  if (busy) return;
  for (const ask of wanted ? [wanted, aheadOf(wanted)] : []) {
    const key = askKey(ask);
    const answer = answers.get(key);
    if (answer && !answer.ok) continue;
    if (answer && (levels.has(key) || ridden?.key === key)) continue;
    // Its kept chart looked for first: a map whose chart is kept is only
    // built, never painted.
    if (!answer && !looked.has(key)) {
      look(ask, key);
      return;
    }
    run({ ...ask, key, paint: !answer });
    return;
  }
  // The map ridden, painted once nothing on a card is waiting.
  if (!wanted && behind) {
    const { ask, level } = behind;
    const key = askKey(ask);
    if (answers.has(key)) behind = null;
    else if (!looked.has(key)) {
      look(ask, key);
      return;
    } else {
      behind = null;
      run({ ...ask, key, paint: true, behind: level });
      return;
    }
  }
  window.clearTimeout(idle);
  // A FREE RIDE IS BEING STOOD UP (`quietSeedMaps`): the worker goes now,
  // with the ski area it holds — tens of megabytes of its own heap that the
  // load is about to want, on a phone where the tab has none to spare.
  if (!wanted) {
    stop();
    return;
  }
  // Nothing left: the worker goes after a while, with the ski area it holds.
  idle = window.setTimeout(() => {
    if (!busy) stop();
  }, IDLE_MS);
}

function look(ask: SeedAsk, key: string): void {
  if (reading.has(key)) return;
  reading.add(key);
  void readChart(key)
    .then((chart) => (chart && !answers.has(key) ? keep(key, chart) : undefined))
    .then(() => {
      reading.delete(key);
      looked.add(key);
      pump();
    });
}

function run(job: Job): void {
  window.clearTimeout(idle);
  // A map this thread can stand up off the ski area it built last is
  // never built twice: it is stood up here and handed over to be painted.
  const own =
    (job.behind as GeneratedLevel | undefined) ??
    levels.get(job.key) ??
    ((!job.face || realFaceLoaded(job.face)) &&
    levelIsCached(job.seed, { region: job.region, face: job.face ?? undefined })
      ? generateLevel(job.seed, {
          region: job.region,
          face: job.face ?? undefined,
          grade: job.grade ?? undefined,
        })
      : null);
  // The map ridden is the ride's, never held here a second time.
  if (own && !job.behind) holdLevel(job.key, own);
  if (own && !job.paint) {
    pump();
    return;
  }
  busy = job;
  // The bar goes up at once for a map to be raised: the worker takes a
  // moment to start, a real face is fetched before its mountain is raised,
  // and that mountain takes seconds before the generator's first landmark.
  if (!own) {
    shares.set(job.key, 0);
    notify();
  }
  if (!own && poolOn()) {
    raise(job);
    return;
  }
  const w = worker ?? spawn();
  const ask: PreviewRequest = {
    seed: job.seed,
    region: job.region,
    face: job.face ?? null,
    grade: job.grade,
    paint: job.paint,
    ...(own ? { level: portableLevel(own) } : {}),
  };
  w.postMessage(ask);
}

/** Raise `job`'s map on the attempt pool; once it is in, it is held, the
 * ride waiting on it handed it, and the worker paints it (`pump`). */
function raise(job: Job): void {
  const order: MapOrder = {
    seed: job.seed,
    generate: { region: job.region, face: job.face ?? undefined, grade: job.grade ?? undefined },
  };
  const own = buildPooled(order, () => {
    if (pool !== own) return;
    const level = own.level() as GeneratedLevel | undefined;
    const failed = own.failed();
    if (!level && failed === null) {
      shares.set(job.key, own.share());
      notify();
      return;
    }
    pool = null;
    busy = null;
    shares.delete(job.key);
    if (level) {
      holdLevel(job.key, level);
      settle(job.key, level);
    } else {
      const { seed, region, grade, key } = job;
      void keep(key, {
        seed,
        region,
        face: job.face ?? null,
        grade,
        ok: false,
        error: failed ?? "",
      });
      settle(key, null);
    }
    notify();
    pump();
  });
  pool = own;
}

function spawn(): Worker {
  const w = new Worker(new URL("./seed-preview-worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent<PreviewReply | PreviewProgress>) => {
    if (w !== worker) return;
    const reply = e.data;
    const key = askKey(reply);
    if ("share" in reply) {
      shares.set(key, reply.share);
      notify();
      return;
    }
    shares.delete(key);
    const job = busy;
    busy = null;
    if (!reply.ok) {
      void keep(key, reply);
      settle(key, null);
    } else {
      const level = levels.get(key) ?? (reply.level ? boundLevel(reply.level) : null);
      if (level && !job?.behind) holdLevel(key, level);
      settle(key, level);
      if (reply.painted) {
        void writeChart(key, reply.painted);
        void keep(key, reply.painted);
      }
    }
    notify();
    pump();
  };
  w.onerror = () => {
    if (w !== worker) return;
    const job = busy;
    stop();
    if (job) {
      const { seed, region, grade, key } = job;
      const face = job.face ?? null;
      void keep(key, { seed, region, face, grade, ok: false, error: "the worker failed" });
    }
    notify();
  };
  worker = w;
  return w;
}

/** Hold a map, letting go of any that is neither on the card nor ahead. */
function holdLevel(key: string, level: GeneratedLevel): void {
  levels.delete(key);
  levels.set(key, level);
  const keep = wanted ? [askKey(wanted), askKey(aheadOf(wanted))] : [key];
  for (const k of [...levels.keys()]) {
    if (levels.size <= MAPS) break;
    if (!keep.includes(k)) levels.delete(k);
  }
}

/** Keep an answer, its pictures made URLs first. */
function keep(key: string, reply: PreviewPainted | PreviewRefused): Promise<void> {
  if (!reply.ok) {
    store(key, reply);
    return Promise.resolve();
  }
  // The panorama for the boards at this map's lift tops, if it is ridden.
  rememberBoard(reply.board, reply.panorama);
  return Promise.all([asUrl(reply.picture), asUrl(reply.panorama.picture)]).then(
    ([url, panoUrl]) => {
      if (url && panoUrl) store(key, { ...reply, url, panoUrl });
    },
  );
}

function store(key: string, answer: SeedAnswer): void {
  const old = answers.get(key);
  if (old?.ok) revoke(old);
  answers.delete(key);
  if (answers.size >= KEPT) {
    const oldest = answers.keys().next().value as string;
    const out = answers.get(oldest);
    if (out?.ok) revoke(out);
    answers.delete(oldest);
  }
  answers.set(key, answer);
  notify();
}

const revoke = (a: Extract<SeedAnswer, { ok: true }>): void => {
  URL.revokeObjectURL(a.url);
  URL.revokeObjectURL(a.panoUrl);
};

/** A worker's picture as a URL: a finished one at once, raw pixels once
 * this thread has drawn them. */
function asUrl(picture: PreviewPicture): Promise<string | null> {
  if (picture instanceof Blob) return Promise.resolve(URL.createObjectURL(picture));
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = picture.px;
    canvas.height = picture.px;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(null);
      return;
    }
    ctx.putImageData(new ImageData(picture.rgba, picture.px, picture.px), 0, 0);
    canvas.toBlob(
      (blob) => resolve(blob ? URL.createObjectURL(blob) : null),
      MAP_TYPE,
      MAP_QUALITY,
    );
  });
}

/** THE MAP A FREE RIDE IS STOOD UP ON, as the pieces of its load
 * (`LoadPlan`): the map `standing` already, or the one the worker built
 * for its seed, or — while the worker is building that very map — that one
 * once it comes (`ready` says when, `readyShare` how far it has got). Where
 * there is none, the load orders it built on the card's own worker (`map`).
 * Nothing more is built ahead from here on (`quietSeedMaps`). */
export function freeRideLevel(
  options: CreateGameOptions,
  standing: () => Level | undefined,
): {
  ready: () => boolean;
  readyShare: () => number;
  map: () => MapOrder | null;
  /** The map in hand, if any. */
  has: () => Level | undefined;
  /** The real face it stands on, fetched on this thread first. */
  face: string | undefined;
} {
  const ask = freeAsk(options);
  const held = heldLevel(ask) ?? riddenLevel(ask);
  let came: Level | null | undefined = held ?? undefined;
  const building = held ? null : buildingLevel(ask);
  if (building) void building.then((level) => (came = level));
  else came ??= null;
  quietSeedMaps(ask);
  const has = (): Level | undefined => standing() ?? came ?? undefined;
  return {
    // A map standing (or staged) is ridden at once, the worker never awaited.
    ready: () => came !== undefined || standing() !== undefined,
    readyShare: () => (came !== undefined || standing() ? 1 : (seedShare(ask) ?? 0)),
    map: () => (has() ? null : gameOrder(options)),
    has,
    face: options.face,
  };
}

/** The map a free ride's options ask for. */
export function freeAsk(options: CreateGameOptions): SeedAsk {
  return {
    seed: options.seed ?? 1,
    region: options.region ?? DEFAULT_REGION,
    face: options.face ?? null,
    grade: options.grade ?? null,
  };
}
