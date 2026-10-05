---
title: A pole carried round a circling arm turns WITH the fist at the grip it already hangs in; blend it by how far the arm is off home, not by the circle's weight
date: 2026-10-05
scope: pwa/src/game/skier-flight.ts
concepts: [air, windmill, poles, continuity, commit]
---

The windmill's poles were aimed out along the arm plus a little trail: at
the top of the circle they stood straight out of the fists like antennas.
A held rod is rigid in a set wrist — it keeps its angle to the arm — and
the angle to keep is the one the spotting hang already has (about 1.95 rad
behind the arm), so the circle starts and ends on the pole where it
hangs. Aiming the rod at a "physically nicer" trailing tangent instead put
it nearly OPPOSITE the hang, and the blend between them flipped the rod
through sideways in a twentieth of a second. And the blend's weight must
be how far the arm still is off home (`FlightShape.pole`), not the
windmill's weight: that fades while the arm still has most of a turn to
brake through, and the rod swung back to its hang on its own.
`npx vitest run tests/skier_flight_test.ts` holds the rod's turn per frame.

A held lean in the air is the player's commitment: the windmill (a skier
fighting a rotation) is cancelled by it, like a spin's. The cliff move and
`cliff-lean` side by side in `make skier` show the two.
