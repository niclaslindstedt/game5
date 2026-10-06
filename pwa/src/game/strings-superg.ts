// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE SUPER-G (R33) and of THE RACE CARD the front door's RACE
// tile opens — a block of the one strings table (`strings.ts`, §39.1),
// stated next door and spread into `STRINGS` under the same names, as the
// slalom's and the downhill's are: the race card's rows, the super-G's
// level card, its run on the HUD and its plate.

export const SUPER_G_STRINGS = {
  /* ── THE FRONT DOOR'S RACE TILE (menu-main.tsx) ─────────────────────── */
  /** The tile's name, and its lines: the disciplines it opens, and what a
   * race of any of them is. */
  menuRaces: "RACE",
  menuRacesLine: (names: readonly string[]): string => names.join(" · "),
  menuRacesFormat: (skiers: number): string => `A FIELD OF ${skiers} · ONE ON THE COURSE`,

  /* ── THE RACE CARD (menu-races.tsx) ─────────────────────────────────── */
  racesTitle: "RACE",
  /** A built discipline's row: its format under its name. */
  racesSlalom: (skiers: number): string => `TWO RUNS · ${skiers}`,
  racesSuperG: (skiers: number): string => `ONE RUN · ${skiers}`,
  racesDownhill: (skiers: number): string => `TRAINING + RACE · ${skiers}`,
  /** A discipline the game names and has not built: its row, dimmed. */
  racesComing: "COMING",

  /* ── THE LEVEL CARD (menu-levels.tsx) ───────────────────────────────── */
  levelsSuperG: "SUPER-G ON",

  /* ── THE HUD (hud.tsx) AND THE PLATE (hud-result.tsx) ───────────────── */
  /** The run chip: a super-G is one run, never seen before it. */
  superGRun: "ONE RUN",
  resultSuperGTitle: "SUPER-G",
  superGAgain: "RACE AGAIN",
} as const;
