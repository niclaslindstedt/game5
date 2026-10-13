// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED TOURER'S SURFACES for `scripts/screenshot.mjs`: the rider
// card with the TOURER body picked (only its BODY and WEIGHT rows), and
// the gear card after it, him stood on the skis.

/** What the game remembers: the tourer worn. */
const TOURER = { "fall-line.settings.v1": JSON.stringify({ outfit: { body: "tourer" } }) };

export const TOURER_SURFACES = {
  "dress-tourer": {
    params: { menu: "dress" },
    storage: TOURER,
    wait: ".menu-stage[data-ready]",
    settle: 1800,
  },
  "skis-tourer": {
    params: { menu: "skis" },
    storage: TOURER,
    wait: ".menu-stage[data-ready]",
    settle: 1800,
  },
};
