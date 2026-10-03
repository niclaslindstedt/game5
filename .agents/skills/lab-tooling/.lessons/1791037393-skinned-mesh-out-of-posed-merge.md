---
title: A skinned mesh hung under a pair's root must be kept out of the merged draw
date: 2026-10-03
scope: pwa/src/game/skis-body.ts, pwa/src/game/posed-merge.ts
concepts: [skinning, merged-draw]
---

`mergePosed` folds EVERY `Mesh` it is handed into one rigid-skinned draw, and `THREE.SkinnedMesh` is a `Mesh`: the dressed skier (`skier-dress.ts`, under the figure's group) is filtered out where `skis-body.ts` collects the parts (`!(o instanceof THREE.SkinnedMesh)`), drawn as its own two draws, and added to `casters`. A lab that finds the skier's bones does it by name off the `dressed` group (`getObjectByName("dressed")`), which is what the skier lab's detail and stretch sheets read.
