---
title: Software GL runs a branch it skips at the branch's full price — so it overprices a uniform `continue` and cannot price a per-puff branch at all
date: 2026-10-05
scope: pwa/src/game/
concepts: [performance, shaders, swiftshader, measurement]
---

Timing the snow cloud alone under SwiftShader (a scratch page: 120 puffs veiled in front of a chase lens, the frame read back), then cutting the fragment shader short at each stage, priced its parts: the density 48 ms, the light +52, the LAMP LOOP +175 with every lamp off, the tone map and haze +~95, of 385. A trivial shader drew the same puffs in 17 ms. The lamp loop's `if (uLampOn[i] <= 0.0) continue;` is skipped cheaply by a real GPU (the test is uniform), but SwiftShader runs the body masked. A `break` at the first empty slot (exact, because `dealLamps` fills the slots in order) took the frame to 283 ms. The other way round, a branch on a per-puff varying (a cheaper path for faint puffs) bought ~1.5% there, because SwiftShader runs both sides. Under software GL, price a shader by cutting it short (a `gl_FragColor = …; return;` at each stage) and by the work a change removes outright, never by a branch it adds. Time it against the same random stream: the sled lab's cloud carries its stream from sheet to sheet, so a run with fewer sheets differs everywhere.
