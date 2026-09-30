---
title: A boom loses the skier on a drop because its AIM trails too — measure the offset in half-fovs, and tilt past a knee
date: 2026-09-24
scope: pwa/src/game/camera-rigs.ts, pwa/src/tools/world-harness.tsx, tests/world_render_test.ts
concepts: [camera, air, cliff, framing, tilt]
---

"The camera loses the skier off a jump" was the sprung height (`heightFollowAir`)
AND the aim point both built off the lagged `st.y`: a 20 m cliff put the
skier's middle 1.25 half-fovs below the axis (off the frame). A scratch
vitest riding a ballistic pose over a step ground reads the offset in a second;
the bot's flights in `make world` (`drop` view) are too small to show it.
The fix that keeps the hang: ease the lag into `lagMax` with a tanh (smooth,
unlike a clamp) and TILT the look only past a knee of the kept band — a hard
angle clamp measured as a visible jerk where it engages.
