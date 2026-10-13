// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT'S WAY ON AND OFF as `scripts/screenshot.mjs` photographs it
// (spread into its `SURFACES`): no skis go with him in a wingsuit, so the
// rider card rides and the gear card is skipped, and once he is down on his
// boots a plate asks what next.

export const WINGSUIT_SURFACES = {
  // THE RIDER CARD on a free ride flown in a WINGSUIT: its way on is FLY,
  // and there is no gear card after it (`menu-dress.tsx`).
  "dress-wingsuit": {
    params: { menu: "dress", mode: "free" },
    storage: {
      "fall-line.settings.v1": JSON.stringify({
        ride: { seed: 38, run: { seed: 38, region: "alpine", id: "wingsuit" } },
      }),
    },
    wait: ".menu-stage[data-ready]",
    settle: 1800,
  },
  // Down on his boots off its exit on map 38 (the bot lands about 138 s
  // in): the plate offers FLY AGAIN, the PISTE MAP and QUIT
  // (`hud-result.tsx`'s `LandedPlate`). The pre-roll is long: ask for
  // `--timeout 400`.
  "wingsuit-landed": {
    params: { start: "free", wingsuit: "1", chute: "400", t: "142", shot: "1" },
    wait: ".hud-result-landed",
    settle: 1500,
  },
  // THE THUMBS FLYING THE SUIT (phone): the edge thumb's pad drawn as the
  // suit seen from above, turned with the bank and slid with the lean, and
  // the lever's knob the suit again, swept at a full tuck — and eased up
  // into the back key, spread.
  "wingsuit-thumbs": {
    params: { start: "free", wingsuit: "1", chute: "500", t: "6", shot: "1" },
    wait: ".hud",
    thumbs: [
      [0.22, 0.72, 34, -26],
      [0.8, 0.72, 0, 0],
    ],
    settle: 1200,
  },
  "wingsuit-thumbs-spread": {
    params: { start: "free", wingsuit: "1", chute: "500", t: "6", shot: "1" },
    wait: ".hud",
    thumbs: [
      [0.22, 0.72, -20, 30],
      [0.8, 0.75, 0, -150],
    ],
    settle: 1200,
  },
};
