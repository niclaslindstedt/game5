// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH MAP THE WORLD'S RENDERER HAS STANDING, and every build into it.
//
// A level the renderer has not built must never be drawn, stepped, or have
// its lights counted down under a card the player cannot see through. So
// every build goes through `build`, which remembers which level is standing;
// `drawable` is the one question the loop asks before it steps or draws.
//
// A world can also be STAGED: built ahead, COLD — every mesh, but its shaders
// not yet compiled — while the free ride's rider and gear cards are up
// (`free-stage.ts`). Their own stage covers the whole screen, so nothing
// behind it is drawn meanwhile; a staged level is never `drawable`, and the
// build that rides it later (`build`, under the loading card) pays only for
// the compile. A build asked for while that level is still being staged
// joins it rather than starting it again.

import type { GameState, Level } from "@engine";

import type { WorldRenderer } from "./renderer-api.ts";

export type WorldBuild = {
  /** Build `s`'s level, warm — or nothing, where it is standing already. */
  build: (s: GameState, again?: boolean) => Promise<void>;
  /** Build `s`'s level cold, ahead of a ride on it. */
  stage: (s: GameState) => Promise<void>;
  /** Throw away a staged world (or one being staged): nothing stands. */
  unstage: () => void;
  /** Whether `level` is built, warm, and may be drawn. */
  drawable: (level: Level) => boolean;
  /** The level staged or being staged, if any. */
  staged: () => Level | null;
};

export function createWorldBuild(
  renderer: WorldRenderer,
  /** Run before any level is built — the minimap's bake. */
  before: (s: GameState) => void,
): WorldBuild {
  let standing: Level | null = null;
  let wanted: Level | null = null;
  /** The level built cold, and the load building it while it is. */
  let cold: Level | null = null;
  let staging: Promise<void> | null = null;

  const build = (s: GameState, again = false): Promise<void> => {
    const level = s.level;
    // A new race on the map already standing needs nothing built: the
    // renderer sees a fresh state and starts its trails and spray clean.
    if (standing === level && !again) return Promise.resolve();
    if (cold === level && !again) {
      // Staged: joined while it is still building, then compiled.
      const ahead = staging ?? Promise.resolve();
      wanted = level;
      return ahead.then(() => {
        if (wanted !== level) return;
        cold = null;
        return renderer.finish(s).then(() => {
          if (wanted === level) standing = level;
        });
      });
    }
    wanted = level;
    standing = null;
    cold = null;
    staging = null;
    before(s);
    return renderer.load(s).then(() => {
      if (wanted === level) standing = level;
    });
  };

  const stage = (s: GameState): Promise<void> => {
    const level = s.level;
    if (standing === level || cold === level) return staging ?? Promise.resolve();
    wanted = level;
    standing = null;
    cold = level;
    before(s);
    const load = renderer.load(s, true).then(() => {
      if (staging === load) staging = null;
    });
    staging = load;
    return load;
  };

  const unstage = (): void => {
    if (cold === null) return;
    cold = null;
    staging = null;
    wanted = null;
    standing = null;
    renderer.clear();
  };

  return {
    build,
    stage,
    unstage,
    drawable: (level) => standing !== null && standing === level,
    staged: () => cold,
  };
}
