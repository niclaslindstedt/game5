---
title: Anything drawn standing in the snow is passed through until the ENGINE plans where it stands
date: 2026-10-05
scope: engine/game/posts.ts, engine/game/edge-stakes.ts, pwa/src/game/
concepts: [collision, posts, stakes, scenery]
---

The floodlight masts and the edge stakes were placed by the app (`piste-light-plan.ts`, `gates.ts`), so the engine could not know they existed and skiers rode through them. Making a thing solid means moving its PLACEMENT into the engine (`piste-masts.ts`, `stakePlan`) and having the app draw off that plan — never a second copy of the layout in the app. Before calling a new contact done, grep `pwa/src/game/` for anything else built at a place the engine never states (signs, station furniture, arena fences): each is a pass-through waiting to be reported. Add a solid to `posts.ts`' list (trunks first, so a trunk's index stays its own) and every contact reader — the skier, the ragdoll, the loose skis, the snowmobile and both bots' dodges — picks it up at once.
