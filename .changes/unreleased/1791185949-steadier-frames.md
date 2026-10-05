---
type: Fixed
title: Quicker, steadier frames — the scene no longer drawn twice, no shader stalls mid-run, cheaper shadows, woods and ground
---

A run begun while the front door's scenery was still loading no longer leaves a second copy of the whole mountain, its woods, lifts, crowd and skiers drawn behind the first for the rest of the session. Under SHADOWS HIGH the skiers' own shadows no longer make every material rebuild its shader setup each frame, and they read their map in nine samples where there were thirty-six, pixel for pixel the same picture. Every shadow program a race can need is linked behind the loading card, so a new kind of caster coming into view (a slalom's finish) no longer stalls a frame. The woods' per-frame refill costs about half what it did with exactly the same trees drawn, and the ground draws only the parts of its grid the camera can see.
