// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FILM UNDER THE FRONT DOOR as `scripts/screenshot.mjs` photographs it
// (spread into its `SURFACES`): the door over the race the daring bot rides,
// cut as a film (`cinema-run.ts`) and letterboxed (`film-bars.ts`), a while
// into it and later on. A software rasterizer draws the race at a frame or so
// a second, so the moments are the wall clock's, never the same twice.

export const FILM_SURFACES = {
  "menu-film": {
    params: { menu: "root", backdrop: "race" },
    wait: ".menu-card-root",
    settle: 30000,
  },
  "menu-film-late": {
    params: { menu: "root", backdrop: "race" },
    wait: ".menu-card-root",
    settle: 60000,
  },
};
