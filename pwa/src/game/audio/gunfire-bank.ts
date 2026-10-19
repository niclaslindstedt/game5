// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S GUNS — the `gunfire` event's one-shots
// (`engine/game/gunfire.ts`): each weapon's report, the supersonic crack of
// a round going by close, what a round strikes, a rocket leaving its tube
// and its burst (the helicopter's explosion, smaller), a round in him.
//
// What a gunshot IS to an ear: a MUZZLE BLAST — a broadband impulse of a
// millisecond or two, all attack, rolled off by distance into a dull
// boom — and, for a supersonic round, its own BALLISTIC CRACK, a sharp
// N-wave snap that arrives before the blast at anyone downrange. In the
// mountains the report is thrown back by the valley as a rolling echo. So
// each report here is a white transient with no attack, a short driven
// body pitched by the calibre (a rifle's bark high and tight, a door gun's
// lower and fuller, a heavy gun's a thump), and a pink tail through the
// echo. Snow swallows transients: a round into the snow is a soft puff;
// into a trunk a woody knock; into steel a ringing ping.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

/** A REPORT: the blast's white crack, the bark's body at `body` Hz, the
 * echo's pink tail — `big` the calibre's weight (1 a rifle's). */
function report(body: number, big: number): SoundBank[string]["voices"] {
  return [
    {
      call: "noise",
      durationMs: 14 * big,
      volume: 0.07,
      color: "white",
      filter: { type: "highpass", frequency: 1600 / big },
    },
    {
      call: "noise",
      durationMs: 70 * big,
      volume: 0.06,
      color: "white",
      filter: { type: "bandpass", frequency: 2200 / big, to: 500 / big, q: 0.7 },
    },
    {
      call: "tone",
      type: "sine",
      from: body,
      to: body * 0.35,
      durationMs: 110 * big,
      volume: 0.06,
      drive: 0.7,
      attackMs: 1,
    },
    {
      call: "noise",
      durationMs: 600 * big,
      volume: 0.035,
      color: "pink",
      delayMs: 20,
      attackMs: 6,
      filter: { type: "lowpass", frequency: 1800 / big, to: 300 / big },
      echo: 0.4,
    },
  ];
}

