// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE BUILT IN CODE, IN DETAIL — the procedural-rig candidate's
// bike (`bike-rig-switch.ts`): the same class and the same numbers as the
// placeholder (`bike-look.ts`, the engine's `BIKE`), the same NODES on the
// same pivots (`BIKE_NODES`), so it is posed by the same hand (`poseBike`)
// and its wheels sit where the physics has them — but built the way the
// class's photographs show it rather than out of round sticks:
//
//   THE FRAME hydroformed: an oval down tube, wide at the bracket and
//   flattened under the head, a top tube that dips to the seat tube, a
//   gusset plate under the head, the shock's tab, the pivot's boss, the
//   bracket's shell with a chain guide and a bash guard on its tabs, a down
//   tube protector, a short bent seat tube and a slammed post.
//   THE SWINGARM boxed: tall chainstays out to plate dropouts, seatstays up
//   to the rocker plates that drive the shock, the rear caliper on its mount.
//   THE FORK a dual crown: shaped crown plates, gold-coated stanchions with
//   their top caps, tapered lowers with a brace, the front caliper.
//   THE COCKPIT a riser bar swept and risen to its grips, a direct-mount
//   stem, lock-on grips with collars, the levers and their hoses.
//   THE WHEELS a box-section rim, a laced hub, knobbly tyres with centre and
//   shoulder knobs, a rotor on a spider.
//   THE DRIVE a chainring with its teeth, shaped arms, flat pedals with
//   pins, the chain's two runs, a short-cage derailleur.
//
// Every part is lofted or built smooth and painted by vertex colour, one
// draw a node and a finish (paint, gloss metal, satin black, rubber).

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BIKE_BB } from "@engine";

import {
  BAR_MIDDLE,
  BIKE_LOOK as L,
  CROWN_BOTTOM,
  CROWN_TOP,
  DRIVE,
  GRIPS,
  HEAD_BOTTOM,
  HEAD_TOP,
  REAR_REST,
  STEER_AT,
  STEER_AXIS,
  frontAxle,
  shockAt,
  type V3,
} from "./bike-look.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { blob, brick, loft, ring, rod } from "./loft-geo.ts";
import type { BikeNodes } from "./bike-view.ts";

/** THE PAINT: a team's red frame with white bands, black everywhere else
 * a rider would bolt on, the fork's gold coat, an orange coil. */
export const DH_PAINT = {
  frame: 0xb8231b,
  band: 0xf2f0ea,
  black: 0x17181a,
  satin: 0x2a2c30,
  alloy: 0xa8adb2,
  gold: 0xc9a456,
  coil: 0xf07a12,
  rubber: 0x1c1c1d,
  wall: 0x6e5a3e,
  hose: 0x111111,
};
const C = DH_PAINT;

const NAMES = {
  frame: "bike_frame",
  bars: "bike_bars",
  fork: "bike_fork",
  wheelF: "bike_wheel_f",
  swingarm: "bike_swingarm",
  wheelR: "bike_wheel_r",
  shock: "bike_shock",
  cranks: "bike_cranks",
  pedalL: "bike_pedal_l",
  pedalR: "bike_pedal_r",
} as const;

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: V3, k: number): V3 => v(a.x * k, a.y * k, a.z * k);
const mix = (a: V3, b: V3, k: number): V3 => add(a, mul(sub(b, a), k));
const SHOCK_REST = shockAt(0).length;

type Finish = "paint" | "metal" | "satin" | "rubber";

