---
type: Changed
title: The game draws with WebGPU where the device has it
---

The mountain, the snow and everything on it are now drawn with WebGPU on a browser and device that offer it, and with the same renderer over WebGL2 where they do not. A device that cannot start WebGPU, or loses it while the game loads, falls back to WebGL2 on its own instead of leaving a black screen.

The renderer the game drew with before is one setting away: DEVELOPER ▸ RENDERER ▸ CLASSIC WEBGL, or `?renderer=webgl` on the link. The trail maps' stamps are no longer culled away on the WebGPU picture, and the first hit with the injuries on no longer stalls while its pieces are prepared.
