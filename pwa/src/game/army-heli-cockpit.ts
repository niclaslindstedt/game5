// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY HELICOPTER'S FLIGHT DECK AS DRAWN — what the COCKPIT lens
// (`camera-heli.ts`'s HELMET rung on the army's machine) sees from the
// right seat once he has taken it, laid out by `army-cockpit-plan.ts` and
// painted by `army-heli-paint.ts`:
//
//   * THE CABIN'S INSIDE is the Blender model's own skin turned inside out
//     (`cockpit-shroud.ts`' `cabinOf`): its opaque panels copied in and
//     drawn from in here, every window — the windscreen's panes, the chin
//     windows, the roof windows, the crew doors' — exactly where the
//     outside has it, the glass clear (the outside's dark glass put away
//     while the eye is inside), each pane in its black seal;
//   * THE PANEL under its glareshield: both pilots' flight instruments, the
//     engines' vertical tapes and the caution panel between them; on the
//     glareshield the engines' emergency-off T-handles and the fire
//     extinguisher's switch, a master caution light before each seat;
//   * THE LOWER CONSOLE between the seats, its radios and computers, and
//     THE UPPER CONSOLE over the pilots' heads with the quadrant's power
//     and fuel levers, the rotor brake's handle, the switches and breakers;
//   * TWO ARMOURED SEATS with their side armour and harnesses;
//   * EACH PILOT'S CONTROLS, moving with the machine's own
//     (`HeliState.controls`): the cyclics swung, the collectives raised,
//     the pedals pushed — and HIM in the right seat in his ski jacket, his
//     right hand round the cyclic's grip, his left on the collective, his
//     feet on the pedals (`seated-figure.ts`).
//
// Built once, when the model arrives, as a child of the machine — so it
// moves with the drawing exactly — and shown only while the eye is in the
// deck. Presentation only: it reads `GameState.heli` and writes nothing.

import * as THREE from "three";
import type { HeliState, Level } from "@engine";

import {
  ARMY_COCKPIT as C,
  COPILOT,
  deckCollective,
  deckCyclic,
  deckPedals,
  deckPose,
  PILOT,
  seatX,
} from "./army-cockpit-plan.ts";
import {
  ARMY_CONSOLE_H,
  ARMY_CONSOLE_W,
  ARMY_OVERHEAD_H,
  ARMY_OVERHEAD_W,
  ARMY_PANEL_H,
  ARMY_PANEL_W,
  paintArmyConsole,
  paintArmyOverhead,
  paintArmyPanelBack,
  paintArmyPanelLive,
} from "./army-heli-paint.ts";
import { CabKit, quad } from "./cab-kit.ts";
import { gaugesOf } from "./cockpit-plan.ts";
import { cabinOf, sealGeometry } from "./cockpit-shroud.ts";
import type { HazeUniforms } from "./haze.ts";
import { createSeatedFigure } from "./seated-figure.ts";

type V3 = { x: number; y: number; z: number };

/** How often the panel's faces are painted again, Hz. */
const PAINT_HZ = 15;
/** His kit (`seated-figure.ts`): the red shell he skis in, black trousers,
 * a black helmet, the skis' slot unused, a blue accent, the skin, brown
 * hair, the shell again. */
const KIT = [0, 16, 25, 33, 1, 40, 45, 0];

export type ArmyDeck = {
  group: THREE.Group;
  /** Whether the eye is in the deck (the deck shown, the outside's glass
   * put away), and whether it is his own (his head drawn in). */
  show(on: boolean, own: boolean): void;
  /** One frame of the controls and the faces off the machine. */
  update(h: HeliState, level: Level, t: number, dt: number): void;
  dispose(): void;
};

