# The paramotor

A free ride can start under a powered wing. Pick **PARAMOTOR** on the start card's RUN row (the stop before the snowmobile), or follow a `?start=free&para=1` link. You start on the summit with your skis on, a small ram-air wing held up over you on its lines and a motor on your back. Ski off until the wing flies, fly it anywhere on the mountain, land on your skis, and drop the whole rig to ski on.

The engine side is `engine/game/para.ts` (the flight), `para-state.ts` (its state and events), `para-pilot.ts` (the bot's hands) and `defs/para.ts` (every number). The app side is `pwa/src/game/para-canopy.ts` (the wing's shape, its paint and its line plan, three-free), `para-motor.ts` (the motor unit as built), `para-scene.ts` (the two hung on the engine's bodies, the lines drawn, the downed wing laid on the snow, and the pilot sat in the harness), `camera-para.ts` (the camera rows under the wing), `hud-para.tsx` (the strip), `audio/para-bed.ts` (the motor's sound) and `strings-para.ts`.

## What it is

The rig is a **motorised speed wing**, flown on skis. It sits between two real kinds of wing:

- **A paramotor wing** is large: 22–30 m² flat, trimmed near 37 km/h, a minimum sink near 1.05 m/s and a glide near 8. It floats.
- **A speed wing**, the kind speed riders launch off a summit on, is small: 8–13 m² (some up to 18), an aspect ratio near 4, a glide of 3–5 and 40–90 km/h. It flies fast and close to the slope.

This game's wing is **16 m²**. It flies at about **55 km/h** with the motor off and sinks at about 3–4 m/s, a glide near 4. It climbs only on the engine. That is the fast end of a paramotor's polar: low enough over the snow to feel the slope rush past, and slow enough to land on skis.

**The motor** is a foot-launch paramotor's: a single-cylinder two-stroke of about 185 cc turning a two-bladed 1.25 m propeller inside a round guard cage. That class gives about 75 kgf of static thrust at 8,500 rpm and burns about 3 L an hour. The frame, cage and tank weigh about 25 kg on the skier's back.

## The flight model

The model has **two bodies on one line**, solved after the skier's own step each tick at 120 Hz:

- **The pilot** is the skier's own body, with the motor's mass added. On the snow his skis are the skier's: every edge, skid and sink still applies.
- **The wing** is a 10 kg point mass: its cloth plus the air held in its cells.
- **The lines** are a constraint that never stretches: 6 m, a speed wing's short lines. They pull only when the two bodies move apart along them, so a wing that surges forward or collapses can go slack.

**The wing's forces** come from the air through it, the weather's wind included (`airAt`):

- **The angle of attack** is the trim angle plus the airflow's angle in the plane square to the lines. Trimmed, the wing settles at about 8°.
- **Lift** climbs at 3.2 per radian from a zero-lift angle of −0.05 rad (its camber). Past the **stall** at 0.3 rad only 0.55 of the lift is left.
- **Drag** is a zero-lift drag of 0.045 (the cloth, the cell mouths and the lines) plus the induced drag, 0.133·C_L² (1/πeA for an aspect ratio near 4). Stalled, the drag jumps to 0.45.

**The controls** are the pilot's own keys:

| Key | On the wing |
| --- | --- |
| The tuck | **The hand throttle.** Thrust is the static thrust times (rpm/full)², falling to zero at the propeller's pitch speed of 38 m/s. The rpm answers with a 0.35 s lag. |
| The skid | **Both brakes.** They pull the trailing edge down: more trim, more lift and drag, and an earlier stall. Pulled near the snow they flare the wing, so you touch down at walking pace. Held down, the wing stalls. |
| The edge | **The toggles and your weight in the harness.** One braked side drags and banks the canopy toward it, and the canopy's arc swings it back over the pilot as it banks. A toggle held is a steady turn, and let go it levels. |
| The lean | **The risers.** Forward is the accelerator (the front risers down, faster and steeper); back lets the trimmers out (slower). |

Some behaviour comes out of the model with no special case:

- **Phugoid.** A speed change swings the pilot fore and aft under the wing, and the swing is damped by the air against the canopy.
- **Torque.** At full power the engine's torque turns the wing a little to the left.
- **Stall recovery.** Let the brakes up after a stall and the canopy surges forward over the pilot as it fills, then dives to pick up speed. Low over the snow, that dive is how a stall ends badly.

**The launch.** On the summit the wing is held inflated overhead, standing a little behind plumb, until the skier is going 8 m/s. Then it is let fly. With the throttle open the skis leave the snow two to three seconds later.

**Under the wing on the snow** is speed riding: the skis on the slope, the wing still flying and taking some of the weight. Near the snow the pilot stands up out of the seat, and his skis meet the slope square from 6 m above it, fully by 1.5 m.

