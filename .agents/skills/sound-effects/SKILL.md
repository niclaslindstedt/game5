---
name: sound-effects
description: "Use when adding or tuning a SOUND — the WIND (the rush in the helmet that rises with speed and closes in with the tuck), the EDGES and the snow (the hiss on the groomer, the chatter on hard crust and ice, the scrape under a skid, the powder's whoosh, the carve — the continuous BEDS), the POLES (their clicks and the push at a crawl), or a one-shot: a landing soft or hard, a trunk, a rival shouldered, a gate taken (and a panel whacked when it is taken close), a miss, a reset, the start wand's beeps, GO, the finish horn and the arena's cowbells, the crash. There is no engine: the drive is gravity. Every sound is synthesized at runtime from authored parameters under `pwa/src/game/audio/`; the game ships no audio file. Owns the game's use of the vocabulary and the instrument (the framework's `audio/voice` and `audio/synth`), the bank, the route, the beds and the listener, the mixing budget, and the audition page — `make audition`, and `--meter` for the levels — which is the only honest way to judge any of it. NOT for music: the game has none, by design — its sound is its effects alone."
---

# Designing sound effects

The game ships **no audio files**. Every sound is synthesized at runtime from
a handful of numbers, authored as TypeScript data in `pwa/src/game/audio/`,
which keeps the app tiny and offline and makes the sound design as diffable
as a pair's spec. `docs/audio.md` is the reference; this is the loop.

**The register is a modern arcade racer in the snow — not a chip, and not a
sample library.** A skier at speed is WIND first — the roar in the helmet
that is most of what he hears, closing in as he tucks — and under it the
skis: a hiss on the groomer, a chatter on the hard stuff, a scrape when they
are thrown across the way, a whoosh in the powder; at a crawl the click of a
pole plant and the push after it; and SNOW SWALLOWS TRANSIENTS. Four things
in the instrument exist to reach that:

| Reach for | When |
| --- | --- |
| `color: "brown" \| "pink"` on a noise | ALWAYS decide this before the filter. Brown is mass and depth (a landing's weight, the powder's whoosh), pink is hiss and wind and every puff of snow, white is grit — the edge's chatter on ice, the crack of wood. |
| `filter.to` — a moving cutoff | Any sound that is a GESTURE rather than a hit: a puff of powder opening, the whoosh past a gate, the wind closing in over a tuck. |
| `drive` — the waveshaper | Anything with a body in it: the scrape of a skid, the horn, a cowbell's clank. A SOFT curve at every setting — never a clip, which aliases and which a Bluetooth codec turns into a swirl. |
| `attackMs` + `holdMs` on a NOISE | Every landing in snow. Powder SWELLS: a brown thump that opens over a few milliseconds with a pink puff over it. Never on the things that are not snow — a trunk cracking, a gate panel whacked, two skiers meeting, the wand's beeps. A bed is a LAYER and has no envelope at all. |

**Read this skill's lessons first** —
`npx ogf-skill-lessons sound-effects --list`. Load
**`skill-reflection`** at both ends, **`write-code`** beside this one, and
**`game-feel`** whenever the acceptance test is "does it sound like skiing".

## Files

