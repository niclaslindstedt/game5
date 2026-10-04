---
title: A slalom sweep counts `out` before `finished`, and a 30/30 is partly luck — prove a setting by its neighbours
date: 2026-10-04
scope: engine/sim/bot.ts, engine/sim/slalom-plan.ts
concepts: [bot, slalom, sweep, chaos]
---

`Progress.finished` is set on a DSQ or a DNF too, so a scratch sweep that reads `finished` first counts a disqualified run as a finish (it looks like a run far under par with a mean speed over its top speed): read `p.out` first. Sweep the campaign slaloms (`buildCampaignLevel` over `SHELVES`, `createGame({ mode: "slalom", spec: SWIFT })`) and seeds 1–16, run 1, four processes in parallel (`nproc` is 4) writing a file each. Outcomes are chaotic — one gate taken late re-rolls the run — and any setting loses about one run in twenty: nudging a knob or a physics number ±10–20 % lands 26–30 of 30, so a single 30/30 is partly luck. Pick a setting that finishes 30/30 AND whose neighbours mostly do; overrides of the live tables (`SLALOM_TECHNIQUE`, `RIDER_BOT`, `PAR`, `DISCIPLINE_RULES.slalom`) from an env var in a `previews/` script make each neighbour one command. Failures are DSQs (a gate missed or straddled after the planner flips its steer every decision) and stalls (turned across and up the hill, stopped, reset — read as a `dnf: fall`, no `wipeout` event). Before blaming the bot on a course, measure the stretch: the second difference of the ground along the piste (rms ~0.01/m on a normal stretch, ~0.03 with a lip every 5–7 m) found the mogul faces the setter now combs (`slalom.comb`).
