---
title: A post-pass darkening keeps the air in front of the surface — and the air's share is held under the colour
date: 2026-10-23
scope: pwa/src/game/rays-tsl.ts, pwa/src/game/haze-tsl.ts
concepts: [post, ambient-occlusion, haze, tsl, webgpu]
---

The picture the grade reads is already hazed, `seen = A·surface + B`, so
the shade and the contact shadows lay `k·seen + (1 − k)·B` with `B` the
haze over black at the pixel's world point. That keeps a far slope's mist
and the air in front of a shaded trunk. It made dark figures near the lens
LIGHTER and bluish, though, because not every material is hazed (a skier's
black pants have no `B` in them). Holding `B` under `seen` (`min(B, seen)`)
fixed it, and the lab's off-and-on sheets now count pixels lighter as well
as darker, so a regression of the kind shows as a non-zero "lighter" share
anywhere but on a mirror. Two TSL traps cost a lab run each: a branch block
written `() => x.assign(y)` hands back the node and is built as a return,
commented out inside an inline `Fn`, so brace every branch. A
`FramebufferTexture` is made in the canvas's format and cannot be copied
from a half-float target, so keep a frame in a target of its own.
