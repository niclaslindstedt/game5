---
title: A new solid moves the RACE bots too — run every mode's sim, not just `make sim`
date: 2026-10-05
scope: engine/sim/bot.ts, engine/sim/downhill-steer.ts
concepts: [collision, bot, sim, posts]
---

`make sim` (the plain run) moved one digest when the posts went in, but the failure that mattered only showed in `tests/downhill_test.ts`: a gondola tower the lift planner could not slide off a run stood ON a downhill course, and the speed-course steer (`downhillSteer`) overrides the aim the dodge moved, so the racer ran straight into it. Now the line steer is skipped while the dodge is moving the aim. The dodge also reads the line he is actually TRAVELLING along (`TRAVEL_LOOK`), since a bot drifting wide of its aim point never sees what is in its path. After adding any contact, run `sim` with `--mode downhill`, `superG`, `slalom` and `speedSki` before and after (a baseline from a clean `origin/main` worktree is the quickest before), and expect digests to move only where the bot really meets the new thing.
