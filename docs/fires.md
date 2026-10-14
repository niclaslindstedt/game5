# Fires

A free ride's ski area keeps FIRES: a CAMP FIRE outside a share of its huts,
where skiers stop to grill sausages and warm their hands, and a few BONFIRES
on the valley floor at the bottom of the runs. This page is what they are
modelled on and what is built. The engine half is built: where every fire
stands and what riding into one does; and the fires are drawn. The people
grilling round them and the skier burning are the parts still to come.

## What they are modelled on

- **A camp fire** is a hut's own outdoor fireplace. In the northern ski
  areas the classic skier's lunch is sausages grilled over an open fire at a
  rest stop beside the runs: a warming hut, an open-fronted log shelter or a
  grill hut with a fire ring in front of it — a ring of stone or steel about
  a metre across — a supply of firewood beside it and log benches round it.
  Mountain restaurants keep grills on their terraces. Its flames stand half
  a metre to a metre high. It stands a few metres out from the hut's front:
  clear of the walls and eaves, close enough to be the hut's.
- **A bonfire** is the big fire a base keeps going at the end of the day.
  Fire codes cap an open bonfire's fuel at about 4.5 m across and 2.4 m tall
  and keep it at least 15 m from any building or anything that burns, in a
  pit a little wider than the fire. Its flames stand three to five metres;
  the heat off a fire that size is bearable — a few kW/m², warm on the face —
  from about four to six metres out, which is where its benches stand.
- **A body on fire.** Flame contact, and a ski jacket's burning shell over
  him, puts of the order of 100 kW/m² on a skier — twenty times what hurts
  bare skin within seconds. The game's burn model (`body.ts`, the `heat`
  ladder in `defs/anatomy.ts`, which a crashed helicopter's fireball already
  uses) reads that as a thermal dose in (kW/m²)^4/3·s; at that flux it
  passes the airway's threshold in a couple of seconds, and an airway burn
  is mortal (`gore.ts`).

## What is built

- **Where** (`engine/game/fires.ts`, numbers in `defs/fires.ts`): `firesOf`
  deals about 45 % of the huts — a log hut, cabin or chalet, an afterski
  lodge, a mountain restaurant, the patrol's hut — a camp fire, in the order
  their hashes put them, a hut with no room passing its fire on to the next.
  Each stands 4–8 m out from the front wall (always past the roof's reach),
  to one side of the door or beside a flank, on ground leaning no more than
  0.3, off every run's snow, the water and the streets, clear of every
  trunk, post, wall and lift line; two to four log benches face it and most
  have a woodpile. Two to four bonfires stand on the valley floor near the
  village, 60 m apart, out of the hub's open snow, 15 m from every
  building's walls and clear of the lifts, the wind tunnels, the
  helicopter's pad, the snowmobile, the balloon's site and the airstrip;
  five to seven benches stand five metres out. A pure function of the map
  off hashes of its seed on a salt of its own: no stream, no digest.
- **Riding into one** (`engine/game/fire-burn.ts`, `RunRules.fires` — a
  free ride's alone): a footprint circle in a hearth, his centre of gravity
  not clear over its flames, throws him (the `fire` crash cause, a low
  stumble on into it) with his clothes alight (`GameState.burn`: the fire,
  where and when he caught, `burning`, `burnt` 0..1 over 25 s, the flux on
  him) and the `fire` event (`caught`, later `out`). A thrown body rolling
  into a hearth catches the same. The flux is summed into his body's heat
  dose every step and judged four times a second while it burns; with his
  wounds carried (the INJURIES switch) he dies of `fire` within a few
  seconds, otherwise he lies until the reset stands him up, put out.
- **Safe for work** (`RunRules.sfw`): a hearth is a solid; he is held off
  at its edge, his way into it taken off, and nothing burns.

- **As drawn** (`pwa/src/game/fire-plan.ts` lays out the parts, three-free;
  `fires-view.ts` draws them, built by `gates.ts` and shown on a run whose
  rules keep fires): a camp fire's ring of a dozen stones round a teepee of
  six split logs, charred where they burn, over a bed of embers glowing in
  cells, a sooty grill grate over half of it on two stones, its benches
  split half logs on two stumps, its woodpile split logs stacked ends out;
  a bonfire's teepee of sixteen long logs over a burnt bed. Round both the
  snow is trampled and melted — ash and char in the hearth, dark slush at
  its rim, grey-brown boot-packed snow out past the benches fading into the
  white. The FLAMES are tongues of fire, each a quad turned to the lens and
  shaped in the shader off the run's clock: a yellow-white heart, an orange
  body, red tips licking and tearing off the top, laid over by the wind; a
  soft glow round them; sparks rising, slowing and swirling off downwind,
  thick at night; a thin grey thread of smoke drifting off on the wind, a
  bonfire's a taller column. Every particle is a pure function of the clock
  in the shader. THE LIGHT: the four fires nearest the lens are dealt lamp
  slots (`headlamp.ts`'s `Flood`, all round, warm orange, flickering), so
  after dark the snow, the benches, the people and the trees round a fire
  are lit by it. Eleven draw calls for every fire on a map. `make fires` is
  its lab (sheets `camp`, `bonfire`, `night`, `map`, each frame captioned
  with its milliseconds, draw calls and triangles).

`tests/fires_test.ts` and `tests/fires_look_test.ts` hold it.
