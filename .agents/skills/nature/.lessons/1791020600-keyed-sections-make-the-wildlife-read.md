---
title: A lofted body is a cigar until its rings are keyed — the moves that make a bird, an animal and the arch read
date: 2026-09-29
scope: pwa/src/game/bird-shapes.ts, pwa/src/game/beast-shapes.ts, pwa/src/game/mark-shapes.ts
concepts: [modelling, birds, animals, arch, silhouette]
---

Learned modelling the wildlife in Blender and carried into the procedural
builders, where every one still holds:

- Rings of one size make a cigar. Key them: a bird's flat back over a keeled
  breast, tapering to the vent (a pentagon, flat side up, point down); an
  animal's withers standing over its loins, the flank tucked, the rump
  rounding down. Draw a bird's breast back under a big head or an owl's
  chest pokes past its face.
- A bill or a muzzle is a measure of the HEAD (`headR * 1.35`), not of the
  body's length: sized off the length it vanishes on a raven and grows
  absurd on a swan.
- A tail is a fan out of the rump, two sheets ~1.5 mm apart (4 mm reads as
  two flaps).
- A soarer needs its primaries splayed into fingers (`style.fingers`, each
  ~0.62 of its share of the chord, the outer ones swept back) or it is a dart
  from below; thinner sticks read as stalks.
- A bounder's hind leg is a haunch (thick at the top); a hoofed animal
  (`prints.pattern == "pairs"`) stands on dark, narrow hooves.
- An inflatable's piping is one narrow ring a seam — a PAIR of stations
  either side of it — never the nearest station's whole width (a candy cane).
- Judge a bird FROM BELOW: `make birds` draws the underside the game sees.
