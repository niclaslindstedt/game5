---
title: A tree's faceted normals go in the UNIT frame, its colours one flat colour a face, and its trunk is sized in the shader
date: 2026-10-02
scope: pwa/src/game/tree-mesh.ts, pwa/src/game/tree-shapes.ts, pwa/src/game/forest.ts
concepts: [trees, normals, faceting, girth, colour]
---

Three things the procedural rewrite got wrong first, each visible only in
`make world` (the tree sheet hid all three):

- **Face normals are taken in the unit frame, plainly.** three.js already
  turns an instanced normal through the instance matrix's inverse transpose
  (`defaultnormal_vertex`), so squeezing a face normal by the 4:1 stretch
  before storing it squeezes it twice: every bough lit edge-on, a wood of
  grey-blue cones.
- **One flat colour a face.** A bough coloured white at its root and green
  at its tip is a gradient that reads as grey mush at any distance; snow as
  clean white planes (a tier's cap, the top of some boughs) over solid
  green boughs (every other one a shade darker, so the facets read) is the
  white-over-green banding — and the chunky look.
- **The trunk is not in the crown's scale.** An instance is stretched by
  its crown across, so a trunk built into the mesh is as thick as the crown
  is wide — every tree the same pencil. Tag the trunk's vertices (`stem`:
  axis in plan, weight) and hand each instance its GIRTH (`girth`:
  `TreeDef.radius / (TRUNK_REF · scale)` per axis); `graftGirth` widens the
  ring in the vertex shader. A tree's age then costs no mesh. The casters'
  depth material needs the same graft and its own cache key, and an inset
  (scaled) sketch must scale its `stem` axes with its positions.

The world lab's tree shadows sometimes come out missing: the mountain's
shadow bake lands after the frame is taken. Re-run before blaming a change.
