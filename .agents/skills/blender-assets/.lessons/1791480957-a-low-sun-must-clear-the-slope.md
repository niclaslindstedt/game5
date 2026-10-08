---
title: A backlit shot from ON a slope needs the sun higher than the slope's own pitch toward it — cut a col on the sun's bearing, and lay a motif in the FRAME, then cast it onto the snow
date: 2026-10-08
scope: scripts/blender/title_world.py, scripts/blender/title_spray.py
concepts: key-art, lighting, composition, terrain
---

From a lens standing on a 17° face, every far point of the face toward the sun stands at ~17° or more, so a "low 8° sun behind the ridge" lights nothing — the whole frame falls flat and grey, the skier included. The title scene puts the sun just over the near slope (~19°) and cuts a deep col in the ridge on the sun's bearing FROM THE SKIER (`P["notch"]`, a gaussian in that bearing, not in an across-the-face coordinate — the sun's ray runs diagonally across the face). A carve seen side-on hides its lean: turn the skier (`P["yaw"]`) until he comes at the lens obliquely, and his rooster tail trails behind him into the sun. A logo motif laid on the ground in world coordinates foreshortens to a straight line on a face seen up its fall line; lay it in plate UV and cast each point through the lens onto the snow (`title_spray.tracks`), and place the gates and a stand of trees the same way. Rings of jittered polar samples flat-shade into concentric bands at a grazing sun: scatter each ring's points through its whole width.
