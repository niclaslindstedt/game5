// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR ON THE JUMP PLANE (`plane.ts`) — every force the air and the
// propeller put on it, surface by surface, in the body frame about its CoG.
//
// THE SURFACES. The wing is four sections — an inner (flapped) and an outer
// (with the aileron) either side — each at its own place along the span
// with its own dihedral, incidence and washout, and the horizontal tail and
// the fin are a section each. A section meets the air its own way: the
// CoG's velocity through the air plus the body's turn about the CoG at
// that section (ω × r), so a rolling wing sees more angle on the side going
// down and less on the side going up (the roll's damping), a pitching tail
// and a yawing fin likewise (theirs), and a yawed wing a faster side and a
// slower one. Its angle of attack is read in the plane across its span;
// its LIFT comes off a lift curve that is straight up to the stall and then
// falls, over a few degrees, to a flat plate's (`aero.plate` · sin 2α) —
// so a wing pulled past its stall lets go of its air, and a wing stalled on
// one side and not the other rolls the plane over into a spin, from the
// physics alone. Its DRAG is its section's, its induced drag off its own
// lift (so the aileron pulled down drags its wing back: the adverse yaw)
// and a flat plate's past the stall. The controls move the curve: the
// flaps shift the inner sections' zero lift (and their stall a little
// less), the ailerons the outer sections' each its own way, the elevator
// the tail's, the rudder the fin's. The tail sits in the wing's DOWNWASH
// and, with the fin, in a share of the propeller's SLIPSTREAM, which keeps
// the rudder and the elevator alive on the take-off roll.
//
// THE BODY — the fuselage, the gear on its skis and the struts — is a drag
// area along each of its axes, at a point behind the CoG, so it weathervanes
// a little too.
//
// THE PROPELLER pulls along the thrust line: the shaft power over the
// airspeed at its efficiency, held under its static thrust (momentum
// theory, the power's two-thirds power) by a smooth minimum; windmilling at
// idle it drags; on the snow with the brakes on, it reverses. Its torque
// rolls the airframe left and the slipstream's swirl yaws it left — and the
// airframe is RIGGED against both (`aero.rig`: the ailerons set a touch
// apart, the fin offset), cancelling them at the cruise as a single's
// rigging does, so they come back only off it: slow on full power, as over
// a loop's top, the nose wants right rudder.
//
// Pure over the plane's state and the air given it; nothing here draws
// from the stream.

