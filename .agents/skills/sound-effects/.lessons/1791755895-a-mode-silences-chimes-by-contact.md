---
title: A mode with moments of its own silences the generic chimes through the route's Contact, never new events
date: 2026-10-11
scope: pwa/src/game/audio/route.ts, pwa/src/game/audio/index.ts
concepts: [route, contact, events, ski-jump]
---

A ski jump emits the generic `count`, `go`, `land`, `trick`, `combo`,
`checkpoint`, `lap` and `finish` events beside its own `skiJump` ones, so it
rang the trick score's chime, the combo's phrase and the finish horn over a
landing (`node previews/…` printing every step's events through
`soundForEvent` is how it showed). The fix is app-side: `index.ts`'s
`contactOf` adds `Contact.jump` on a run with `state.jump`, and `route.ts`'s
`jumpSound` answers first — the jury's signal for `go`, nothing for `count`
and the chimes, the jump's own bank for its stages — falling through
(`undefined`) for everything else. Without a contact every event keeps its
old sound, so `audio_test`'s every-event table is untouched. A new mode with
its own vocabulary of moments adds a Contact field and a function like it.
