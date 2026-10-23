---
type: Changed
title: The woods cost the processor less on WebGPU
---

On a device that draws with WebGPU, the woods are now drawn as one indirect draw a pass instead of one draw for every tree shape in view. The picture is the same, and each frame hands the GPU far fewer objects: about a fifth less of the processor's drawing work at the HIGH picture in our measurements, which leaves more room for a steady frame rate on devices where the processor is the limit.