| File | Role |
| --- | --- |
| framework `audio/voice` | **The vocabulary.** Every parameter a sound may be written in, the `Synth` interface, the `LayerSpec` / `LayerTarget` / `Layer` a bed is made of, and the arithmetic worth testing without a browser. DOM-free on purpose. |
| framework `audio/synth` | The instrument: `tone()` and `noise()` for one-shots, `layer()` for the beds, the echo bus, the master limiter, the context lifecycle (unlock, iOS interruption, zombie-context recovery). The ONLY module that touches WebAudio. |
| `pwa/src/game/audio/bank.ts` | **THE RUN'S SOUND DESIGN** (`RUN_BANK`): every discrete sound as data — a description and a list of voices. The landings, the trunk, the shoulder, the gate and the panel, the miss, the reset, the wand's count and GO, the finish horn and the cowbells, the crash. |
| `pwa/src/game/audio/contact-bank.ts` | **WHAT A SKIER MEETS AND COMES DOWN INTO** (`CONTACT_BANK`, spread into `RUN_BANK`): a landing in powder and on ice, a trunk brushed, a dead snag, the four wipeouts (tree, nose, roll, catch) — every fall ending on the skis' own clatter. |
| `pwa/src/game/audio/route.ts` | **WHICH sound an event makes** and how big (`PlayShape`) — pure functions from `GameEvent` and its `Contact` (the snow under the skis, the trunk met — `trunkAt`) (`soundForEvent`, `soundsForStep`, `heardFrom`). |
| `pwa/src/game/audio/wind-voice.ts` | THE WIND as layers that never stop: the rush, its body, its whistle — `windTargets` is a pure function of the state. The level and the cutoff are arithmetic off `SkierState.speed` and the crouch (`tuck` through its lag): a tuck closes the helmet's opening and the wind darkens as it gets louder; in the air the wind is all there is. |
| `pwa/src/game/audio/snow-voice.ts` | THE SKIS ON THE SNOW as eight layers (the hiss, the powder, the edge, the chatter, the skid, the crust's crunch, the slush, the ice's scrape) — this game's answer to the sibling snowmobile game's engine voice: `snowTargets`, a pure function of the SIX KINDS OF SNOW under the skis (`SnowUnder`, `snowpack.ts`'s mix read by the bed at the boots), the edge, the skid and the PAIR (`skiVoiceOf`: flex, waist, length). |
| `pwa/src/game/audio/listener.ts` | **WHERE THE EAR IS.** `LISTENERS`, one row per camera rung: what each seat does to the wind, the edges, the poles and the one-shots. The helmet hears the wind loudest; the far boom hears the snow. The beds and the router both read it. |
| `pwa/src/game/audio/ride-bed.ts` | The scheduler: reads the player's `SkierState` once a frame and turns it into every layer's target, through the seat's listener row; raises the poles' clicks as a CUE at a crawl with the tuck held. The field has no bed of its own yet. |
| `pwa/src/game/audio/bird-voice.ts`, `bird-bank.ts`, `bird-bed.ts` | **THE MOUNTAIN'S VOICES.** Who cries and how often (`BIRD_CALLS`, plan-free), the cries themselves (`BIRD_BANK`, spread into `RUN_BANK`), and the scheduler that raises them off the birds' own plan (`birdPlanFor`) — a CUE drawn off each flock's scatter (`criesIn`), never an event and never `state.rng`. The ptarmigan's whirr is the one cry a skier causes (`flushAt`). `tests/birds_test.ts` holds every call to a bank id. |
| framework `audio/rack` | The plumbing every bed shares: build a layer, rebuild one whose context died, steer it on its glide. |
| framework `audio/play`, `audio/types` | Firing one def through a shape; what a def and a shape ARE. |
| `pwa/src/game/audio/bus.ts` | One synth, the volume-scaled view the SOUND switch moves, and the unlock. |
| `pwa/src/game/audio/index.ts` | The front door (`createRunAudio`): events in, the beds fed per frame, `silence()`. `App.tsx` is its one caller. |
| `pwa/src/game/settings.ts` | The switch the player keeps (`sound`), and the three faders. |
| `scripts/audition.mjs` | **THE REVIEW SURFACE** (`make audition`) and the meter (`ARGS=--meter`, `--seat`). |
| `tests/audio_test.ts` | The guards: every event answered, the mix ceiling, the beds' shapes, the silence said, every cutoff under the headset's Nyquist — against a recording synth, no DOM. |

## An event, a cue, or a bed — the first decision

| It is… | When | Where it goes |
| --- | --- | --- |
| **An EVENT sound** | The simulation reported a moment: `step()` pushed a `GameEvent` | A def in `bank.ts` + a rung in `route.ts` |
| **A CUE** | The APP can work it out from the state and the engine never said so (a pole plant, a panel brushed) | Raised by the bed's own reading of the state (`ride-bed.ts`) |
| **A BED** | It has no beginning and no end: the wind, the hiss, the chatter, the powder | A LAYER in `wind-voice.ts` / `snow-voice.ts`, steered per frame |

**Never add a `GameEvent` for presentation**: if the app can work it out from
the state it already has, it must. **A field left out of a route rung answers
every value of it** — add a `case` only when the event picks a DIFFERENT
sound (a landing the legs took and one they could not); a different SIZE is
a `PlayShape` on the sound already there.

## A BED is a LAYER; an EVENT is a one-shot

A one-shot is attack-then-decay; a `holdMs` turns it into a swell. A bed is
never written out of one-shots: it is a `Layer` built ONCE — an oscillator or
a looping window onto the noise pool, a filter, a saturation curve, a gain —
and STEERED every frame with a `LayerTarget` (level, pitch, cutoff, grit, pan)
and a glide. The rules:

1. **What a layer IS goes in the `LayerSpec`; what MOVES goes in the target.**
   A different colour of rush is a second layer, not a colour switch.
2. **A bed is a PURE FUNCTION from the state to a table of targets**
   (`windTargets`, `snowTargets`) — testable, driveable from the audition
   page's sliders. Add a layer by adding a key to the spec table, the glide
   table and the target function; the tests read targets by NAME.
3. **The glide is the character of the change**, in seconds.
4. **A driven layer has ONE curve and moves the gain in front of it**
   (`grit`); swapping a curve under a running signal is a step.
5. **Nothing is booked ahead.** A late frame leaves every layer holding its
   last target; a bed fed on a cadence stutters when starved, which a player
   reports as CRACKLE.
6. **…so SILENCE HAS TO BE SAID.** Every frame that is not hearing the run —
   the pause card, a hidden tab, a held screenshot — calls
   `RunAudio.silence()`. A path that skips `frame()` without hushing is the
   wind blowing on under the pause card.
7. **A silent layer costs nothing to keep.** Level 0, left built.

## What skiing taught the vocabulary

- **There is no engine, so the WIND is the speedometer.** Nothing else rises
  with pace the whole way from the start gate to the finish; the tuck is
  heard as the wind closing in and darkening, and standing up out of it as
  the roar opening again. A layer set that gave the wind one level would
  leave the player with no sense of speed at all.
- **The snow is SIX KINDS, heard as a mix** — the same `snowpack.ts` mix
  the spray, the cloud and the grooves read, so what is seen and what is
  heard never disagree: skiing off the piste is heard as the hiss giving
  way to the whoosh before anything else changes; a crest scoured to crust
  CRUNCHES; spring snow SLUSHES, loudest slow; ice SCRAPES under the steel
  and takes the carve's clean tear away. The powder's whoosh is loudest
  SLOW, where the skis are sunk and pushing snow, and thins as they float
  up — and NEW snow swallows a third of it. Each kind's own layer is silent
  on every other kind (the test holds it).
- **The pair is heard off its spec, never off its name** (`skiVoiceOf`):
  stiffness pitches the chatter up and holds it down, the waist deepens the
  hush, the length lowers the hiss. A new pair needs no audio row.
- **A contact is what was met AND what it came down into.** The event says a
  trunk was met at a speed; the route's `Contact` (the trunk off the map by
  where, the snow the bed last read) picks the sound — a brush, a crack, a
  dead snag — and shapes it; a fall in deep powder is swallowed, on ice it
  is bare. Never a new `GameEvent` field for it: the app can work it out.
