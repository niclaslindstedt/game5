---
title: Slalom bot outcomes are chaotic — prove a change on all 14 rungs plus seeds 1–16 and under small perturbations of its knobs
date: 2026-10-04
scope: engine/sim/bot.ts
concepts: [bot, slalom, sweep, chaos]
---

One gate missed early re-rolls the whole run, so a knob that finishes 30/30 may lose a rung when any neighbour knob moves 20 %. Sweep the campaign slaloms (`buildCampaignLevel` over `SHELVES`, `createGame({ mode: "slalom", spec: SWIFT })`) and seeds 1–16, run 1, then re-run with each new knob nudged up and down; count failures per run, not rows. Run four configs in parallel (`nproc` is 4) and have the scratch test write its table to a file — vitest hides a passing test's console output. Before blaming the bot on a course, measure the stretch: the second difference of the ground along the piste (rms ~0.01/m on a normal stretch, ~0.03 with a lip every 5–7 m) found the mogul faces the setter now combs (`slalom.comb`).
