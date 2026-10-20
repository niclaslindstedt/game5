// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAUSE CARD as `scripts/screenshot.mjs` photographs it (spread into its
// `SURFACES`): held over a race, held over a free ride, its PISTE MAP — another
// run on the same mountain — and its OPTIONS, the front door's own page over
// the held run.

export const PAUSE_SURFACES = {
  pause: { params: { paused: "1", t: "14" }, wait: ".menu-card-pause", settle: 700 },
  // ...over a FREE RIDE, and its PISTE MAP: another run on the same mountain.
  "pause-free": {
    params: { start: "free", t: "20" },
    open: ["Escape"],
    wait: ".menu-card-pause",
    settle: 700,
  },
  "pause-slopes": {
    params: { start: "free", t: "20" },
    open: ["Escape"],
    press: ".pause-slopes-press",
    pressAfter: 700,
    wait: ".menu-card-pause-slopes .seed-preview-map image",
    settle: 1200,
  },
  "pause-options": {
    params: { paused: "1", t: "14" },
    press: '[data-menu="options"]',
    pressAfter: 700,
    wait: ".pause-panel .menu-card-options",
    settle: 700,
  },
};
