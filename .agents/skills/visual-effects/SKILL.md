---
name: visual-effects
description: "Use when creating or tuning what the SKIS THROW OFF, what they LEAVE and what the skier FEELS — the spray (the sheet of snow off a skidded turn, the powder off the tips and the tails in a carve, the landing puff), the tracks' STAMPING (every station laid as a capsule into the trail map, the drawn depth, an edged ski's narrower deeper groove, the windrow, the break on a reset), and the vibration table under the player's thumbs (the chatter on hard snow, a landing, a trunk, a fall, the gate's tick). Covers the event → effect flow (the engine emits events and writes `SkierState`; the renderer turns them into transient visuals and pulses), the two surfaces (the three.js scene for the air, the trail map for the snow), the low-poly art direction the effects sit inside, and the loop that judges them — zoomed. Not the snow's own light (`snow-look`) and not the sky (`atmosphere`)."
---

# Visual effects — what the skis throw off

Transient FX are **presentation only**: the engine knows nothing of them. It
emits an EVENT or writes a `SkierState` reading, and the app turns that into
a short-lived drawn thing, a groove in the snow or a pulse in the hands. An
effect never changes what happens, only how it reads. The renderer reads
`GameState`; it never mutates state and never steps physics.

**Read this skill's lessons first** — `npx ogf-skill-lessons
visual-effects --list`. Load **`skill-reflection`** at both ends of the
session and **`write-code`** beside this one. For the snow the track is drawn
in, `snow-look`; for the sound the same moment makes, `sound-effects` — the
pulse and the sound read the same event, and where they disagree it is on
purpose.

## The two surfaces

Pick by what the effect is anchored to:

| Surface | Use for | Lives in |
| --- | --- | --- |
| **The three.js scene** | Anything IN THE AIR: the skid's sheet, the powder off the tips and tails, the landing puff — the heavy grains and clumps as one pool of sprites, and the fine SNOW CLOUD they raise as one instanced draw of volume-shaded puffs, both lit as the snow is and faded into the same haze | `pwa/src/game/spray.ts`, `snow-cloud.ts` |
| **The trail map** | Anything IN THE SNOW: every groove a ski's station presses, the windrow beside it — stamped as capsules into a world-space map the terrain shader lowers the snow by and shades | `pwa/src/game/trail-stamp.ts` decides each stamp (three-free), `trail-map.ts` keeps the maps (`snow-look`'s), `renderer.ts` stamps every skier every frame |

There is no third surface: a decal or a second mesh laid over the snow is lit
differently from the ground under it and reads as paint. The LENS's reaction
(the flown hand-over, a landing's kick) is the camera's — `camera.ts` under
`game-feel`.

## The modules

| Effect | Where |
| --- | --- |
| THE SKID'S SHEET: snow thrown sideways off two skis pivoted across the way, harder with the brake and the speed, a wall of it in a hockey stop, much more in powder than on the groomer | `spray.ts` |
| THE CARVE'S SPRAY: powder off the tips and the outside ski's tail in a carve, sized by the edge and the speed; a thin dust on the groomer | `spray.ts` |
| THE LANDING PUFF: a ring of powder from under a skier coming down, sized by how hard — read off the airborne → grounded TRANSITION rather than the `land` event, so a frame that ran two steps cannot swallow it and a rival's landing throws the same puff | `spray.ts` |
| THE SNOW CLOUD: the fine powder a skid, a powder turn, a landing and a wipeout raise — the rooster tail that stalls, swells, drifts and hangs. What each source throws out of which snow and how a puff flies, swells and thins is `snow-cloud-plan.ts` (three-free, `tests/snow_cloud_test.ts`); the flight, the sort, the whole cloud's self-shadow (a sun-first walk through a hashed grid), the shader (noise-carved body, wrap light, Henyey–Greenstein glow, glints, lamps, the soft meeting with the snow) and the chase lens's VEIL through the player's own tail are `snow-cloud.ts` | `snow-cloud-plan.ts`, `snow-cloud.ts` |
| THE KINDS OF SNOW: groomed, hard, soft, new, wet, ice — where each lies (the packed field, the crust, the ice, a snowing sky's new layer and `fresh`, a spring thaw) and what each does to the cloud, the spray's clumps, a groove's depth, WALLS and windrow, and a print (a crust carries a light foot) | `snowpack.ts` (three-free, `tests/snowpack_test.ts`) |
| THE TRACKS: a capsule per station from its last touch to this one; `drawnDepth` (the sink or the powder's furrow, whichever is deeper, cut narrower and deeper the more edge the ski stands on); `furrowProfile` for the windrow; `TRAIL.jump` breaks the line on a reset; a thrown skier's slide gouges a wider furrow of its own | `trail-stamp.ts`; `tests/world_render_test.ts` |
| WHAT IS FELT: the CHATTER on hard snow read off `skiCompression` every step, a landing, a trunk, a fall (read off the state — there is no event), a gate's light tick; what does NOT rumble and why | `pwa/src/game/rumble.ts` (DOM-free; `tests/rumble_test.ts`) |
| The motor: the browser's Vibration API or the store shell's tap, the player's switch | `pwa/src/game/haptics.ts` — the only `navigator.vibrate`; the phone's half is `platform-shells`' |

## The flow: reading → effect → draw

1. **The engine says what happened.** A moment is a `GameEvent` (`land`,
   `hit`, `checkpoint`…); a condition is a `SkierState` field the engine
   wrote (`tuck`, `brake`, `skid`, `edge`, `packed`, `skiAngle`, `airborne`,
   `contacts`, `skiCompression`). Event-driven for "at the moment of",
   state-driven for "while". The renderer never re-derives intent from
   physics deltas.
2. **Observe every STEP where a reading spikes, draw every frame.** A
   reading that spikes for two steps is a random sample of itself if read
   once per frame. `rumble.ts` reads the chatter per step and pays it out no
   oftener than its gap; the puff reads a transition, not a frame's state.
3. **The trail is stamped every frame, drawn or not.** `renderer.draw` with
   `present` off still stamps — which is how a fast-forward (the world lab,
   a pre-rolled screenshot) arrives with the tracks that run actually cut.
4. **The effect animates by its own progress** off the sim clock, so a
   pre-rolled still carries the same spray the player would see.

## The art direction — effects must sit inside it

The world is faceted low-poly under a sun and a sky light, every texture made
in code. Snow in the air is:

- **A cloud of fine powder, not droplets.** Soft sprites that grow a little
  as the cloud disperses, lit the sun's colour on the lit side and the sky's
  blue in shade, fading into the same haze as the face. A spray lit flat
  white reads as foam; one lit grey reads as smoke.
- **Motion carries it.** Speed reads through spawn rate, inherited velocity
  and lifetime; a sheet that streams off a hockey stop sells 90 km/h better
  than any texture. On the groomer there is little loose snow — a thin dust
  off the edges; in powder, a plume off every turn.
- **The tracks are the signature.** Two thin lines, close together and
  parallel through a schuss, opening and deepening on the outside ski
  through a carve. It is what a player sees behind every rival, and it
  persists for the whole run.

## Craft rules

- **Presentation-only, structurally.** No effect writes `GameState`, draws
  from `state.rng` or feeds anything back into `step()`. Renderer-side
  randomness uses its own source, deterministic per run.
- **Budget per frequency.** The spray and the stamping run continuously for
  four skiers: pre-allocated pools, no per-frame allocation, one geometry
  and one material per system, one draw for the whole spray.
- **A track never lies about the physics.** Drawn no shallower than the
  support the ski rides on; broken on a reset rather than swept across the
  map.
- **A pulse is sized against the RUN, not a held key.** Size a rumble
  threshold from the bot skiing the piste at pace (`botInput`), never from a
  probe holding a tuck on the start line; and a phone has ONE motor and no
  mixer, so every buzz spent on news is a buzz taken off the next landing.
- **Events for sound too.** If the moment would also want audio, the EVENT
  carries what audio needs, designed once and read by `audio/route.ts` and
  `rumble.ts` alike.
- **Reduced motion.** Anything screen-filling or flashing needs a
  `prefers-reduced-motion` fallback that keeps the information.

## The iterate loop — LOOK at it, ZOOMED

1. **`make cloud`** is the snow cloud's own lab: one run per row across
   the seed's open bowl — a kind of snow (`--snow=`) × a light
   (`--light=front,back,side,low,overcast,snowing,night`) × a held speed —
   photographed from several angles at one moment (`--views=chase,side,
   front,high,trail,under,furrow`), or one angle at several moments
   (`--cols=times`). The LIGHT is the sun turned to the run, so BACK is
   always the chase lens looking into the sun through the cloud. Run it
   before and after, both sheets in the PR.
2. **`make world SEED=38`** reaches the moments in one skied run:
   `powder` and `powder-high` for the powder turn's plume, `jump` and
   `landing` for the puff, `furrow` and `lookback` for the tracks, `track`
   for the thin dust on the groomer. It builds its own bundle; no
   `make build`.
3. **Zoom** — crop the skier at full resolution (`make cloud
   ARGS="--width=800 --height=450"`); at a quarter size you are judging a
   smudge.
4. **Bench the numbers** when the question is WHEN rather than HOW:
   `make ride SCENARIO=kicker` says when the skier leaves and lands, so the
   puff's frame is known before it is looked for; `SCENARIO=hockey-stop`
   when the skid's sheet starts and stops.
5. **Ski it** for anything that moves — a spray's timing and a pulse show in
   no still: `npm run dev`, or `make screenshots` at two offsets
   (`ARGS="--t 12"`, `--t 13`).
6. Judge, refine the worst beat, re-shoot. `make profile` before and after.

## What the cloud taught (the snow cloud's own rules)

- **Shade the CLOUD, not the puff.** A puff lit and self-shadowed on its
  own gets a bright rim on its sun side, and a stream of them reads as a
  string of rings. The shadow is the whole cloud's (the sun-first walk),
  the glow against the sun is the whole cloud's thinness, and a puff's own
  relief is a light touch over that.
- **Snow is never grey.** Ice scatters nearly all it stops: a shadow deep
  in the plume is lit again by the cloud round it (the multiple-scatter
  octave). Single scattering alone turns a snow cloud into dust.
- **The chase lens rides in its own tail.** Without the veil the player's
  skier disappears into his own cloud at any speed in powder. A planted
  lens (a replay's broadcast, a lab view) sees the cloud whole.
- **A faint puff is still fill.** The biggest puffs on the screen are the
  near and veiled ones; cull them in the vertex shader, not by alpha.
- **Fade into the snow on the ball's front surface**, not the card's
  plane, or a lens looking down cuts every puff into a crescent.

## Ship checklist

- [ ] Presentation-only — no simulation state touched, no `state.rng` draws.
- [ ] Right surface: the scene for the air, the trail map for the snow, the
      camera module for the lens.
- [ ] Sits inside the art direction: lit as the snow is, fading into the
      haze, no foreign fidelity.
- [ ] Pooled allocations; observed per step where the reading spikes.
- [ ] You LOOKED at it zoomed, at two moments.
- [ ] `make cloud` before and after for anything in the air, both sheets
      in the PR.
- [ ] `npx vitest run tests/world_render_test.ts tests/rumble_test.ts
      tests/snow_cloud_test.ts tests/snowpack_test.ts`;
      `make profile` both tables in the PR.
- [ ] A `.changes/unreleased/` fragment — effects are player-visible.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment: a
beat that only read zoomed, a reading that turned out to be sampled rather
than seen, a pulse sized off the wrong run.
