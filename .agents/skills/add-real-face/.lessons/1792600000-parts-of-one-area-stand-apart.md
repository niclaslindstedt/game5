---
concepts: [crops, where, area-step, markers]
---

The two mountainsides of one area must stand about seven kilometres apart, measured by their crop rows' lat and lon.

The area step's camera spans at least `AREA_KM` (34 km). On the thinnest view the world map test keeps (470 × 200), that is about six pixels a kilometre. Two parts closer than about 7 km therefore fail `world_map_test`'s "two of an area's mountains" check, which wants more than 40 px between them.

Two crops on the two faces of one ski area, a few kilometres apart, cannot pass as two parts of one area. Name the second crop as an area of its own instead. Do not move its marker off the crop to make room.
