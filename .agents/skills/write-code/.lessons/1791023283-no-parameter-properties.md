---
title: A module the labs or the Blender driver import runs under Node's type stripping — no parameter properties, enums or namespaces in it
date: 2026-10-03
scope: pwa/src/game/
concepts: [node, typescript, labs, models]
---

`scripts/blender/kinds/*.mjs`, `skier-metrics` and the probes import game
modules straight through `node --experimental-strip-types`, which only
erases types: `constructor(readonly material: M) {}` fails with
ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX at import, though `tsc` and Vite accept
it. Declare the field and assign it in the constructor (`helmet-shape.ts`'s
`Piece`). A quick `node --experimental-strip-types -e 'import("./x.ts")'`
catches it before a 45 s Blender run does.
