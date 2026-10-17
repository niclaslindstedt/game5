# Fires

A free ride's ski area keeps FIRES: a CAMP FIRE outside a share of its huts,
where skiers stop to grill sausages and warm their hands, and a few BONFIRES
where its skiers gather: at the base, off the top station and, on most maps,
half way up. This page is what they are
modelled on and what is built. The engine half is built: where every fire
stands and what riding into one does; the fires are drawn; and the people
round them are out on the free ride. The skier burning is drawn and heard.

## What they are modelled on

- **A camp fire** is a hut's own outdoor fireplace. In the northern ski
  areas the classic skier's lunch is sausages grilled over an open fire at a
  rest stop beside the runs: a warming hut, an open-fronted log shelter or a
  grill hut with a fire ring in front of it — a ring of stone or steel about
  a metre across — a supply of firewood beside it and log benches round it.
  Mountain restaurants keep grills on their terraces. Its flames stand half
  a metre to a metre high. It stands a few metres out from the hut's front:
  clear of the walls and eaves, close enough to be the hut's.
- **A bonfire** is the big open fire a ski area keeps where its skiers
  stop. Where it stands follows them: by far most often at the BASE, in the
  plaza at the foot of the lifts where the runs come home and the fire pits
  stand by the village's terraces; at the MID-MOUNTAIN stop, the bench where
  the first lift tops out and the mountain restaurant stands, its deck with
  fire pits beside it; and at the TOP, the warming fire or lean-to with a
  grill a short walk off the top station, where a northern area's skiers
  grill before the run down. Each stands a little off the station and the
  runs, never on them, and level with or below the station, so a skier off
  the lift glides to it. Fire codes cap an open bonfire's fuel at about 4.5 m across and 2.4 m tall
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
  have a woodpile. Two to four bonfires stand about the mountain
  (`FIRE_LAYOUT.bonfire.sites`, each fire's `site`): one or two at the BASE
  near the bottom station nearest the village, one off the highest lift's
  TOP station, and on three maps in four one at the MID-MOUNTAIN stop off the
  lift top nearest half way up — each looked for about 40 m from its
  station (never within 25 m of one), the top's and the middle's no more
  than 2 m over their station's snow, in the open first (no more than two
  trunks within 20 m) and among the trees only where the open has no room;
  60 m apart, out of the hub's open snow, off every ski route, 15 m from
  every building's walls and clear of the lifts, the wind tunnels, the
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

`tests/fires_test.ts`, `tests/fires_look_test.ts` and `tests/burn_look_test.ts`
hold it.

## The people round them

Skiers stop at a fire to warm up and eat (`civilian-fires.ts`, dealt by
`civilian-plan.ts` on a salt of its own, so no digest moves — presentation
only). A camp fire gathers two to five, a bonfire four to ten, every one
facing the fire:

- **Sat on the benches**, the hips on the seat itself: a sitter's floor is
  the bench's top less the bench pose's seat height, so the figure sits on
  the log and never on the air beside it.
- **Grilling**: stood (or, at a camp fire, sat on a bench no higher than the
  hearth) with a 1.2 m stick held out low, a sausage at its tip over the
  embers — a third of a metre out from a camp fire's middle, 1.9 m from a
  bonfire's, a quarter to seven tenths of a metre over the hearth — turned
  slowly and browned in stripes (`civilian-fires.ts`'s `stickTip`, drawn by `fire-helds.ts`).
- **Eating** the sausage in its bread, a bite every few seconds; **warming
  the hands** palms out to the heat; talking, a mug or a beer.
- A pair or a few of **skis and poles stuck upright** in the snow behind them.

They come by the hour (`FIRE_HOURS` in `civilian-fire-roles.ts`): a camp
fire fullest round lunch (11–14) and thin late at night, a bonfire filling
toward evening and the afterski. They are the civilians' own figures and
poses (the `grill`, `eat`, `bite` and `warm` targets and their bench forms,
`civilian-moves.ts`) in the same instanced draw; the sticks and the bread are
two instanced meshes beside it, drawn only near the lens. Every other person
on foot is kept out of a fire's ring (`fireKeepOut`), and nobody stands in a
hearth or on a bench he is not sat on. `make fires ARGS=--sheet=people` is
the lab (a group close and from above, the view from a bench, a griller's
hand, stick and sausage close up, an eater and a warmer, a bonfire's ring,
and the same at hour 21); `tests/fire_people_test.ts` holds it.

## The skier burning

- **As drawn** (`pwa/src/game/burn-plan.ts` decides it,
  three-free; `burn-view.ts` draws it, built by `machines.ts` the first time
  a run's `GameState.burn` is shown; nothing at all on a run kept safe for
  work): flames stand on patches of him laid along his bones — his shins,
  thighs, pelvis, chest, arms and helmet — and follow the posed body or the
  ragdoll; the fire CLIMBS him from his boots to his crown over four
  seconds, the jacket burning tallest and the helmet least, and dies down
  over the burn's last half. Thick black smoke off the melting shell rises
  and drifts off on the wind, sparks fly off him (a burst as he goes
  through the hearth), and his clothes CHAR behind the fire — black,
  browned where the shell ran — in the dressed skin's own colours. Once the
  flames are out he smoulders for forty seconds: embers in the char and
  thin grey wisps. His light is a lamp slot of its own, flickering orange,
  so after dark the snow round him is lit. Four draw calls (the flames, the
  glow, the sparks, the smoke). The X-ray cam leaves a fire death to the
  death cam.
- **As heard**: a whoomph as his clothes catch and a hiss as the burn goes
  out (`audio/fire-bank.ts`), and under them a roar, a tear and a hiss with
  the crackle of the burning cloth (`audio/burn-bed.ts`), fading into a few
  embers' pops in the smoulder. No voice of his. The news reads ON FIRE! as
  he catches and BURNT OUT as the burn ends on his body; the death card
  reads BURNED. `make burn` is its lab (sheets `catch`, `burn`, `char`,
  `night`, `sfw`, each frame captioned with the time since he caught, the
  burnt share, its milliseconds, draw calls and triangles).

## A snowmobile ridden into one

The snowmobile catches in a hearth instead of being held off it, and its tank goes up a moment later. Its rider is blown off it burning. [The snowmobile's page](snowmobile.md#into-a-fire) has the whole of it.
