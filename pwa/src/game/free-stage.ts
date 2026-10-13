// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE'S WORLD, STOOD UP WHILE ITS CARDS ARE UP.
//
// By the rider card a free ride is decided but for the skier: the mountain,
// the day, the snow, the start and the craft are the start card's, and only
// the body, the kit and the pair are still to pick. The map itself is
// already built (the start card's worker, `seed-maps.ts`); what was left to
// the loading card was standing the race up on it (`createGame` — a second
// on a phone) and the world's renderer building every mesh of it (several
// more). Both are a function of what is decided — so they are paid for here,
// behind the start card once its rows have been still a moment, and behind
// the rider and gear cards, whose own stage covers the whole screen
// (`menu-stage.tsx`) — and the press on RIDE finds them done.
//
// WHAT IS STAGED IS THE WORLD, NOT THE RUN. The run RIDE stands up is a new
// one (`take`), on the pair and the help picked by then, on the map staged
// — the renderer rebuilds a rider whose pair or kit has changed on its own
// — and its shaders are compiled under the loading card, as ever: only the
// meshes are built ahead (`world-build.ts`), so no more is held on the
// graphics card behind the cards than the run would hold.
//
// A STAGE IS THROWN AWAY the moment it is wrong: a ride whose world differs
// (another mountain, another hour, another craft — `sceneKey`) stages again,
// and leaving the free ride's cards for anywhere but the start card clears
// the world and hands the backdrop back (`drop`).

import {
  DEFAULT_REGION,
  regionOf,
  type CreateGameOptions,
  type GameState,
  type Level,
} from "@engine";

/** What the world a free ride stands up depends on: its options, but for
 * what the run is skied on and the renderer redraws by itself — the pair,
 * the help, the poles, the gore — and what the app deals afresh each time
 * (the grimbear's odds, the mishaps' salt). The outfit only where the
 * renderer builds it in (a wingsuit's colourway). */
export function sceneKey(options: CreateGameOptions, outfit: string): string {
  const world = { ...options, outfit: options.wingsuit ? outfit : null };
  return JSON.stringify(world, (key, value: unknown) => (RUN_ONLY.has(key) ? undefined : value));
}

/** The options a run is skied on rather than its world is built off. */
const RUN_ONLY = new Set(["spec", "assist", "poles", "gore", "grimbear", "mishaps", "level"]);

export type FreeStage = {
  /** The free ride's start, rider or gear card is up for `options`: stage
   * it, once the cards have been still `after` ms (`later`'s own wait when
   * left out). */
  want: (options: CreateGameOptions, outfit: string, after?: number) => void;
  /** The cards are down (any card but those and the start card): throw the
   * stage away. */
  drop: () => void;
  /** RIDE on `options`: the options to stand the run up on — on the staged
   * map, where the stage is this ride's — or null to build it as ever. */
  take: (options: CreateGameOptions, outfit: string) => CreateGameOptions | null;
};

export function createFreeStage(deps: {
  /** The map the start card's worker built for these options, if held. */
  held: (options: CreateGameOptions) => Level | null;
  /** Be told when a map arrives; returns the unsubscribe. */
  onMaps: (listener: () => void) => () => void;
  /** Stand the race up: `createGame`. */
  stand: (options: CreateGameOptions) => GameState;
  /** Build a world cold (`WorldBuild.stage`), and throw one away. */
  stage: (s: GameState) => Promise<void>;
  unstage: () => void;
  /** Whether a load is running — its world is never touched from here. */
  busy: () => boolean;
  /** Put the backdrop back after a stage is thrown away. */
  restore: () => void;
  /** Wait a moment (`ms`, or its own) before the heavy work: the card's
   * own stage first. */
  later: (run: () => void, ms?: number) => () => void;
}): FreeStage {
  /** The stage standing or being stood up: its key, and its map. */
  let held: { key: string; base: Level; level: Level } | null = null;
  /** What the cards want staged, while it waits on its map or its moment. */
  let pending: { key: string; options: CreateGameOptions; after?: number } | null = null;
  let stopMaps: (() => void) | null = null;
  let cancel: (() => void) | null = null;

  const settle = (): void => {
    stopMaps?.();
    stopMaps = null;
    cancel?.();
    cancel = null;
  };

  /** Stage `pending` if its map is in hand; else wait for it. */
  const attempt = (): void => {
    const want = pending;
    if (!want || deps.busy()) return;
    // The map under the stage standing, where it is this ride's too (only
    // the hour or the craft changed): the worker may have let it go since.
    const base =
      (held && sameMap(held.base, want.options) ? held.base : null) ?? deps.held(want.options);
    if (!base) {
      stopMaps ??= deps.onMaps(attempt);
      return;
    }
    settle();
    cancel = deps.later(() => {
      cancel = null;
      if (pending !== want || deps.busy()) return;
      pending = null;
      let game: GameState;
      try {
        game = deps.stand({ ...want.options, level: base });
      } catch {
        return; // the loading card stands it up, and says why it cannot
      }
      held = { key: want.key, base, level: game.level };
      deps.stage(game).catch(() => {
        if (held?.level === game.level) held = null;
      });
    }, want.after);
  };

  return {
    want: (options, outfit, after) => {
      const key = sceneKey(options, outfit);
      if (held?.key === key) return;
      // The same ride still waiting: from the rider card it no longer waits
      // on the start card's stillness.
      if (pending?.key === key && (after ?? 0) >= (pending.after ?? 0)) return;
      settle();
      pending = { key, options, after };
      attempt();
    },
    drop: () => {
      settle();
      pending = null;
      if (!held || deps.busy()) {
        held = null;
        return;
      }
      held = null;
      deps.unstage();
      deps.restore();
    },
    take: (options, outfit) => {
      settle();
      pending = null;
      const stage = held;
      held = null;
      if (!stage || stage.key !== sceneKey(options, outfit)) return null;
      // The staged map already carries its day and its sky.
      return { ...options, level: stage.level, day: undefined, sky: undefined };
    },
  };
}

/** Whether `level` is the map `options` ride: their seed, country and face. */
function sameMap(level: Level, options: CreateGameOptions): boolean {
  return (
    level.seed === options.seed &&
    regionOf(level).id === (options.region ?? DEFAULT_REGION) &&
    (level.face ?? null) === (options.face ?? null)
  );
}
