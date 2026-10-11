---
title: Node's per-step garbage is mostly boxed numbers the phone never makes — and a texture read twice is a texture held twice
date: 2026-10-11
scope: engine/, pwa/src/game/
concepts: [performance, memory, garbage, three, textures]
---

The sampling heap profiler showed the engine making about 330 KB a step, and most of it was V8 boxing doubles passed to and from functions too large to inline (`stepSkier`). JavaScriptCore, the phone's engine, keeps doubles in the value itself, so that garbage does not exist on the device. Chase only the real objects, arrays and closures the profile names (a `.some` closure in a loop, a spread `{...spot}`, a fresh quaternion a carrier), and prove each with the cpu-cost hash.

For memory, add up the GPU's buffers once per attribute object (three uploads a shared attribute once) and look for the same data held twice: a far cut, a distant cut and a whole mesh built from the same triangles (one buffer, draw ranges, each range's bounding sphere set by hand), and a canvas uploaded once as sRGB colour and again as a linear bump (one texture, the bump encoding the decode back with `sRGBTransferOETF`, swapped into three's chunk text in `onBeforeCompile`, since includes are resolved after it).
