---
title: Three's shadow pass tests a caster against the PICTURE's camera's layers, so no layer makes a mesh cast without being drawn — open its draw range in `onBeforeShadow` instead
date: 2026-10-05
scope: pwa/src/game/sled-view.ts
concepts: [performance, shadows, three, draw-calls]
---

`WebGLShadowMap.renderObject` asks `object.layers.test(camera.layers)` of the camera handed to `render()`, the picture's, never the light's shadow camera. A caster on a layer of its own is therefore dropped from the shadow pass along with the picture. The mesh's `material.visible` and its frustum test are shared by both passes too. What separates them is the pair of hooks three calls around a caster's shadow draw: hang a merged caster with an empty draw range, open it in `onBeforeShadow` and shut it in `onAfterShadow`. In the picture it is then an empty draw (a program bind, no triangle). A count of 0 still reaches `gl.drawElements` and is counted. Merging the snowmobile's 39 primitives into one caster a node cut the shadow pass's draws for it to 7, every frame byte-identical.