import { clamp, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { PLANE } from "./defs/plane.ts";
import type { PlaneState } from "./plane-state.ts";

const A = PLANE.aero;
const W = PLANE.wing;
const E = PLANE.engine;
const C = PLANE.controls;

/** The CoG in the body frame (from the ground datum), m. */
export const COG = { x: 0, y: PLANE.cog.y, z: PLANE.cog.z };

type Section = {
  /** Place from the CoG, body frame, m. */
  px: number;
  py: number;
  pz: number;
  /** The chord's direction (forward) and the normal (up), unit. */
  cx: number;
  cy: number;
  cz: number;
  nx: number;
  ny: number;
  nz: number;
  /** The span's direction, n × c. */
  sx: number;
  sy: number;
  sz: number;
  area: number;
  slope: number;
  stall: number;
  profile: number;
  /** The induced drag factor, 1 / (π A e). */
  induced: number;
  /** The zero-lift angle's shift the section is built with, rad. */
  camber: number;
  kind: "wing" | "tail" | "fin";
  flap: boolean;
  /** −1 the left aileron, 1 the right, 0 none. */
  aileron: number;
};

const SEMI = W.span / 2;
const ROOT = PLANE.fuselage.stations[4].half;
const FLAP_TIP = ROOT + W.flap.span * (SEMI - ROOT);
/** The exposed panels scaled up to the whole wing's area (the part across
 * the cabin roof lifts too). */
const WING_AREA = W.span * W.chord;
const EXPOSED = 2 * (SEMI - ROOT) * W.chord;
const AR = (W.span * W.span) / WING_AREA;

function section(
  x: number,
  y: number,
  z: number,
  chordUp: number,
  dihedral: number,
  side: number,
  area: number,
  kind: Section["kind"],
  rest: Partial<Section>,
): Section {
  const ci = Math.cos(chordUp);
  const si = Math.sin(chordUp);
  // The span outward along the dihedral; the normal off chord × span, up.
  const sx0 = side === 0 ? 0 : side * Math.cos(dihedral);
  const sy0 = side === 0 ? 0 : Math.sin(dihedral);
  let nx = si * 0 - ci * sy0;
  let ny = ci * sx0 - 0;
  let nz = 0 * sy0 - si * sx0;
  if (side === 0) {
    nx = 0;
    ny = ci;
    nz = -si;
  }
  if (ny < 0 && kind !== "fin") {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const n = hypot3(nx, ny, nz) || 1;
  nx /= n;
  ny /= n;
  nz /= n;
  const s: Section = {
    px: x - COG.x,
    py: y - COG.y,
    pz: z - COG.z,
    cx: 0,
    cy: si,
    cz: ci,
    nx,
    ny,
    nz,
    sx: 0,
    sy: 0,
    sz: 0,
    area,
    slope: A.lift.wing,
    stall: A.stall.wing,
    profile: A.profile.wing,
    induced: 1 / (Math.PI * AR * A.oswald),
    camber: -A.zeroLift,
    kind,
    flap: false,
    aileron: 0,
    ...rest,
  };
  // The span, n × c (the section's own, so a fin's points down: its lift
  // still comes out along its normal).
  s.sx = s.ny * s.cz - s.nz * s.cy;
  s.sy = s.nz * s.cx - s.nx * s.cz;
  s.sz = s.nx * s.cy - s.ny * s.cx;
  return s;
}

function wingSections(): Section[] {
  const out: Section[] = [];
  const ac = W.root.le - W.chord / 4;
  const scale = WING_AREA / EXPOSED;
  for (const side of [-1, 1]) {
    const pieces = [
      { from: ROOT, to: FLAP_TIP, flap: true },
      { from: FLAP_TIP, to: SEMI, flap: false },
    ];
    for (const piece of pieces) {
      const mid = (piece.from + piece.to) / 2;
      const twist = W.washout * ((mid - ROOT) / (SEMI - ROOT));
      out.push(
        section(
          side * mid,
          W.root.y + mid * Math.tan(W.dihedral),
          ac,
          W.incidence - twist,
          W.dihedral,
          side,
          (piece.to - piece.from) * W.chord * scale,
          "wing",
          {
            flap: piece.flap,
            aileron: piece.flap ? 0 : side,
            // The ailerons' rigging: the left one set a touch down, the
            // right a touch up, against the torque's roll.
            camber: -A.zeroLift - (piece.flap ? 0 : side * A.rig.aileron),
          },
        ),
      );
    }
  }
  return out;
}

function tailSection(): Section {
  const T = PLANE.tail;
  const tailAR = (T.span * T.span) / (T.span * T.chord);
  return section(0, T.y, T.le - T.chord / 4, T.incidence, 0, 0, T.span * T.chord, "tail", {
    slope: A.lift.tail,
    stall: A.stall.tail,
    profile: A.profile.tail,
    induced: 1 / (Math.PI * tailAR * 0.8),
    camber: 0,
  });
}

function finSection(): Section {
  const F = PLANE.fin;
  const h = F.tip.y - F.root.y;
  const area = (h * (F.root.chord + F.tip.chord)) / 2 + 0.5 * (F.root.le - F.dorsal) * 0.35;
  // The centroid's height up the fin, and the quarter chord there.
  const up = (h * (F.root.chord + 2 * F.tip.chord)) / (3 * (F.root.chord + F.tip.chord));
  const k = up / h;
  const le = F.root.le + (F.tip.le - F.root.le) * k;
  const chord = F.root.chord + (F.tip.chord - F.root.chord) * k;
  const s = section(0, F.root.y + up, le - chord / 4, 0, 0, 0, area, "fin", {
    slope: A.lift.fin,
    stall: A.stall.fin,
    profile: A.profile.fin,
    induced: 1 / (Math.PI * ((2 * h * h) / area) * 0.8),
    // The fin set off the centre line, its leading edge to the left, as a
    // touch of right rudder held for good against the swirl's yaw.
    camber: -A.rig.fin,
  });
  // A fin's normal is the body's right.
  s.nx = 1;
  s.ny = 0;
  s.nz = 0;
  s.sx = s.ny * s.cz - s.nz * s.cy;
  s.sy = s.nz * s.cx - s.nx * s.cz;
  s.sz = s.nx * s.cy - s.ny * s.cx;
  return s;
}

/** Every lifting surface, built once off `PLANE`. */
export const SECTIONS: readonly Section[] = [...wingSections(), tailSection(), finSection()];
/** The wing's whole area, m². */
export const WING = WING_AREA;

/** The propeller's turn at full rpm, rad/s, and its disc's area, m². */
const PROP_OMEGA = (PLANE.prop.rpm / 60) * 2 * Math.PI;
const DISC = (Math.PI * PLANE.prop.diameter * PLANE.prop.diameter) / 4;
const HUB = { x: 0, y: PLANE.prop.hub.y - COG.y, z: PLANE.prop.hub.z - COG.z };
const BODY = { x: 0, y: A.body.at.y - COG.y, z: A.body.at.z - COG.z };

/** What `planeAir` hands back: the force and the torque in the body frame,
 * N and N·m, and what the plane reads of its air. */
export type PlaneAir = {
  fx: number;
  fy: number;
  fz: number;
  tx: number;
  ty: number;
  tz: number;
  /** The wing's mean lift coefficient, the share of it stalled, the lift
   * all told along the body's up, N, and the thrust, N. */
  cl: number;
  stalled: number;
  lift: number;
  thrust: number;
};

/** THE THRUST at a power share and an airspeed, N, in the air or on the
 * snow (where `reverse`, 0..1, turns it back). */
export function thrustAt(power: number, speed: number, density: number, reverse = 0): number {
  const P = Math.max(0, power) * E.power;
  const rho = density / 1.225;
  const still = E.staticThrust * rho ** (1 / 3) * Math.pow(Math.max(0, power), 2 / 3);
  const flowing = (E.efficiency * P) / Math.max(1, speed);
  // A smooth minimum of the two: the static cap at rest, ηP/V at speed.
  const T = 1 / Math.cbrt(1 / still ** 3 + 1 / flowing ** 3 + 1e-30);
  // At flight idle the propeller windmills, dragging.
  const mill = 0.5 * density * speed * speed * E.windmill * clamp(1 - power / 0.15, 0, 1);
  return T - mill - reverse * E.reverse * E.staticThrust;
}

/** The lift and drag coefficients of a section at an effective angle of
 * attack `a` (from its zero lift), rad, its stall `stall` (and a cambered
 * wing's shallower stall below zero), into `out`; the share stalled. */
function coefficients(
  s: Section,
  a: number,
  stall: number,
  out: { cl: number; cd: number },
): number {
  const neg = s.kind === "wing" ? 0.75 * stall : stall;
  const over = a >= 0 ? a - stall : -neg - a;
  let b = clamp(over / A.soft, 0, 1);
  b = b * b * (3 - 2 * b);
  const attached = s.slope * a;
  const sin = Math.sin(a);
  out.cl = (1 - b) * attached + b * A.plate * Math.sin(2 * a);
  out.cd = s.profile + (1 - b) * s.induced * attached * attached + b * A.plateDrag * sin * sin;
  return b;
}

const co = { cl: 0, cd: 0 };

/** THE AIR AND THE PROPELLER ON THE PLANE `p`: `ux, uy, uz` the CoG's
 * velocity through the air in the body frame, m/s; `density` the air's;
 * its surfaces, rates, power and the wing's last lift coefficient read off
 * `p`. `grounded` and `brake` turn the propeller back on the snow. */
export function planeAir(
  p: PlaneState,
  ux: number,
  uy: number,
  uz: number,
  density: number,
  grounded: boolean,
  out: PlaneAir,
): PlaneAir {
  const speed = hypot3(ux, uy, uz);
  const brake = grounded ? clamp(p.controls.brake ?? 0, 0, 1) : 0;
  const reverse = brake * clamp(1 - p.power / 0.2, 0, 1);
  const thrust = thrustAt(p.power, Math.max(0, uz), density, reverse);
  // The slipstream's increment far behind the disc (momentum theory), and
  // the tail's and the fin's share of it.
  const slip =
    thrust > 0
      ? A.slip * (Math.sqrt(uz * uz + (2 * thrust) / (density * DISC)) - Math.max(0, uz))
      : 0;
  const surf = p.surfaces;
  const flapShift = A.flapLift * surf.flaps * C.flaps;
  const downwash = A.downwash * p.cl;
  let fx = 0;
  let fy = 0;
  let fz = thrust;
  let tx = 0;
  let ty = 0;
  let tz = 0;
  let wingLift = 0;
  let wingArea = 0;
  let stalledArea = 0;
  let lift = 0;
  const half = 0.5 * density;
  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i];
    // The section's own velocity through the air: the CoG's and the turn's.
    let vx = ux + (p.wy * s.pz - p.wz * s.py);
    let vy = uy + (p.wz * s.px - p.wx * s.pz);
    let vz = uz + (p.wx * s.py - p.wy * s.px);
    if (s.kind !== "wing") vz += slip;
    // Across the span only.
    const along = vx * s.sx + vy * s.sy + vz * s.sz;
    vx -= along * s.sx;
    vy -= along * s.sy;
    vz -= along * s.sz;
    const v2 = vx * vx + vy * vy + vz * vz;
    if (v2 < 0.04) continue;
    const v = Math.sqrt(v2);
    let a = Math.atan2(-(vx * s.nx + vy * s.ny + vz * s.nz), vx * s.cx + vy * s.cy + vz * s.cz);
    a += s.camber;
    let stall = s.stall;
    let extraDrag = 0;
    if (s.kind === "wing") {
      if (s.flap) {
        a += flapShift;
        stall += A.flapStall * flapShift;
        extraDrag = A.flapDrag * surf.flaps * (EXPOSED / WING_AREA);
      } else {
        // The right aileron up (positive) unloads the right wing.
        a -= s.aileron * A.effect.aileron * surf.aileron;
      }
    } else if (s.kind === "tail") {
      a += A.effect.elevator * surf.elevator - downwash;
    } else {
      a -= A.effect.rudder * surf.rudder;
    }
    if (a > Math.PI) a -= 2 * Math.PI;
    if (a < -Math.PI) a += 2 * Math.PI;
    const b = coefficients(s, a, stall, co);
    const q = half * v2 * s.area;
    const L = q * co.cl;
    const D = q * (co.cd + extraDrag);
    // Lift along v̂ × span, drag against v̂.
    const ix = vx / v;
    const iy = vy / v;
    const iz = vz / v;
    const lx = iy * s.sz - iz * s.sy;
    const ly = iz * s.sx - ix * s.sz;
    const lz = ix * s.sy - iy * s.sx;
    const Fx = L * lx - D * ix;
    const Fy = L * ly - D * iy;
    const Fz = L * lz - D * iz;
    fx += Fx;
    fy += Fy;
    fz += Fz;
    tx += s.py * Fz - s.pz * Fy;
    ty += s.pz * Fx - s.px * Fz;
    tz += s.px * Fy - s.py * Fx;
    if (s.kind === "wing") {
      wingLift += co.cl * s.area;
      wingArea += s.area;
      stalledArea += b * s.area;
    }
    if (s.kind !== "fin") lift += L * ly;
  }
  // THE BODY's drag along its own axes, at its point.
  const bx = ux + (p.wy * BODY.z - p.wz * BODY.y);
  const by = uy + (p.wz * BODY.x - p.wx * BODY.z);
  const bz = uz + (p.wx * BODY.y - p.wy * BODY.x);
  const dx = -half * A.body.side * Math.abs(bx) * bx;
  const dy = -half * A.body.plan * Math.abs(by) * by;
  const dz = -half * A.body.front * Math.abs(bz) * bz;
  fx += dx;
  fy += dy;
  fz += dz;
  tx += BODY.y * dz - BODY.z * dy;
  ty += BODY.z * dx - BODY.x * dz;
  tz += BODY.x * dy - BODY.y * dx;
  // THE THRUST on its line (the hub above the CoG pitches the nose down),
  // the torque's roll and the swirl's yaw, both to the left.
  tx += HUB.y * thrust;
  tz += E.torque * ((p.power * E.power) / PROP_OMEGA);
  ty -= E.swirl * Math.max(0, thrust);
  out.fx = fx;
  out.fy = fy;
  out.fz = fz;
  out.tx = tx;
  out.ty = ty;
  out.tz = tz;
  out.cl = wingArea > 0 ? wingLift / wingArea : 0;
  out.stalled = wingArea > 0 ? stalledArea / wingArea : 0;
  out.lift = lift;
  out.thrust = thrust;
  void speed;
  return out;
}
