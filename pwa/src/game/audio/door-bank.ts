// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BUILDING'S DOOR (`doorway.ts`'s `door` event) — opened and shut, each
// by what the leaf is made of (`docs/buildings.md` § Doors, `docs/audio.md`):
//
//   * OPENED: the lever's click and the latch drawn out of its strike, then
//     the leaf's swing — a timber leaf's hinges CREAK (a stick-slip chain
//     of short glides), a glazed one's closer arm sighs and its glass
//     shivers, a steel leaf's long hinges grind once — and the air pushed
//     by the leaf, a soft low whoosh;
//   * SHUT: the leaf's last stretch brought in by its closer, the THUD of
//     it on its stop (a heavy wooden knock, a glass door's dull rubber
//     seal, a steel leaf's boom) and the latch snapping into its strike;
//   * a ROLLER DOOR: its slats rattling up on their drum, and down again to
//     a clank on the sill.
//
// Heard at the door, from the skier's head (`route.ts`).

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";
import type { SoundVoice } from "@niclaslindstedt/oss-game-framework/audio/types";

/** The lever and the latch: a small metal click, its spring, the latch's
 * tongue drawn — `at` ms in. */
function latch(at: number, volume = 0.07): SoundVoice[] {
  return [
    {
      call: "noise",
      durationMs: 14,
      volume,
      color: "white",
      delayMs: at,
      filter: { type: "bandpass", frequency: 3600, q: 4 },
    },
    {
      call: "tone",
      type: "square",
      from: 2300,
      to: 1700,
      durationMs: 30,
      volume: volume * 0.45,
      delayMs: at + 2,
    },
    {
      call: "noise",
      durationMs: 22,
      volume: volume * 0.7,
      color: "white",
      delayMs: at + 70,
      filter: { type: "bandpass", frequency: 2600, q: 3 },
    },
  ];
}

/** The air a leaf pushes as it swings: a low soft whoosh `ms` long. */
function swingAir(at: number, ms: number, volume = 0.05): SoundVoice {
  return {
    call: "noise",
    durationMs: ms,
    volume,
    color: "pink",
    delayMs: at,
    attackMs: ms * 0.4,
    filter: { type: "bandpass", frequency: 260, to: 520, q: 0.7 },
  };
}

/** A hinge's creak: `n` short glides of a dry pivot sticking and slipping,
 * rising from `from` Hz, each a little higher, starting `at` ms in. */
function creak(at: number, n: number, from: number, volume = 0.04): SoundVoice[] {
  const out: SoundVoice[] = [];
  for (let i = 0; i < n; i++) {
    const f = from * (1 + 0.07 * i);
    out.push({
      call: "tone",
      type: "sawtooth",
      from: f,
      to: f * 1.18,
      durationMs: 70 + 12 * (i % 3),
      volume: volume * (1 - i / (n * 1.6)),
      delayMs: at + i * 85,
      attackMs: 12,
    });
  }
  out.push({
    call: "noise",
    durationMs: n * 85,
    volume: volume * 0.6,
    color: "pink",
    delayMs: at,
    attackMs: 40,
    filter: { type: "bandpass", frequency: from * 4, to: from * 5, q: 6 },
  });
  return out;
}

/** The leaf on its stop: a body knock `hz` deep, its rattle, `at` ms in. */
function thud(at: number, hz: number, volume: number, ring = 0): SoundVoice[] {
  const out: SoundVoice[] = [
    {
      call: "tone",
      type: "sine",
      from: hz,
      to: hz * 0.7,
      durationMs: 160,
      volume,
      drive: 0.5,
      delayMs: at,
      attackMs: 2,
    },
    {
      call: "noise",
      durationMs: 70,
      volume: volume * 0.6,
      color: "brown",
      delayMs: at,
      filter: { type: "lowpass", frequency: 1100 },
    },
  ];
  if (ring > 0) {
    out.push({
      call: "tone",
      type: "triangle",
      from: hz * 6.3,
      to: hz * 6.1,
      durationMs: 600,
      volume: ring,
      delayMs: at + 2,
    });
  }
  return out;
}

/** A roller door's slats on their drum: a train of little clacks `ms` long. */
function slats(at: number, ms: number, volume = 0.02): SoundVoice[] {
  const out: SoundVoice[] = [];
  for (let t = 0; t < ms; t += 55) {
    out.push({
      call: "noise",
      durationMs: 12,
      volume: volume * (0.7 + 0.3 * Math.sin(t * 0.09)),
      color: "white",
      delayMs: at + t,
      filter: { type: "bandpass", frequency: 1900, q: 2.2 },
    });
  }
  out.push({
    call: "noise",
    durationMs: ms,
    volume: volume * 0.8,
    color: "brown",
    delayMs: at,
    attackMs: 120,
    filter: { type: "lowpass", frequency: 420 },
  });
  return out;
}

export const DOOR_BANK: SoundBank = {
  door_open_timber: {
    description:
      "A timber door opened: the lever's click and the latch drawn, then the " +
      "hinges creaking — a dry chain of short rising glides as the pivot " +
      "sticks and slips — over the soft low whoosh of the leaf pushing the air.",
    voices: [...latch(0), ...creak(160, 7, 190), swingAir(140, 900)],
  },
  door_open_glass: {
    description:
      "A glazed door opened: a bar's soft click and the latch, the closer's " +
      "arm sighing as it is wound, a faint shiver of the glass in its frame, " +
      "and the air the wide leaf moves.",
    voices: [
      ...latch(0, 0.055),
      {
        call: "noise",
        durationMs: 800,
        volume: 0.035,
        color: "white",
        delayMs: 140,
        attackMs: 200,
        filter: { type: "bandpass", frequency: 1500, to: 1100, q: 1.6 },
      },
      {
        call: "tone",
        type: "sine",
        from: 2900,
        to: 2850,
        durationMs: 260,
        volume: 0.006,
        delayMs: 150,
      },
      swingAir(120, 900, 0.06),
    ],
  },
  door_open_steel: {
    description:
      "A steel door opened: a heavy lever clacking down, the latch's knock, " +
      "the long hinges grinding once low, and the air of the big leaf.",
    voices: [
      ...latch(0, 0.08),
      ...creak(150, 4, 110, 0.035),
      ...thud(30, 180, 0.02),
      swingAir(140, 1000, 0.06),
    ],
  },
  door_open_roll: {
    description:
      "A roller door hauled up: its slats rattling onto the drum overhead in " +
      "a long train of little clacks over a rumble, a rising rattle.",
    voices: [...latch(0, 0.035), ...slats(120, 2300)],
  },
  door_shut_timber: {
    description:
      "A timber door shut by its closer: the last creak in, the heavy wooden " +
      "knock of the leaf on its stop and the latch snapping into its strike.",
    voices: [...creak(0, 3, 230, 0.014), ...thud(240, 95, 0.06), ...latch(250, 0.035)],
  },
  door_shut_glass: {
    description:
      "A glazed door shut: the closer bringing it in, a dull rubbery bump on " +
      "its seal, the glass ringing faintly and the latch's click.",
    voices: [...thud(60, 140, 0.03, 0.006), ...latch(70, 0.03)],
  },
  door_shut_steel: {
    description:
      "A steel door shut: a hollow boom of the big leaf on its frame and the latch's clack.",
    voices: [...thud(40, 75, 0.06, 0.008), ...latch(50, 0.045)],
  },
  door_shut_roll: {
    description: "A roller door let down: the slats rattling off the drum and a clank on the sill.",
    voices: [...slats(0, 1800, 0.016), ...thud(1800, 120, 0.04, 0.01)],
  },
};
