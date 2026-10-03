// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A PISTE-HEAD SIGN IS MADE OF, country by country (R21) — the board's
// wood and the hand its name is burned in, one row per kind of snow country.
// Three-free and DOM-free, so the suite reads every row
// (`tests/sign_look_test.ts` holds it to the engine's list of ids and every
// face to its file and its licence); `run-signs.ts` prints the boards.
//
// A SIGN IS A PLANK WITH ITS WORDS BURNED IN BY HAND: the run's name and
// its arrow scorched black into the grain, the grade's mark painted on.
// The woods are weathered and oiled, darker than new-sawn timber, as a
// board that has stood a few winters is. Each country's signs are lettered
// by a different hand, every one of them heavy enough to read from the top
// of the run, as each country's ski areas would sign their own:
//
//   * the ALPINE — larch, oiled brown, in a fat rounded hand, capitals, as a
//     chalet carves its name over the door;
//   * the FELLS — pale weathered birch, in a tall solid hand, as written;
//   * the CONTINENTAL ranges — dark rough-sawn pine, in a heavy slanted
//     brush, capitals, a frontier camp's sign;
//   * the MARITIME ranges — grey weathered cedar, in a thick quick marker,
//     capitals.
//
// Every face is a free typeface redistributed beside its licence
// (`fonts/sign-<region>.LICENSE.txt`), loaded only for the country a map is
// built in.

import type { RegionId } from "@engine";

export type SignLook = {
  /** The family the face is registered under on the page. */
  family: string;
  /** The face's file, as the bundler emits it. */
  url: string;
  /** Capitals, or the name as it is written. */
  caps: boolean;
  /** The plank: its tone, the grain's, the end grain and the back. */
  wood: string;
  grain: string;
  edge: string;
};

/** The fallback a board is printed in until its face has loaded. */
export const SIGN_FALLBACK = '"Comic Sans MS", "Chalkboard SE", cursive, sans-serif';

/** Literal `new URL`s, so the bundler finds and emits each face. */
export const SIGN_LOOKS: Readonly<Record<RegionId, SignLook>> = {
  alpine: {
    family: "sign-alpine",
    url: new URL("./fonts/sign-alpine.woff2", import.meta.url).href,
    caps: true,
    wood: "#76492a",
    grain: "#4a2a12",
    edge: "#5e3c20",
  },
  fell: {
    family: "sign-fell",
    url: new URL("./fonts/sign-fell.woff2", import.meta.url).href,
    caps: false,
    wood: "#8c7656",
    grain: "#57432c",
    edge: "#6e5a40",
  },
  continental: {
    family: "sign-continental",
    url: new URL("./fonts/sign-continental.woff2", import.meta.url).href,
    caps: true,
    wood: "#5e3c2a",
    grain: "#38200f",
    edge: "#4c3020",
  },
  maritime: {
    family: "sign-maritime",
    url: new URL("./fonts/sign-maritime.woff2", import.meta.url).href,
    caps: true,
    wood: "#6a5038",
    grain: "#352418",
    edge: "#4c3828",
  },
};

export function signLookOf(region: RegionId | undefined): SignLook {
  return SIGN_LOOKS[region ?? "alpine"] ?? SIGN_LOOKS.alpine;
}
