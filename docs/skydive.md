# The skydive

Out of the jump plane's door ([the jump plane](airplane.md)) a free ride becomes a skydive: the exit into the slipstream, the freefall, the opening, the canopy flown down onto the mountain and landed on your skis. Follow a `?start=free&chute=<m>` link to start already out of the door `<m>` metres over the snow (30–6,000; it implies `plane=1`), or pick **PLANE** on the start card and jump.

The engine side is `engine/game/chute.ts` (the step: the exit, the freefall, the opening, the canopy, the cut-away, the reserve, the landing, the snag, the restart), `chute-state.ts` (its state and events), `canopy.ts` (the ram-air maths it shares with the paramotor), `chute-pilot.ts` (the bot's hands) and `defs/chute.ts` (`CHUTE`, every number), exported through `plane-api.ts`. The app side is `pwa/src/game/chute-gear.ts` (the harness-container), `chute-canopy.ts` (the sport main and the reserve, variants of the paramotor's cloth), `chute-rig-plan.ts` (the loose pieces, three-free), `chute-scene.ts` (every stage drawn), `skier-skydive.ts` (the body), `camera-skydive.ts` and `camera-para.ts`'s `CHUTE_RIGS` (the lenses), `plane-hud.ts` / `hud-plane.tsx` (the readout), `audio/chute-*.ts` (the sound) and `strings-chute.ts`.

## The rig

A sport skydiver's: a harness and container on the back (the reserve in the upper tray, the main in the lower, 11 kg packed), a throw-out pilot chute of 0.75 m on a 2.5 m bridle in a pouch at the container's foot, and a **9-cell ram-air main** of 18.6 m² (200 sq ft) flat, 6.5 m across on a 2.85 m chord (aspect ratio near 2.3), on 4.2 m of lines and risers, with a **slider** (0.75 × 0.65 m) that holds the mouth shut while it fills, and two steering toggles on the rear risers. The **reserve** (`CHUTE.reserve`) is a **7-cell square** of 16.3 m² (175 sq ft, about 0.88 of the main), 5.6 m across on a 2.9 m chord, on 4.0 m of lines with a smaller slider, white with red end cells, out of the upper tray by a **spring pilot chute** (0.6 m, short bridle) and a **free bag** that is let go once the lines are out. The skis stay on his feet throughout.

## The press

The machine press (**Enter**, a double tap on touch) does the next thing, and the HUD names it:

1. In the door: **JUMP**.
2. Out of the door (after 1.5 s, the tail passed over) and in freefall: **OPEN** — the throw.
3. Under the canopy: **CUT AWAY**.
4. Cut away and still above the 600 m deck's handover height: **RESERVE** — the left hand pulls the metal handle.

The reserve is never cut away: under it the press does nothing. A canopy not cut away is **released by itself** when his skis meet the snow under it.

## The exit and the freefall

He leaves the door with the plane's velocity and a push, into the slipstream. A **poised exit** leaves diving, already turning onto the wind: his body leads the air's own angle by 0.55 rad, starting from the crouch's 0.35 rad over upright and turned onto it in 0.25 s — about 34° over by half a second, 50° by a second and a half, belly to earth by the third. He is out of the "hill" and in freefall once the air comes up at him within 0.2 rad of plumb (about 9 s), or as soon as the player takes over after 1.5 s.

**The freefall** is a point mass under its drag on the air of the map (`para-air.ts`) at the real density for the height (the standard atmosphere): belly to earth 0.5 m² (55.8 m/s near the snow, 66.4 m/s at 3,800 m), tracking 0.34 m² with a glide near 0.9, head down 0.2 m² (about 89 m/s). From a standstill he reaches half of terminal in 3.4 s and 95 % in 9.7 s; 4,000 m to 1,000 m takes about 53 s.

| Key | In freefall | Under the canopy |
| --- | --- | --- |
| The tuck | Head down: the dive | — |
| The lean forward | The track: a glide along his heading | The front risers: faster, steeper |
| The lean back | A back slide | The rear risers: a flatter glide |
| The edge | A flat turn on the arms and legs | The toggles: one braked side turns it |
| The skid | — | Both toggles: brakes, and the flare near the snow |

