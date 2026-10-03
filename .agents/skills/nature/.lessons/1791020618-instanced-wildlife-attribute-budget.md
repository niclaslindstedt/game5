---
title: An instanced, instance-coloured mesh has about eleven of WebGL's sixteen vertex attributes left — pack the shader's marks into vec3/vec4
date: 2026-10-03
scope: pwa/src/game/beast-shapes.ts, pwa/src/game/beasts.ts, pwa/src/game/birds.ts
concepts: [shaders, instancing, wildlife, attributes]
---

The animals first carried every hinge as its own float — `aLeg`, `aHip`,
`aHead`, `aAntler` a vertex and `aGait`, `aStride`, `aGraze`, `aRack` an
instance. With position, normal, colour, the instance matrix (four slots) and
`instanceColor`, that is seventeen, and the program fails to link with "Too
many attributes" — but only in the browser: the suite, the typecheck and the
build are green, and `make birds` (one instance, no instance colour) drew
fine. `make world`'s console printed `VALIDATE_STATUS false` and the herd
simply was not there. So the per-vertex part rides one `vec3` (`aPart`: leg,
hip, head) and the per-instance motion one `vec4` (`aMotion`: gait, stride,
graze, rack). Count the slots before adding a mark, and run `make world`
(grep its output for `Shader Error`) after any change to a graft.
