---
title: A hop off a crest is not a flight, and a jump is his own legs — gate air-only poses on `flying`, never on `airborne`
date: 2026-10-03
scope: pwa/src/game/skier-gait.ts, pwa/src/game/skier-spring.ts, pwa/src/game/skier-pose.ts
concepts: [air, gait, poles, snap, bumps, jump]
---

The engine's `airborne` flickers on for two frames whenever skis skim off a roller's crest. Anything switched on it — the gait dropped to still, the compact air pose eased in — snaps the whole figure there and back: a double-poling skier over 15 cm rollers was 12 % of frames at fault, all of it this. Gate on `flying` (`skier-gait.ts`: in the air past `HOP`, or a jump he `popped` himself, which flies from its first frame). And never kick the body's spring with the pop's change of climb: the jump is his legs throwing his body, so a kick there folds him 29 cm as he leaves the snow.