export function buildDhBike(haze: HazeUniforms): {
  root: THREE.Group;
  nodes: BikeNodes;
  dispose(): void;
} {
  const mats: THREE.Material[] = [];
  const make = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(
      new THREE.MeshStandardMaterial({ vertexColors: true, ...p }),
      haze,
      "bike",
    );
    mats.push(m);
    return m;
  };
  const M: Record<Finish, THREE.MeshStandardMaterial> = {
    paint: make({ roughness: 0.3, metalness: 0.15 }),
    metal: make({ roughness: 0.28, metalness: 0.85 }),
    satin: make({ roughness: 0.62, metalness: 0.25 }),
    rubber: make({ roughness: 0.92, metalness: 0 }),
  };
  const parts = new Map<THREE.Object3D, Map<Finish, THREE.BufferGeometry[]>>();
  const put = (n: THREE.Object3D, f: Finish, g: THREE.BufferGeometry): void => {
    let by = parts.get(n);
    if (!by) parts.set(n, (by = new Map()));
    const list = by.get(f) ?? [];
    list.push(g.index ? g.toNonIndexed() : g);
    by.set(f, list);
  };
  const node = (name: string, parent: THREE.Object3D, at: V3): THREE.Group => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(at.x, at.y, at.z);
    parent.add(g);
    return g;
  };
  const O = v(0, 0, 0);
  const root = new THREE.Group();
  root.name = "bike-dh";
  const frame = node(NAMES.frame, root, BIKE_BB);

  // ── THE FRAME ─────────────────────────────────────────────────────────
  // The head tube, tapered (1.5″ below, 1⅛″ above, with its cups).
  put(
    frame,
    "paint",
    rod(sub(HEAD_BOTTOM, mul(STEER_AXIS, 0.008)), HEAD_TOP, 0.031, C.frame, 16, 0.027),
  );
  put(
    frame,
    "satin",
    rod(
      sub(HEAD_BOTTOM, mul(STEER_AXIS, 0.018)),
      sub(HEAD_BOTTOM, mul(STEER_AXIS, 0.006)),
      0.033,
      C.black,
      16,
    ),
  );
  put(frame, "satin", rod(HEAD_TOP, add(HEAD_TOP, mul(STEER_AXIS, 0.012)), 0.029, C.black, 16));
  const seatJoin = v(0, 0.39, -0.165);
  const bbTop = v(0, 0.035, -0.02);
  // The top tube: off the head tube's top third, dipping to the seat tube,
  // wide and flattened.
  const ttFrom = mix(HEAD_BOTTOM, HEAD_TOP, 0.72);
  put(
    frame,
    "paint",
    loft(
      [add(ttFrom, v(0, 0, -0.01)), mix(ttFrom, seatJoin, 0.45), add(seatJoin, v(0, 0.01, 0.01))],
      (t) => [0.021 - 0.004 * t, 0.033 - 0.01 * t],
      C.frame,
      { sides: 14, across: v(1, 0, 0) },
    ),
  );
  // The down tube: big and oval, flattened under the head, wide at the shell.
  const dtFrom = mix(HEAD_BOTTOM, HEAD_TOP, 0.18);
  const dtTo = v(0, 0.055, 0.06);
  put(
    frame,
    "paint",
    loft(
      [add(dtFrom, v(0, 0, -0.012)), mix(dtFrom, dtTo, 0.5), dtTo],
      (t) => [0.028 + 0.012 * t, 0.034 - 0.006 * t],
      C.frame,
      { sides: 16, across: v(1, 0, 0) },
    ),
  );
  // The white bands on the down tube and the top tube (a team's livery).
  for (const k of [0.32, 0.4]) {
    const a = mix(dtFrom, dtTo, k);
    const b = mix(dtFrom, dtTo, k + 0.035);
    put(frame, "paint", rod(a, b, 0.036, C.band, 16, 0.037));
  }
  put(
    frame,
    "paint",
    rod(mix(ttFrom, seatJoin, 0.18), mix(ttFrom, seatJoin, 0.32), 0.0225, C.band, 14, 0.0215),
  );
  // The down tube's protector, under it near the shell.
  put(
    frame,
    "satin",
    loft([mix(dtFrom, dtTo, 0.55), mix(dtFrom, dtTo, 0.92)], () => [0.03, 0.012], C.black, {
      sides: 10,
      across: v(1, 0, 0),
      outline: (a) => (Math.sin(a) > 0 ? 0.4 : 1.15),
    }),
  );
  // The gusset under the head, joining the two tubes.
  put(
    frame,
    "paint",
    loft(
      [mix(dtFrom, ttFrom, 0.1), mix(dtFrom, ttFrom, 0.5), mix(dtFrom, ttFrom, 0.9)],
      () => [0.012, 0.03],
      C.frame,
      { sides: 10, across: v(1, 0, 0) },
    ),
  );
  // The seat tube, bent forward round the shock, and its collar.
  put(
    frame,
    "paint",
    loft(
      [bbTop, v(0, 0.2, -0.075), seatJoin, L.seatTop],
      (t) => [0.02 + 0.006 * (1 - t), 0.022],
      C.frame,
      {
        sides: 14,
        across: v(1, 0, 0),
      },
    ),
  );
  put(
    frame,
    "satin",
    rod(
      sub(L.seatTop, v(0, 0.015, -0.006)),
      add(L.seatTop, v(0, 0.005, -0.002)),
      0.022,
      C.black,
      12,
    ),
  );
  // The post, slammed, and the saddle: a lofted wedge, narrow at the nose.
  const post = sub(L.saddle.at, v(0, 0.012, 0));
  put(frame, "metal", rod(L.seatTop, post, 0.0155, C.satin, 12));
  const sd = L.saddle;
  put(
    frame,
    "rubber",
    loft(
      [
        add(sd.at, v(0, 0.02, -sd.length * 0.42)),
        add(sd.at, v(0, 0.024, 0)),
        add(sd.at, v(0, 0.018, sd.length * 0.55)),
      ],
      (t) => [sd.width * 0.5 * (t < 0.45 ? 1 : 1 - (t - 0.45) * 1.25), 0.02 - 0.006 * t],
      C.black,
      { sides: 14, across: v(1, 0, 0), steps: 8 },
    ),
  );
  // The shock's tab off the down tube, and its clevis.
  const tabFoot = mix(dtFrom, dtTo, 0.42);
  put(
    frame,
    "paint",
    loft([add(tabFoot, v(0, 0.02, -0.01)), L.shockFront], () => [0.022, 0.014], C.frame, {
      sides: 10,
    }),
  );
  for (const s of [-1, 1])
    put(frame, "satin", brick(add(L.shockFront, v(s * 0.017, 0, 0)), 0.006, 0.04, 0.03, C.black));
  // The main pivot's boss and the bracket's shell (73 mm wide).
  put(
    frame,
    "paint",
    rod(add(L.pivot, v(-0.05, 0, 0)), add(L.pivot, v(0.05, 0, 0)), 0.026, C.frame, 14),
  );
  put(frame, "satin", rod(v(-0.042, 0, 0), v(0.042, 0, 0), 0.024, C.black, 14));
  put(
    frame,
    "paint",
    loft([v(0, 0.0, 0.0), v(0, 0.06, 0.02)], () => [0.04, 0.03], C.frame, { sides: 12 }),
  );
  // The chain guide: the bash guard over the ring and the top guide.
  put(frame, "satin", ring(DRIVE * 0.068, L.ring + 0.016, L.ring - 0.004, 0.005, C.black, 28));
  put(frame, "satin", brick(v(DRIVE * 0.056, 0.085, -0.03), 0.026, 0.02, 0.05, C.black));
  // The cable and hose runs along the down tube.
  put(
    frame,
    "rubber",
    loft(
      [
        add(dtFrom, v(0.03, 0.01, 0.02)),
        add(mix(dtFrom, dtTo, 0.5), v(0.036, 0, 0)),
        add(dtTo, v(0.03, 0.01, -0.03)),
        v(0.035, 0.05, -0.08),
      ],
      () => [0.0035, 0.0035],
      C.hose,
      { sides: 5 },
    ),
  );

  // ── THE STEERED SIDE ──────────────────────────────────────────────────
  const bars = node(NAMES.bars, frame, STEER_AT);
  const rel = (p: V3, o: V3): V3 => sub(p, o);
  const axleRest = frontAxle(0, 0);
  const legs = [-1, 1].map((s) => v(s * L.forkHalf, 0, 0));
  const footOf = (s: V3): V3 => rel(v(s.x, axleRest.y, axleRest.z), STEER_AT);
  const upAx = (p: V3, k: number): V3 => add(p, mul(STEER_AXIS, k));
  for (const s of legs) {
    const foot = footOf(s);
    const from = upAx(foot, L.lower.length - 0.06);
    const top = upAx(foot, L.lower.length + L.stanchion.length - 0.09);
    put(bars, "metal", rod(from, top, L.stanchion.r, C.gold, 14));
    put(bars, "satin", rod(top, upAx(top, 0.022), L.stanchion.r * 0.95, C.black, 12));
  }
  // The crown plates: forged, swept from the steerer to the legs.
  for (const c of [CROWN_TOP, CROWN_BOTTOM]) {
    const at = rel(c, STEER_AT);
    const ahead = footOf(O);
    const k = (at.y - ahead.y) / STEER_AXIS.y;
    const leg = add(ahead, mul(STEER_AXIS, k));
    for (const sx of [-1, 1])
      put(
        bars,
        "satin",
        loft(
          [
            v(0, at.y, at.z),
            v(sx * L.forkHalf * 0.6, (at.y + leg.y) / 2, (at.z + leg.z) / 2 + 0.005),
            v(sx * (L.forkHalf + 0.026), leg.y, leg.z),
          ],
          (t) => [0.016 - 0.004 * t, 0.024],
          C.black,
          { sides: 10, across: v(0, 1, 0) },
        ),
      );
    put(
      bars,
      "satin",
      rod(sub(at, mul(STEER_AXIS, 0.02)), add(at, mul(STEER_AXIS, 0.02)), 0.03, C.black, 14),
    );
  }
  // The stem (direct-mount, two bolts a side) and the riser bar.
  const crownTop = rel(CROWN_TOP, STEER_AT);
  const clamp = rel(BAR_MIDDLE, STEER_AT);
  const bar0 = sub(clamp, v(0, L.rise, 0));
  put(
    bars,
    "satin",
    loft(
      [add(crownTop, v(0, 0.012, -0.012)), mix(crownTop, bar0, 0.5), bar0],
      () => [0.03, 0.016],
      C.satin,
      { sides: 12, across: v(1, 0, 0) },
    ),
  );
  put(bars, "metal", rod(add(bar0, v(-0.03, 0, 0)), add(bar0, v(0.03, 0, 0)), 0.021, C.satin, 14));
  const [gl, gr] = GRIPS.map((g) => rel(g, STEER_AT));
  const end = (g: V3): V3 => v(g.x + Math.sign(g.x) * (L.grip / 2 + 0.004), g.y, g.z);
  const barPath = [
    end(gl),
    v(gl.x * 0.55, gl.y - 0.004, gl.z + 0.012),
    v(-0.1, bar0.y + 0.004, bar0.z + 0.004),
    v(-0.05, bar0.y, bar0.z),
    v(0.05, bar0.y, bar0.z),
    v(0.1, bar0.y + 0.004, bar0.z + 0.004),
    v(gr.x * 0.55, gr.y - 0.004, gr.z + 0.012),
    end(gr),
  ];
  put(
    bars,
    "satin",
    loft(
      barPath,
      (t) => {
        const r = 0.0112 + 0.0045 * Math.max(0, 1 - Math.abs(t - 0.5) * 5);
        return [r, r];
      },
      C.black,
      { sides: 10, steps: 4 },
    ),
  );
  for (const g of [gl, gr]) {
    const s = Math.sign(g.x);
    const inner = v(g.x - (s * L.grip) / 2, g.y, g.z);
    const outer = v(g.x + (s * L.grip) / 2, g.y, g.z);
    put(
      bars,
      "rubber",
      loft(
        [inner, outer],
        (t) => [
          0.0165 - 0.001 * Math.sin(t * Math.PI * 7) ** 2,
          0.0165 - 0.001 * Math.sin(t * Math.PI * 7) ** 2,
        ],
        C.rubber,
        { sides: 12, steps: 14 },
      ),
    );
    for (const e of [inner, outer])
      put(
        bars,
        "metal",
        rod(sub(e, v(s * 0.004, 0, 0)), add(e, v(s * 0.004, 0, 0)), 0.0175, C.satin, 12),
      );
    // The brake's master cylinder and its blade, reaching forward under the bar.
    const mc = v(g.x - s * 0.075, g.y + 0.012, g.z + 0.005);
    put(bars, "satin", brick(mc, 0.05, 0.022, 0.03, C.black));
    put(
      bars,
      "metal",
      loft(
        [
          v(mc.x + s * 0.02, mc.y - 0.005, mc.z + 0.012),
          v(mc.x + s * 0.05, mc.y - 0.022, mc.z + 0.05),
          v(mc.x + s * 0.085, mc.y - 0.03, mc.z + 0.052),
        ],
        () => [0.008, 0.004],
        C.alloy,
        { sides: 8, across: v(0, 1, 0) },
      ),
    );
  }
  // The shifter pod under the drive side's grip.
  const drv = DRIVE < 0 ? gl : gr;
  put(
    bars,
    "satin",
    brick(v(drv.x - DRIVE * -0.09, drv.y - 0.022, drv.z + 0.005), 0.03, 0.02, 0.035, C.black),
  );

  // ── THE FORK'S LOWERS and the front wheel ─────────────────────────────
  const fork = node(NAMES.fork, bars, O);
  for (const s of legs) {
    const foot = footOf(s);
    put(
      fork,
      "satin",
      loft(
        [
          sub(foot, mul(STEER_AXIS, 0.02)),
          upAx(foot, L.lower.length * 0.5),
          upAx(foot, L.lower.length),
        ],
        (t) => {
          const r = L.lower.r * (1.1 - 0.12 * t);
          return [r, r * 1.05];
        },
        C.black,
        { sides: 14, across: v(1, 0, 0) },
      ),
    );
    put(
      fork,
      "satin",
      rod(add(foot, v(s.x * 0.01, 0, 0)), add(foot, v(s.x * 0.025, 0, 0)), 0.02, C.satin, 10),
    );
    put(
      fork,
      "paint",
      rod(
        upAx(foot, L.lower.length * 0.42),
        upAx(foot, L.lower.length * 0.62),
        L.lower.r * 1.08,
        C.band,
        14,
      ),
    );
  }
  put(
    fork,
    "satin",
    loft(
      [
        upAx(footOf(legs[0]), 0.27),
        add(upAx(footOf(v(0, 0, 0)), 0.31), v(0, 0, 0.02)),
        upAx(footOf(legs[1]), 0.27),
      ],
      () => [0.014, 0.022],
      C.black,
      { sides: 10, across: v(0, 0, 1) },
    ),
  );
  const wheelF = node(NAMES.wheelF, fork, rel(axleRest, STEER_AT));
  wheel(wheelF, L.rimF, 0.1);
  // The front caliper, on the +x leg behind the rotor.
  const fc = footOf(legs[1]);
  put(
    fork,
    "satin",
    brick(
      v(-DRIVE * 0.062, fc.y + 0.075, fc.z - 0.06),
      0.03,
      0.07,
      0.045,
      C.black,
      new THREE.Euler(-0.8, 0, 0),
    ),
  );
  put(
    fork,
    "rubber",
    loft(
      [
        v(-DRIVE * 0.07, fc.y + 0.11, fc.z - 0.07),
        upAx(v(-DRIVE * 0.1, fc.y, fc.z - 0.06), 0.45),
        v(-DRIVE * 0.06, crownTop.y + 0.02, crownTop.z + 0.08),
      ],
      () => [0.0035, 0.0035],
      C.hose,
      { sides: 5 },
    ),
  );

  // ── THE SWINGARM and the rear wheel ───────────────────────────────────
  const swing = node(NAMES.swingarm, frame, L.pivot);
  const axle = rel(REAR_REST, L.pivot);
  const rocker = rel(L.shockRear, L.pivot);
  for (const s of [-1, 1]) {
    const x = s * 0.062;
    // Chainstays: tall boxes out to the dropout.
    put(
      swing,
      "paint",
      loft(
        [
          v(s * 0.04, 0, 0.01),
          v(s * 0.055, axle.y * 0.5 - 0.01, axle.z * 0.5),
          v(x, axle.y, axle.z + 0.03),
        ],
        (t) => [0.01, 0.026 - 0.01 * t],
        C.frame,
        { sides: 12, across: v(1, 0, 0) },
      ),
    );
    // Seatstays up to the rocker plates.
    put(
      swing,
      "paint",
      loft(
        [
          v(x, axle.y + 0.01, axle.z + 0.01),
          v(s * 0.05, (axle.y + rocker.y) * 0.55, (axle.z + rocker.z) * 0.5 - 0.02),
          v(s * 0.028, rocker.y - 0.01, rocker.z - 0.035),
        ],
        (t) => [0.009, 0.017 + 0.005 * t],
        C.frame,
        { sides: 12, across: v(1, 0, 0) },
      ),
    );
    // The dropout plate and the axle's nut.
    put(
      swing,
      "satin",
      loft(
        [v(x, axle.y + 0.03, axle.z + 0.02), v(x, axle.y - 0.015, axle.z - 0.01)],
        () => [0.004, 0.026],
        C.black,
        { sides: 8, across: v(1, 0, 0) },
      ),
    );
    put(
      swing,
      "metal",
      rod(v(s * 0.066, axle.y, axle.z), v(s * 0.078, axle.y, axle.z), 0.012, C.alloy, 8),
    );
    // The rocker plates either side of the shock's rear eye.
    put(
      swing,
      "paint",
      loft(
        [
          v(s * 0.02, 0.02, 0.0),
          v(s * 0.024, rocker.y * 0.6, rocker.z - 0.01),
          v(s * 0.02, rocker.y, rocker.z),
        ],
        () => [0.005, 0.024],
        C.frame,
        { sides: 8, across: v(1, 0, 0) },
      ),
    );
  }
  put(
    swing,
    "satin",
    rod(v(-0.03, rocker.y, rocker.z), v(0.03, rocker.y, rocker.z), 0.009, C.black, 10),
  );
  put(
    swing,
    "paint",
    loft(
      [v(0, axle.y * 0.2, axle.z * 0.2 + 0.02), v(0, axle.y * 0.25 + 0.03, axle.z * 0.25)],
      () => [0.06, 0.012],
      C.frame,
      { sides: 10 },
    ),
  );
  // The chain's two runs, link by link, and the derailleur's cage.
  const ringAt = rel(v(DRIVE * 0.058, 0, 0), L.pivot);
  for (const s of [1, -1]) {
    const a = v(ringAt.x, ringAt.y + s * L.ring, ringAt.z);
    const b = v(ringAt.x + DRIVE * 0.01, axle.y + s * L.cog, axle.z);
    const n = 46;
    for (let i = 0; i < n; i++) {
      const p = mix(a, b, (i + 0.5) / n);
      const d = sub(b, a);
      const turn = new THREE.Euler(-Math.atan2(d.y, d.z), 0, 0);
      put(
        swing,
        "metal",
        brick(p, i % 2 ? 0.006 : 0.004, 0.008, 0.012, i % 2 ? C.alloy : C.satin, turn),
      );
    }
  }
  const der = v(DRIVE * 0.075, axle.y - 0.06, axle.z + 0.01);
  put(swing, "satin", brick(der, 0.012, 0.075, 0.03, C.black));
  for (const k of [-1, 1])
    put(
      swing,
      "satin",
      ring(der.x, 0.011, 0, 0.006, C.satin, 12).translate(0, der.y + k * 0.03, der.z),
    );
  put(
    swing,
    "satin",
    brick(v(DRIVE * 0.08, axle.y + 0.015, axle.z - 0.01), 0.02, 0.04, 0.03, C.black),
  );
  // The rear caliper on the +x stay, over the rotor.
  put(
    swing,
    "satin",
    brick(
      v(-DRIVE * 0.068, axle.y + 0.08, axle.z + 0.03),
      0.028,
      0.045,
      0.065,
      C.black,
      new THREE.Euler(0.4, 0, 0),
    ),
  );
  const wheelR = node(NAMES.wheelR, swing, axle);
  wheel(wheelR, L.rimR, 0.1);
  // The cassette's seven cogs on the drive side.
  for (let i = 0; i < 7; i++)
    put(
      wheelR,
      "metal",
      ring(DRIVE * (0.035 + i * 0.0035), L.cog - i * 0.004, 0.012, 0.0018, C.alloy, 20),
    );

  // ── THE SHOCK, built along +z from its front eye ──────────────────────
  const shock = node(NAMES.shock, frame, L.shockFront);
  const S = SHOCK_REST;
  put(shock, "metal", rod(v(0, 0, 0), v(0, 0, S * 0.58), 0.021, C.satin, 14));
  put(shock, "satin", rod(v(0, 0.028, 0.03), v(0, 0.028, S * 0.4), 0.017, C.black, 12));
  put(shock, "metal", rod(v(0, 0, S * 0.52), v(0, 0, S), 0.0085, C.alloy, 10));
  put(shock, "satin", rod(v(-0.012, 0, 0), v(0.012, 0, 0), 0.01, C.black, 8));
  put(shock, "satin", rod(v(-0.012, 0, S), v(0.012, 0, S), 0.01, C.black, 8));
  // The coil, a true helix between its seats.
  const turns = 8;
  const helix: V3[] = [];
  for (let i = 0; i <= turns * 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    helix.push(
      v(
        Math.cos(a) * L.shock.coil,
        Math.sin(a) * L.shock.coil,
        S * (0.18 + (0.72 * i) / (turns * 12)),
      ),
    );
  }
  put(
    shock,
    "paint",
    loft(helix, () => [0.0045, 0.0045], C.coil, { sides: 6, steps: 1 }),
  );
  put(
    shock,
    "satin",
    ring(0, 0.034, 0.01, 0.006, C.black)
      .rotateY(Math.PI / 2)
      .translate(0, 0, S * 0.17),
  );

  // ── THE CRANKS, the ring and the pedals ───────────────────────────────
  const cranks = node(NAMES.cranks, frame, O);
  put(cranks, "satin", ring(DRIVE * 0.058, L.ring, L.ring - 0.02, 0.004, C.black, 34));
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2;
    put(
      cranks,
      "satin",
      brick(
        v(DRIVE * 0.058, Math.cos(a) * (L.ring + 0.003), Math.sin(a) * (L.ring + 0.003)),
        0.003,
        0.006,
        0.005,
        C.satin,
        new THREE.Euler(-a, 0, 0),
      ),
    );
  }
  put(cranks, "metal", rod(v(-0.07, 0, 0), v(0.07, 0, 0), 0.012, C.satin, 10));
  const pedals: THREE.Group[] = [];
  for (const i of [0, 1]) {
    const s = i ? 1 : -1;
    const dir = i ? -1 : 1;
    const tip = v(s * 0.078, 0, dir * L.crank);
    put(
      cranks,
      "metal",
      loft(
        [v(s * 0.068, 0, 0), v(s * 0.075, 0, dir * L.crank * 0.5), tip],
        (t) => [0.009, 0.019 - 0.006 * t],
        C.satin,
        { sides: 10, across: v(1, 0, 0) },
      ),
    );
    const pedal = node(i ? NAMES.pedalR : NAMES.pedalL, cranks, v(s * L.q, 0, tip.z));
    put(pedal, "metal", rod(v(-s * (L.q - 0.078), 0, 0), v(-s * 0.02, 0, 0), 0.007, C.alloy, 8));
    // A flat platform, concave, with pins along both faces.
    const P = L.pedal;
    put(
      pedal,
      "satin",
      loft(
        [v(-P.width / 2, 0, 0), v(P.width / 2, 0, 0)],
        () => [P.length / 2, P.thick / 2],
        C.black,
        {
          sides: 4,
          across: v(0, 0, 1),
          outline: (a) => 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))),
        },
      ),
    );
    for (const y of [-1, 1])
      for (const px of [-0.4, 0, 0.4])
        for (const pz of [-0.42, 0.42])
          put(
            pedal,
            "metal",
            rod(
              v(px * P.width, (y * P.thick) / 2, pz * P.length),
              v(px * P.width, y * (P.thick / 2 + 0.005), pz * P.length),
              0.0018,
              C.alloy,
              4,
            ),
          );
    pedals.push(pedal);
  }

  /** A WHEEL about +x at the node's origin: hub and flanges, laced spokes,
   * a box rim, a knobbly tyre and its rotor on the +x (non-drive) side. */
  function wheel(at: THREE.Object3D, rim: number, rotor: number): void {
    const tyreR = rim + L.tyre * 0.55;
    // The tyre: a fat torus of a section a little squarer than round.
    const circle = (r: number, x: number, n = 72): V3[] => {
      const out: V3[] = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        out.push(v(x, Math.cos(a) * r, Math.sin(a) * r));
      }
      return out;
    };
    put(
      at,
      "rubber",
      loft(circle(tyreR, 0), () => [L.tyre * 0.5, L.tyre * 0.55], C.rubber, {
        sides: 14,
        steps: 1,
        caps: false,
        across: v(1, 0, 0),
        outline: (a) => 1 + 0.08 * Math.cos(2 * a) ** 2,
      }),
    );
    // The knobs: a centre pair and a shoulder row, staggered round it.
    const rows = 40;
    for (let i = 0; i < rows; i++) {
      const a = (i / rows) * Math.PI * 2;
      const e = new THREE.Euler(-a, 0, 0);
      const r0 = tyreR + L.tyre * 0.55;
      const place = (x: number, rr: number): V3 => v(x, Math.cos(a) * rr, Math.sin(a) * rr);
      if (i % 2) put(at, "rubber", brick(place(0, r0 + 0.002), 0.03, 0.007, 0.014, C.rubber, e));
      else
        for (const s of [-1, 1])
          put(at, "rubber", brick(place(s * 0.012, r0 + 0.002), 0.012, 0.007, 0.012, C.rubber, e));
      for (const s of [-1, 1]) {
        const k = new THREE.Euler(-a, 0, s * 0.7);
        put(
          at,
          "rubber",
          brick(place(s * L.tyre * 0.47, tyreR + L.tyre * 0.38), 0.012, 0.008, 0.016, C.rubber, k),
        );
      }
    }
    // The rim: a box section, black, with its seam.
    put(
      at,
      "satin",
      loft(circle(rim - 0.008, 0), () => [0.016, 0.012], C.black, {
        sides: 8,
        steps: 1,
        caps: false,
        across: v(1, 0, 0),
      }),
    );
    // The hub, its flanges and 32 spokes laced two-cross.
    put(at, "metal", rod(v(-0.07, 0, 0), v(0.07, 0, 0), L.hub * 0.6, C.satin, 12));
    put(at, "metal", rod(v(-0.03, 0, 0), v(0.03, 0, 0), L.hub, C.satin, 14));
    for (const s of [-1, 1]) put(at, "metal", ring(s * 0.035, 0.03, 0.006, 0.004, C.satin, 18));
    for (let i = 0; i < L.spokes; i++) {
      const a = (i / L.spokes) * Math.PI * 2;
      const s = i % 2 ? 1 : -1;
      const lead = (i % 4 < 2 ? 1 : -1) * 0.5;
      put(
        at,
        "metal",
        rod(
          v(s * 0.035, Math.cos(a + lead) * 0.026, Math.sin(a + lead) * 0.026),
          v(s * 0.006, Math.cos(a) * (rim - 0.016), Math.sin(a) * (rim - 0.016)),
          0.0012,
          C.alloy,
          3,
        ),
      );
    }
    // The rotor on its spider.
    const rx = -DRIVE * 0.052;
    put(at, "metal", ring(rx, rotor, rotor - 0.018, 0.002, C.alloy, 36));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      put(
        at,
        "metal",
        rod(
          v(rx, Math.cos(a) * 0.026, Math.sin(a) * 0.026),
          v(rx, Math.cos(a + 0.3) * (rotor - 0.012), Math.sin(a + 0.3) * (rotor - 0.012)),
          0.0035,
          C.satin,
          4,
        ),
      );
    }
    put(at, "satin", blob(v(rx, 0, 0), v(0.004, 0.028, 0.028), C.satin, 12, 6));
  }

  const geos: THREE.BufferGeometry[] = [];
  for (const [n, by] of parts) {
    for (const [f, list] of by) {
      const g = mergeGeometries(list, false);
      for (const l of list) l.dispose();
      if (!g) continue;
      geos.push(g);
      const mesh = new THREE.Mesh(g, M[f]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      n.add(mesh);
    }
  }
  return {
    root,
    nodes: {
      frame,
      bars,
      fork,
      wheelF,
      swingarm: swing,
      wheelR,
      shock,
      cranks,
      pedalL: pedals[0],
      pedalR: pedals[1],
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
