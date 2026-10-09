// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE AFTERSKI (`afterski.ts`, `buzz.ts`) — a block of the one
// strings table (`strings.ts`, §39.1), stated next door and spread into
// `STRINGS` under the same names, as the snowmobile's are: the way to a
// lodge and the way in, the room's readout, the BUZZ meter, getting up and
// fetching the skis, and the news all of it earns.

/** The buzz's words, from the first beer to as far as it goes. */
const BUZZ_WORDS = ["TIPSY", "MERRY", "WOBBLY", "SLOSHED", "LEGLESS"] as const;

export const AFTERSKI_STRINGS = {
  /** The start card's RUN row: the ride begun inside the lodge, at the
   * party (`free-ride.ts`'s `AFTERSKI_RUN`). */
  startRunAfterski: "AFTERSKI",

  /* ── THE WAY IN (hud-afterski.tsx) ─────────────────────────────────── */
  /** A lodge near him on a free ride, how far its door is, and how to go
   * in stood at it. */
  afterskiCall: "AFTERSKI",
  afterskiAway: (m: number): string => `${Math.round(m)} M`,
  afterskiTake: (touch: boolean, key: string): string =>
    touch ? "TAP TO GO IN" : `${key} OR CLICK TO GO IN`,

  /** A building's door before him (`door-hud.ts`): what the machine press
   * does to it. */
  doorCall: "DOOR",
  doorTake: (touch: boolean, key: string, shut: boolean): string => {
    const verb = shut ? "SHUT" : "OPEN";
    return touch ? `TAP TO ${verb}` : `${key} OR CLICK TO ${verb}`;
  },

  /* ── INSIDE ─────────────────────────────────────────────────────────── */
  afterskiInside: "AFTERSKI",
  afterskiBeers: (n: number): string => (n === 1 ? "1 BEER" : `${n} BEERS`),
  /** Another round on a tap anywhere or the jump key; a beer on its way
   * down; the door's word (the machine key heads out too). */
  afterskiRound: (touch: boolean, key: string): string =>
    touch ? "TAP FOR ANOTHER ROUND" : `CLICK OR ${key} FOR ANOTHER ROUND`,
  afterskiCheers: "CHEERS!",
  afterskiLeave: "LEAVE",

  /* ── THE BUZZ METER ─────────────────────────────────────────────────── */
  buzzLabel: "BUZZ",
  buzzWord: (buzz: number): string =>
    BUZZ_WORDS[Math.min(BUZZ_WORDS.length - 1, Math.floor(buzz * BUZZ_WORDS.length))],

  /* ── ON FOOT, FETCHING THE SKIS ─────────────────────────────────────── */
  fetchWord: "FETCH YOUR SKIS",
  fetchLeft: (n: number): string => (n === 1 ? "1 SKI TO GO" : `${n} SKIS TO GO`),
  fetchHint: (touch: boolean, key: string): string =>
    touch ? "STEER TO WALK · OR LET HIM STAGGER" : `STEER TO WALK · ${key} TO RESET`,

  /* ── THE NEWS (run-news.ts) ────────────────────────────────────────── */
  newsAfterskiIn: "INTO THE AFTERSKI!",
  newsFirstBeer: "CHEERS! FIRST ONE DOWN",
  newsBeer: (n: number): string => `${n} DOWN!`,
  newsAfterskiOut: "BACK ON THE SNOW. STEADY NOW",
  newsFetchUp: "UP YOU GET. WHERE ARE YOUR SKIS?",
  newsFetchSki: "GOT ONE",
  newsFetchIn: "CLICKED IN! SKI ON",
};
