---
type: Fixed
title: The world no longer vanishes below SHADOWS HIGH
---

On a machine whose picture is set (or probed) below SHADOWS HIGH, the snow, the woods, the skier and the helicopter's body were not drawn at all on browsers that check every draw's texture bindings — only the sky, the rotor's blur and the lights were left. The skiers' own shadow map is now always handed to the snow as a real depth texture, a texel a side when there is no map, so every draw goes through whatever the SHADOWS row says.
