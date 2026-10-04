# The helicopter

A free ride's way up the mountain with no lift at all. A helicopter stands on its pad on the valley floor. A skier who rides in beside its right skid is sat on the skid, and then the player flies it anywhere on the mountain and as high as they like. Jumping pushes the skier off the skid, the skis are theirs again, and the pilot flies the machine home to its pad. Flown into the snow, into a crown or onto a slope too steep to land on, it crashes and burns where it came down, the skier on it is thrown, and a few seconds later the ride starts again from the pad.

It is reached two ways:

- **The start card's RUN row**, whose last stop is HELICOPTER (`free-ride.ts`'s `HELI_RUN`). The ride begins sat on the skid on the pad with the rotor turning. `?start=free&heli=1` is the same ride from a link.
- **Riding into it.** On every free ride it waits on its pad. Within 90 m of it, the machine and the painted pad light up and the HUD calls the skier to it (`snapshot.ts`'s `heliOf`). Riding in within `HELI.board.reach` of the right skid, slower than `HELI.board.fastest`, takes the skier on.

There is no ceiling, by design. That is the point of the game it makes: climb, push off, and see what the damage meter and the anatomy plate say when the snow comes.

## Where it lives

| Piece | File |
| --- | --- |
| Every number, and the geometry the model is built to | `engine/game/defs/heli.ts` (`HELI`) |
| The flight, the boarding, the drop, the pilot flying home, the crash, the restart | `engine/game/heli.ts` (`stepHeli`, `thrustMost`, `pilotInput`, `startAgain`) |
| Where the pad stands | `engine/game/heli-pad.ts` (`helipadOf`) |
| The rotor's wash, as air | `engine/game/heli-wash.ts` (`washAt`, `inducedOf`), read by `air.ts` and the renderer |
| The state and its events | `HeliState`, the `heli` event, `RunRules.heli`, `GameState.heli` in `engine/game/state.ts` |
| The machine as drawn (the model, the rotor blur disc, the lights, the pad and the wind sock, the wreck, the wash's snow) | `pwa/src/game/heli-view.ts` |
| The explosion and the fire on the wreck | `pwa/src/game/explosion.ts` |
| The lens while riding it | `pwa/src/game/camera-heli.ts` |
| Everything the renderer holds it by | `pwa/src/game/heli-scene.ts` |
| The HUD's readout | `pwa/src/game/hud-heli.tsx`, `pwa/src/heli.css` |
| The sound | `pwa/src/game/audio/heli-*.ts` (see `docs/audio.md`) |
| The Blender model | `scripts/blender/heli.py`, `scripts/blender/kinds/heli.mjs`, published to `pwa/models/heli.glb` by `make models` |

## The machine

The class is the light single-engine utility helicopter heli-ski operators fly:

- a three-bladed main rotor about 10.7 m across, turning clockwise seen from above at about 390 rpm, with a tip speed near 220 m/s;
- a two-bladed tail rotor 1.86 m across at about 2,050 rpm, on the right of a slim boom (the side a clockwise rotor puts it);
- skid gear on two arched cross tubes, with a ski basket on the left skid;
- about 1,175 kg empty and 2,250 kg at its maximum weight.

It is flown at a working weight of 1,780 kg: the empty machine, a pilot, a guide, three quarters of its fuel and the basket. The skier on the right skid is added on top while he rides it. He rides the skid the machine hovers low on anyway.

The frame is the skier's: x right, y up, z forward. The origin is the SKID DATUM, the ground under the middle of the skids, so a machine resting on level snow stands at `groundAt`.

## The flight

The model is a rigid airframe hung under a thrust along its own up axis.

**The thrust the rotor can give** comes from momentum theory (`thrustMost`). The power that reaches the induced flow, `HELI.power` (300 kW), buys thrust T at P = T·(v_c + v_i). The induced velocity comes from Glauert's forward-flight relation, v_i = v_h² / √(V² + (v_c + v_i)²), with v_h = √(T / 2ρA). So:

- the rotor gives about 1.4 times the machine's weight at the hover;
- it gives more in forward flight (translational lift sets in at 8–12 m/s);
- it gives less climbing, and only its own weight at about 10 m/s of climb.

The parasite power ½ρfV³ (f = 1.4 m²) comes off the top at speed. Near the snow, GROUND EFFECT multiplies it by 1 / (1 − (R / 4z)²) (Cheeseman and Bennett), where z is the hub's height over the snow. That is 1.22 on the skids and gone by a rotor diameter up.

The air's density is held at 1.0 kg/m³ whatever the height. A real machine of this class runs out of power at about 4,500 m with this load. This one never does, on purpose.

**The air** drags on the airframe's front, side and plan areas (`HELI.drag`). The drag is against the weather's wind where the machine flies (`windAt`, brought to its height by the log law, `profileAt`). The fin turns the nose into a crosswind (`HELI.vane`), so a gust moves the helicopter and the pilot's feet hold the heading.

**The skier on the right skid** is weight off the centre line. His rolling moment leaves a hang of a few degrees to his side, which the stabilisation trims against. He is also mass the collective is lifting. When he jumps, the collective (which answers in `pilot.lag`, 0.3 s) is still lifting him, so the machine lurches up and rolls back off his side before the pilot takes it out.

**The attitude** is flown by a stability augmentation: a damped spring (`pilot.attitude` rad/s, `pilot.damping`) onto the attitude the controls ask for. **The collective** holds the vertical speed asked, within what the rotor can give. The arcade's one extra hand is `pilot.coordinate`, which takes the side slip out so the machine goes where it points.

## The controls

The controls are the skier's own, read as an arcade pilot's (`controlsOf`). `input-model.ts`'s `sampleInput` is told the skier is flying, so nothing leans off the tuck key in the air and the edge thumb pulled down is not the back key.

| | Keys | Touch | Does |
| --- | --- | --- | --- |
| Tuck | W | the lever (a thumb on it) | noses down, flies forward |
| Back key | S | the lever slid up past its shut mark | noses up, slows and stops |
| Edges | A / D, ← / → | the edge thumb across | turns it, banked as a coordinated turn (tan φ = Vω / g) |
| Lean forward | ↑, Q, Z | the edge thumb pushed up | climbs, to 10 m/s |
| Lean back | ↓, E, Shift | the edge thumb pulled down | sinks, held to 3 m/s near the hover (the vortex ring sets in at a quarter to half the hover's induced velocity) and to 9 m/s at speed |
| Jump | Space | a double tap on either thumb's zone | pushes the skier off the skid |
| Reset | R | the reset press | back on the pad |

The drone's left-stick layout is the same idea: one thumb owns the height and the turn, the other the speed. On the snow, the tuck or a steer alone lifts the machine into a low hover, so pressing forward takes off.

## The pad, the drop and the pilot

**The pad** (`helipadOf`) is a level patch of the hub's open snow (R29), as near the village as one lies. The rotor's sweep plus a margin must be clear of every trunk, every lift line and bottom station, and both wind tunnels. A map with no hub puts it beside the finish.

**The drop** sends the skier off the seat with the machine's velocity plus `HELI.drop` (out over the skid and a little up). He faces the way it was flying, or out over the skid at the hover. From there he is an ordinary skier in the air: the flight, the landing load (`flight.ts`), the wipeout, the ragdoll and the injuries (`crash.ts`, `body.ts`) are the game's own. Deep powder gives more than a groomer, and a skier who leaves the skid high enough reaches the snow at the speed of a long fall.

**The pilot** holds the machine level for a beat (`home.beat`). He then climbs to `home.clear` over the snow ahead, flies home at `home.cruise`, slows in time to stop over the pad, comes down onto it and shuts down. A parked machine can be boarded again.

## The crash

A crash ends the flight. It happens when, while the player flies:

- the rotor disc's rim meets the snow, or meets a crown it sweeps (a tree's cone at the disc's height);
- the chin, the boom or the fin meets the snow;
- the skids touch down faster than `crash.sink` (4.5 m/s; the gear is certified for 2.5) or `crash.slide` along the snow;
- the airframe stands more than `crash.tilt` off the snow's lean;
- the snow is steeper than `crash.slope`. A flight manual's slope limits are 6–10°, and a machine pivoting on one skid is past saving at 5–8°. Both are held a little wider here for the arcade.

The wreck burns for `crash.wreck` seconds. A skier aboard is thrown by the blast (the `heli` crash cause, with its own tumble in `defs/crash.ts`). Then the ride starts again on the pad. A machine that crashes with nobody on it never happens: only the player's flying is tested against the mountain.

## The wash

The rotor drives its flow down through the disc at the induced velocity v_i = √(T / 2ρA), about 10 m/s for this machine at the hover, and on to twice that in the far wake. Over the snow the column turns into a thin radial OUTWASH WALL JET:

- its peak is 1.9 v_i at `wash.core` (1.7) rotor radii out;
- beyond the peak it falls off as 1/r and mixes away a dozen radii out;
- it leaves the snow once the hub is more than `wash.reach` (2.5) rotor diameters up.

Dry snow starts to blow at 4–11 m/s of wind, so a hover over powder blows snow out to 25–45 m. Below about one rotor diameter, the machine sits in its own whiteout.

`washAt` is air like any other. The skier's drag is against it (`air.ts`), so a skier standing by a machine lifting off is pushed off the pad. The renderer reads the same field to throw the snow cloud's puffs (`heli-view.ts`).

## The look and the sound

The model is made in Blender off `HELI` (`make models`). The renderer hangs it on the skid datum and spins `heli_rotor` and `heli_tail_rotor`. As the rotor comes up to speed, its blades are drawn at a strobed turn under a streaked BLUR DISC, the way an eye or a camera sees a rotor turning six times a second.

While the skier rides it, the helicopter takes the lens (`camera-heli.ts`):

- CHASE: behind and over the machine;
- FAR: the same, further out;
- HIGH: high over it, looking down at the drop;
- TIPS and HELMET: the RIDER'S EYE, out over his skis at the snow below.

The explosion (`explosion.ts`) is a fireball rather than a blast, because a light helicopter's fuel deflagrates. It is a swelling ball of fire rising into a column of black smoke, with a flash, the airframe's debris flung out and bouncing on the snow, a ring of thrown snow, and then the wreck left burning.

The sound is `docs/audio.md`'s. In brief:

- the rotor's whop at its blade-passage frequency (3 × 390 / 60 = 19.5 Hz), sharpening into blade slap in descents and turns;
- the turbine's whine following the spool;
- the tail rotor's buzz at about 68 Hz;
- the wash's roar of blowing snow near the ground;
- the explosion's whump, crack and fire.

## Measuring it

- `npx vitest run tests/heli_test.ts`: the thrust against momentum theory, the climb with no ceiling, the hang toward the skier, the turn, the drop and the lurch, the pilot home, the boarding, the crash and the restart, the wash, and determinism.
- `make screenshots ARGS="--surface heli-pad,heli-wash,heli"` (after `make build`): the machine on its pad, lifting off into its wash, and flown up the mountain by the pre-roll's pilot (`pilotInput`).
