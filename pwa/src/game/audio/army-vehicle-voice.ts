// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A GROUND WAVE'S VEHICLE, AS SIX LAYERS THAT NEVER STOP — the tracked
// carrier, the truck and the tank (`army-vehicle.ts`), each a big DIESEL
// heard from where the skier is, the tracked ones with their tracks:
//
//   BLOCK    the firing note of a big slow diesel — a square folded through
//            the saturation curve, low and thick: a six's at a carrier's
//            and a truck's revs, a twelve's on the tank
//   KNOCK    the DIESEL'S CLATTER — the injection's hard knock on every
//            firing, mid-band noise driven hard, loudest at idle and under
//            load, the sound a parked diesel is known by
//   BASS     a sine an octave under the note: the weight of the machine
//   TURBO    the turbocharger's whistle over it all, a thin sine whose pitch
//            climbs with the revs and the load
//   CLATTER  THE TRACK — every link meeting the drive sprocket and the
//            road wheels, a buzzing sawtooth at the links' passing rate
//            (the pace over the link pitch): the clank-clank a tank is
//            heard by before its engine; none on a truck
//   SQUEAL   the tracks' squeal and the snow under them crushed — high
//            noise rising with the pace; on a truck, its chained tyres'
//            low rumble in its place
//
// A pure function of the vehicle as the ear has it: `vehicleTargets` says
// where every layer should be, and the army's bed (`army-bed.ts`) steers the
// real ones there — which is what lets the audition page drive it from
// sliders.

import type { LayerSpec, LayerTarget } from "@niclaslindstedt/oss-game-framework/audio/voice";

/** EACH KIND'S ENGINE AND RUNNING GEAR: its idle and governed revs, its
 * cylinders (a four-stroke fires half of them a revolution), the link
 * pitch of its tracks (m; none on wheels) and how loud it is against the
 * rest of the game. */
export const VEHICLE_ENGINES = {
  carrier: { idle: 750, max: 2600, cylinders: 6, link: 0.11, loud: 2 },
  truck: { idle: 650, max: 2300, cylinders: 6, link: 0, loud: 1.8 },
  tank: { idle: 800, max: 2600, cylinders: 12, link: 0.16, loud: 3 },
} as const;

export type VehicleEngineKind = keyof typeof VEHICLE_ENGINES;

/** ONE VEHICLE at one instant: its kind, how far up its band the crank is
 * (0..1), how hard it is working (0..1: climbing, pulling away), and its
 * pace over the snow, m/s. */
export type VehicleVoice = {
  kind: VehicleEngineKind;
  rev: number;
  load: number;
  pace: number;
};

/** What the ear makes of it: the gain (the distance) and how bright,
 * 0..1. */
export type VehicleMix = { gain: number; tone: number };

export type VehicleLayer = "block" | "knock" | "bass" | "turbo" | "clatter" | "squeal";

/** What each layer is BUILT from — decided once. */
export const VEHICLE_LAYERS: Record<VehicleLayer, LayerSpec> = {
  block: {
    kind: "tone",
    type: "square",
    detuneCents: 9,
    drive: 1,
    filter: { type: "lowpass", q: 0.8 },
  },
  knock: { kind: "noise", color: "white", filter: { type: "bandpass", q: 1.6 } },
  bass: { kind: "tone", type: "sine", detuneCents: 4 },
  turbo: { kind: "tone", type: "sine", detuneCents: 3 },
  clatter: {
    kind: "tone",
    type: "sawtooth",
    detuneCents: 25,
    drive: 1,
    filter: { type: "bandpass", q: 1.1 },
  },
  squeal: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.9 } },
};

/** How fast each layer follows, s. */
export const VEHICLE_GLIDE: Record<VehicleLayer, number> = {
  block: 0.12,
  knock: 0.1,
  bass: 0.12,
  turbo: 0.4,
  clatter: 0.08,
  squeal: 0.15,
};

/** The firing note at these revs, Hz. */
export function dieselHz(kind: VehicleEngineKind, rev: number): number {
  const E = VEHICLE_ENGINES[kind];
  const rpm = E.idle + Math.min(1, Math.max(0, rev)) * (E.max - E.idle);
  return (rpm / 60) * (E.cylinders / 2);
}

/** The track's links passing at this pace, Hz (none on wheels). */
export function linkHz(kind: VehicleEngineKind, pace: number): number {
  const L = VEHICLE_ENGINES[kind].link;
  return L > 0 ? Math.abs(pace) / L : 0;
}

/** Where every layer of one vehicle should be for `voice`, heard by
 * `mix`. */
export function vehicleTargets(
  voice: VehicleVoice,
  mix: VehicleMix,
): Record<VehicleLayer, LayerTarget> {
  const E = VEHICLE_ENGINES[voice.kind];
  const g = mix.gain * E.loud;
  const rev = Math.min(1, Math.max(0, voice.rev));
  const load = Math.min(1, Math.max(0, voice.load));
  const hz = dieselHz(voice.kind, rev);
  const pace = Math.abs(voice.pace);
  const links = linkHz(voice.kind, pace);
  const rolling = Math.min(1, pace / 12);
  const tracked = E.link > 0;
  return {
    block: {
      level: (0.026 + 0.02 * load + 0.008 * rev) * g,
      hz,
      cutoff: (260 + 420 * rev) * (0.6 + 0.4 * mix.tone),
      grit: 0.35 + 0.45 * load,
    },
    knock: {
      level: (0.01 + 0.008 * load) * (1 - 0.4 * rev) * g,
      cutoff: (1300 + 900 * rev) * (0.5 + 0.5 * mix.tone),
    },
    bass: { level: (0.024 + 0.014 * load) * g, hz: Math.max(30, hz * 0.5) },
    turbo: {
      level: (0.0012 + 0.003 * load) * rev * g * mix.tone,
      hz: 2400 + 3800 * rev,
    },
    clatter: {
      level: tracked ? rolling * (0.008 + 0.012 * rolling) * g : 0,
      hz: Math.max(12, links),
      cutoff: Math.max(180, links * 6) * (0.6 + 0.4 * mix.tone),
      grit: 0.7,
    },
    squeal: tracked
      ? { level: rolling * 0.008 * g * (0.4 + 0.6 * mix.tone), cutoff: 1800 + 1600 * rolling }
      : { level: rolling * 0.01 * g, cutoff: 160 + 220 * rolling },
  };
}

/** A vehicle heard from `distance` m: the inverse of the distance past a
 * few metres, fading out by the better part of a kilometre (a tank carries
 * a long way over the snow), the air taking the top off. */
export function vehicleHeard(distance: number): VehicleMix {
  const d = Math.max(0, distance);
  const fade = 1 - Math.min(1, Math.max(0, (d - 300) / 500));
  return { gain: (6 / Math.max(6, d)) * fade, tone: 1 / (1 + d / 200) };
}
