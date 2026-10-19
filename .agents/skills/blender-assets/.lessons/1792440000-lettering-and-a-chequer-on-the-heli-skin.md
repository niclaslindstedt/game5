---
title: Lay lettering on a curved skin as a font mesh projected vertex by vertex, and cut a chequer as skin fields — both stay inside the heli's budget
date: 2026-10-19
scope: scripts/blender/police.py, scripts/blender/heli.py
concepts: [livery, lettering, fields, budget, models]
---

The police machine needed POLICE on its sides and belly and a two-row
chequer along its band. Blender's built-in font (`bpy.data.curves.new(...,
"FONT")`, `resolution_u = 2`, converted to a mesh) gives clean caps at a
few hundred triangles a word; setting each vertex by a `place(u, v)` that
stands it on the skin (`side_x` on a side, the section's underside on the
belly) 7 mm proud wraps the word onto the curved surface with no z-fight,
and flat shading keeps the letters even. The chequer costs nothing in
textures: each yellow cell is a field (`min` of the two half-widths less a
6 mm inset, so no two cells meet at a corner, `-1` on the blue cells) that
`heli.py`'s CDT traces into the skin like a window. The whole dress came
to 15.8k triangles against the 16k budget once the chequer stopped where
the boom grows slim — measure with `TRIANGLES` before adding more. A
render from below needs the studio's floor plane hidden (open the saved
`-game.blend` in bpy and set `hide_render`).
