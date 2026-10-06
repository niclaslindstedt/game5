---
title: A summit's lip reads as a cliff only from a LOW, level lens — the chase's own height shows the face beyond it
date: 2026-10-03
scope: pwa/src/game/camera-rigs.ts, pwa/src/game/camera-summit.ts, pwa/src/game/camera-lift.ts
concepts: [camera, summit, lift, framing]
---

Holding the chase level on a pad (no lean) was not enough: at 1.7 m over him
and 4.3 m back the face beyond the lip still showed, and the player read it
as "shifted up as on the slopes". `SUMMIT_LOOK` now also brings the arm down
and in (0.95 m, 3.4 m, the skier near the frame's middle) on the chase only
(`rig.ride`), the pad's edge then the edge of the world; the drop fade is a
dozen metres under the deck so the soft spring holds the lens a beat at the
top and the look TIPS DOWN after him over the lip. The lift's own close look
must hand over to it within a couple of seconds of the stand-up, or it
masks it. Judge it with `make lift-ride ARGS=--at=…` out to the lip
(`previews/probe`-style trace of u/v/dy says when he gets there).
