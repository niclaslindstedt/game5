---
title: A station off the snow keeps the contact point it last touched — read SkierState.contacts with touching, never bare
date: 2026-10-04
scope: engine/game/skier.ts, engine/game/strict.ts, engine/game/gate-poles.ts
concepts: [contacts, flight, gates]
---

`stepSkier` writes a contact's `x`/`z` only on a step its station touches, so in the air every contact is where it left the snow — metres back up the hill after a roller. The strict gate verdict judged a racer flying over a closed gate by those feet and disqualified him with his body through the middle; it now takes a foot in the air under the body. `gate-poles.ts` still averages the bare contacts for the knock (presentation only). Anything new that reads where the feet are must check `touching` first.