## The opening

The throw starts five stages (`CHUTE.deploy`), each the drag area the air meets growing, so the deceleration is the **opening shock** with no special case:

| Stage | Ends, s after the throw | Drag area, m² |
| --- | --- | --- |
| The pilot chute out and inflating | 0.45 | 0.55 |
| The bag lifted off the container | 0.85 | 0.65 |
| The lines unstowed to LINE STRETCH | 1.3 | 1.5 |
| The SNIVEL, the slider held at the top | 2.9 | 3.4 |
| The slider down and FULL inflation | 3.6 | 14 |

Then the canopy flies as a second body, its force ramped from 55 % to all of it over a second, the harness load eased over the lines' 0.12 s of stretch. A normal opening costs about 150 m and peaks near 3.8 g (the band 3–6).

The reserve's pull opens its own five stages, faster (`CHUTE.reserve.deploy`): the spring throws its pilot chute clear of the burble at once and the free bag comes off with the lines, so there is no throw and no reach behind him.

| Stage | Ends, s after the pull | Drag area, m² |
| --- | --- | --- |
| The spring pilot chute out | 0.25 | 0.55 |
| The free bag lifted off the tray | 0.55 | 0.65 |
| LINE STRETCH | 0.95 | 1.4 |
| The SNIVEL, the slider held | 2.0 | 3.0 |
| The slider down and FULL | 2.7 | 12 |

Pulled at once after a cut-away it is full about 2.7 s later and some 40 m lower, peaking near 3 g; pulled near terminal after a delay, near 4.2 g. Its numbers stand inside the class's bands (a reserve 0.85–0.9 of the main's area, a spring pilot chute and free bag, certified to open within 300 ft); no maker's figures are used.

## The canopy

Two bodies on one line as the paramotor's wing (`canopy.ts` holds what they share: the line direction, the way, the lift and drag, the swing's damping, the pull on the lines, a crown's reach, a falling piece, hanging under the canopy), with no motor. The canopy is a 12 kg point mass with the air in its cells. Trimmed hands off it flies about 11.8 m/s forward and 4.3 m/s down, a glide near 2.7. One toggle all the way down turns it round in about 7 s at near 10 m/s of sink; both held stall it into a deep stall (about 8.5 m/s of sink, until they are let up and the canopy surges forward). Near the snow he stands up in the harness and his skis meet the slope square from 6 m above it; a flare takes the sink to about 1.5 m/s, and he lands skiing on at about 5 m/s. The reserve flies on the same maths with its own polar, smaller and more heavily loaded: about 12.0 m/s forward and 4.8 m/s down, a glide near 2.5; flared, it lands at about 1.1 m/s of sink.

## Down, cut away, caught

- **Landed.** The canopy within 0.4 m of the snow, or his skis on it, cuts the canopy away (`landed`): it falls as cloth and lies where it comes down, and he skis on.
- **Cut away** (`released`). The canopy falls as cloth (2.5 m² streaming, 4 kg, drifting with the wind) and he falls on; the next press pulls the **reserve** (`ch.reserve`), which opens, flies, lands and snags exactly as the main does, the main's piece still falling on its own (`ChuteState.piece`, and the reserve's `sparePiece` once it in turn is let go of on the snow). Not pulled, a cut-away is a freefall to the snow, handed to the skier's own step at 2.5 m and judged as any fall is; thrown, the ride begins again in the plane's door on the strip when the fall is over. Come down on his skis unthrown, he skis on after half a second stood.
- **Caught** (`snagged`). The canopy (the main or the reserve) within 1.2 m of a crown's edge below the tree's top, or a line or the cloth within 0.7 m of a lift's rope, 1 m of a tower's column or 1.4 m of a chair or a cabin, holds there. He hangs under it on his lines, swinging (a damped pendulum), a trunk met past 2.5 m/s felt by his body, until he starts again (**R**) in the plane's door.

Near the map's edge the airborne bounds blow him back in and turn him toward the middle — 320 m on his body, 100 m under the canopy ([the jump plane](airplane.md#the-airborne-edge)).

