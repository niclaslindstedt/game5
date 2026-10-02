---
title: A landing "tolerance" threw the bot off clean landings — judge a fall by what touched the snow, and stage a near miss before trusting a threshold
date: 2026-10-02
scope: engine/game/crash.ts, engine/game/chassis.ts
concepts: [wipeout, landing, resilience, save, thresholds]
---

The old `landing` cause compared how far off true the skis came down
against a tolerance that shrank with the load; at 9–14 g the bot's own
seed-7 landings (0.4–0.7 off) crossed it, so `make sim` carried two
wipeouts nobody had read as falls. Replacing it with the hull's own
contacts (`bodyHit`: the hips, shoulders or helmet driven into the snow)
made "landed on his side" the fall and "landed crooked on his edges" a
save. Two traps found by tracing a scenario step by step, not by the
summary line: a body slam threshold set from intuition (3.5 m/s) let a
fall onto the side off 1.6 m read as a save (it hits at 2.8), and
`rolledFor` reset on every one-step bounce off the snow, so a skier lying
on his side took two seconds to count as down. Probe the corpus at the
knob's ends (resilience 0 and 1) and diff against main in a worktree —
seed 10's crawl-speed trap predates the change and is not the knob's.
