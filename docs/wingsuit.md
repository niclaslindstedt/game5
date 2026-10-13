# The wingsuit

A free ride can be flown in a WINGSUIT: a large three-wing suit (two arm wings and a leg wing, ram-air, the arms and legs its spars) over a BASE rig with one canopy and **no reserve**. **He wears no skis**: he jumps on his boots and lands on them. The engine takes it with `CreateGameOptions.wingsuit`:

- **On its own** (`wingsuit: true`), he stands at the CLIFF EXIT high on the mountain, facing out over the drop.
- **Up a craft** — with `plane` (or `chute`), `heli`, `balloon` or `para` — he wears the suit in the plane's door, on the helicopter's skid, in the balloon's basket or under the paramotor's wing, with no skis, and every way off it is the suit's start arc: the plane's jump, the helicopter's drop, the balloon's jump over the side, the paramotor's dropped rig. The skydive's one way in off a craft (`chute.ts`'s `craftFreefall`) reads the craft's event and hands him to `suitExit` with the craft's own way — at ANY height, where the rig's skydive needs 100 m: in the suit there are no skis to fall onto. A restart puts him back in the craft he left.
- **At a lab's moment**, `wingsuitOut` takes him out at a given position and velocity, and `skydiveAt` with its `suit` stands him already flying.

The engine side:

| File | What it holds |
| --- | --- |
| `engine/game/wingsuit.ts` | The flight, the ledge and the jump, the snow met, the landing and the walk |
| `wingsuit-start.ts` | The exit searched on a map, stood on it, the hook out of a craft |
| `wingsuit-pilot.ts` | The bot's hands |
| `defs/wingsuit.ts` | `WINGSUIT`: every number, with its source |

It rides on the skydive's step (`chute.ts`, [the skydive](skydive.md)): `ChuteState.suit` is `"wingsuit"`, its flight `ChuteState.wing` (`WingsuitFlight`), and the canopy `CHUTE.base` on `canopy.ts`'s maths. `GameState.wingsuit` says where the ride began (`from`: `"cliff"` on its own exit, `"craft"` up a craft, `"air"` a lab's moment) and, on a cliff exit, the hover he is held at (`hover`, below). Nothing draws from the stream, and a ride with no wingsuit never comes in here, so no digest moves.

## The press

The machine press (**Enter**, a double tap on touch):

1. **On the exit: JUMP.** The tuck pressed past half does the same.
2. **Flying: PULL**, from a second after the jump.

Under the canopy the press does nothing: there is nothing to cut away to. On the snow, on his boots, the press begins the jump again at its exit, and so does the reset.

## The air on the suit

The model is the one fitted to a flight-test logger worn by a flyer in a large glide suit. The lift and the drag are *factors* that fold the half, the coefficient and the area into square metres:

  L = ρV²·cL(α),  D = cp·ρV² + L²/(ci·ρV²)

The best glide is ½·√(ci/cp) whatever the density or the mass, which move only the speeds. The paper's suit was of an older generation, with a best glide near 2.7. A large modern suit is scaled from it as the research does: a larger induced factor for the longer, wider wing.

The lift factor rises 1.3 m² a radian from −0.14 rad of attack and tops out at the stall, 0.6 rad. Past it, it falls gently and the drag grows: he mushes.

The suit **pressurises** with the air through it. It is empty below 8 m/s and full by 18 m/s, over half a second. Before then it is a body with little lift.

| The hands | Key | What it does |
| --- | --- | --- |
| Pitch | The lean | Forward toward the dive's trim (0.05 rad), back toward the flare's (0.42 rad) |
| Roll | The edge | Rolls him to 1.15 rad of bank in 0.35 s. The tilted lift turns him; a turn is pulled a little higher and sinks |
| Sweep | The tuck | The arms swept back to the hips: the delta dive, with less lift, less drag and a lower trim |
| Spread | The back key | The wings full and pushed forward: more lift and drag, and a higher trim. With the lean back, it is **the flare** |

**The attack is its own short period.** The pitching moment pulls the attack toward its trim and the pitch rate is damped (0.20 m³ a radian, 16 kg·m²). It rings near 0.9 Hz and settles in about a second and a half. The path is turned by the lift and by gravity across it. Nothing else is written in: the **phugoid** (the speed's long swing) comes out of it at about 24 s.

**The air** is the paramotor's (`para-air.ts`): the map's wind, the ridge lift and the lee. The density is the standard atmosphere's for the height. At the map's edge it is the airborne edge's band (`AIR_BOUNDS.wingsuit`, 600 m), blowing him back in and turning his hand to the middle, as every craft in the air.

## The exits

**The cliff exit** (`wingsuitExitOf`, memoized per map) is searched over the top 55 % of the mountain's vertical, every 12 m, on the fall line and 0.35 rad either side. The 48 likeliest spots are kept: the drop over 30 m, plus three tenths of the drop over 100 m, plus a tenth of each metre the spot stands above the band's foot. Off each one the **start arc** is flown: the suit's own lift and drag on a point mass, from a running push of 4.5 m/s out and 0.8 m/s up. The highest spot whose arc clears the snow by 10 m is taken.

A real exit point is a wall near sheer for its first hundred metres. A generated mountain has no such wall: its faces top out near 45°, and the arc off the best of them meets the snow 60–80 m down. So on every generated map the exit is a **HOVER**. He stands on the skid of a helicopter held still over the highest of those edges, at the least height (100–800 m, in 25 m steps) whose arc from rest clears the snow. Then the hover is raised 500 m above that (`hoverRoom`), so he has the suit to fly for a while before he pulls 350 m over the snow. He steps off at 1 m/s. On seed 38 the least that clears is 175 m, so he hovers at 675 m; on the others tried, 650–675 m. `WingsuitExit.hover` says which kind it is, and so does `GameState.wingsuit.hover`.

**The exit's attack**: he leads with his body into the air coming up at him, at 0.55 rad of attack, just short of the stall, where the suit's lift is greatest. It is held there until the air reaches 15 m/s. The hands are his from a second after the jump. He is **flying** once his path's glide reaches 1 (as fast across as down), or after 14 s. On seed 38 that is 114 m and 5.8 s after the jump.

**Out of the plane's door** he leaves at the jump run's speed. The suit is full and flying 1.5 s later, 4 m lower.

## The pull and the canopy

The pull starts the skydive's staged opening on the **BASE rig** (`CHUTE.base`):

- **The canopy**: a single 7-cell canopy of 24.2 m², 6.6 m across, on 4.6 m of lines.
- **The slider**: up.
- **The pilot chute**: a 1.0 m hand-thrown pilot chute on a 2.7 m bridle.

| Stage | Ends, s after the throw | Drag area, m² |
| --- | --- | --- |
| The pilot chute | 0.6 | 0.4 |
| The bag | 1.1 | 0.75 |
| Line stretch | 1.7 | 1.8 |
| The snivel | 3.5 | 4.6 |
| Full | 4.3 | 17 |

The suit's own drag area is 0.15 m², and its lift is carried through the opening until line stretch. Thrown from the glide, it is full in about 4.3 s, 67 m lower, at a peak of about 2 g.

Hands off, the canopy flies 9.1 m/s forward and 3.6 m/s down: a large, docile BASE canopy. It is flown on the skydive's keys:

- **The edge** is the toggles.
- **The back key** is both brakes and the flare.
- **The lean** is the risers.

## The snow and the landing

**The snow met in flight** throws him. This is the snow under him (or where he will be next step) within the body's 0.3 m half thickness, or a crown within 0.2 m. The cause is `wingsuit`, or `tree` for a crown. Once he has lain, the jump begins again where the ride began: the cliff (or hover), or the craft he left.

**Landed under the canopy**, the canopy is let go and he is **on his boots**:

- **Too hard**: from 6 m/s of sink, or 9 m/s across the snow, he is thrown (`landing`).
- **Otherwise**: he runs it out at 5 m/s² and walks at 1.4 m/s at most, turning at 1.6 rad/s.

## In the app

The start card's **START** row has a **WINGSUIT** stop after the plane: the ride begun on the wingsuit's own exit (`free-ride.ts`'s `WINGSUIT_RUN`; the chart marks the exit). The wingsuit is its own thing, as the paramotor is: the cards never put it on him up a craft, and every jump off the paramotor, the balloon, the helicopter and the plane is made in the parachute. With no skis to pick, the rider card's way on is **FLY** and the gear card is skipped (`menu-dress.tsx`); once he has stood on his boots a moment after landing, the HUD's plate offers **FLY AGAIN**, the **PISTE MAP** (the pause card opened on its slopes) and **QUIT** (`plane-hud.ts`'s `suitLandedOf`, `hud-result.tsx`'s `LandedPlate`). A link says the same: `?wingsuit=1` the exit; `?suit=wing` (or `rig`) over a craft is a lab's hook only. A flyer who dies starts again on the exit (`againAt`'s `exit`) or in his craft.

**The HUD** (`plane-hud.ts`'s `chuteOf`, its `suit`; `hud-plane.tsx`'s `SuitReadout`) reads the height over the snow big, labelled **ABOVE SNOW** (a flyer flies by the ground under him, never the sea) — amber inside the bot's slowing height (450 m), red with **PULL!** at its pull height (350 m) — the air speed in km/h beside the glide flown, the sink in m/s under it, and the press: **JUMP** on the exit, **PULL** in flight. Its words are `strings-wingsuit.ts`; the news says the exit, the pull and the landing on his feet.

**The sound** is the skydive's bed (`chute-bed.ts`, `chute-voice.ts`) with the suit's own `suit` layer: the roar as a belly's at a fifth more air (a glide's 150–250 km/h is as loud as a freefall, over 115 dBA at the ear), the loose jumpsuit's flap gone, and the trailing edges' and cells' FLUTTER — a brown rumble of 20–80 Hz rising with the speed, a little quieter as the suit fills hard. `make audition ARGS=--meter` has its three rows (filling off the exit, gliding, diving).

**The statistics** keep the metres flown across the sky in the suit (`stats.ts`'s `suit`, FLOWN IN A WINGSUIT).

## The bot

`wingsuitPilot` flies the suit and `wingsuitInput` is the whole ride: the press on the exit, then the suit, then the skydive's own pattern (`chutePilot`).

- **The line**: it flies hands off down the fall line.
- **The snow ahead**: it looks 2 and 4 s along its way. It turns down the fall line harder where the snow ahead comes within 40 m, and leans back and spreads (a flare) where it comes within 15 m.
- **The pull**: it slows from 450 m over the valley floor and pulls at 350 m. It never pulls in the start arc. Flying, it also pulls when the snow ahead is closer than it can lift him off and he is within 40 m of it.

On seed 38 it flies 3.7 km in the suit, pulls 337 m over the snow and lands on its boots 3.4 km from the exit.

## The lab

`make wingsuit-flight` (pure Node, seconds; the flat map, plus seed 38 for the exit and the whole flight). Each row sits beside its band:

| Row | Value | Band |
| --- | --- | --- |
| `glide-ratio` | 3.2 | 3.0–3.5 |
| `glide-across` | 152 km/h | 150–190 |
| `glide-sink` | 13.1 m/s | 10–14 |
| `dive-top` | 359 km/h | ≥250 |
| `flare-gain` | 20.7 m | 10–40 |
| `flare-sink` | −8.0 m/s (climbing for 4 s) | <0 |
| `flare-held` | 10.4 m/s | >10 |
| `short` | 0.9 Hz | 0.6–1.0 |
| `phugoid` | 24 s | 10–30 |
| `turn-rate` | 17.8 °/s | 15–35 |
| `turn-sink` | 21.4 m/s | 12–25 |
| `exit-drop` | 114 m | 60–120 |
| `exit-time` | 5.8 s | 4–7 |
| `plane-time` | 1.5 s | 1–4 |
| `plane-lost` | 3.9 m | <100 |
| `pull-full` | 4.3 s | 3–5 |
| `pull-lost` | 67 m | 60–150 |
| `pull-g` | 2.1 g | 2–5 |
| `canopy-fwd` | 9.1 m/s | 8–10 |
| `canopy-sink` | 3.6 m/s | 3.5–5 |
| `land` | 2.1 m/s | <3 |
| `edge` | 256 m | >0 |
| `flight` | 3.7 km | — |

Write the table with `ARGS=--json=FILE` before a change and compare against it with `--compare=FILE` after. `SEED=` flies another map. `tests/wingsuit_test.ts` holds the bands that matter.

`make wingsuit` is the picture lab. It skis the run through the game's own renderer and writes five sheets to `previews/`:

- `suit`: the suit flying, seen from six sides, and stood slack on the exit.
- `flight`: the whole ride on the bot's hands, from the exit through the pull, the canopy and the flare to walking off.
- `poses`: the shapes flown on the flyer's own keys (neutral, the turns, the dive, the flare), each from behind and from the side.
- `chase`: every rung of the camera ladder gliding high (900 m), flying the face on the bot's hands (`chase-face`, a few hundred metres over the snow), a change of rung flown frame by frame (`chase-swing`), under the canopy and on the exit.
- `night`: the exit and the glide at hour 21.

`ARGS=--sheet=suit,poses` shoots only some sheets, `--views=` some views, and `SEED=` another map. It needs `npm i --no-save playwright-core` and, in a web session, `CHROMIUM_PATH=/opt/pw-browsers/chromium`.

## As drawn

On a wingsuit run the flyer has no skis, no boots on bindings and no poles. Every stage is a shape laid on the engine's attitude (`skier-wingsuit.ts`, three-free: `wingsuitShapeOf`, `wingsuitPose`, `wingsuitTilt`):

- **Ready**: stood on the edge, or on the helicopter's skid with his left hand on the door frame. The wings hang slack.
- **Exit**: he pushes off and lays himself onto the air while the suit fills.
- **Flight**: the arms out from his sides, nearly straight, a little forward and pushed down. The legs are spread about 30° and the toes pointed.
- **Turn**: banked about his length, with the inside arm dropped.
- **Dive**: the arms swept back toward the hips.
- **Flare**: the arms forward and wide.
- **Pull**: his right hand reaches back to the pouch at the foot of the container, then throws out at arm's length.
- **Canopy**: the arm wings unzipped and hanging off the arms, his hands on the toggles.
- **Landed**: stood on his boots, then walking with the leg wing hanging like a skirt.

**The wings are lofted every frame, not skinned.** In the rig's bind pose he stands with his arms down, so a membrane between the arm and the side has no area there. Weights cannot grow it into a wing. Instead `wingsuit-cloth.ts` (three-free) builds each wing as a Coons patch off the posed joints:

- The arm wing runs from the wrist and the arm to the side of the trunk and down to the hip.
- The leg wing runs between the legs from the crotch to the ankles.

Each wing is two skins, top and bottom, with caps at the open edges. The gap between the skins is the thicker of two shapes: a round sleeve around the limb, or an airfoil section (NACA, about 6 % of the chord) grown by the suit's PRESSURE. Inflated, the wing takes on a camber, a pillow between each pair of ribs, and RAM-AIR INLETS under the leading edge. Slack, it sags and flutters. Under the canopy the arm wing is UNZIPPED and hangs off the arm. `suitMeasures` holds the sizes to a large suit's: about 1.7 m of span, a root chord near a metre, a 0.3 m tip and a leg wing about a metre long.

The BOOTIES are the leg wing's sleeves turned along each pointed foot past the ankle, painted dark, so the leg wing's trailing corners are two feet; each sleeve stands out at the knee and the heel, so from the side the legs read as legs. The boots' liners are folded away in flight. Flying, his head is carried up off his back with the neck craned, so from the side and the front the full-face helmet stands in front of the container. The body under the wings is the outfit's race jacket, insulated pants, race gloves and visor helmet, recoloured to the suit (`wingsuit-dress.ts`).

**The paint.** `wingsuit-look.ts` holds five bold COLOURWAYS: ember, volt, glacier, orchid and crimson. Each has a base, an accent, an edge, an underside, tips and trim. The wing's shader (`suitPaint`) paints each skin from the wing's own coordinates, so a panel stays put however the wing is bent. The colourway follows the outfit (`suitOf`).

**The BASE rig** (`chute-gear.ts`, `chute-scene.ts`): a slim single container with no reserve tray and no reserve handle, a big pouch at its foot, and a large pilot chute sized off `CHUTE.base`. The canopy is a 7-cell main (`BASE_WING` in `chute-canopy.ts`), orange with a white centre and black ends.

**THE HOVER EXIT** (`wingsuit-hover.ts`): when `state.wingsuit.hover > 0`, a helicopter is drawn holding a hover over the exit, with the flyer stood on its right skid. Once he steps off it holds for a moment, then noses over, climbs away to its left and is gone 50 s after the jump. It is the heli-ski machine's own drawing (`heli-view.ts`) handed a state of its own, presentation only.

**The BASE container** (`base-rig.ts`): a soft, rounded bag in the suit's colours — the closing flap in its accent with a bound seam where the pin cover folds over, the bridle in its channel down the right edge of the flap to the pouch across the bottom, the handle out of it, and riser covers over the shoulders. **The slider** is open MESH: a tape border round a net that is mostly air.

## The lenses

`camera-wingsuit.ts` (three-free; `tests/camera_wingsuit_test.ts`) frames him from the exit to the pull the way wingsuit footage is shot, every lens LOOKING DOWN along his line so the mountain fills the frame:

| Rung | The lens |
| --- | --- |
| TIPS | The camera on the back of his helmet: the helmet low in the frame, the arm wings out to its edges, the snow ahead |
| HELMET | His own eyes, ahead and down along his way |
| CHASE | The chase flyer straight behind him, a little over him, looking along his way: where he is going is the middle of the frame |
| FAR | The same flyer about 9 m back and 3 m up, still behind him |
| HIGH | Over and behind him, steeply down: him over the face |
| ORBIT | A flyer slowly circling him |

On the HOVER EXIT every lens stands out on the side away from the helicopter, outside its disc, looking down past him at the drop; TIPS and HELMET look out over the drop from the skid. **The launch** (`SUIT_LAUNCH`): off the exit the picture opens on a dramatic shot — off a hover the exit's own lens off his side, off a ledge or a door a lens out in front of him and under his line looking back up at him diving off — held 0.35 s and flown round behind him into the chase over 0.8 s, so within a second and a quarter the picture is where he is going. Every boom stands straight back along his heading, the way his body points, never off to one side with the wind's drift. Through the launch and every change of rung the aim is turned onto him whenever he would stand further off its axis than `IN_VIEW` of its half field (`keepInView`), so a fall steeper than the chase's line never loses him. **In a dive** (`SUIT_DIVE`) the chase and far flyers close in on him with the airspeed, by up to 55 % of their reach from a glide's 45 m/s to a dive's 68 m/s, so a swept, tucked flyer under a widened field keeps his size.

**The sense of speed** (`camera-pace.ts`, `make speed-cam`): the booms' field widens with the airspeed (20° by 70 m/s) while the lens pulls in to keep him his size, so the world rushes out past the frame's edges; the lens falls back behind a dive into speed and closes on a flare (the surge); past 22 m/s it is rocked by the air in slow swings growing with the speed (the buffet), and it banks with him by a share of his bank. The ice crystals in the air are drawn bigger and brighter the faster the lens moves (`snowfall-plan.ts`'s `STREAKS`), the peripheral flow a player reads speed by. Motion blur is left out on purpose: in studies of racing games a strong blur lowered the speed players read. **Every change of rung is flown**, never cut, over 1.1 s: the lens swung round him (`swingLens`), never through him. Through the opening the skydive's lens takes him (`camera-skydive.ts`), flown in the same way, and under the full canopy the canopy's ladder (`CHUTE_RIGS`).

**The mist aloft.** The DISTANCE row's mist closes on the distance through the air, so from hundreds of metres up it hid the whole mountain. On a wingsuit run alone, a lens more than 40 m over the snow (wholly by 220 m) measures it across the ground instead, thin under him and thickening to close a little inside its wall, where the woods stop, so the ground and the woods melt into the haze with no rim (`haze.ts`'s `uMistAloft`, set by `machines.ts`). Every other ride keeps the mist as it was. And the higher he flies the steeper every lens looks (`camera-wingsuit.ts`'s `SEE`): pitched down until the middle of the frame lands within 380 m across the ground, most of it by climbing the flyer over him so he stays in the frame — from 500 m up the chase sees him over the woods and the runs, never over the mist past the ground's edge.

`tests/wingsuit_look_test.ts` holds the shapes, the measures, the colourways, that nothing of a pair of skis is drawn, and the helicopter's skid under him.