## The bot

The bot never jumps from the door by itself, but flies the skydive once he is out (`chute-pilot.ts`): it pulls at 1,000 m over the snow (not before 2 s out, and at once below a 600 m deck), pulls the reserve at once after a cut-away, then flies the pattern a canopy pilot flies to his spot — the strip when it is within a 2.2 glide, else the piste below — on the side toward the map's middle: the downwind leg joined at 300 m, base at 150 m, final at 60 m, its steer held to 0.45 of a toggle (a holding turn, never a spiral), and a progressive flare from 3 m down to all the way at 1 m. On seed 38 it lands about 26 m from its spot. `skydiveInput` (the labs and the suite) jumps on the plane's jump run.

## The look

- **The rig on him** (`chute-gear.ts`): worn on the chest and thigh bones — the main and reserve trays, the pilot chute's pouch and handle, the lift webs, rings, lateral and chest straps, the reserve's metal handle on the left lift web, the red cut-away pad on the right and the leg straps; the reserve tray's flap is hinged and thrown open when the reserve is pulled.
- **The opening** (`chute-rig-plan.ts`, `chute-scene.ts`): the pilot chute in his fist until the throw, then caught by the air; the bridle's slack and snaking; the bag lifted and tumbling; line stretch; the snivel; the slider coming down the lines; the cells filling from the middle out. At full canopy the bag and the pilot chute ride the bridle off the top skin's middle and settle aft over 2.2 s, the pilot chute trailing above and behind.
- **The canopy** (`chute-canopy.ts`): the paramotor's cloth (`para-canopy.ts` takes an optional `WingShape`; without one the paramotor is byte-identical) laid out as a sport main — the planform, the paint, the inflation held narrow by the slider, the toggles pulling the trailing edge, small stabilizers hanging toward the lines — flown on four risers with the steering lines to his hands.
- **The reserve** (`RESERVE_WING`, `RESERVE_PAINT`): seven single cells, white with red ends, its slider grey. Its spring pilot chute leaps out of the upper tray, the free bag comes off at line stretch and drifts up and away, and under the open reserve no bag rides the bridle. The main's streamer goes on falling beside it.
- **Cut away**, it crumples into a streamer within about 1.2 s and lies on the snow. **Caught in a crown** it is laid like a sheet over the crown's top 3.2 m, held out by the boughs, the lines running down to him; **over a rope** it drapes across it.
- **The body** (`skier-skydive.ts`): one `SkydiveShape` a stage read off `ChuteState` — poised in the door, the exit, the box, the track, head down, turns, the reach and the throw, the opening shock, hanging on the toggles, the front risers, the flare, the cut-away (the pads, then the punch), the reserve's pull (`SkydiveShape.reserve`: the left hand to the handle and out with it, the right over his head), snagged — laid from a square stand with his skis side by side and swinging with his boots.
- **The snowboarder's body** (`board-skydive.ts`, drawn by `board-model.ts`): the same shape on a rider on a board, the board strapped to both feet. His arms are the skier's own, but he jumps square to his front like a skier, the board across his feet with its nose on his lead side. In the door he stands sideways on the board along the sill, facing out, his hands on the door's posts, and turns a quarter into the slipstream as he leaves. In the box the board lies flat across over his raised soles. A board fights a track, so his knees stay half bent and it trails flatter than skis would. Under the canopy it hangs across under him, and the flare stands it flat and turns him side-on, the board along his line of flight for the snow. The legs are the skier's turned limbs fitted to the bindings, with each knee solved again so the boots never leave them.

**The cameras.** In freefall (`camera-skydive.ts`) a camera flyer: CHASE beside and over him, FAR further out, HIGH straight over him, ORBIT round him; HELMET his own eyes on the horizon ahead and down, TIPS looking back past his skis. Through the opening the lens pulls back to hold him and everything over him (in first person he looks up the lines at the canopy filling). On a tall screen the flyer stands further off. Under the canopy the paramotor's ladder (`camera-para.ts`'s `CHUTE_RIGS`) is framed off a point 1.4 m up his lines, TIPS and HELMET at a hanging jumper's eye. Every hand-over from the door's lens to the flyer and from the flyer to the canopy's is flown. On his own eyes his figure and his rig are hidden (`machines.figureShown`).

