// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE'S SOUND DESIGN — every discrete sound the skier and the piste
// make, as data: a description and a list of voices.
//
// SNOW SWALLOWS TRANSIENTS. That is the rule every landing here is written
// to: a skier coming down in powder is a brown thump that opens over a few
// milliseconds with a pink puff of snow thrown up over it, and the only
// sharp edges in this bank belong to the things that are not snow — a trunk
// cracking, a pole's tip on the hardpack, a gate's panel slapped, two
// skiers shouldering, the finish's horn and its cowbells.
//
// Every voice is the synth's own vocabulary (the framework's `audio/voice`); the id is what
// `route.ts` names, and the description is what the next retune is checked
// against — a def without one fails the test.
//
// COLOUR BEFORE FILTER, always: brown is mass and distance, pink is snow in
// the air and the wind, white is grit and the crack of wood. And `drive` on
// anything with a body behind it — a body thumping down, a trunk — because a
// clean sine is a bell.

import { AFTERSKI_BANK } from "./afterski-bank.ts";
import { BIRD_BANK } from "./bird-bank.ts";
import { CONTACT_BANK } from "./contact-bank.ts";
import { GORE_BANK } from "./gore-bank.ts";
import { HELI_BANK } from "./heli-bank.ts";
import { SLED_BANK } from "./sled-bank.ts";
import { LIFT_BANK } from "./lift-voice.ts";
import { TUNNEL_BANK } from "./tunnel-voice.ts";
import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const RUN_BANK: SoundBank = {
  land_soft: {
    description:
      "The skier coming back onto the snow: the legs taking it — a " +
      "short low sine thump with a little drive, bending down — under a " +
      "brown settle and a pink puff of snow thrown up by the skis, both " +
      "opening over a few milliseconds rather than cracking, because snow " +
      "has no transient.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 90,
        to: 55,
        durationMs: 150,
        volume: 0.05,
        drive: 0.3,
        attackMs: 4,
      },
      {
        call: "noise",
        durationMs: 220,
        volume: 0.04,
        color: "brown",
        attackMs: 6,
        filter: { type: "lowpass", frequency: 380, to: 180 },
      },
      {
        call: "noise",
        durationMs: 320,
        volume: 0.026,
        color: "pink",
        attackMs: 14,
        delayMs: 20,
        filter: { type: "bandpass", frequency: 1200, to: 3200, q: 0.7 },
      },
    ],
  },

  land_hard: {
    description:
      "A landing the legs could not take: the knees folded to the stops " +
      "— a hard driven thump with a white knock on top of it, the one hard " +
      "edge a landing is allowed — then the same brown mass and a bigger " +
      "sheet of snow, longer, because the whole skier has gone into it.",
    voices: [
      {
        call: "noise",
        durationMs: 30,
        volume: 0.05,
        filter: { type: "bandpass", frequency: 700, q: 1.6 },
      },
      {
        call: "tone",
        type: "sine",
        from: 78,
        to: 42,
        durationMs: 240,
        volume: 0.07,
        drive: 0.6,
        attackMs: 2,
      },
      {
        call: "noise",
        durationMs: 320,
        volume: 0.05,
        color: "brown",
        attackMs: 5,
        filter: { type: "lowpass", frequency: 320, to: 140 },
      },
      {
        call: "noise",
        durationMs: 480,
        volume: 0.034,
        color: "pink",
        attackMs: 18,
        delayMs: 25,
        holdMs: 60,
        filter: { type: "bandpass", frequency: 900, to: 2800, q: 0.7 },
      },
    ],
  },

  hit_tree: {
    description:
      "A skier into a trunk. The CRACK of wood — broadband white gone inside " +
      "a fiftieth of a second — over the body's own hollow thump, a " +
      "driven sine barely moving off its note. Then the TREE ANSWERS: the " +
      "load on its branches shaken loose, a pink sheet of snow falling " +
      "through a lowpass a beat later and thinning out. The forest edge " +
      "echoes the crack and not the fall.",
    voices: [
      {
        call: "noise",
        durationMs: 18,
        volume: 0.06,
        filter: { type: "highpass", frequency: 300 },
        echo: 0.22,
      },
      {
        call: "tone",
        type: "sine",
        from: 130,
        to: 110,
        durationMs: 220,
        volume: 0.055,
        drive: 0.55,
        filter: { type: "lowpass", frequency: 800 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 240,
        to: 190,
        durationMs: 120,
        volume: 0.02,
        drive: 0.4,
        delayMs: 6,
        filter: { type: "bandpass", frequency: 600, q: 2 },
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.03,
        color: "pink",
        attackMs: 60,
        delayMs: 90,
        holdMs: 120,
        filter: { type: "lowpass", frequency: 2400, to: 700 },
      },
    ],
  },

  bump: {
    description:
      "Skier on skier: two bodies shouldering, skis clacking — a short " +
      "driven triangle bending down for the body of it, a band of white for " +
      "the knock, no crack in it — with a thin pink spit of snow off both " +
      "pairs of skis. Rounder than the tree, because nothing here is hard.",
    voices: [
      {
        call: "noise",
        durationMs: 60,
        volume: 0.03,
        filter: { type: "bandpass", frequency: 900, q: 3 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 170,
        to: 95,
        durationMs: 200,
        volume: 0.045,
        drive: 0.4,
        filter: { type: "lowpass", frequency: 1200, to: 400 },
      },
      {
        call: "noise",
        durationMs: 240,
        volume: 0.02,
        color: "pink",
        attackMs: 12,
        delayMs: 20,
        filter: { type: "bandpass", frequency: 1400, to: 2800, q: 0.9 },
      },
    ],
  },

  checkpoint: {
    description:
      "A gate passed: the panel slapped past on its hinged pole — a short " +
      "pink whack with a hollow body under it (a sine thump bending down), " +
      "and the pole's spring ringing back for a moment after. Quiet, and a " +
      "touch of the hill's echo so it sits in the same air as the wind.",
    voices: [
      {
        call: "noise",
        durationMs: 70,
        volume: 0.045,
        color: "pink",
        attackMs: 2,
        filter: { type: "bandpass", frequency: 900, to: 500, q: 0.8 },
      },
      {
        call: "tone",
        type: "sine",
        from: 170,
        to: 95,
        durationMs: 110,
        volume: 0.035,
        drive: 0.25,
        attackMs: 3,
      },
      {
        call: "tone",
        type: "triangle",
        from: 620,
        to: 560,
        durationMs: 240,
        volume: 0.012,
        delayMs: 40,
        echo: 0.1,
        filter: { type: "lowpass", frequency: 2400 },
      },
    ],
  },

  plant: {
    description:
      "A pole planted: the carbide tip on the hardpack — a tick of white " +
      "noise a few milliseconds long over a short high sine, the basket's " +
      "pat under it in pink. Small: it is heard because it is beside the ear. " +
      "Played by the packed share of the snow under him (`plantVoice`).",
    voices: [
      {
        call: "noise",
        durationMs: 18,
        volume: 0.03,
        color: "white",
        attackMs: 1,
        filter: { type: "highpass", frequency: 2600 },
      },
      { call: "tone", type: "sine", from: 2400, to: 1900, durationMs: 40, volume: 0.014 },
      {
        call: "noise",
        durationMs: 60,
        volume: 0.014,
        color: "pink",
        attackMs: 4,
        delayMs: 6,
        filter: { type: "lowpass", frequency: 700, to: 300 },
      },
    ],
  },

  plantSoft: {
    description:
      "A pole planted in LOOSE snow: no tip strikes anything — the basket " +
      "punched into the powder, a short low pat of pink noise under a " +
      "closing lowpass. Played under the tick by the loose share of the " +
      "snow, its cutoff lowered and its level taken down to nothing as the " +
      "loose snow deepens (`plantVoice`).",
    voices: [
      {
        call: "noise",
        durationMs: 70,
        volume: 0.016,
        color: "pink",
        attackMs: 6,
        filter: { type: "lowpass", frequency: 520, to: 180 },
      },
    ],
  },

  lap: {
    description:
      "A lap done: the checkpoint's chime made into a phrase — three sines " +
      "rising a third, a fifth, an octave, quick, on the echo bus — so the " +
      "line is heard as more than one more flag.",
    voices: [
      { call: "tone", type: "sine", from: 880, durationMs: 140, volume: 0.028, detuneCents: 5 },
      {
        call: "tone",
        type: "sine",
        from: 1108,
        durationMs: 140,
        volume: 0.028,
        delayMs: 90,
        detuneCents: 5,
      },
      {
        call: "tone",
        type: "sine",
        from: 1760,
        durationMs: 320,
        volume: 0.03,
        delayMs: 180,
        detuneCents: 5,
        echo: 0.18,
      },
    ],
  },

  missed: {
    description:
      "A checkpoint ridden past: the chime inverted — two driven squares " +
      "FALLING, the second lower and later, through a dark lowpass. Dry, " +
      "flat, and no echo: bad news does not ring.",
    voices: [
      {
        call: "tone",
        type: "square",
        from: 330,
        to: 260,
        durationMs: 180,
        volume: 0.03,
        drive: 0.4,
        filter: { type: "lowpass", frequency: 1200 },
      },
      {
        call: "tone",
        type: "square",
        from: 220,
        to: 175,
        durationMs: 240,
        volume: 0.028,
        drive: 0.4,
        delayMs: 130,
        filter: { type: "lowpass", frequency: 1000 },
      },
    ],
  },

  out: {
    description:
      "OUT OF THE RACE — a gate missed, a pole straddled, a fall: the " +
      "timing board's verdict, one long low driven square sagging a " +
      "semitone under a dark lowpass, and the arena's groan under it, a " +
      "slow swell of brown noise. Nothing rings: it is over.",
    voices: [
      {
        call: "tone",
        type: "square",
        from: 196,
        to: 185,
        durationMs: 620,
        volume: 0.03,
        drive: 0.5,
        holdMs: 200,
        filter: { type: "lowpass", frequency: 900 },
      },
      {
        call: "noise",
        durationMs: 900,
        volume: 0.022,
        color: "brown",
        attackMs: 220,
        filter: { type: "bandpass", frequency: 420, to: 300, q: 0.7 },
      },
    ],
  },

  pole: {
    description:
      "A FLEX POLE KNOCKED: the hollow plastic clack of a guard on a slalom " +
      "pole — a short bright bandpassed burst with a pitched knock under it " +
      "— and the pole's rattle on its hinge as it springs back, a second " +
      "fainter clack a beat later.",
    voices: [
      {
        call: "noise",
        durationMs: 40,
        volume: 0.045,
        color: "white",
        filter: { type: "bandpass", frequency: 2600, q: 2.5 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 520,
        to: 380,
        durationMs: 60,
        volume: 0.03,
      },
      {
        call: "noise",
        durationMs: 30,
        volume: 0.018,
        color: "white",
        delayMs: 140,
        filter: { type: "bandpass", frequency: 2200, q: 2.5 },
      },
    ],
  },

  reset: {
    description:
      "The skier stood back on the piste at the last gate: a soft " +
      "settle into the snow — a brown thump and a short pink sigh — and " +
      "nothing else, because the wind bed is already there, quiet, when " +
      "the picture lands.",
    voices: [
      {
        call: "noise",
        durationMs: 280,
        volume: 0.03,
        color: "brown",
        attackMs: 10,
        filter: { type: "lowpass", frequency: 320 },
      },
      {
        call: "noise",
        durationMs: 240,
        volume: 0.018,
        color: "pink",
        attackMs: 15,
        filter: { type: "bandpass", frequency: 1400, to: 2600, q: 0.8 },
      },
    ],
  },

  trap: {
    description:
      "Through a downhill's speed trap: the photocells' two quick chirps, " +
      "high and dry, a beat apart — the timing's own voice, and the speed up " +
      "on the board before the second has rung down.",
    voices: [
      { call: "tone", type: "sine", from: 1760, durationMs: 60, volume: 0.022 },
      { call: "tone", type: "sine", from: 2093, durationMs: 80, volume: 0.022, delayMs: 90 },
    ],
  },

  roar: {
    description:
      "The grimbear out of the trees: a beast's roar — a low sawtooth " +
      "growl driven hard and sagging, a second voice a fifth above it for " +
      "the throat, a brown rush of breath under both, all opening slowly " +
      "and lowpassed, so it reads as something big in the woods and not as " +
      "a horn.",
    voices: [
      {
        call: "tone",
        type: "sawtooth",
        from: 92,
        to: 64,
        durationMs: 1400,
        volume: 0.05,
        drive: 0.7,
        attackMs: 90,
        filter: { type: "lowpass", frequency: 900, to: 380 },
      },
      {
        call: "tone",
        type: "sawtooth",
        from: 138,
        to: 92,
        durationMs: 1100,
        volume: 0.025,
        drive: 0.5,
        attackMs: 120,
        filter: { type: "lowpass", frequency: 1200, to: 500 },
      },
      {
        call: "noise",
        durationMs: 1300,
        volume: 0.04,
        color: "brown",
        attackMs: 80,
        filter: { type: "lowpass", frequency: 600, to: 250 },
      },
    ],
  },

  net: {
    description:
      "Into the A-nets beside a downhill: a body caught in netting — a long " +
      "soft rush of pink noise sagging down as the mesh takes him, the " +
      "cables' twang under it (a triangle bending low), and the slip " +
      "sheet's hiss after. Big and soft: nothing hard was hit.",
    voices: [
      {
        call: "noise",
        durationMs: 520,
        volume: 0.05,
        color: "pink",
        attackMs: 10,
        filter: { type: "lowpass", frequency: 1800, to: 500 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 140,
        to: 70,
        durationMs: 380,
        volume: 0.04,
        drive: 0.3,
        filter: { type: "lowpass", frequency: 900, to: 300 },
      },
      {
        call: "noise",
        durationMs: 360,
        volume: 0.018,
        delayMs: 160,
        filter: { type: "bandpass", frequency: 3200, q: 0.8 },
      },
    ],
  },

  count: {
    description:
      "One light of the countdown: a single short sine, dry and plain, so " +
      "three of them a second apart read as a count and not as three " +
      "checkpoints taken.",
    voices: [{ call: "tone", type: "sine", from: 660, durationMs: 110, volume: 0.032 }],
  },

  go: {
    description:
      "The lights out: the count's note an octave up and held, with a " +
      "little chorus and the forest's echo under it, so the last beep is " +
      "heard as the one that was different before anybody has read the word.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 1320,
        durationMs: 420,
        volume: 0.034,
        holdMs: 100,
        detuneCents: 6,
        echo: 0.18,
      },
    ],
  },

  gate_drop: {
    description:
      "A SKI CROSS'S START GATE DROPPING: the latch let go — a dry white " +
      "tick — then the four steel doors slamming down onto their stops a " +
      "few milliseconds apart, a driven square knock bending down under " +
      "two bursts of bright grit, the frame left ringing on two inharmonic " +
      "partials with the slope's echo behind it. The GO of a gate start.",
    voices: [
      {
        call: "noise",
        durationMs: 18,
        volume: 0.035,
        color: "white",
        filter: { type: "bandpass", frequency: 3600, q: 3 },
      },
      {
        call: "tone",
        type: "square",
        from: 230,
        to: 115,
        durationMs: 150,
        volume: 0.05,
        drive: 0.6,
        delayMs: 70,
        filter: { type: "lowpass", frequency: 1900, to: 450 },
      },
      {
        call: "noise",
        durationMs: 55,
        volume: 0.055,
        color: "white",
        delayMs: 70,
        filter: { type: "bandpass", frequency: 2100, q: 1.4 },
      },
      {
        call: "noise",
        durationMs: 45,
        volume: 0.035,
        color: "white",
        delayMs: 92,
        filter: { type: "bandpass", frequency: 1700, q: 1.4 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 742,
        durationMs: 380,
        volume: 0.016,
        delayMs: 75,
        echo: 0.2,
      },
      {
        call: "tone",
        type: "sine",
        from: 1187,
        durationMs: 300,
        volume: 0.012,
        delayMs: 78,
      },
    ],
  },

  finish: {
    description:
      "The finish line: the arena's HORN — a driven sawtooth a fifth over " +
      "its root, held, on the echo bus — with the crowd's COWBELLS under " +
      "it: three metallic square clanks a little apart, each ringing down, " +
      "and the gate's chime on top so the phrase still reads as the flag.",
    voices: [
      {
        call: "tone",
        type: "sawtooth",
        from: 330,
        durationMs: 700,
        holdMs: 320,
        volume: 0.026,
        drive: 0.5,
        detuneCents: 8,
        attackMs: 20,
        echo: 0.18,
        filter: { type: "lowpass", frequency: 2200 },
      },
      {
        call: "tone",
        type: "sawtooth",
        from: 495,
        durationMs: 700,
        holdMs: 320,
        volume: 0.02,
        drive: 0.5,
        detuneCents: 8,
        attackMs: 20,
        echo: 0.18,
        filter: { type: "lowpass", frequency: 2600 },
      },
      {
        call: "tone",
        type: "square",
        from: 1760,
        to: 1700,
        durationMs: 260,
        volume: 0.014,
        delayMs: 80,
        echo: 0.14,
        filter: { type: "bandpass", frequency: 2400, q: 2.5 },
      },
      {
        call: "tone",
        type: "square",
        from: 1480,
        to: 1430,
        durationMs: 260,
        volume: 0.014,
        delayMs: 230,
        echo: 0.14,
        filter: { type: "bandpass", frequency: 2100, q: 2.5 },
      },
      {
        call: "tone",
        type: "square",
        from: 1980,
        to: 1900,
        durationMs: 300,
        volume: 0.012,
        delayMs: 390,
        echo: 0.14,
        filter: { type: "bandpass", frequency: 2700, q: 2.5 },
      },
      {
        call: "tone",
        type: "sine",
        from: 1320,
        durationMs: 520,
        volume: 0.03,
        delayMs: 300,
        holdMs: 120,
        detuneCents: 6,
        echo: 0.2,
      },
    ],
  },

  // WHAT A SKIER MEETS AND COMES DOWN INTO — the landings in powder and on
  // ice, a trunk brushed, a dead snag, the four ways he is thrown — are
  // their own module (`contact-bank.ts`), picked by `route.ts`'s `Contact`.
  ...CONTACT_BANK,

  // THE BIRDS' CRIES are their own module (`bird-bank.ts`), raised by
  // `bird-bed.ts` off the flocks `bird-plan.ts` laid over the map.
  ...BIRD_BANK,

  // THE WIND TUNNEL'S MOUTH crossed, in and out — the bed's cues
  // (`tunnel-voice.ts`).
  ...TUNNEL_BANK,

  // THE LIFT RIDDEN (`lift-voice.ts`): taken on, its towers, stood off.
  ...LIFT_BANK,

  // THE HELICOPTER (`heli-bank.ts`): the skid boarded, lifted off and set
  // down, the drop, the crash and the fire's crackle — the bed's cue.
  ...HELI_BANK,
  ...SLED_BANK,
  ...AFTERSKI_BANK,
  ...GORE_BANK,
};
