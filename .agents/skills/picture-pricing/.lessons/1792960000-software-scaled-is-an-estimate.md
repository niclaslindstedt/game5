---
title: With no GPU, price a new stop's own passes in software and scale them by a priced pixel row — never by guesswork, and always marked as owed a re-price
date: 2026-10-14
scope: pwa/src/game/picture-fit.ts
concepts: [pricing, measurement, software-gl, sky]
---

The sky's tiers (the GPU sky, the clouds, the far ranges) all ride DISTANCE
and were added after its GPU price. In a container with only SwiftShader, a
whole `--costs` run is out of reach (one 60-frame race is five to ten
minutes) and its milliseconds price the CPU. What worked: time the new
passes ALONE in the sky lab (`--sheet=cloudmotion` / `skytier` / `far`),
then turn software ms into reference ms by a row the list already prices for
the same kind of work — RESOLUTION 100 against 50 on the benchmark race, in
the same software GL at the same buffer (4539 against 2221 ms ↔ 1.02 ms on
the reference). Add the estimate on top of the GPU-measured cost, write the
numbers and the method beside the row, and bracket it with the whole-frame
ratio (about five times dearer) so the next session knows how wrong it can
be. A tiered pass can cost LESS a step up (HIGH's reprojected volume under
MEDIUM's slab) — the row's total still must not fall up the ladder.
