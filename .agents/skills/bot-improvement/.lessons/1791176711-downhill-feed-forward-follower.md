---
title: The downhill's smooth line wants the feed-forward follower the slalom rejected — and never a look past the owed gate
date: 2026-10-05
scope: engine/sim/bot.ts, engine/sim/downhill-steer.ts
concepts: [bot, downhill, controller, line, speed]
---

Where the slalom's planner beat every feedback controller, the downhill is
the other way round: its line is a minimum-curvature curve with bends of
50 m and more, so a feed-forward of the line's own bend read `lead` = 0.3 s
ahead (the edge that bend asks at this speed) plus a small PD pull onto the
line holds it within a metre at 40 m/s (`downhill-steer.ts`); a look-ahead
pursuit alone ran wide by the second bend. Three more rules each cost a
miss to find: hold the OWED gate's line and its width as the room until it
is taken (reading past it cut the corner); read the line's swing and the
piste's bend SIGNED (`lineBendAt` — summed as magnitudes they doubled where
the gates cut a bend's inside, and the bot crawled); and check at most a
tenth of the brake at speed (a full skid slides off the line). In the air,
steer for the landing (`landingAhead`).
