// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER SEASON as `scripts/screenshot.mjs` photographs it (spread into
// its `SURFACES`): the start card with the SEASON row's SUMMER stop stored,
// a summer free ride (`?summer=1`) begun on the downhill bike at a trail's
// head, the meadows, the grass and the open lakes round it — and THE BIKE
// (`?bike=1`) at rest at the head, ridden down the trail by the pre-roll's
// hands (`bike-pilot.ts`) on the close chase, and on the bar-cam — and the
// cards a summer ride is picked on: the rider card stood in the meadow, the
// bike card (the gear card of a ride begun on the bike), and the thumbs on
// the bike (the edge pad drawn as its handlebar, turned and slid).

export const SUMMER_SURFACES = {
  "start-summer": {
    params: { menu: "start" },
    storage: { "fall-line.settings.v1": JSON.stringify({ ride: { season: "summer" } }) },
    wait: ".seed-preview-map image",
    settle: 700,
  },
  "dress-summer": {
    params: { menu: "dress", mode: "free" },
    storage: { "fall-line.settings.v1": JSON.stringify({ ride: { season: "summer" } }) },
    wait: ".menu-stage[data-ready]",
    settle: 1800,
  },
  "gear-bike": {
    params: { menu: "skis", mode: "free" },
    storage: { "fall-line.settings.v1": JSON.stringify({ ride: { season: "summer" } }) },
    wait: ".menu-stage[data-ready]",
    settle: 1800,
  },
  "bike-thumbs": {
    params: { start: "free", bike: "1", t: "6", shot: "1" },
    wait: ".hud-bike",
    thumbs: [
      [0.22, 0.72, 34, -20],
      [0.8, 0.72, 0, 0],
    ],
    settle: 1200,
  },
  summer: {
    params: { start: "free", summer: "1", t: "2", shot: "1" },
    wait: ".hud-bike",
    settle: 2500,
  },
  "bike-head": {
    params: { start: "free", bike: "1", t: "0.5", shot: "1" },
    wait: ".hud-bike",
    settle: 2000,
  },
  bike: {
    params: { start: "free", bike: "1", t: "12", shot: "1" },
    wait: ".hud-bike",
    settle: 2000,
  },
  "bike-tips": {
    params: { start: "free", bike: "1", t: "12", camera: "tips", shot: "1" },
    wait: ".hud-bike",
    settle: 2000,
  },
};
