---
type: Fixed
---

Loading one map after another no longer piles up memory a phone runs out of: the minimap's ground and the piste map boards' pictures are given back when their map is left, the instanced draws' buffers are freed with their map. Saved ghosts are held to a budget, the oldest let go first, so a full store can no longer stop the record book, the settings and the statistics from being saved. A phone that takes the graphics back while a map is loading no longer leaves the loading card up for good.
