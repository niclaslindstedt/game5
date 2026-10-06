# The paramotor

A free ride can start under a powered wing. Pick **PARAMOTOR** on the start card's RUN row (the stop before the snowmobile), or follow a `?start=free&para=1` link. You start on the summit with your skis on, a small ram-air wing held up over you on its lines and a motor on your back. Ski off until the wing flies, fly it anywhere on the mountain, land on your skis, and drop the whole rig to ski on.

The engine side is `engine/game/para.ts` (the flight), `para-state.ts` (its state and events), `para-pilot.ts` (the bot's hands) and `defs/para.ts` (every number). The app side is `pwa/src/game/para-scene.ts` (the wing, the lines and the motor as drawn, and the pilot sat in the harness), `camera-para.ts` (the camera rows under the wing), `hud-para.tsx` (the strip), `audio/para-bed.ts` (the motor's sound) and `strings-para.ts`.

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

## Where it starts

`paraStartOf(level)` picks the highest head among the ski area's runs, or else the piste's own start, and faces the skier down that run from it.

## Determinism

Nothing in the paramotor draws from `state.rng`. The wind it flies in is the weather's pure field. A run flown on the same inputs is the same run (`tests/para_test.ts`).

## Tests and labs

- `npx vitest run tests/para_test.ts`: the launch, the climb and the glide, the turn, the stall and its recovery, the drop and skiing on, the restart, determinism, the start card and the HUD.
- `make build`, then `make screenshots ARGS="--surface para-ready,para-go,para"`: on the summit under the held wing, skiing off as it flies, and in the air on the bot's hands.
