---
title: A cloud sized by the plough's depth is biggest at a crawl — scale the whole recipe by how much the speed lofts, and measure it as area against the skier
date: 2026-10-01
scope: pwa/src/game/snow-cloud-plan.ts, scripts/cloud-metrics.mjs, pwa/src/game/hold-input.ts
concepts: [snow-cloud, loft, speed, metrics, held-ride, veil]
---

"Too big at low speed" was measurable before it was fixable: the opacity-
weighted area alive behind him (rate × ∫πr²·opacity over a puff's life)
put the powder cloud at 10 km/h at 55 % of the 60 km/h one, and the
plough term (sink-driven, speed-blind) was nearly all of it. Scaling only
the RATE by speed left each puff as big and long-lived as before — a
slow skier still wore a ball. The cure scales rate, size, swell, hang and
lift together by `loftOf(speed)` (smoothstep 1→14 m/s, each to a floor),
with landings and bursts taking the full loft because an impact lofts
whatever the speed. `make cloud-metrics --compare` showed 10 km/h going
from 45× to about 1× the skier's silhouette with 60 km/h unchanged.

The lab's sheets missed one thing the game showed: a carve throws puffs
beside and ahead of the boots, which the chase veil (cut at his feet)
left in front of the lens. Reach the veil a metre past him.

An in-game shot at a speed needs the cloud EMITTED, and the renderer
emits only while it draws: hold the ride in the frame loop after the map
stands, drawing unpresented, and place the run at the speed down the fall
line — a held tuck cannot reach 60 km/h in deep flat powder.
