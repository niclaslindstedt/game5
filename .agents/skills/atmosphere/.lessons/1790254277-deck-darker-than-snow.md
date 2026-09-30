---
title: A lid over snow reads as a white sheet unless its deck is DARKER than the snow under it
date: 2026-09-24
scope: pwa/src/game/sky.ts
concepts: [overcast, flat-light, contrast, stars]
---

The overcast deck was a light grey (0.52 linear) with the ambient raised by a
third under it, so after tone mapping the sky, the haze and the snow were all
the same near-white and a player called the whole frame "a white sheet of
nothing". A real lid seen from the snow is darker than the snowfield: the deck
now sits near 0.3 (a storm's near 0.06), its underside is drawn with lit and
shade a factor of three apart, and some key gets through (0.22) so the relief
keeps a soft shadow. Judge a sky change on `make sky` at noon, not only at a
low sun. And stars have to be SIZED IN PIXELS (off `fwidth` of the ray): a star
at a fixed angular size vanishes on a contact sheet and blobs on a desktop.
