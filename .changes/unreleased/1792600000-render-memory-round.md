---
type: Changed
title: Lighter free rides — less memory for the village and the signs, fewer per-frame allocations
---
The village's buildings now share one copy of their distant shapes instead of three, which frees about 9 MB of graphics memory on a typical free ride. Each run sign and route board keeps its printed face once instead of twice, another 9 MB or so. The paramotor and the hot air balloon are built only on a ride that carries them. The lifts' moving chairs and cabins cost about a third less work a frame and leave far less garbage behind, and the injury check no longer allocates on every step.
