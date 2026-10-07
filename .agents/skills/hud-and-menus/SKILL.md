---
name: hud-and-menus
description: "Use when changing WHAT THE PLAYER READS AND PRESSES DURING A RUN — a HUD readout (the run clock, the position, the gates taken of the total, the split, the air clock, the lights and GO, the missed-gate arrow, the EDGE bar over the speed with the skid's word on it, the news column, the finish plate), the minimap in the top right (pressed, the pause) and the presses under it (reset, camera), the touch controls (the EDGE THUMB on the lower left, the TUCK LEVER on the lower right — a full tuck on touch, stood up UP, the skid further UP) and the keyboard layout. Owns the DOM-free-payload split every one of these is built on (`snapshot.ts`, `input-model.ts`, `run-news.ts`, and the framework's `input/thumb-guard` and `input/hud-press`), the thumb-guard discipline, and where each surface lives. The CARDS around a run — the attract screen, the front door, the loading card, the pause card, the settings — are `menu-system`. Load `ui-review` beside either for the screenshot sweep."
---

# The HUD and the controls: what the player reads and presses

Everything on screen during a RUN that is not the world. Two surfaces, one
rule: **the decision is DOM-free, the DOM only renders it**. A payload module
works out what to show — the numbers, the words, what a drag MEANS — and a
`.tsx` component draws it. That split is why the root suite can test the
lever's gesture and the news column without a browser
(`tests/input_model_test.ts`, `tests/hud_test.ts`), and it is the first thing
to preserve in any change here.

