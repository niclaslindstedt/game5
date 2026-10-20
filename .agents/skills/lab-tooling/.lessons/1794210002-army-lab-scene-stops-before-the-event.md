---
title: An army-lab scene that photographs a shot or a burst must stop its run BEFORE the event, and `--skip-build` keeps the old scene code
date: 2026-10-20
scope: pwa/src/tools/army-vehicles-sheet.ts, pwa/src/tools/army-harness.ts, scripts/army-preview.mjs
concepts: [lab, screenshots, gunfire, harness]
---

`gunfire-view.ts` skips every log entry already in `GunfireState.log` the first time it draws a new run (`seen = g.said`). So a scene whose `groundRun` steps until the shot or the burst has happened draws neither. Stop on the event BEFORE it (the tank's `halt`), draw one frame to adopt the run, then step and draw with a real `dt` (`lab.frame(run, 1/60)`) through the fire, so the explosion grows between frames. A scene that finds nothing returns 0 frames quietly (`vehicle-fire 0 frames (15 s)`): read the frame count every run. `make army ARGS=--skip-build` reuses the last bundle, so after editing a scene's lenses rebuild or you photograph the old ones. Frame a wide shot off the vehicle nearest him and him, not off the middle of the whole wave, which is often empty valley.
