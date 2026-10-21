// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TANK'S DRIVER'S STATION AS DRAWN — what the HELMET rung sees of a
// tank he took from the army, hatch down (`tank-station-plan.ts`' driver,
// painted by `tank-paint.ts`), built in code in the hull's frame on the cab
// bench (`cab-kit.ts`, `cab-parts.ts`):
//
//   * THE COMPARTMENT under the deck in the hull's front: the floor's plate
//     and its escape hatch, the walls in a light paint (a crew's inside is
//     painted pale to see by), the deck's underside over him with the
//     hatch's lid, its handle and its locking lever, the glacis's slope in
//     front of his feet, the bulkhead behind his seat; the cables in their
//     clips, the stowage on his right, a hand grip;
//   * THE VISION BLOCKS: three periscopes in an arc in the hatch's rim, their
//     lower windows in rubber seals with a brow pad over the middle one —
//     the world seen through them (the hull's shell from outside put away
//     while the eye is in here, `army-vehicle-view.ts`) and the gun over
//     his head when the turret faces forward;
//   * THE T-BAR on its column, its grips twisting with the throttle, the
//     transmission's selector on its middle; the broad brake pedal and his
//     left foot's rest; the parking brake's handle;
//   * HIS DISPLAY and the switch panel on his left, the master switch, the
//     fixed extinguisher's pull and a hand extinguisher;
//   * THE SEAT, reclined, and HIM in it (`seated-figure.ts`), his hands on
//     the grips and his right foot on the brake.
//
// Built with the world on a ride that carries the army (every program
// linked behind the loading card), hung in his tank's hull as drawn and
// shown only while the lens is the driver's eye. Presentation only.

import * as THREE from "three";
import { ARMOUR, type ArmourRide } from "@engine";

import { CabKit, quad } from "./cab-kit.ts";
import { buildExtinguisher, buildPedal, buildSeat, wallAt } from "./cab-parts.ts";
import type { CarrierCab } from "./carrier-cab.ts";
import type { HazeUniforms } from "./haze.ts";
import { createSeatedFigure } from "./seated-figure.ts";
import { handsOnYoke, TANK_DRIVER as C, tankGauges, yokePose } from "./tank-station-plan.ts";
import { paintDriverDisplay, paintDriverPanel } from "./tank-paint.ts";

type V3 = { x: number; y: number; z: number };

/** How often the display is painted again, Hz. */
const PAINT_HZ = 10;
/** px a metre on the faces. */
const PX = 1800;
/** His kit (`seated-figure.ts`): the carrier's driver's. */
const KIT = [0, 16, 25, 33, 1, 40, 45, 0];

export type TankDriver = CarrierCab;

