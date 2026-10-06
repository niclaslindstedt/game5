---
title: A line swung to each gate's side needs the base line held to the middle, and gates kept where the racer is on the snow
date: 2026-10-05
scope: engine/mapgen/super-g.ts, engine/mapgen/speed-course.ts
concepts: [super-G, setter, racing line, crests, jumps]
---

The downhill's least-bending line wanders twenty metres to a side on a wide
resort piste; swinging gates either side of THAT puts an apex at the edge
and the next swing twenty-five metres across. Cap the base line's room
(`LineRule.most`) before adding a swing. And at 100 km/h a racer flies the
shaved crests as well as the drops: find the crests still tighter than
v²/g over a lip's length (a 2 m station finds noise every forty metres) and
keep gates off the landing — longer after the lip than before it. Share,
don't copy: the downhill's line, reader, trap and spacing moved into
`speed-course.ts` with their arithmetic untouched and every digest held.
