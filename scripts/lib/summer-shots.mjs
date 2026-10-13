// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER SEASON as `scripts/screenshot.mjs` photographs it (spread into
// its `SURFACES`): the start card with the SEASON row's SUMMER stop stored,
// and a summer free ride (`?summer=1`) sat on the helicopter's skid on its
// pad, the meadows, the grass and the open lakes round it.

export const SUMMER_SURFACES = {
  "start-summer": {
    params: { menu: "start" },
    storage: { "fall-line.settings.v1": JSON.stringify({ ride: { season: "summer" } }) },
    wait: ".seed-preview-map image",
    settle: 700,
  },
  summer: {
    params: { start: "free", summer: "1", t: "2", shot: "1" },
    wait: ".hud-heli",
    settle: 2500,
  },
};
