---
title: The crop search trades the ski area for the drop below it — re-centre on the lifts and read the plan, not the score
date: 2026-10-12
scope: scripts/lib/real-face-crops.mjs, scripts/real-faces.mjs
concepts: [crop, search, lifts, town, refusals]
---

Where a ski area stands high over a long fall to the valley (a plateau
face over a plain, a resort above a cliff-lined valley), the search's
worth keeps buying drop until it is capped, so its best rows slide the
window down off the skiing: the lifts end up crowded into one edge or the
top half (`low 0.00` on every row) and the generator stands its lifts on
empty slopes beside them. Taking the search's top row three times in one
batch put the real lifts in a corner of the map. What held: move the
row's `lat`/`lon` to the middle of the kept lifts' ends (the
`previews/.osm/lifts-<id>-*.json` file), try `east`/`north` 0 and a few
bearings near the search's, and judge each by the bake's `drop`/`falls`
table and then the resort lab's plan — real lifts in the middle, the town
under the hub. Every one of those faces kept over 700 m of drop.

The suite holds every face to a town (`streets > 0`): a crop that keeps
the high skiing of an area whose town lies 5 km down the valley from it
has no town and fails. Keep the town and accept fewer real pistes on the
map; say so in the PR (`near` comes out low for such a face).

A high basin with a long road up to it (the batch's alpine-31 on one
seed, continental-23 on two of its search's rows) is refused over and
over by R26's "no way off the gondola's top falls to the peak's chair's
queue", past the hinted attempts. Try the search's other rows before
dropping the face; one of them built on every seed.