**The HUD**: the stage, an altimeter, the fall, the air speed under the canopy, the PULL cue, the stall, and the next press (the RESERVE call after a cut-away).

**The sound** (`audio/chute-voice.ts`, `chute-bed.ts`, `chute-bank.ts`): twelve layers — the freefall's roar, rumble, whistle and flap coloured by his body (belly, head down, track), the exit's buffet, the deployment's flogging, the canopy's rustle, the lines' hum by vortex shedding (about 1.5 kHz at 12 m/s), the luff of a deep brake, a cut-away piece flapping off, the brake line zipping through its ring and the strained tail while a toggle holds it — and one-shots for the exit, the throw, line stretch, the opening (scaled by its g), the release, the landing, a snag in a tree or on a lift and its creaks, and the reserve's pull (the handle, the pin and the spring's thunk); its opening reuses the main's line stretch and opening. The ride bed's own wind is silent while he falls, so nothing is heard twice.

## Determinism

Nothing in the skydive draws from `state.rng`. It is an option of a free ride (`CreateGameOptions.chute`, `GameState.chute`), so no race and no `make sim` digest can see it.

## Measuring it

- `make skydive-flight` (pure Node, seconds; the flat map, seed 38 for the jump and the lift): each row beside its band — `exit` (9.0 s), `exit-0.5s` (33.8°, 30–60) and `exit-1.5s` (50.4°, 45–75), `v50` / `v95`, `terminal` / `terminal-high` / `head-down`, `track`, `ff-time`, `open-stretch` / `open-full` / `open-lost` / `open-g`, `canopy-fwd` / `-sink` / `-glide`, `turn-full` / `turn-half`, `flare`, `land`, `cutaway`, `snag-tree`, `snag-lift`, the reserve's `reserve-stretch` / `-full` / `-lost` / `-g-now` / `-g` / `-fwd` / `-sink` / `-glide` / `-land`, `edge-track` / `edge-canopy` and `jump` (the bot's whole jump on seed 38). `ARGS=--json=FILE` before a change and `--compare=FILE` after; `SEED=` another map.
- `make skydive` (browser, its own bundle from `pwa/skydive-preview.html`): one contact sheet a group in `previews/skydive-<group>.png` — `gear`, `exit`, `freefall`, `deploy` (the opening frame by frame, off his side and on the chase lens), `shape` (the main from behind, the side, below, the front, over the top skin and in a turn), `canopy` (hands off, the toggles, the front risers, the flare and the landing), `cutaway`, `reserve` (the handle pulled, the opening frame by frame, the reserve from four sides beside the main, the main's streamer away, the flare and the let-go), `snag` (a crown — its `crown over` and `crown round` views — and a lift's rope), `lenses` (every rung in freefall, the opening and under the canopy), `night` and `stages` (every stage of the body on one sheet, close). `ARGS=--sheet=deploy,canopy` a few; `ARGS=--skis=lynx` on a snowboard (its pictures under `previews/skydive-lynx-*`, beside the skier's); `SEED=` / `REGION=` another map.
- `make build`, then `make screenshots ARGS="--surface chute-free,chute-open,chute"`.
- The suite: `tests/chute_test.ts`, `chute_look_test.ts`, `para_look_test.ts` (the paramotor's cloth unmoved), `para_test.ts`, `plane_test.ts`, `air_bounds_test.ts`, `plane_hud_test.ts` and `plane_audio_test.ts`.

## Known gaps

- **No automatic activation device.** A cut-away not followed by the press is still a fall to the snow; a device firing the reserve at a set height and speed would change the cut-away's own row and test, and waits.
- A snag on a moving chair is held where it caught; the carrier does not carry him on.
- The crown drape is a cone model; on a slim fir it reads as cloth hanging in the crown rather than spread over it.
- The stabilizers read as small white triangles from straight behind.
