---
title: The crowd draws off one stream, so a single bump with the player re-deals every amateur after it — count what a test samples loosely
date: 2026-10-04
scope: tests/crowd_test.ts, engine/game/crowd.ts
concepts: [crowd, determinism, test, regroup]
---

A physics change that moved the hands-off player by a few centimetres made
his first bump with an amateur land 0.04 s later at a different speed; the
crowd's decisions all draw from `CrowdState.rng` in turn, so from that
step on every amateur's choices were re-dealt and `crowd_test`'s "rode a
lift and skied off it" count fell 6 → 2 while the same 28 came off the lift.
The four it lost had STOPPED at the top for the group (the leader's
regroup) between two samples — so the pattern now allows `ride,skate,stop,ski`.
Before blaming the crowd for a count, diff each amateur's mode sequence
against the old tree's (`git archive` the base into the scratchpad).