**The drop.** The machine press (**Enter**, or a double tap on touch) releases the whole rig. The canopy streams down as cloth, the motor falls on its own, and both lie where they land. The skier goes on as a skier. Drop it low: a pilot who lets go of the wing 100 m up falls 100 m.

**The collapse.** A wing brought down within 0.4 m of the snow, or into a tree's crown, collapses and is cut away the same way.

**A reset** (R) while the rig is on starts the ride again on the summit.

## How it looks

The look is built from how real speed wings and foot-launch paramotors are made, restated as numbers (`para-canopy.ts`'s `CANOPY`, `para-motor.ts`'s `MOTOR`):

- **The wing** is 7.8 m across flat on a 2.45 m root chord, an elliptical planform tapering to half a chord at the tips with its leading edge swept back toward them: about 16 m² and a flat aspect ratio near 3.8. It is arced so its projected span is about 0.83 of the flat one, its outer cells curled down 60–80° from the vertical as a ram-air wing's are.
- **The cells.** 25 of them, each a 15 % thick section with a little camber, the top skin pillowed out between the ribs and the trailing edge scalloped. The open cells' MOUTHS are cut along the underside just behind the nose (1–7 % of the chord); the outer two each side are closed, and a STABILIZER panel hangs under each tip.
- **The paint** is a three-colour panel scheme: a red base, a white swoosh piped in black running from the centre's nose out to the tips' tails, black tips, the underside a shade darker and the ribs' seams darker still. It is drawn in the shader (`PAINT_GLSL`), off each vertex's place on the wing, so the panels' edges, the mouths and the seams stay crisp at any distance.
- **The lines** are a cascade, as a real wing's are: every rib carries an A, a B and a C line (red, yellow, yellow) and the outer trailing edge the brake lines (orange), gathered two at a time into middles and those into mains, each set tied to its own riser webbing 45 cm over the hang point — the A risers red. Each stabilizer has a line of its own.
- **The brakes** pull the trailing edge down, the more toward the tips, each toggle its own side; a stalled wing bunches its span.
- **The motor unit** is a round cage of about 1.3 m in four tube sections with sleeves, its eight spokes from a hub ring and a net laced zigzag in each sector; a two-blade carbon propeller of 1.24 m, twisted and tapered, with a spinner and a blur disc as it spins up (the blades hidden past 90 % of their speed); the engine low in the middle with its cylinder up, its fins, plug cap, pulley and belt and its exhaust can; a translucent tank under it; the frame black with red accents and swan-neck arms round the pilot's sides to high hang points. Seated, the pilot's head is at the hub.
- **Released**, the propeller runs down over a second or so, and the canopy lies on the snow as a crumpled sheet on its back, draped over the ground point by point, its lines fanned toward the motor while they still reach it.

## The lab

`make para` photographs every moment the paramotor has through the game's own renderer, a contact sheet a group and every frame alone under `previews/` (`scripts/para-preview.mjs` over `pwa/src/tools/para-harness.ts` and `para-scenes.ts`):

| Sheet | What it shows |
| --- | --- |
| `summit` | On the summit under the held wing: the chase, behind, beside, in front, under the canopy and far off. |
| `launch` | Skiing off as the wing is let fly, and the lift-off. |
| `flight` | Climbing on the bot's hands, from behind, a quarter, beside, in front, below and above. |
| `turn` | A toggle pulled each way, and both brakes held. |
| `landing` | The final approach, the flare, and speed riding on the snow under it. |
| `drop` | The rig released, skiing on, and the canopy and the motor lying on the snow. |
| `gear` | The motor, the harness and the risers close up, and the canopy's underside. |
| `turntable` | The rig in the air from eight sides. |
| `lenses` | Every rung of the camera ladder in flight. |
| `night` | In the air after dark. |

`ARGS="--sheet=gear,turntable"` shoots some; `--views=` some views of them; `SEED=` another map. Run it before and after any change to how the rig looks, and look at both.

## Where it starts

`paraStartOf(level)` picks the highest head among the ski area's runs, or else the piste's own start, and faces the skier down that run from it.

## Determinism

Nothing in the paramotor draws from `state.rng`. The wind it flies in is the weather's pure field. A run flown on the same inputs is the same run (`tests/para_test.ts`).

## Tests and labs

- `npx vitest run tests/para_look_test.ts`: the wing's size, aspect ratio, arc and tip curl inside a speed wing's bands, a finite mesh under the brakes, every line hung off one of the eight risers, and the mouths and the tips as painted.
- `make para`: the lab (above).
- `npx vitest run tests/para_test.ts`: the launch, the climb and the glide, the turn, the stall and its recovery, the drop and skiing on, the restart, determinism, the start card and the HUD.
- `make build`, then `make screenshots ARGS="--surface para-ready,para-go,para"`: on the summit under the held wing, skiing off as it flies, and in the air on the bot's hands.
