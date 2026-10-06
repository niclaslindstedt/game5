---
title: The wind moves the skier through his drag — read it where he is, keep the bench calm, and expect a crawl in a gale
date: 2026-10-04
scope: engine/game/air.ts, engine/game/wind.ts, engine/game/skier.ts, engine/sim/bot.ts
concepts: [wind, drag, crosswind, shelter, bench, bot, storm]
---

The drag is against the AIR WHERE HE IS (`airAt`: R19's 10 m wind down the
log law to his body, the mountain's exposure, the woods' shelter), split
along his heading and across it onto two areas — never the 10 m wind and
never one area, or a tucked skier's long profile takes no crosswind. A
crosswind does nothing to the yaw directly: the edges hold it, so it shows
as the LEAN (the incline stands on the bend's pull less `AirForce.side`)
and, only where the grip limits the turn, as a tighter or wider line
(`reach`) — test a crosswind turn at full edge and speed, not on a half
edge, where the carve's geometry sets the heading and the wind moves only
the lean. The synthetic bench is STILL AIR (`STILL_AIR`): a bench figure
is the skier's own, and a wind is asked for with `withSky`. With the game's
drag areas (twice a racer's), a storm in the face on a traverse slows a
skier to a skater's pace — the bot's give-up had to learn that moving
slowly is not being stuck (`stillGoing`, `patience`); `npm run sim --
--weather storm` is the sweep that finds it.
