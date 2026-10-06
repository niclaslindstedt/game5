---
title: A course can be a track of its own — hand back a Level whose track IS it, and round a profile with hulls, not relaxation
date: 2026-10-05
scope: engine/mapgen/speed-ski.ts, engine/mapgen/course-prep.ts
concepts: [speed-ski, track, profile, crest, knee, search, performance]
---

Speed skiing's track (R34) is straight; no piste is. `setSpeedSki` searches a straight line down the face (every column, nine bearings, every start a point mass skis) and returns a `Level` whose `track` is the speed track — the physics' queries, the minimap, the trees cleared, the snow groomed then follow it with no change. The map's own kickers and cliffs keep their place but their `s` was the old piste's: mark them `onTrack: false` with no arc, or the bot and the analysis read them on the new track.

Rounding the profile: `shaveCrests`' relaxation (lower a point onto its chord, repeat until none moves) ran thousands of passes on each of ~500 candidate lines and made the setter 2.4 s. The highest profile under y whose curvature is nowhere more convex than 1/R is the lower convex hull of y + x²/2R less the parabola — one O(n) pass (`hullOf`); the knees (concave) are the upper hull the other way round. Round both: a sharp knee is a compression the legs' damping eats 1–3 % of the speed in at 55 m/s. And read a graded profile between its samples on a cubic, never linearly — a kink every 4 m is a bump at 200 km/h.
