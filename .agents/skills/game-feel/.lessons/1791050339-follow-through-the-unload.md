---
title: A lens judged on how it follows needs an unbroken lab, and the layout has to fit the skis' turn
date: 2026-10-03
scope: pwa/src/game/camera-lift.ts, engine/game/lift-ride.ts, pwa/src/game/station-plan.ts
concepts: [camera, lift, unload, lab, occluder, layout]
---

The chair-to-run sequence looked fine in jumped-to screenshots and was broken
in motion: the lens snapped fresh in every one, so nothing showed the springs.
`make lift-ride` rides it unbroken at sixty frames a second and photographs it
round the unload, and the first sheet showed four bugs no still had: the rider
sat through the chair's backrest (his hips were placed off his boots, behind
the back), the lead skied him through the station house and the stop gate, and
the chair he left popped. Three rules came out of it. The skier turns on an
arc of about 8 m even at a crawl, and braking to tighten it just stops him
dead, so place the station's pieces where that arc does not sweep (the parting
3 m past the wheel, the signs 14 m past it) rather than steering harder. A
moving prop between the lens and the rider (the empty chair) is hidden as an
occluder, not made solid to the boom: the clearance walk starts at a helmet
that is still inside the prop, and pulling the lens onto his back is worse
than the prop vanishing. And a "stay in the lane" rule must be stated by the
lane's own corridor, not by how far up the line he is: led over the lip and
back down the line, he passed under the same `u` and was pulled back toward
the lane.
