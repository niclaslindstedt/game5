// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER CARD WITH A MODELLED BODY (`scripts/screenshot.mjs`'s
// `dress-<body>` surfaces): the DRESS card stood up with the settings a
// player who picked that body would have stored, so the card's stage shows
// the model and its rows (`outfit.ts`'s `BODIES`, the ones with a `model`).

/** The base rider card: the stage framed on the skier. */
export const DRESS = { params: { menu: "dress" }, wait: ".menu-stage[data-ready]", settle: 1800 };

/** One stored outfit a body, keyed `dress-<body>`. */
export const RIDER_SURFACES = Object.fromEntries(
  ["hiker", "hikerWoman"].map((body) => [
    `dress-${body}`,
    { ...DRESS, storage: { "fall-line.settings.v1": JSON.stringify({ outfit: { body } }) } },
  ]),
);
