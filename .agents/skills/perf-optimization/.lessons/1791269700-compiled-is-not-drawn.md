---
title: A program compiled behind the card can still stall its first frame — count links AND first uses after `__SH_READY__`, and watch for GL errors that drop draws
date: 2026-10-06
scope: pwa/src/game/environment.ts, pwa/src/game/heli-view.ts, pwa/src/game/machines.ts
concepts: [performance, shaders, three, webgl-errors]
---

Three things the helicopter's boarding hitch taught. First, `compile` only sees what is in the scene: a model loaded with `GLTFLoader` after the load's compile (and everything hung on it) links on its first frame, so a view whose model is async owes a `ready` promise the load waits on. Second, a material whose `transparent` is toggled mid-run (`needsUpdate`) is a NEW program at that moment — keep it in the state it will spend the ride in. Third, a linked program is finished by the driver at its first DRAW (`getProgramInfoLog` in a CDP profile is where that time lands): patch `linkProgram` and `getProgramInfoLog` in an init script and count both after `__SH_READY__`, and draw everything once behind the card (`warmPicture`). And wrap the draw calls with `getError()` once in a probe: a sampler bound to the wrong kind of texture (a `sampler2DShadow` handed a depth texture three never uploaded) makes the GL REFUSE the draw — under SHADOWS MEDIUM that was every lit draw (fixed by handing the sampler a real texel), the world gone and the frame cheap, which a timing meter reads as a win; and a warm draw made before a sampled target exists warms nothing.
