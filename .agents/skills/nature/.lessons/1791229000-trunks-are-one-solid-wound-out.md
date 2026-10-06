---
title: A trunk is one solid — wound outward, one shared ring a joint — and a lean is a matrix, never the map
date: 2026-10-05
scope: pwa/src/game/tree-mesh.ts, pwa/src/game/tree-shapes.ts, pwa/src/game/forest.ts, pwa/src/game/tree-tilt.ts
concepts: [trees, trunk, winding, joints, girth, lean]
---

Two faults made every trunk read as a hollow shell, and the tree sheet
showed neither. They only showed close up, in a game frame or `make world`'s
`forest` view:

- **`tube` was wound INWARD.** The tree material draws front faces only, so
  the near wall was culled and the far wall's inside was drawn, lit
  backwards. That made dark trunks, and a birch's white bark came out grey.
  A shape built without `wind: true` keeps the winding it was pushed with.
  `tests/trees_test.ts` now checks every trunk face turns out from its axis.
- **A stem made of separate tubes does not join.** Each span turned its ring
  its own way (`i * 0.5`), built it square to its own axis, and took its own
  girth weight. That left notches at every joint, and the girth then pulled
  them further apart. `stemUp` now lays ONE ring a joint, level in plan,
  turned the same way, with one weight shared by the span on each side. The
  test holds each joint to at most five corners with one weight (the root of
  a multi-stemmed tree is the exception).

The lean is the INSTANCE's rotation about the trunk's foot, off a hash of
its place (`tree-tilt.ts`). It never comes off `state.rng` and is never
written into `TreeDef`, so no digest moves and collision stays upright.
Everything in `forest.ts` that reads a tree's place has to allow for the
lean: the cell cull's box, the casters' reach and the lens-clear test.
Otherwise a crown leaning 9 m off its trunk gets culled or loses its shadow.