export function createTankDriver(haze: HazeUniforms): TankDriver {
  const group = new THREE.Group();
  group.name = "tank_driver";
  group.visible = false;
  const kit = new CabKit(haze, "tank-driver");
  const ds = THREE.DoubleSide;
  const pale = kit.std({ color: 0xcfd0c4, roughness: 0.85, side: ds });
  const plate = kit.std({ color: 0x5b5f55, roughness: 0.75, side: ds });
  const dark = kit.std({ color: 0x1d1f1c, roughness: 0.8 });
  const black = kit.std({ color: 0x0e0f0f, roughness: 0.6 });
  const rubber = kit.std({ color: 0x0a0a0a, roughness: 0.85 });
  const steel = kit.std({ color: 0x8a8d88, roughness: 0.4, metalness: 0.7 });
  const olive = kit.std({ color: 0x48503a, roughness: 0.8 });
  const cloth = kit.std({ color: 0x2e3329, roughness: 0.97 });
  const red = kit.std({ color: 0xb21d17, roughness: 0.45 });
  const cable = kit.std({ color: 0x23251f, roughness: 0.7 });
  const lamp = kit.std({
    color: 0xd0f0e0,
    emissive: 0x9ff0c8,
    emissiveIntensity: 0.3,
    roughness: 0.4,
  });
  // The blocks' glass: a thick prism's, greener and darker than a window's.
  const prism = kit.std({
    color: 0x6f9a86,
    roughness: 0.05,
    metalness: 0.3,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: ds,
  });

  const R = C.room;
  const B = C.blocks;
  const front = (y: number): number =>
    R.toe.z + ((y - R.toe.y) / (R.brow.y - R.toe.y)) * (R.brow.z - R.toe.z);

  // ── THE COMPARTMENT ─────────────────────────────────────────────────
  // The floor, the escape hatch in it.
  kit.mesh(
    quad(
      { x: R.left, y: R.floor, z: R.back },
      { x: R.right, y: R.floor, z: R.back },
      { x: R.right, y: R.floor, z: R.toe.z },
      { x: R.left, y: R.floor, z: R.toe.z },
    ),
    plate,
    group,
  );
  const esc = kit.mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 24), steel, group);
  esc.rotation.x = Math.PI / 2;
  esc.position.set(C.seat.x - 0.05, R.floor + 0.01, R.back + 0.35);
  // The glacis over his feet, up to the blocks' band.
  kit.mesh(
    quad(
      { x: R.left, y: R.toe.y, z: R.toe.z },
      { x: R.right, y: R.toe.y, z: R.toe.z },
      { x: R.right, y: B.lo - 0.02, z: front(B.lo - 0.02) },
      { x: R.left, y: B.lo - 0.02, z: front(B.lo - 0.02) },
    ),
    pale,
    group,
  );
  kit.mesh(
    quad(
      { x: R.left, y: R.floor, z: R.toe.z },
      { x: R.right, y: R.floor, z: R.toe.z },
      { x: R.right, y: R.toe.y, z: R.toe.z },
      { x: R.left, y: R.toe.y, z: R.toe.z },
    ),
    pale,
    group,
  );
  // The deck's underside.
  kit.mesh(
    quad(
      { x: R.left, y: R.roof, z: R.back },
      { x: R.right, y: R.roof, z: R.back },
      { x: R.right, y: R.roof, z: R.brow.z },
      { x: R.left, y: R.roof, z: R.brow.z },
    ),
    pale,
    group,
  );
  // The sides and the bulkhead behind the seat.
  wallAt(
    kit,
    group,
    R.left,
    pale,
    [R.back, R.floor],
    [R.toe.z, R.floor],
    [R.brow.z, R.roof],
    [R.back, R.roof],
  );
  wallAt(
    kit,
    group,
    R.right,
    pale,
    [R.back, R.floor],
    [R.toe.z, R.floor],
    [R.brow.z, R.roof],
    [R.back, R.roof],
  );
  kit.mesh(
    quad(
      { x: R.left, y: R.floor, z: R.back },
      { x: R.right, y: R.floor, z: R.back },
      { x: R.right, y: R.roof, z: R.back },
      { x: R.left, y: R.roof, z: R.back },
    ),
    plate,
    group,
  );

  // ── THE VISION BLOCKS ───────────────────────────────────────────────
  // Each block's window: its two edges across, set back along its yaw.
  const edges = B.at.map((b) => {
    const cx = Math.cos(b.yaw);
    const sx = Math.sin(b.yaw);
    // The window faces along its yaw; its edges lie square to it.
    return {
      l: { x: b.x + (B.w / 2) * cx, z: b.z - (B.w / 2) * sx },
      r: { x: b.x - (B.w / 2) * cx, z: b.z + (B.w / 2) * sx },
      b,
    };
  });
  // The band the blocks sit in: the fillers between them, to the walls,
  // and the front plate over and under them.
  const band = (a: { x: number; z: number }, b: { x: number; z: number }, y0: number, y1: number) =>
    kit.mesh(
      quad(
        { x: a.x, y: y0, z: a.z },
        { x: b.x, y: y0, z: b.z },
        { x: b.x, y: y1, z: b.z },
        { x: a.x, y: y1, z: a.z },
      ),
      pale,
      group,
    );
  const wallL = { x: R.left, z: front(B.lo) };
  const wallR = { x: R.right, z: front(B.lo) };
  band(wallL, edges[0].l, B.lo - 0.02, R.roof);
  for (let i = 0; i < edges.length - 1; i++) band(edges[i].r, edges[i + 1].l, B.lo - 0.02, R.roof);
  band(edges[edges.length - 1].r, wallR, B.lo - 0.02, R.roof);
  for (const e of edges) {
    // Over the window to the roof, and the window's seal and glass.
    band(e.l, e.r, B.hi, R.roof);
    band(e.l, e.r, B.lo - 0.02, B.lo);
    const c: V3[] = [
      { x: e.l.x, y: B.lo, z: e.l.z },
      { x: e.r.x, y: B.lo, z: e.r.z },
      { x: e.r.x, y: B.hi, z: e.r.z },
      { x: e.l.x, y: B.hi, z: e.l.z },
    ];
    for (let i = 0; i < 4; i++) kit.rod(c[i], c[(i + 1) % 4], 0.014, rubber, group, 6);
    const pane = kit.mesh(quad(c[0], c[1], c[2], c[3]), prism, group);
    pane.renderOrder = 4;
    pane.castShadow = false;
    // The block's housing back into the deck: its lid and cheeks.
    const back = { x: -Math.sin(e.b.yaw) * 0.12, z: -Math.cos(e.b.yaw) * 0.12 };
    kit.mesh(
      quad(
        { x: e.l.x, y: B.hi + 0.005, z: e.l.z },
        { x: e.r.x, y: B.hi + 0.005, z: e.r.z },
        { x: e.r.x + back.x, y: R.roof, z: e.r.z + back.z },
        { x: e.l.x + back.x, y: R.roof, z: e.l.z + back.z },
      ),
      olive,
      group,
    );
  }
  // The brow pad over the middle block.
  const mid = B.at[1];
  const pad = kit.box(
    B.w + 0.08,
    0.05,
    0.06,
    { x: mid.x, y: B.hi + 0.04, z: mid.z - 0.08 },
    black,
    group,
    0.02,
  );
  pad.castShadow = false;

  // ── THE HATCH OVER HIS HEAD ─────────────────────────────────────────
  const H = C.hatch;
  const lid = kit.mesh(new THREE.CircleGeometry(H.r, 28), olive, group);
  lid.rotation.x = Math.PI / 2;
  lid.position.set(H.x, R.roof - 0.012, H.z);
  const ring = kit.mesh(new THREE.TorusGeometry(H.r, 0.025, 8, 28), steel, group);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(H.x, R.roof - 0.02, H.z);
  kit.rod(
    { x: H.x - 0.12, y: R.roof - 0.07, z: H.z },
    { x: H.x + 0.12, y: R.roof - 0.07, z: H.z },
    0.012,
    black,
    group,
  );
  for (const s of [-1, 1])
    kit.rod(
      { x: H.x + s * 0.12, y: R.roof - 0.07, z: H.z },
      { x: H.x + s * 0.12, y: R.roof - 0.01, z: H.z },
      0.01,
      black,
      group,
    );
  // The locking lever, swung across.
  kit.rod(
    { x: H.x + 0.18, y: R.roof - 0.04, z: H.z - 0.12 },
    { x: H.x - 0.02, y: R.roof - 0.05, z: H.z - 0.22 },
    0.014,
    red,
    group,
  );
  // The dome lamp, a crew's blue-green.
  kit.box(
    0.12,
    0.025,
    0.07,
    { x: R.left - 0.12, y: R.roof - 0.013, z: R.back + 0.3 },
    lamp,
    group,
    0.01,
  );

  // ── THE T-BAR ───────────────────────────────────────────────────────
  const Y = C.yoke;
  const col = { x: C.eye.x, y: Y.foot.y, z: Y.foot.z };
  const top = { x: C.eye.x, y: Y.mid.y - 0.05, z: Y.mid.z + 0.08 };
  kit.rod(col, top, 0.03, dark, group, 12);
  kit.box(0.14, 0.1, 0.12, { x: col.x, y: col.y + 0.05, z: col.z }, dark, group, 0.02);
  const yoke = new THREE.Group();
  yoke.position.set(top.x, top.y, top.z);
  group.add(yoke);
  const bar = { x: 0, y: Y.mid.y - top.y, z: Y.mid.z - top.z };
  kit.rod({ x: 0, y: 0, z: 0 }, bar, 0.022, dark, yoke, 10);
  kit.rod(
    { x: Y.half, y: bar.y, z: bar.z },
    { x: -Y.half, y: bar.y, z: bar.z },
    0.018,
    steel,
    yoke,
    10,
  );
  // The selector on the bar's middle: its plate and lever.
  const sel = kit.canvas(128, 64);
  sel.ctx.fillStyle = "#0e0f0f";
  sel.ctx.fillRect(0, 0, 128, 64);
  sel.ctx.fillStyle = "#e0e3da";
  sel.ctx.font = "bold 22px sans-serif";
  sel.ctx.textAlign = "center";
  sel.ctx.fillText("R N D L P", 64, 40);
  kit.box(0.16, 0.05, 0.09, { x: 0, y: bar.y + 0.035, z: bar.z }, dark, yoke, 0.012);
  kit.mesh(
    quad(
      { x: 0.07, y: bar.y + 0.062, z: bar.z - 0.035 },
      { x: -0.07, y: bar.y + 0.062, z: bar.z - 0.035 },
      { x: -0.07, y: bar.y + 0.062, z: bar.z + 0.035 },
      { x: 0.07, y: bar.y + 0.062, z: bar.z + 0.035 },
    ),
    kit.face(sel.texture, 0.2),
    yoke,
  );
  kit.box(0.015, 0.05, 0.015, { x: 0.02, y: bar.y + 0.085, z: bar.z }, steel, yoke, 0.004);
  // The grips, each its own to twist.
  const grips: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(s * Y.half, bar.y, bar.z);
    yoke.add(g);
    const grip = kit.mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 12), rubber, g);
    grip.rotation.z = Math.PI / 2;
    grip.position.x = s * 0.07;
    for (let i = 0; i < 4; i++) {
      const rib = kit.mesh(new THREE.TorusGeometry(0.023, 0.004, 4, 12), black, g);
      rib.rotation.y = Math.PI / 2;
      rib.position.x = s * (0.02 + i * 0.03);
    }
    grips.push(g);
  }

  // ── THE PEDAL AND THE REST ──────────────────────────────────────────
  const P = C.pedal;
  const brake = buildPedal(kit, group, { x: P.x, y: P.y + 0.16, z: P.z + 0.04 }, 0.16, 0.1, {
    steel,
    rubber,
  });
  kit.box(
    0.12,
    0.02,
    0.18,
    { x: C.rest.x, y: C.rest.y - 0.02, z: C.rest.z },
    plate,
    group,
    0.005,
  ).rotation.x = -0.5;
  // The parking brake's handle on the right wall.
  kit.rod(
    { x: R.right + 0.06, y: 0.8, z: C.seat.z + 0.5 },
    { x: R.right + 0.1, y: 1.0, z: C.seat.z + 0.65 },
    0.014,
    steel,
    group,
  );
  kit.box(0.04, 0.04, 0.12, { x: R.right + 0.1, y: 1.02, z: C.seat.z + 0.68 }, red, group, 0.015);

  // ── THE DISPLAY AND THE PANEL on his left ───────────────────────────
  /** A face `p` in its box, turned square to his eyes. */
  const facing = (
    p: { x: number; y: number; z: number; w: number; h: number },
    m: THREE.Material,
    depth: number,
  ): void => {
    const yaw = Math.atan2(C.eye.x - p.x, C.eye.z - p.z);
    const box = kit.box(
      p.w + 0.03,
      p.h + 0.03,
      depth,
      { x: p.x, y: p.y, z: p.z },
      dark,
      group,
      0.01,
    );
    box.rotation.y = yaw;
    const face = kit.mesh(new THREE.PlaneGeometry(p.w, p.h), m, group);
    // The face's normal (+z of the plane) turned to `yaw`, proud of the box.
    face.rotation.y = yaw;
    face.position.set(
      p.x + Math.sin(yaw) * (depth / 2 + 0.002),
      p.y,
      p.z + Math.cos(yaw) * (depth / 2 + 0.002),
    );
  };
  const D = C.display;
  const display = kit.canvas(Math.round(D.w * PX), Math.round(D.h * PX));
  paintDriverDisplay(display.ctx, null);
  facing(D, kit.face(display.texture, 0.55), 0.05);
  const Pn = C.panel;
  const panel = kit.canvas(Math.round(Pn.w * PX), Math.round(Pn.h * PX));
  paintDriverPanel(panel.ctx);
  facing(Pn, kit.face(panel.texture, 0.25), 0.06);
  // The cables down the left wall in their clips.
  for (const dy of [0, 0.05, 0.1]) {
    kit.rod(
      { x: R.left - 0.03, y: 0.62 + dy, z: R.back },
      { x: R.left - 0.03, y: 0.62 + dy, z: R.toe.z - 0.1 },
      0.012,
      cable,
      group,
      6,
    );
  }

  // ── THE STOWAGE ON HIS RIGHT ────────────────────────────────────────
  kit.box(
    0.28,
    0.5,
    0.9,
    { x: R.right + 0.15, y: R.floor + 0.25, z: C.seat.z + 0.05 },
    olive,
    group,
    0.03,
  );
  for (const z of [-0.25, 0.05, 0.35])
    kit.box(
      0.02,
      0.4,
      0.22,
      { x: R.right + 0.295, y: R.floor + 0.27, z: C.seat.z + z },
      dark,
      group,
      0.01,
    );
  buildExtinguisher(
    kit,
    group,
    { x: R.right + 0.1, y: R.floor + 0.72, z: C.seat.z + 0.45 },
    { red, black, steel },
    0.3,
  );
  kit.rod(
    { x: R.right + 0.05, y: 1.3, z: C.seat.z + 0.1 },
    { x: R.right + 0.05, y: 1.3, z: C.seat.z + 0.55 },
    0.014,
    black,
    group,
  );

  // ── THE SEAT, RECLINED ──────────────────────────────────────────────
  const St = C.seat;
  buildSeat(kit, group, St.x, St, R.floor, { frame: dark, cloth, steel });

  // ── HIM ─────────────────────────────────────────────────────────────
  const Bd = C.body;
  const driver = createSeatedFigure(
    haze,
    {
      x: St.x,
      left: 1,
      eye: C.eye,
      shoulder: Bd.shoulder,
      hip: Bd.hip,
      upperArm: Bd.upperArm,
      forearm: Bd.forearm,
      thigh: Bd.thigh,
      shin: Bd.shin,
    },
    KIT,
    "tank_driver",
  );
  group.add(driver.group);
  const restFoot: V3 = { x: C.rest.x, y: C.rest.y + 0.02, z: C.rest.z };
  const h0 = handsOnYoke(0);
  driver.pose(h0.left, h0.right, [restFoot, { x: P.x, y: P.y, z: P.z }], false);

  let since = Infinity;
  return {
    group,
    update(r: ArmourRide, t, dt, shown, own) {
      group.visible = shown;
      if (!shown) {
        since = Infinity;
        return;
      }
      const b = r.body;
      const pose = yokePose(r);
      yoke.rotation.y = -pose.turn;
      for (const [i, g] of grips.entries()) g.rotation.x = i === 1 ? -pose.twist : 0;
      const pressed = b.speed * r.drive < -0.05 ? Math.min(1, Math.abs(r.drive)) : 0;
      brake.rotation.x = pressed * 0.35;
      const hands = handsOnYoke(pose.turn);
      const foot: V3 = { x: P.x, y: P.y - pressed * P.travel * 0.5, z: P.z - pressed * P.travel };
      driver.pose(hands.left, hands.right, [restFoot, foot], own);
      since += dt;
      if (since >= 1 / PAINT_HZ) {
        since = 0;
        paintDriverDisplay(
          display.ctx,
          tankGauges(b.speed, r.drive, b.turret, t, r.dead, ARMOUR.top.tank),
        );
        display.texture.needsUpdate = true;
      }
    },
    dispose() {
      driver.dispose();
      kit.dispose();
    },
  };
}
