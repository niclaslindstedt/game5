---
title: Judge the body on its legs in the WORLD and at the rollers' own wavelength — a running mean and the body frame both lie
date: 2026-10-03
scope: pwa/src/game/skier-spring.ts, scripts/skier-metrics.mjs, tests/skier_legs_test.ts
concepts: [spring, bumps, landing, labs, snap, continuity]
---

The upper body is a mass on the legs (`LEGS`): kicked by the pair's climb, sprung back and damped against THE LINE (`slope`, the climb taken slowly) — damped against the skis instead it follows every bump; against nought it lags any pitch. Three measuring traps cost most of the first pass. (1) A joint held level in the world JOLTS in the body frame by the engine's CoG — the snap band only means what the eye sees once `skier-metrics` stands the joints in the world (`inWorld`). (2) A running-mean high-pass over a second passes the 0.5–1 Hz the body deliberately follows: the ratio read 0.9 while the body was carrying a third of the bounce. Read the bounce as the component at the rollers' own wavelength along z (`tests/skier_legs_test.ts`'s `bounce`), and take the mean out first or the 1 m offset leaks into the sum. (3) A pure sine through the spring at 60 Hz floors near 0.3 from the frame's sampling alone; check a spring change at 1 kHz before blaming the model. Over big rollers the ENGINE launches him (its legs extend ~6 cm off rest), and the view cannot absorb more than the legs' reach.
