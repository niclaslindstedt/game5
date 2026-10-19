---
title: A plan too big to move into the engine is HANDED IN as data at create — and its replay recipe must carry it
date: 2026-10-19
scope: engine/game/foot.ts, engine/game/rescue-call.ts, pwa/src/game/foot-call.ts, pwa/src/game/replay.ts
concepts: [collision, civilians, replay, determinism, presentation]
---

The civilians' plan (places off every building, roles, routes, fires, summer) is thousands of lines of `pwa/`; moving its placement into the engine (the posts lesson's answer) was out of reach. What the engine needed of it was small and closed-form, so the app hands it in before the first step as plain data — `FootCall` via `withFoot`, exactly as the rescue's `RescueCall`s are — and the one piece both sides compute (the route walked) moved into the engine (`foot-route.ts`) and is re-exported to the plan, so there is still one layout. Three traps: the hand-in has to happen wherever a run is stood up (App.tsx's `show` and the boot state — one choke point, not every `createGame`); `recipeOf` must copy it or a replay rides through people the live run hit; and a time-varying thing the app owns (a crew walking its call) is SAMPLED onto the call (`rescue-tracks.ts`, a quarter-second track) rather than re-derived in the engine.
