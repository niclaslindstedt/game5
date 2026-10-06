---
title: Tile a round of renders into one contact sheet with Blender's own image API — the container has no PIL or sharp, and one sheet is judged where sixteen files are skimmed
date: 2026-09-29
scope: scripts/blender.mjs
concepts: [renders, contact-sheet, headless, judging]
---

A modelling pass over a catalog (six pairs, four kits) makes dozens of
stills, and reading them one file at a time is how a wrong tail on the third
bird goes unnoticed. The session's Python has neither PIL nor numpy and npm
has no sharp, but Blender does: `blender -b --python-expr` with
`bpy.data.images.load(...)`, `.scale(W, H)`, `.pixels` copied row by row
into a `bpy.data.images.new(...)` sheet and `.save()` tiles sixteen 1280×720
renders into one 2560×1440 grid in a few seconds (rows fill bottom-up:
Blender's pixel rows start at the image's foot). Read the sheet, not the
files — and put on it the view the game actually has of the asset (a
pair's chase view, not only the studio's three-quarter).
