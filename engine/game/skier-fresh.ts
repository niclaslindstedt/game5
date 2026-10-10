// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKIER AT REST, before anything is read: every field of `SkierState` at
// its zero, his stations laid out off the pair's own probes. Kept apart
// from the step (`skier.ts`, which re-exports it) so the body's model is
// the whole of that file.

import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import type { SkiSpec } from "./defs/skis.ts";
import { freshBody } from "./body.ts";
import { probesOf } from "./suspension.ts";
import type { SkierState, SnowContact } from "./state.ts";

/** A skier at rest with nothing read yet; `standSkier` puts him somewhere. */
export function freshSkier(spec: SkiSpec): SkierState {
  const probes = probesOf(spec);
  const contacts: SnowContact[] = probes.map((p) => ({
    kind: "ski",
    station: p.station,
    side: p.side,
    x: 0,
    y: 0,
    z: 0,
    sink: 0,
    width: p.width,
    compression: 0,
    load: 0,
    touching: false,
  }));
  return {
    spec,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    q: fromEuler(0, 0, 0),
    wx: 0,
    wy: 0,
    wz: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    incline: 0,
    balance: 0,
    speed: 0,
    way: 0,
    switched: false,
    tuck: 0,
    brake: 0,
    steer: 0,
    lean: 0,
    edge: 0,
    skid: 0,
    skiAngle: 0,
    carve: 0,
    jumpLoad: 0,
    popped: 1e6,
    drive: 0,
    stride: 0,
    glide: 0,
    step: 0,
    pivot: 0,
    sidestep: 0,
    crouch: 0,
    hipRight: 0,
    hipAft: 0,
    packed: 0,
    sideSlip: 0,
    chatter: 0,
    contacts,
    skiCompression: [0, 0],
    airborne: false,
    airTime: 0,
    launchVy: 0,
    airReported: false,
    landing: 1e6,
    overFor: 0,
    stuckFor: 0,
    trench: 0,
    trenchFor: 0,
    boggedFor: 0,
    well: 0,
    rolledFor: 0,
    bodyHit: 0,
    bodySide: 0,
    save: null,
    resilience: 1,
    poles: spec.board === undefined,
    launch: -1,
    thrown: null,
    damage: { ski: [0, 0], legs: 0 },
    body: freshBody(),
    tunnel: null,
    lift: null,
    chairLeft: null,
    hitCooldown: 0,
    bumpCooldown: 0,
    sinks: probes.map(() => 0),
    comps: probes.map(() => 0),
  };
}