**Read this skill's lessons first** — `npx ogf-skill-lessons
hud-and-menus --list`. Load **`skill-reflection`** at both ends,
**`write-code`** beside this one, and **`ui-review`** for the fit-and-finish
sweep. For what a readout MEANS (the air clock as a moment), `game-feel`.

**The CARDS are next door** (`menu-system`): the attract card, the front door,
the loading card, the pause card and what the game remembers. `input.ts` sits
on the seam — the keys that ski are here, the keys that walk a card are
there.

**The shutter is built** (`shot-request.ts`, `screenshots.ts`, the
framework's `shots/shot-hud`; `menu-system` owns the roll and the gallery):
P and H are two of `InputAction`'s presses, and the HUD's `bare` form
(`data-bare`) keeps the thumbs and the corner presses with the readouts down
— which is also what tells `readHudLayer` to leave the chrome out of a
picture. A new HUD element is in every picture from the day it lands; an
ANIMATED one is stilled at its computed value by `shots/shot-hud`, so check a
picture taken mid-animation (`make screenshots ARGS="--surface
gallery-roll"`). The REPLAY's bar is `hud-replay.tsx` (`menu-system` owns
the replay). OPTIONS and its KEYS page are built and are `menu-system`'s;
what they change HERE is the layout the manager rides (`setBindings`) and
how the thumbs read (`TouchFeel`, the lever's side).

## The HUD

| Surface | Where |
| --- | --- |
| The LAYOUT: top left the run clock, POSITION, GATES taken of the total, the SPLIT under them while fresh; top right the minimap (pressed, the pause) and the two presses under it; top centre the AIR CLOCK while off the snow; dead centre the LIGHTS and GO; upper centre a MISSED GATE warning with an arrow back at it and the metres to go, or BOGGED with how to pole out; bottom left the EDGE bar over the speed; bottom right the news column; over the tips the combo line on a tricks run | `pwa/src/game/hud.tsx` + `pwa/src/styles.css` |
| What the HUD READS, ~12×/s | `pwa/src/game/snapshot.ts` — DOM-free; nothing in it decides, it reads the engine's `speed`, the edge angle against the pair's `edgeMax`, the skid, `progress`, `racePlace`, `bearingToNext` |
| The EDGE BAR: how far over the skis are, signed, with the skid's word over it while the brake is on (there is no engine, so no revs to read) | `pwa/src/game/hud-dial.tsx` — handed a share, paints it |
| The presses: RESET and CAMERA — marks, not words, on every device; PAUSE is the minimap's own press, and a pause disc heads the row only with the readouts off | `pwa/src/game/hud-actions.tsx`; the action each one runs is `run-actions.ts`'s (`menu-system`) |
| THE MINIMAP: a round plate under the presses, the map turned HEADING-UP about the skier, the window opening with the speedo, the piste, every gate (the owed one red, a missed one the warning red, a chevron on the rim once it is off the plate), the finish, and the field in its slot colours | `pwa/src/game/minimap-view.ts` (DOM-free: the pose, the continuous turn, the zoom, every mark — `tests/minimap_test.ts`), `minimap-bake.ts` (the ground painted ONCE per map, DOM-free, run in `minimap-worker.ts` and started as the map is loaded — `prepareMinimap`), `minimap.tsx` (the world painted on a CANVAS under the pose, glided between snapshots on the animation frame — never world-sized SVG under a CSS transform, which a browser may drop; the skier's arrow and the rim's chevron in an SVG over it); colours from `skier-colours.ts` |
| What an event SAYS in the news column | `pwa/src/game/run-news.ts` (pure: an event and the state in, a line out — a wipeout names how he fell, a bog says POLE OUT, a hurt edge is news); words from `strings.ts` |
| The FINISH PLATE: the place and the time, then the whole field's table, live, while the rest ski home; the campaign's lines on a rung; WATCH REPLAY | `pwa/src/game/hud-result.tsx` |
| The DAMAGE instrument on a run with damage on: the two edges and the legs | `pwa/src/game/hud-damage.tsx` |
| THE BODY at the left edge — an anatomy plate from the front, MADE FROM A 3D BODY (`body-model.ts`, GENERATED by `make hud-body ARGS=--write` off one man's CT: the skin's silhouette the outline and its parts cut at the seams read off the bones, the trunk cut along the spine into a front and a back view — the back off by default, `BodyPanel side="back"` — every bone and every ORGAN lit and shaded, in the order its depth says — the organs inside the bones, the skull's cap lifted off the brain; `body-figure.ts`), each part's flesh painted by its worst injury that is not a fracture or an organ's, every organ in its own soft colour sound and painted by its worst injury hurt (a hurt one mostly hidden dashed in over what hides it), every bone whole, cracked or broken — the bone's own geometry fractured by `fractureOf` (a fissure cut in; a break cut through, its fragment displaced and angulated), never a mark drawn over it; the word off the injury severity score and only what the bones cannot show in plain words; the run's hardest blow — and THE G METER over the skier the moment a blow lands, the number alone, shaking by how hard — both off the DOM-free `body-tile.ts`; what a blow, an injury and a fracture ARE is `crash`'s (`body.ts`). Judge it with `make damage` (the panel at the game's pixels, the reference viewports, the figure enlarged) | `pwa/src/game/hud-body.tsx`, `hud-gforce.tsx`, `body-tile.ts`, `body-figure.ts`, `body-frame.ts`, `body-model.ts`, `strings-body.ts`, `pwa/src/body.css`; `scripts/hud-body.mjs` |
| The COMBO over the tips on a tricks run: the elements, the multiplier, the score, the buzzer | `pwa/src/game/hud-combo.tsx` over `trick-tile.ts` (DOM-free); the words `TRICK_WORDS` / `comboLine` |
| Every word | `pwa/src/game/strings.ts` (§39.1) — templates, never concatenations at the call site |
| What the speedo READS | `SkierState.speed` — `|v|`, vertical included, written once by the engine; never re-derived here |
| `__SH_READY__` | set in `App.tsx` once a run's frame is drawn — a HUD change that delays it is a screenshot lab that times out |

## The controls

| Surface | Where |
| --- | --- |
| What a key or a touch MEANS, as maths | `pwa/src/game/input-model.ts` — DOM-free: the key ramps, the lever's drag → tuck/brake, the thumb's travel → steer (the edge)/lean, and the ONE sign flip between screen and engine; `tests/input_model_test.ts` |
| WHICH KEY DOES WHAT | `pwa/src/game/settings-input.ts` — rebound on OPTIONS ▸ KEYS and handed to the manager through `setBindings`; as it SHIPS, `DEFAULT_KEYS` (W tuck, S/Space brake, A D/← → edge, ↓/E/Shift lean back, ↑/Q/Z lean forward — and W/S pressed in the air lean too, `input-model.ts`'s `airLean` — F/X the grab, R reset, Enter the MACHINE key — on and off the free ride's snowmobile and helicopter, `SkierInput.machine`, like R an edge the ENGINE is handed — B restart, C camera, H HUD, P the shutter, Escape pause) and why each key is where it is; `HeldAction` is `keyof KeysHeld`, so a new held key does not compile until it is named |
| Listening to the DOM | `pwa/src/game/input.ts` — keys and the thumb zones into one `SkierInput`, sampled once per STEP; the reset edge banked between steps |
| Touch: the EDGE THUMB | `pwa/src/game/hud-touch.tsx`, lower LEFT — sideways travel tips the skis onto an edge, vertical travel leans |
| Touch: the TUCK LEVER | `hud-touch.tsx`, lower RIGHT — anchored in a FULL TUCK where the thumb lands; slid UP stands him up, further UP is the brake (the skid) |
| HOW THE THUMBS READ (OPTIONS ▸ CONTROLS): the lever's side, the travel, the inverted lean | `TouchFeel` in `input-model.ts` — every thumb function takes it, `barReachPx` draws the ring at the travel it asks for; the side is `Settings.touch.lever`, and the edge thumb takes the other. The keys never pass through it |
| A zone's grip on a finger, and every way it has to END | the framework's `input/thumb-guard` (DOM-free, injected window), used by `hud-touch.tsx` |
| A BUTTON pressed while a zone is held | the framework's `input/hud-press` — `click` comes only from the PRIMARY pointer, and a skiing thumb has that finger spoken for, so every press over a run fires from `pointerup` |
| The `reset` edge | `SkierInput.reset` is true for one step; `input-model.ts` is where a held key becomes one |

## The traps

- **A thumb on the lever is a full tuck, and that is a decision.** A run is
  skied tucked nearly all the time, and a lever that tucked only as it was
  dragged made every start and every exit from a bend a hand-over. The
  anchor is the FULL TUCK; the whole throw runs UP from it — standing up to
  the upright mark, then the skid past a dead band. Keep the anchor at the
  touch point, never a fixed zero.
- **Analogue means analogue.** The lever's output goes straight into
  `tuck`; a key is RAMPED so a press does not read as a lever slammed into
  a tuck. Do not quantise either.
- **Lean has two thumbs.** The edge thumb's vertical travel on touch, E/Q on
  keys; in the air it is the pitch control. A change that moves the thumb's
  zone changes how far a thumb can lean — check it still reaches ±1.
- **The HUD reads `GameState` and writes nothing.** No HUD-side timer, no
  HUD-side split, no "airborne" guessed from `y`. A readout that needs a
  number the engine does not expose is an engine field (`engine-system`),
  never a HUD formula — and a readout that must OUTLIVE its moment compares an
  engine-published time against `state.t`, never a `setTimeout` (which does
  not pause with the run).
- **A PRESS OVER A RUN IS NEVER WIRED ON `onClick` ALONE.** A non-primary
  finger gets `pointerdown`/`pointerup` and no click at all, so an `onClick`
  button is dead to exactly the skier who needs it. The framework's
  `input/hud-press` is the answer; a new press joins it.
- **The thumb zones draw nothing until a thumb is down.** A picture shows a
  button in clear sky whether or not a zone lies over it; only
  `document.elementFromPoint` down each button's centreline answers it.
- **Every word is a key in `strings.ts`.** A literal in a component is a line
  that cannot be fixed without a code review and a second language that is a
  rewrite.
- **A menu is not a saving.** The front door's backdrop is a live run skied
  by the bot (`menu-system`); a HUD change reaching into `App.tsx`'s loop can
  break that from this side.

## The loop

```sh
make build
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=grid    # the lights
make screenshots SCENE=race                                            # racing, the field strung out
make screenshots SCENE=late                                            # well down the mountain
npx vitest run tests/hud_test.ts tests/input_model_test.ts             # the payloads, headless
```

**`make screenshots` CANNOT SHOW THE TOUCH CONTROLS.** The edge thumb and the
lever are drawn only while a pointer is down, and the lab presses nothing. A
change to either is looked at with a scratch probe over the built site
(`lab-tooling`): `serveDir("pwa/dist")`, a context with `hasTouch: true` at
390×844, a `pointerdown` on the zone and a `pointermove` to each end of the
travel, shooting BETWEEN them and only then `pointerup` — a tap is down and
up, and the overlay is gone before the shutter opens.

Then `ui-review`'s audit at the reference viewports (1280×720, 390×844 and
844×390). The failure mode here is always overlap, clipping, or a readout
under a thumb that already has a job: the lever thumb owns the lower right,
the edge thumb the lower left.

## What the change obliges elsewhere

- A key or a gesture → `docs/getting-started.md` and the README's Controls;
  `tests/input_model_test.ts`. A key that means something to a CARD goes past
  `menu-system` too, and a key the desktop menu bar presses past
  `platform-shells`.
- A readout → a scene that photographs it (`SCENES` in
  `scripts/screenshot.mjs`), `docs/getting-started.md`.
- Anything the player sees → a `.changes/unreleased/` fragment.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. A settled rule about
the thumbs — where a zone may reach, what a drag may mean — belongs in the
traps above once it has held twice.
