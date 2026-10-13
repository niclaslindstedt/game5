---
title: A dark dawn shade is lifted in the shadow, never across the whole sky light — and a deck's floor must keep its relief
date: 2026-10-13
scope: pwa/src/game/sky.ts, pwa/src/game/haze.ts, pwa/src/game/cloud-volume-glsl.ts
concepts: [sunrise, shade, exposure, clouds, labs]
---

In the dawn chase, snow in the mountain's shadow fell to a twentieth of the
sunlit key. The first fix multiplied the whole sky light (the ambient and the
irradiance harmonics) for a sun a few degrees up. The chase table said it
worked, with shadeL tripled. The vista and sunset sheets, measured box by box
against the baseline, said otherwise. The sunset's golden key on the snow
cooled from r/b 1.62 to 1.32, and the dawn haze went grey: the extra blue sky
light also fell on every sunlit face and on the far terrain under the air.
Because sunrise and sunset share the same elevations, no profile by elevation
can tell them apart. The lift now multiplies `indirectDiffuse` only where
`terrainLit` is low (`SHADE_LIFT` in `haze.ts`). Sunset is back to the
baseline's numbers to the pixel, and the dawn shade is still lifted.

Second: when a closed deck on HIGH was brought up to MEDIUM's grey with a
constant light floor, it matched on brightness and lost all its lumps. The
deck's mean is not the whole check. Crop the sheet and look at its relief, and
shade the floor by the point's height in the column so the base's lumps still
read.
