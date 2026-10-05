---
title: The bot's kicker speed stops at the first unsafe landing — on a table that is the knuckle
date: 2026-10-05
scope: engine/sim/bot.ts
concepts: [kickers, table, landing, ski-cross]
---

`kickerSpeed` scans upward from 8 m/s and stops at the first speed whose landing would fold the legs. On a table jump that is the knuckle at the table's end, so the bot slowed to land on the table and never found the faster speeds that clear onto the landing slope. Rather than change the scan (every mode's digest rides it), the ski cross's jumps are shaped so every speed from 10 to 20 m/s lands under the limit; check a new kind of jump with the same point-mass flight before blaming the bot.
