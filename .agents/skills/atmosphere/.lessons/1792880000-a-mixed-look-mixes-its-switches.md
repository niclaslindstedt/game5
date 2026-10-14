---
title: Mixing two sky looks mixes their switches too — give a switch a share of its own
date: 2026-10-14
scope: pwa/src/game/sky.ts, pwa/src/game/sky-gpu.ts, pwa/src/game/cloud-front.ts
concepts: [weather, front, clouds, sky-gpu, continuity]
---

A moving sky (`front.ts`) is drawn by mixing the looks of the two skies on
either side with `blendLook`. That function mixes every number, and some
numbers are really switches. `SkyLook.cloud.genus` is 0–3. `sky-gpu.ts`
asked `genus === 3` to hand the dome to the LOW grid under a lid. Mixed, the
genus was 2.96 at 96 % of the way into an overcast, so the GPU's clear-sky
table still drew the far air cyan until the change was 100 % done. Then it
popped grey. A comparison like `=== n` or `> n` against a mixed number puts
the pop wherever the number crosses n, and that can be the end of the change.
The fix is a switch's own share (`CloudLook.lid`, 0..1). The grid takes over
as soon as any of a lid is in, since the grid is itself the two looks mixed,
and so it is continuous. Look for every `=== ` on a look field before you mix
looks.

The cloud field had a second trap. A layer's place in the noise is
`speed · t`. When a change moves the speed (or the cell's size), the whole
run's time multiplies the difference, and the field races kilometres during
the morph. A slot's drift has to be the INTEGRAL of its speed
(`frontEaseArea`), with the offsets laid so the noise reads that.
