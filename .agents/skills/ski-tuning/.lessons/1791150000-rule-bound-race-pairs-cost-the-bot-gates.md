---
title: The race pairs sit at their competition rules' minimums — a wider sidecut costs the bot gates, and the answer is never to cut the ski back under the rule
date: 2026-10-04
scope: engine/game/defs/skis.ts, engine/sim/bot.ts
concepts: [sidecut, competition-rules, bot, sim, geometry]
---

The Chough (193 cm, 65 mm, 30 m) and the Eagle (218 cm, 65 mm, 50 m) are held to the men's top-level rules by `tests/catalog_test.ts`. Moving the Eagle 45 → 50 m took `make sim ARGS="--skis all"`'s misses on the Eagle from 6 to 10 over seeds 1–8 and cost seed 2 one bot reset (+53 s); the Chough at 30 m lost 1–2 s a seed and missed nothing. That is the class's honest cost on the generator's bends ("hates a bend") and the bot's line, not a reason to tighten the sidecut back below the rule. The widths are not free either: `tests/topsheet_test.ts` holds every pair's sidecut to the circle its drawn widths make (R ≈ c² / 8d over the plan's widest points), so a sidecut moved owes a shoulder and a tail moved with it — the Eagle's old 100/66/86 drew a 33 m ski labelled 45.
