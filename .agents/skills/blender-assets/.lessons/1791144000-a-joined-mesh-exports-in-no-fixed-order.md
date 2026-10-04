---
title: A joined mesh exports in no fixed order — sort its elements by distance from an off-axis point, or a committed model moves on every run
date: 2026-10-04
scope: scripts/blender/heli.py
concepts: [models, determinism, gltf, export, stamps]
---

`bpy.ops.object.join()` takes the selected parts in an order that changes
run to run, and the glTF export lists each material's triangles in the
joined mesh's face order — so `make models KIND=heli` cut twice from the
same sources gave two different `heli.glb`s (identical vertices, the index
buffers of the small primitives shuffled), a diff in git for nothing. Sorting
every element after the join (`mesh.sort_elements(type="CURSOR_DISTANCE",
elements={"VERT", "EDGE", "FACE"})` with the cursor at a point off every
symmetry plane, so no two mirrored parts tie) made three cuts byte-identical.
Custom normals set by hand on a shelf ellipsoid were NOT stable run to run
and had to go; the ones set on the big CDT skin were. Check with `cmp` over
two fresh cuts before committing a new kind.
