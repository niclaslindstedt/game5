---
title: A crooked-landing rule threw clean sidehill landings until the roll was judged against the nearer of the snow and the plumb — and the landing lab hid every throw made on the touchdown step
date: 2026-10-09
scope: engine/game/flight.ts, engine/game/crash.ts, scripts/landing-lab.mjs
concepts: [landing, crooked, sidehill, roll, lab]
---

Judging how far off true the skis came down (`landingFaults`) against the
load's tolerance threw the bot on the open face: stood plumb, he met a 40°
sidehill "rolled 41°" against its normal — which is the stance a skier
traverses it in. The roll is now the distance of the body outside the
range between the snow's normal and the plumb (zero inside it). Two lab
traps found on the way: the landing lab opened a row only while
`c.thrown === null` after the step, so a landing that threw him ON its own
step was never a row (judge by whether he was down before the step); and
the attitude sweep needs `assist.air = 0`, or the pitch and roll hands
level the set attitude away before the snow. Read `--trace` with the
faults axis by axis before trusting a new fall in the hands-off table.