export const GUNFIRE_BANK: SoundBank = {
  gun_rifle: {
    description:
      "A service rifle's report: a hard white crack with no attack, a tight " +
      "driven bark falling from 420 Hz, and a pink tail rolled back off the " +
      "valley through the echo.",
    voices: report(420, 1),
  },
  gun_mg: {
    description:
      "A door-mounted machine gun's report, one of a burst: lower and fuller " +
      "than the rifle's — a wider crack, a driven body from 300 Hz and a " +
      "longer tail through the echo — so a burst is heard as a rattle.",
    voices: report(300, 1.3),
  },
  gun_heavy: {
    description:
      "A heavy machine gun's report: a thump more than a crack — a broad " +
      "white blast rolled off low, a driven body from 190 Hz and a heavy " +
      "pink tail through the echo, the slow pound of the big calibre.",
    voices: report(190, 1.8),
  },
  gun_snap: {
    description:
      "A round passing close: the supersonic CRACK of its shock wave — a " +
      "few milliseconds of bright white grit high up, a sharp zip after it " +
      "falling in pitch as it goes by.",
    voices: [
      {
        call: "noise",
        durationMs: 6,
        volume: 0.07,
        color: "white",
        filter: { type: "highpass", frequency: 3200 },
      },
      {
        call: "noise",
        durationMs: 60,
        volume: 0.03,
        color: "white",
        delayMs: 4,
        filter: { type: "bandpass", frequency: 5200, to: 1800, q: 2 },
      },
    ],
  },
  gun_puff: {
    description:
      "A round into the snow: a soft pink puff swallowed by it, a dull brown " +
      "thump under it and a little white grit of crust flicked up.",
    voices: [
      {
        call: "noise",
        durationMs: 120,
        volume: 0.04,
        color: "pink",
        attackMs: 4,
        filter: { type: "bandpass", frequency: 900, to: 400, q: 0.8 },
      },
      {
        call: "noise",
        durationMs: 60,
        volume: 0.03,
        color: "brown",
        filter: { type: "lowpass", frequency: 260 },
      },
      {
        call: "noise",
        durationMs: 18,
        volume: 0.015,
        color: "white",
        filter: { type: "highpass", frequency: 2600 },
      },
    ],
  },
  gun_wood: {
    description:
      "A round into a trunk: a hard woody knock — a short white crack in a " +
      "band round 1.8 kHz over a dull 260 Hz tock — and the patter of " +
      "bark chips after it.",
    voices: [
      {
        call: "noise",
        durationMs: 30,
        volume: 0.06,
        color: "white",
        filter: { type: "bandpass", frequency: 1800, q: 1.4 },
      },
      { call: "tone", type: "triangle", from: 260, to: 180, durationMs: 70, volume: 0.05 },
      {
        call: "noise",
        durationMs: 140,
        volume: 0.02,
        color: "pink",
        delayMs: 40,
        filter: { type: "bandpass", frequency: 2600, q: 0.8 },
      },
    ],
  },
  gun_ping: {
    description:
      "A round off steel or rock — or through the skin of the machine he " +
      "rides: a bright metallic ping ringing down from 2.4 kHz over a hard " +
      "white tick of the strike.",
    voices: [
      {
        call: "noise",
        durationMs: 10,
        volume: 0.06,
        color: "white",
        filter: { type: "highpass", frequency: 2400 },
      },
      {
        call: "tone",
        type: "sine",
        from: 2400,
        to: 1700,
        durationMs: 260,
        volume: 0.035,
      },
      { call: "tone", type: "sine", from: 3700, to: 2900, durationMs: 160, volume: 0.02 },
    ],
  },
  gun_hit: {
    description:
      "A round in him: a dull wet thud with no ring — a brown lowpassed knock " +
      "and a short pink slap — heard close and felt more than heard.",
    voices: [
      {
        call: "noise",
        durationMs: 80,
        volume: 0.07,
        color: "brown",
        filter: { type: "lowpass", frequency: 420 },
      },
      {
        call: "noise",
        durationMs: 30,
        volume: 0.04,
        color: "pink",
        filter: { type: "bandpass", frequency: 1200, q: 0.9 },
      },
      { call: "tone", type: "sine", from: 120, to: 60, durationMs: 90, volume: 0.05 },
    ],
  },
  rocket_launch: {
    description:
      "A rocket leaving its tube: the launch charge's hard thump, then the " +
      "motor lighting a few metres out — a rushing pink WHOOSH whose band " +
      "climbs as it speeds away, and a hiss trailing it through the echo.",
    voices: [
      {
        call: "noise",
        durationMs: 40,
        volume: 0.07,
        color: "white",
        filter: { type: "lowpass", frequency: 2200 },
      },
      {
        call: "tone",
        type: "sine",
        from: 110,
        to: 50,
        durationMs: 180,
        volume: 0.06,
        drive: 0.5,
        attackMs: 2,
      },
      {
        call: "noise",
        durationMs: 1300,
        volume: 0.06,
        color: "pink",
        delayMs: 80,
        attackMs: 60,
        filter: { type: "bandpass", frequency: 500, to: 2600, q: 0.8 },
        echo: 0.3,
      },
    ],
  },
  tank_gun: {
    description:
      "A tank's main gun: a deep slamming BOOM — a broad white blast, a " +
      "driven sub-bass body falling from 70 Hz and a long brown rumble " +
      "thrown back off the valley through the echo.",
    voices: [
      {
        call: "noise",
        durationMs: 40,
        volume: 0.08,
        color: "white",
        filter: { type: "lowpass", frequency: 2600 },
      },
      {
        call: "tone",
        type: "sine",
        from: 70,
        to: 30,
        durationMs: 900,
        volume: 0.08,
        drive: 0.6,
        attackMs: 2,
      },
      {
        call: "noise",
        durationMs: 2400,
        volume: 0.06,
        color: "brown",
        attackMs: 10,
        filter: { type: "lowpass", frequency: 500, to: 90 },
        echo: 0.5,
      },
    ],
  },
};
