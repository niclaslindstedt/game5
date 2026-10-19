---
title: A broken body is the ragdoll's pose with parts turned about their joints, and a struck man's skis must come off
date: 2026-10-19
scope: pwa/src/game/crowd-broken.ts, pwa/src/game/crowd-fall.ts, pwa/src/game/crowd-view.ts, pwa/src/tools/gore-person-scenes.ts
concepts: [gore, ragdoll, pose, person-hit, lab]
---

The amateur run into and left lying (`crowd-broken.ts`) is the ragdoll's
lying pose with the part below each break turned about its joint, by a
hash of the amateur. Three things the person sheet
(`make gore ARGS=--sheet=person`) showed:

- Turn a break about the snow's UP, never about a bone's own normal. The
  ragdoll already lies flat, so a turn about up keeps every point on the
  snow it lay on. A turn about any other axis pushes a limb into the snow
  or lifts it into the air.
- The skis stood up out of the snow on a leg flung over. `laidSkis` can do
  nothing with a shin that points straight up. Releasing the bindings once
  the trunk is down (`releaseSkis`, `Thrown.down`) made a broken body read
  as broken. A blow that breaks a leg is past any binding's release anyway.
- A smear laid one blot a frame turns into a dotted line once the body
  slides faster than a blot's width a frame. Lay the blots along the
  segment the body crossed. A trace the size of the whole sheet is the
  only place this shows: the close tiles hide it.

The lab takes 10 minutes for five views at 960×540 on software GL. Iterate
with `--views=` on one or two views, and run the whole sheet once at the
end.