export function createArmyDeck(
  model: THREE.Object3D | null,
  toMachine: (m: THREE.Mesh) => THREE.Matrix4,
  haze: HazeUniforms,
): ArmyDeck {
  const group = new THREE.Group();
  group.name = "army_deck";
  // Everything laid out in the deck's own frame (x to the right as seen)
  // under a mirror into the engine's body frame; the cabin's inside, copied
  // off the model, is in the body frame already.
  const room = new THREE.Group();
  room.scale.x = -1;
  group.add(room);
  const kit = new CabKit(haze, "army");
  const ds = THREE.DoubleSide;
  const black = kit.std({ color: 0x121313, roughness: 0.75 });
  const grey = kit.std({ color: 0x2b2e2e, roughness: 0.8 });
  const panelGrey = kit.std({ color: 0x24282a, roughness: 0.85, side: ds });
  const satin = kit.std({ color: 0x2a2c30, roughness: 0.55, metalness: 0.35 });
  const steel = kit.std({ color: 0x8d9096, roughness: 0.35, metalness: 0.8 });
  const rubber = kit.std({ color: 0x0b0b0c, roughness: 0.8 });
  const armourMat = kit.std({ color: 0x3c4038, roughness: 0.6, metalness: 0.25 });
  const cushion = kit.std({ color: 0x3f4632, roughness: 0.95 });
  const strap = kit.std({ color: 0x4a4f3c, roughness: 0.85 });
  const red = kit.std({ color: 0xc0231b, roughness: 0.45 });
  const yellow = kit.std({ color: 0xd8a518, roughness: 0.5 });
  const lit = kit.std({ color: 0x5a4a14, emissive: 0xf4b41c, emissiveIntensity: 0.0, roughness: 0.5 });

  // THE CABIN'S INSIDE off the model's skin; the glass from in here.
  const outsideGlass: THREE.Mesh[] = [];
  if (model) {
    model.traverse((o) => {
      if (o instanceof THREE.Mesh && /^glass/i.test((o.material as THREE.Material).name ?? ""))
        outsideGlass.push(o);
    });
    const cabin = cabinOf(model, toMachine, C.room);
    const seals = sealGeometry(cabin.glass);
    if (seals) kit.mesh(seals, kit.std({ color: 0x1c1d20, roughness: 0.7, side: ds }), group);
    if (cabin.liner) {
      // Drawn both ways: the model reaches the machine under a mirror, so
      // the copy's winding is the skin's turned over.
      const m = kit.std({ vertexColors: true, roughness: 0.92, side: ds });
      kit.mesh(cabin.liner, m, group).castShadow = false;
    }
    if (cabin.glass) {
      const pane = kit.mesh(cabin.glass, kit.glass(), group);
      pane.renderOrder = 4;
      pane.castShadow = false;
    }
  }

  // THE PANEL: its face painted, leant back; its back box behind it.
  const P = C.panel;
  const rise = P.top - P.bottom;
  const zTop = P.z + rise * Math.tan(P.lean);
  const face = kit.canvas(ARMY_PANEL_W, ARMY_PANEL_H);
  const back = document.createElement("canvas");
  back.width = ARMY_PANEL_W;
  back.height = ARMY_PANEL_H;
  paintArmyPanelBack(back.getContext("2d")!);
  face.ctx.drawImage(back, 0, 0);
  kit.mesh(
    quad(
      { x: -P.half, y: P.bottom, z: P.z },
      { x: P.half, y: P.bottom, z: P.z },
      { x: P.half, y: P.top, z: zTop },
      { x: -P.half, y: P.top, z: zTop },
    ),
    kit.face(face.texture, 0.3),
    room,
  );
  kit.box(P.half * 2 + 0.04, rise + 0.04, 0.3, { x: 0, y: (P.top + P.bottom) / 2, z: zTop + 0.16 }, grey, room);
  // THE GLARESHIELD over it: its top and the hood's lip toward the pilots;
  // under the panel the knee panels either side of the console.
  const G = C.glare;
  kit.mesh(
    quad(
      { x: -P.half - 0.02, y: P.top + 0.03, z: zTop - G.over },
      { x: P.half + 0.02, y: P.top + 0.03, z: zTop - G.over },
      { x: P.half - 0.1, y: G.top, z: G.reach },
      { x: -P.half + 0.1, y: G.top, z: G.reach },
    ),
    panelGrey,
    room,
  );
  kit.rod(
    { x: -P.half - 0.02, y: P.top + 0.02, z: zTop - G.over },
    { x: P.half + 0.02, y: P.top + 0.02, z: zTop - G.over },
    0.025,
    rubber,
    room,
    10,
  );
  for (const s of [-1, 1])
    kit.mesh(
      quad(
        { x: s * C.console.half, y: P.bottom, z: P.z },
        { x: s * (P.half - 0.02), y: P.bottom, z: P.z },
        { x: s * (P.half - 0.06), y: P.bottom - 0.08, z: P.z + 0.15 },
        { x: s * C.console.half, y: P.bottom - 0.08, z: P.z + 0.15 },
      ),
      panelGrey,
      room,
    );
  // On the glareshield's middle: the two engines' emergency-off T-handles
  // and the extinguisher's switch between them; the master caution lights.
  for (const s of [-1, 1]) {
    const at = { x: s * 0.09, y: P.top + 0.06, z: zTop - G.over + 0.06 };
    kit.box(0.08, 0.035, 0.05, at, black, room, 0.008);
    kit.rod(at, { x: at.x, y: at.y + 0.02, z: at.z - 0.05 }, 0.007, steel, room, 6);
    kit.box(0.09, 0.022, 0.026, { x: at.x, y: at.y + 0.022, z: at.z - 0.06 }, red, room, 0.008);
  }
  kit.box(0.05, 0.03, 0.05, { x: 0, y: P.top + 0.06, z: zTop - G.over + 0.06 }, black, room, 0.006);
  kit.rod({ x: 0, y: P.top + 0.075, z: zTop - G.over + 0.05 }, { x: 0, y: P.top + 0.105, z: zTop - G.over + 0.04 }, 0.004, steel, room, 6);
  const masters = [PILOT, COPILOT].map((s) =>
    kit.box(0.07, 0.03, 0.02, { x: seatX(s), y: P.top + 0.045, z: zTop - G.over + 0.005 }, lit, room, 0.004),
  );

  // THE LOWER CONSOLE: its body and its painted top, the console's face
  // from the bulkhead to the panel.
  const K = C.console;
  const floor = C.room.floor;
  kit.box(K.half * 2, K.top - floor, K.to - K.from, { x: 0, y: (K.top + floor) / 2, z: (K.from + K.to) / 2 }, grey, room);
  const consoleFace = kit.canvas(ARMY_CONSOLE_W, ARMY_CONSOLE_H);
  paintArmyConsole(consoleFace.ctx, true);
  kit.mesh(
    quad(
      { x: -K.half + 0.01, y: K.top + 0.003, z: K.from },
      { x: K.half - 0.01, y: K.top + 0.003, z: K.from },
      { x: K.half - 0.01, y: K.top + 0.003, z: K.to },
      { x: -K.half + 0.01, y: K.top + 0.003, z: K.to },
    ),
    kit.face(consoleFace.texture, 0.25),
    room,
  );

  // THE UPPER CONSOLE hanging from the roof: its body, its painted face,
  // the quadrant's levers, the rotor brake's handle.
  const O = C.overhead;
  kit.box(O.half * 2, 0.12, O.to - O.from, { x: 0, y: O.y + 0.06, z: (O.from + O.to) / 2 }, grey, room);
  const over = kit.canvas(ARMY_OVERHEAD_W, ARMY_OVERHEAD_H);
  paintArmyOverhead(over.ctx);
  kit.mesh(
    quad(
      { x: O.half - 0.01, y: O.y - 0.002, z: O.from },
      { x: -O.half + 0.01, y: O.y - 0.002, z: O.from },
      { x: -O.half + 0.01, y: O.y - 0.002, z: O.to },
      { x: O.half - 0.01, y: O.y - 0.002, z: O.to },
    ),
    kit.face(over.texture, 0.2),
    room,
  );
  // The power levers (the engines' #1 and #2) and the fuel levers beside
  // them in the quadrant's forward end, pushed to FLY.
  const quadrantZ = O.to - 0.16;
  [-0.09, -0.035, 0.035, 0.09].forEach((x, i) => {
    const fuel = i === 0 || i === 3;
    const root = { x, y: O.y, z: quadrantZ };
    const tip = { x, y: O.y - 0.11, z: quadrantZ + 0.07 };
    kit.rod(root, tip, 0.007, steel, room, 6);
    kit.box(0.03, 0.025, 0.04, tip, fuel ? red : black, room, 0.008);
  });
  // The rotor brake's handle, stowed.
  kit.rod({ x: -0.2, y: O.y, z: O.from + 0.18 }, { x: -0.2, y: O.y - 0.09, z: O.from + 0.24 }, 0.009, steel, room, 6);
  kit.box(0.05, 0.022, 0.03, { x: -0.2, y: O.y - 0.1, z: O.from + 0.25 }, yellow, room, 0.008);

  // TWO ARMOURED SEATS: the bucket (the pan and the back), the side armour
  // panels outboard, the headrest, the harness.
  const S = C.seat;
  for (const side of [PILOT, COPILOT]) {
    const x = seatX(side);
    const depth = S.front - S.back;
    kit.box(S.width, 0.1, depth, { x, y: S.top - 0.05, z: (S.front + S.back) / 2 }, cushion, room, 0.04);
    kit.box(S.width + 0.06, 0.05, depth + 0.04, { x, y: S.top - 0.12, z: (S.front + S.back) / 2 }, armourMat, room, 0.015);
    const seatBack = new THREE.Group();
    seatBack.position.set(x, S.top, S.back);
    seatBack.rotation.x = -S.lean;
    room.add(seatBack);
    kit.box(S.width - 0.04, S.tall, 0.09, { x: 0, y: S.tall / 2, z: 0.0 }, cushion, seatBack, 0.04);
    kit.box(S.width + 0.06, S.tall + 0.06, 0.04, { x: 0, y: S.tall / 2, z: -0.07 }, armourMat, seatBack, 0.012);
    kit.box(0.24, 0.16, 0.08, { x: 0, y: S.tall + 0.08, z: -0.01 }, cushion, seatBack, 0.03);
    // The bucket's wings either side.
    for (const b of [-1, 1])
      kit.box(0.04, S.tall * 0.8, 0.14, { x: b * (S.width / 2 + 0.01), y: S.tall * 0.42, z: 0.02 }, armourMat, seatBack, 0.01);
    // The sliding side armour, outboard, run forward.
    const out = side;
    kit.box(0.03, C.armour.up + 0.2, depth + C.armour.ahead * 0.4, { x: x + out * (S.width / 2 + 0.07), y: S.top + C.armour.up / 2 - 0.05, z: S.back + (depth + C.armour.ahead * 0.4) / 2 }, armourMat, room, 0.01);
    // The pan's legs to the floor.
    for (const fz of [S.back + 0.05, S.front - 0.06])
      for (const b of [-1, 1])
        kit.rod({ x: x + b * (S.width / 2 - 0.06), y: floor, z: fz }, { x: x + b * (S.width / 2 - 0.06), y: S.top - 0.15, z: fz }, 0.016, steel, room, 8);
    // The harness on the empty co-pilot's seat: the shoulder straps down
    // the back and over the pan, the lap belt and its buckle.
    if (side === COPILOT) {
      for (const b of [-1, 1]) {
        kit.box(0.045, 0.006, depth * 0.85, { x: x + b * 0.09, y: S.top + 0.004, z: (S.front + S.back) / 2 }, strap, room);
        kit.box(0.045, S.tall * 0.8, 0.006, { x: b * 0.09, y: S.tall * 0.45, z: 0.05 }, strap, seatBack);
      }
      kit.box(0.08, 0.012, 0.06, { x, y: S.top + 0.012, z: S.front - 0.16 }, steel, room, 0.004);
    }
  }

  // EACH PILOT'S CONTROLS: the cyclic (its boot, the stick, its grip and
  // buttons), the collective (the lever, its switch box), the pedals.
  const Y = C.cyclic;
  const L = C.collective;
  const E = C.pedals;
  const up = new THREE.Vector3(0, 1, 0);
  const controls = [PILOT, COPILOT].map((side) => {
    const x = seatX(side);
    const cyclic = new THREE.Group();
    cyclic.position.set(x, Y.y, Y.z);
    room.add(cyclic);
    kit.rod({ x: 0, y: 0, z: 0 }, { x: 0, y: Y.length * 0.6, z: -0.03 }, 0.014, satin, cyclic);
    kit.rod({ x: 0, y: Y.length * 0.6, z: -0.03 }, { x: 0, y: Y.length, z: 0 }, 0.012, satin, cyclic);
    kit.mesh(new THREE.ConeGeometry(0.075, 0.13, 12, 1, true), rubber, cyclic).position.y = 0.04;
    kit.rod({ x: 0, y: Y.length, z: 0 }, { x: 0, y: Y.length + Y.grip, z: 0.015 }, 0.022, rubber, cyclic, 12);
    kit.box(0.055, 0.035, 0.045, { x: 0, y: Y.length + Y.grip + 0.01, z: 0.02 }, satin, cyclic, 0.008);
    kit.box(0.012, 0.012, 0.012, { x: 0.012, y: Y.length + Y.grip + 0.035, z: 0.032 }, red, cyclic);
    kit.box(0.014, 0.02, 0.012, { x: -0.022, y: Y.length + Y.grip - 0.02, z: 0.034 }, satin, cyclic);
    const collective = new THREE.Group();
    collective.position.set(x + L.off, L.y, L.z);
    room.add(collective);
    kit.rod({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: L.length - 0.16 }, 0.017, satin, collective);
    kit.box(0.05, 0.05, 0.06, { x: 0, y: 0, z: 0 }, satin, collective);
    kit.rod({ x: 0, y: 0, z: L.length - 0.17 }, { x: 0, y: 0, z: L.length - 0.03 }, 0.024, rubber, collective, 12);
    kit.box(0.07, 0.055, 0.08, { x: 0, y: 0.012, z: L.length + 0.01 }, black, collective, 0.01);
    kit.box(0.012, 0.012, 0.012, { x: -0.016, y: 0.045, z: L.length + 0.02 }, yellow, collective);
    kit.box(0.012, 0.012, 0.012, { x: 0.016, y: 0.045, z: L.length - 0.005 }, yellow, collective);
    kit.box(0.09, 0.04, 0.18, { x: x + L.off, y: floor + 0.11, z: L.z + 0.03 }, rubber, room, 0.01);
    const pedals = [-1, 1].map((b) => {
      const g = new THREE.Group();
      g.position.set(x + b * E.gap, E.y, E.z);
      room.add(g);
      const plate = kit.box(0.1, 0.18, 0.016, { x: 0, y: 0.06, z: 0 }, rubber, g, 0.006);
      plate.rotation.x = -0.35;
      kit.rod({ x: 0, y: 0.12, z: 0.03 }, { x: 0, y: 0.36, z: 0.13 }, 0.011, steel, g, 6);
      return g;
    });
    return { side, cyclic, collective, pedals };
  });

  // HIM in the right seat.
  const Pi = C.pilot;
  const pilot = createSeatedFigure(
    haze,
    {
      x: seatX(PILOT),
      left: -1,
      eye: C.eye,
      shoulder: Pi.shoulder,
      hip: Pi.hip,
      upperArm: Pi.upperArm,
      forearm: Pi.forearm,
      thigh: Pi.thigh,
      shin: Pi.shin,
    },
    KIT,
    "army_pilot",
  );
  room.add(pilot.group);

  const a = new THREE.Vector3();
  let own = false;
  /** Pose both sets of controls and him on his. */
  const pose = (h: HeliState): void => {
    const cp = deckPose(h.controls);
    for (const c of controls) {
      const cyc = deckCyclic(cp, c.side);
      a.set(cyc.x - seatX(c.side), cyc.y - Y.y, cyc.z - Y.z).normalize();
      c.cyclic.quaternion.setFromUnitVectors(up, a);
      c.collective.rotation.x = -cp.collective;
      const [pl, pr] = deckPedals(cp, c.side);
      c.pedals[0].position.z = pl.z;
      c.pedals[1].position.z = pr.z;
    }
    const cyc = deckCyclic(cp, PILOT);
    const col = deckCollective(cp, PILOT);
    const [pl, pr] = deckPedals(cp, PILOT);
    const foot = (p: V3): V3 => ({ x: p.x, y: p.y + 0.02, z: p.z - 0.02 });
    pilot.pose(
      { x: col.x, y: col.y + 0.03, z: col.z - 0.01 },
      { x: cyc.x + 0.01, y: cyc.y - 0.01, z: cyc.z - 0.035 },
      [foot(pl), foot(pr)],
      own,
    );
  };

  let inside = false;
  let paintDebt = 0;
  group.visible = false;
  return {
    group,
    show(on, pilotEye) {
      inside = on;
      own = pilotEye;
      group.visible = on;
      for (const g of outsideGlass) g.visible = !on;
    },
    update(h, level, t, dt) {
      if (!inside) return;
      pose(h);
      paintDebt -= dt;
      if (paintDebt > 0) return;
      paintDebt = 1 / PAINT_HZ;
      const g = gaugesOf(h, level.groundAt(h.x, h.z), t);
      paintArmyPanelLive(face.ctx, back, g);
      face.texture.needsUpdate = true;
      const warn = g.live && g.lowRotor;
      for (const m of masters) (m.material as THREE.MeshStandardMaterial).emissiveIntensity = warn ? 1.2 : 0;
    },
    dispose() {
      pilot.dispose();
      kit.dispose();
    },
  };
}