- **The edge tells the ear what the snow is.** A carve on the groomer is a
  clean hiss; on the crust and the ice it CHATTERS (white grit in a band
  that climbs with speed); a skid is a SCRAPE, a driven noise that comes up
  with the brake and goes with it. The bot and the player both read the snow
  by ear before the skis let go.
- **The air is the wind alone.** Off a kicker the snow layers go and only
  the wind keeps going — the physics does that; the bed only hears it.
  Never fake it with a take-off one-shot.
- **The poles are a crawl's sound.** Under `poles.speed` with the tuck held a
  plant is a click and a push; at speed they are silent under the arms. A
  cue off `plantPulse`, never an event.
- **The pitches are arithmetic; the levels are taste.** Nothing about the
  wind's cutoff or the chatter's band is chosen by ear.

## Mixing rules, enforced by test

- A hard landing, a trunk and the crash are the ceiling; nothing in the bank
  passes the test's cap. Ordinary contacts sit under them; the course's
  chimes (a gate, the finish) are quieter than the snow — heard OVER a run,
  never instead of one. The cowbells and the horn belong to the arena and
  come up only near the finish (`heardFrom`).
- **A bed's level is heard THROUGH THE LISTENER.** Every target is multiplied
  by the seat's row in `listener.ts`. Retune at the CHASE seat, then check it
  from the helmet and the high boom. A camera-dependent sound is a COLUMN in
  the listener table, never a branch in a bed or a def.
- **Under a card the whole bed is ducked** (`CARD_DUCK` in `App.tsx`), and the
  run's EVENTS make no noise at all without the player's hands on the skis
  (`soundsLive` in `shell.ts`): a gate the bot takes under the front door is
  not news.
- Keep every sound's `description` current; a def without one fails the test.

## Iteration cycle — a SOUND

1. Edit the def in `bank.ts` (or the bed's target function). A new sound needs
   a rung in `route.ts` or a cue that raises it, or it can never play.
2. `make audition` and **listen in a browser**, next to the sounds it will be
   heard beside.
3. **A session that cannot listen METERS**:
   `CHROMIUM_PATH=/opt/pw-browsers/chromium make audition ARGS=--meter` drives
   the page headlessly and prints a level (dBFS) for every bed preset and every
   sound in the bank (`--seat` picks the camera it listens from). Read it as a
   SHAPE: standing under cruising under a full tuck; the air under the tuck
   with the snow gone; the landings at the top of the bank and the chimes at
   the bottom; nothing within a few dB of the limiter. Keep the table before
   and after, in the PR. A mix that meters wrong IS wrong.
4. `npx vitest run tests/audio_test.ts`.
5. For a BED, move the sliders through the whole range; the faults are at the
   ends — a hiss at a standstill, a wind that arrives all at once.
6. **Then hear it in the game** (`npm run dev`) — a landing lands over the
   wind and a hiss.

**The audition page is part of the deliverable.** A PR that changes what the
game sounds like and gives its reviewer no way to hear it is unreviewable:
say `make audition` in the PR body and paste the meter's table.

## When a sound is allowed to START

A browser makes no sound before the player has touched something, and a
context built outside a real gesture is one iOS Safari will never resume.
`unlockAudio()` hangs off document-wide `pointerdown` and `keydown` in the
capture phase (`App.tsx`) — never off a cue a hover could raise.

## What the change obliges elsewhere

- `make audition` before and after, the meter's table in the PR;
  `npx vitest run tests/audio_test.ts`.
- `docs/audio.md`: a new layer, a new column in the listener, a new cue or a
  new def is a line there.
- A `.changes/unreleased/` fragment — a sound is heard for the whole run.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. The lessons here are
a **palette of parameter recipes that worked** — read them back before
designing a sound, and add to them after.
