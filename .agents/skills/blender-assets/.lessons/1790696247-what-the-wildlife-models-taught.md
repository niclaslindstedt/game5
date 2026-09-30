---
title: A lofted body is a cigar until its sections are keyed — the modelling moves that made the birds, the animals and the arch read
date: 2026-09-29
scope: scripts/blender/bird.py, scripts/blender/beast.py, scripts/blender/gate.py
concepts: [modelling, birds, animals, arch, silhouette]
---

What each first render of the static kinds got wrong, and the move that
fixed it — so the next roster starts from the second try:

- A body lofted from equal rings is a cigar. Key the sections: a bird's
  keeled breast under a flat back, tapering to the vent; an animal's
  withers standing over its loins, the flank tucked, the rump rounding
  down. And stop a bird's breast short of its bill point (`FRONT`), or a
  big-headed owl's chest pokes past its face.
- A bill or a muzzle is a measure of the HEAD (`head_r * 1.35`), not of the
  body's length: sized off the length it vanished on the raven and grew
  absurd on the swan.
- A tail is a fan out of the rump, not a flap hung on the body's end cap;
  two faces 1.5 mm apart, not 4 mm, or the sheets read as two flaps.
- A soarer (the row's dihedral ≥ 0.06 on a span over 1.2 m) needs its
  primaries splayed into fingers or it is a dart from below — five blades
  fanned off the hand's end, `chord / 5 * 0.62` wide, the outer ones swept
  back. Sticks thinner than that read as stalks.
- A bounder's hind leg is a haunch (`2.1 * LEG_R` at the top); a hoofed
  animal (`prints.pattern == "pairs"`) gets a dark, narrow foot.
- An inflatable's piping is one narrow ring a seam — a PAIR of stations
  either side of it — never the nearest station's whole width, which made
  the arch a candy cane at the game's 0.22 m step.
- The studio's under-camera must have no floor under it, and a part
  instanced elsewhere by the game (a pennant at the pole's top) is staged
  there for the still by `publish(..., stage=)` after the export.
