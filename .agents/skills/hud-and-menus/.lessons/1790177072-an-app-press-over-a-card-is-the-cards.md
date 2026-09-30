---
title: An app press the input manager takes over a card is a button the card never gets — ENTER most of all
date: 2026-09-23
scope: pwa/src/game/input.ts, pwa/src/game/settings-input.ts
concepts: [keys, cards, shutter, prevent-default]
---

The input manager listens on `window` and calls `preventDefault` on every
press it takes. A `<button>` is activated by Enter as the keydown's DEFAULT
action, so a manager that took Enter over a card would cancel the press of
whatever row the cursor is on — the front door's RACE included. When ENTER
became the shutter (`shot` in `DEFAULT_KEYS`), `input.ts` was changed so
that, off the race (`claiming` false), an app press other than PAUSE whose
keydown lands ON a control (`onControl`: a button, a field, a link) is left
to that control. Not "every press only while claiming": the REPLAY surface
is off the race and still wants C and ENTER. A new app action bound to a key
a card also uses (Enter, Space) must keep that rule; `menu-nav.ts`'s
capture-phase walker only covers the directions and Escape/Backspace.
