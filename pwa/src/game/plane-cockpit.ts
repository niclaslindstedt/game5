// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S COCKPIT AS DRAWN — what the HELMET rung (`camera-plane.ts`)
// sees from the pilot's seat, laid out by `plane-cockpit-plan.ts`, its
// faces painted by `plane-cockpit-paint.ts` and `plane-cockpit-glass.ts`,
// its mouldings `plane-cockpit-shroud.ts`'s and its parts
// `plane-cockpit-parts.ts`'s:
//
//   * THE GLASS from in here: the model's windows copied as thin, faintly
//     tinted glass that catches the sun (the outside's own glass put away
//     while the eye is in the cockpit), a rubber seal round every pane;
//     the cabin's walls are the model's own liner;
//   * THE PANEL under its glareshield and the coaming forward to the
//     windscreen's foot, its face painted and its lettering BACKLIT after
//     dark, the two glass displays and the standbys' strip LIVE off the
//     plane, the annunciators lit; the footwell's floor and walls round the
//     pedals;
//   * THE QUADRANT between the seats with its four levers, the overhead
//     console and the trim wheel, the compass on the glareshield;
//   * THE SEATS, both STICKS and all four PEDALS, MOVING with the plane's
//     own controls (`PlaneState.controls`) — and THE PILOT in the left seat
//     (`plane-cockpit-pilot.ts`), his left hand on the stick, his right on
//     the power lever.
//
// Built once, when the model arrives, as a child of the airframe — so it
// moves with the drawing exactly — and shown while the eye is in the
// cockpit or near enough outside to see the pilot through the glass.
// Presentation only: it reads `GameState.plane` and writes nothing.

import * as THREE from "three";
import { PLANE, type Level, type PlaneState } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import {
  LIGHTS_H,
  LIGHTS_W,
  MFD_H,
  MFD_W,
  PFD_H,
  PFD_W,
  STANDBY_H,
  STANDBY_W,
  paintLights,
  paintMfd,
  paintPfd,
  paintStandby,
} from "./plane-cockpit-glass.ts";
import {
  OVERHEAD_H,
  OVERHEAD_W,
  PANEL_H,
  PANEL_W,
  QUADRANT_H,
  QUADRANT_W,
  paintOverhead,
  paintPanelBack,
  paintQuadrant,
} from "./plane-cockpit-paint.ts";
import {
  box,
  canvasTexture,
  merged,
  pedal,
  quad,
  quadrant,
  seats,
  stick,
  trimWheel,
  tube,
  type Mats,
  type V3,
} from "./plane-cockpit-parts.ts";
import { createCockpitPilot } from "./plane-cockpit-pilot.ts";
import {
  PLANE_COCKPIT,
  controlPose,
  leverKnob,
  planeGaugesOf,
  setLever,
  stickGrip,
} from "./plane-cockpit-plan.ts";
import {
  coamingGeometry,
  footwellGeometry,
  glassOf,
  screenFoot,
  sealGeometry,
  shroudGeometry,
} from "./plane-cockpit-shroud.ts";

/** How often the live displays are painted again, Hz. */
const PAINT_HZ = 20;
const PAINT_OUT_HZ = 4;
/** How far the cockpit's own surfaces are darkened after dark, so the
 * backlit lettering and the displays carry the panel. */
const DARKEN = 0.75;
/** The outside glass's opacity with the eye near outside (the pilot seen
 * through it) and far off (the glass as dark as built). */
const GLASS_NEAR = 0.55;
const GLASS_FAR = 1;
/** How bright the panel's lettering, the displays and the spill on the
 * cockpit's surfaces glow by day and after dark. */
const GLOW = { day: 0.05, night: 1.1 };
const SCREEN = { day: 0.95, night: 0.6 };
const SPILL = 0.06;
/** The light the cabin's own white walls throw back onto its dark
 * surfaces by day, as a share of each surface's colour — the shadow box
 * puts the whole cockpit in the roof's shadow, and a real one is never
 * that black. */
const BOUNCE = 0.35;

export type PlaneCockpit = {
  group: THREE.Group;
  /** Whether the eye is in the cockpit (the inside glass shown, the
   * outside's put away), whether it is the pilot's own (his head drawn
   * in), and whether it is near enough outside to see in. */
  show(inside: boolean, own: boolean, near: boolean): void;
  /** The controls, the pilot's hands and the displays to the plane as it
   * stands, `t` s into the run. */
  update(p: PlaneState, level: Level, t: number, dt: number): void;
  /** How dark it is, 0 by day to 1 at night (the sky's `lamps`): the
   * lettering and the displays lit, the surfaces darkened. */
  night(k: number): void;
  dispose(): void;
};

const up = new THREE.Vector3(0, 1, 0);

/** A point on the panel's face: `x` across, `s` up its face from its foot,
 * `n` out of it toward the pilot. */
function onFace(x: number, s: number, n: number): V3 {
  const P = PLANE_COCKPIT.panel;
  return {
    x,
    y: P.bottom + Math.cos(P.lean) * s + Math.sin(P.lean) * n,
    z: P.z + Math.sin(P.lean) * s - Math.cos(P.lean) * n,
  };
}

/** A rectangle on the panel's face (its middle `x`, `y` up the face, its
 * size), standing `n` proud of it, facing the pilot. */
function faceRect(r: { x: number; y: number; w: number; h: number }, n: number) {
  const g = quad(
    onFace(r.x - r.w / 2, r.y - r.h / 2, n),
    onFace(r.x + r.w / 2, r.y - r.h / 2, n),
    onFace(r.x + r.w / 2, r.y + r.h / 2, n),
    onFace(r.x - r.w / 2, r.y + r.h / 2, n),
    true,
  );
  return g;
}

export function createPlaneCockpit(
  body: THREE.Object3D | null,
  toMachine: (m: THREE.Mesh) => THREE.Matrix4,
  haze: HazeUniforms,
): PlaneCockpit {
  const C = PLANE_COCKPIT;
  const P = C.panel;
  const floor = PLANE.cabin.floor;
  const group = new THREE.Group();
  group.name = "plane_cockpit";
  // Laid out in the cockpit's frame (x to the right as seen) under a
  // mirror into the engine's body frame; the glass copied off the model is
  // in the body frame already.
  const room = new THREE.Group();
  room.scale.x = -1;
  group.add(room);
  const mats: THREE.MeshStandardMaterial[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const textures: THREE.Texture[] = [];
  const std = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, "plane");
    mats.push(m);
    return m;
  };
  const two = THREE.DoubleSide;
  const m: Mats = {
    black: std({ color: 0x151618, roughness: 0.85, side: two }),
    satin: std({ color: 0x2a2c30, roughness: 0.5, metalness: 0.4 }),
    steel: std({ color: 0x8d9096, roughness: 0.35, metalness: 0.8 }),
    rubber: std({ color: 0x0c0c0d, roughness: 0.8 }),
    fabric: std({ color: 0x3e4148, roughness: 0.97 }),
    leather: std({ color: 0x2c2420, roughness: 0.7 }),
    shell: std({ color: 0x53565c, roughness: 0.6, metalness: 0.1 }),
    strap: std({ color: 0x2f3d55, roughness: 0.8 }),
    red: std({ color: 0xb0201a, roughness: 0.5 }),
    blue: std({ color: 0x1d4fa8, roughness: 0.45 }),
    white: std({ color: 0xe6e6e0, roughness: 0.5 }),
    yellow: std({ color: 0xd8a518, roughness: 0.5 }),
  };
  // The surfaces the day's light bounces onto and the panel's spills onto
  // after dark.
  const spilled: THREE.MeshStandardMaterial[] = (
    ["black", "satin", "rubber", "fabric", "leather", "shell", "strap"] as const
  ).map((k) => m[k] as THREE.MeshStandardMaterial);
  const add = (parent: THREE.Object3D, mesh: THREE.Mesh, shadow = true): THREE.Mesh => {
    mesh.receiveShadow = true;
    mesh.castShadow = shadow;
    parent.add(mesh);
    geos.push(mesh.geometry);
    return mesh;
  };

  // THE GLASS from in here, and the outside's to be put away.
  const outsideGlass: THREE.Mesh[] = [];
  const outsideMats: THREE.MeshStandardMaterial[] = [];
  let foot: ((x: number) => V3) | null = null;
  let innerGlass: THREE.Mesh | null = null;
  if (body) {
    body.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
      const mat = o.material as THREE.MeshStandardMaterial;
      if (!/^glass/i.test(mat.name ?? "")) return;
      outsideGlass.push(o);
      if (!outsideMats.includes(mat)) outsideMats.push(mat);
    });
    // Transparent from the start, so a change of opacity never rebuilds
    // its shader.
    for (const g of outsideMats) {
      g.transparent = true;
      g.needsUpdate = true;
    }
    const glass = glassOf(body, toMachine);
    foot = screenFoot(glass);
    const seals = sealGeometry(glass, { x: 0, y: 1.9, z: 0 });
    if (seals) add(group, new THREE.Mesh(seals, m.rubber), false);
    if (glass) {
      glass.computeVertexNormals();
      const g = std({
        color: 0x8fa8b4,
        roughness: 0.06,
        metalness: 0.5,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: two,
      });
      innerGlass = add(group, new THREE.Mesh(glass, g), false);
      innerGlass.renderOrder = 4;
    }
  }

  // THE PANEL: its face painted, its lettering lit off a glow canvas, the
  // housing behind it to the firewall.
  const rise = P.top - P.bottom;
  const zTop = P.z + rise * Math.tan(P.lean);
  const panel = canvasTexture(PANEL_W, PANEL_H);
  const panelGlow = canvasTexture(PANEL_W, PANEL_H);
  paintPanelBack(panel.ctx, panelGlow.ctx);
  textures.push(panel.texture, panelGlow.texture);
  const panelMat = std({
    map: panel.texture,
    emissiveMap: panelGlow.texture,
    emissive: 0xffffff,
    emissiveIntensity: GLOW.day,
    roughness: 0.62,
  });
  add(
    room,
    new THREE.Mesh(
      quad(
        { x: -P.half, y: P.bottom, z: P.z },
        { x: P.half, y: P.bottom, z: P.z },
        { x: P.half, y: P.top, z: zTop },
        { x: -P.half, y: P.top, z: zTop },
        true,
      ),
      panelMat,
    ),
    false,
  );
  // THE LIVE GLASS: the two displays, the standbys and the annunciators.
  const live = {
    pfd: canvasTexture(PFD_W, PFD_H),
    mfd: canvasTexture(MFD_W, MFD_H),
    standby: canvasTexture(STANDBY_W, STANDBY_H),
    lights: canvasTexture(LIGHTS_W, LIGHTS_H),
  };
  const screenMats: THREE.MeshStandardMaterial[] = [];
  for (const k of ["pfd", "mfd", "standby", "lights"] as const) {
    const c = live[k];
    textures.push(c.texture);
    const mat = std({
      map: c.texture,
      emissiveMap: c.texture,
      emissive: 0xffffff,
      emissiveIntensity: SCREEN.day,
      roughness: 0.18,
      metalness: 0.1,
    });
    screenMats.push(mat);
    add(room, new THREE.Mesh(faceRect(C.screens[k], 0.004), mat), false);
  }
  const housing: THREE.BufferGeometry[] = [
    box(P.half * 2, rise + 0.02, 0.12, 0, (P.top + P.bottom) / 2, (P.z + zTop) / 2 + 0.062, P.lean),
    // The firewall's face behind the panel, down to the footwell.
    box(1.3, P.bottom - floor + 0.1, 0.02, 0, (P.bottom + floor) / 2, C.firewall + 0.01),
  ];
  // THE SHROUD round the face and the coaming forward to the glass.
  const moulding = std({ color: 0x1d1e21, roughness: 0.88, side: two });
  spilled.push(moulding);
  const shroud = shroudGeometry();
  const glareFoot = foot ?? ((x: number) => ({ x, y: C.glare.foot.y, z: C.glare.foot.z }));
  add(room, new THREE.Mesh(shroud.shroud, moulding));
  add(room, new THREE.Mesh(coamingGeometry(shroud.back, glareFoot), moulding), false);
  // THE FOOTWELL: the floor's carpet up its ramp, the trimmed walls.
  const well = footwellGeometry();
  const carpet = std({ color: 0x232427, roughness: 1, side: two });
  const trimmed = std({ color: 0x4a4d52, roughness: 0.9, side: two });
  spilled.push(carpet, trimmed);
  add(room, new THREE.Mesh(well.floor, carpet), false);
  add(room, new THREE.Mesh(well.walls, trimmed), false);

  // THE COMPASS on the glareshield's middle: its bowl, its lit card.
  housing.push(box(0.075, 0.06, 0.06, 0, C.compass.y, C.compass.z));
  const card = std({ color: 0xe8e6da, roughness: 0.5, emissive: 0xffe6b0, emissiveIntensity: 0 });
  add(
    room,
    new THREE.Mesh(box(0.05, 0.022, 0.004, 0, C.compass.y + 0.004, C.compass.z - 0.031), card),
    false,
  );
  room.add(merged(housing, m.black));

  // THE QUADRANT and its levers.
  const plate = canvasTexture(QUADRANT_W, QUADRANT_H);
  const plateGlow = canvasTexture(QUADRANT_W, QUADRANT_H);
  paintQuadrant(plate.ctx, plateGlow.ctx);
  textures.push(plate.texture, plateGlow.texture);
  const plateMat = std({
    map: plate.texture,
    emissiveMap: plateGlow.texture,
    emissive: 0xffffff,
    emissiveIntensity: GLOW.day,
    roughness: 0.7,
    side: two,
  });
  const quad4 = quadrant(m, plateMat);
  for (const o of quad4.parts) room.add(o);
  for (const l of quad4.levers) room.add(l);
  room.add(quad4.flap);

  // THE OVERHEAD CONSOLE and the trim wheel under it.
  const O = C.overhead;
  room.add(
    merged(
      [
        box(
          O.half * 2,
          C.roof - O.y + 0.04,
          O.to - O.from,
          0,
          (C.roof + O.y) / 2 + 0.01,
          (O.to + O.from) / 2,
        ),
      ],
      m.black,
    ),
  );
  const over = canvasTexture(OVERHEAD_W, OVERHEAD_H);
  const overGlow = canvasTexture(OVERHEAD_W, OVERHEAD_H);
  paintOverhead(over.ctx, overGlow.ctx);
  textures.push(over.texture, overGlow.texture);
  const overMat = std({
    map: over.texture,
    emissiveMap: overGlow.texture,
    emissive: 0xffffff,
    emissiveIntensity: GLOW.day,
    roughness: 0.6,
  });
  add(
    room,
    new THREE.Mesh(
      quad(
        { x: -O.half, y: O.y - 0.012, z: O.to },
        { x: O.half, y: O.y - 0.012, z: O.to },
        { x: O.half, y: O.y - 0.012, z: O.from },
        { x: -O.half, y: O.y - 0.012, z: O.from },
        true,
      ),
      overMat,
    ),
    false,
  );
  const trim = trimWheel(m);
  room.add(trim);

  // THE SEATS, the fire extinguisher by the right one.
  for (const o of seats(m)) room.add(o);
  {
    const S = C.seat;
    const ex = { x: S.x + S.width / 2 + 0.06, y: floor + 0.2, z: S.back + 0.12 };
    room.add(
      merged([tube({ ...ex, y: ex.y - 0.15 }, { ...ex, y: ex.y + 0.12 }, 0.042, 0.042, 12)], m.red),
      merged(
        [
          tube({ ...ex, y: ex.y + 0.12 }, { ...ex, y: ex.y + 0.18 }, 0.02, 0.012, 8),
          box(0.09, 0.018, 0.03, ex.x, ex.y + 0.18, ex.z + 0.02),
        ],
        m.black,
      ),
    );
  }

  // THE STICKS and THE PEDALS: the pilot's and the second seat's.
  const sticks = ([-1, 1] as const).map((side) => {
    const g = stick(m);
    g.position.x = -side * C.stick.x;
    room.add(g);
    return { g, side };
  });
  const E = C.pedals;
  const pedals = [E.x - E.gap, E.x + E.gap, -E.x - E.gap, -E.x + E.gap].map((x) => {
    const g = pedal(m, x);
    room.add(g);
    return g;
  });

  // THE PILOT.
  const pilot = createCockpitPilot(haze);
  room.add(pilot.group);

  const a = new THREE.Vector3();
  let own = false;
  /** Pose the controls and the pilot on them. */
  const pose = (p: PlaneState): void => {
    const cp = controlPose(p.controls, p.trim);
    for (const s of sticks) {
      const grip = stickGrip(cp, s.side);
      a.set(grip.x - s.g.position.x, grip.y - C.stick.y, grip.z - C.stick.z).normalize();
      s.g.quaternion.setFromUnitVectors(up, a);
    }
    pedals.forEach((g, i) => {
      g.position.z = E.z + (i % 2 === 0 ? cp.pedalLeft : cp.pedalRight);
    });
    const [prop, power, cond] = quad4.levers;
    prop.rotation.x = -setLever(C.levers.set.prop);
    power.rotation.x = -cp.power;
    cond.rotation.x = -setLever(C.levers.set.condition);
    quad4.flap.rotation.x = -cp.flap;
    trim.rotation.x = cp.trim;
    const grip = stickGrip(cp, -1);
    const knob = leverKnob(cp.power, 1);
    pilot.pose(
      { x: grip.x, y: grip.y, z: grip.z },
      { x: knob.x - 0.01, y: knob.y + 0.012, z: knob.z },
      [
        { x: pedals[0].position.x, y: E.y, z: pedals[0].position.z },
        { x: pedals[1].position.x, y: E.y, z: pedals[1].position.z },
      ],
      own,
    );
  };

  let inside = false;
  let paintDebt = 0;
  // Every surface's colour as built, darkened from after dark.
  const bases = mats
    .filter((mt) => !screenMats.includes(mt) && mt !== card)
    .map((mt) => [mt, mt.color.clone()] as const);
  let night = -1;
  group.visible = false;
  return {
    group,
    show(on, pilotEye, near) {
      inside = on;
      own = on && pilotEye;
      group.visible = on || near;
      if (innerGlass) innerGlass.visible = on;
      for (const g of outsideGlass) g.visible = !on;
      const k = near ? GLASS_NEAR : GLASS_FAR;
      for (const g of outsideMats) {
        g.opacity = k;
        g.depthWrite = k >= 1;
      }
    },
    update(p, level, t, dt) {
      if (!group.visible) return;
      pose(p);
      // Painted briskly from the seat, slowly when only seen from outside.
      paintDebt -= dt;
      if (paintDebt > 0) return;
      paintDebt = 1 / (inside ? PAINT_HZ : PAINT_OUT_HZ);
      const g = planeGaugesOf(p, level.groundAt(p.x, p.z), t);
      const s = Math.sin(p.heading);
      const c = Math.cos(p.heading);
      paintPfd(live.pfd.ctx, g);
      // Ahead `f` and to the right as seen `r` — the engine's −x.
      paintMfd(
        live.mfd.ctx,
        g,
        (f, r) => level.groundAt(p.x + s * f - c * r, p.z + c * f + s * r),
        p.y,
      );
      paintStandby(live.standby.ctx, g);
      paintLights(live.lights.ctx, g);
      for (const k of ["pfd", "mfd", "standby", "lights"] as const)
        live[k].texture.needsUpdate = true;
    },
    night(dark) {
      const k = Math.max(0, Math.min(1, dark));
      // After dark the panel's lettering, the quadrant and the overhead
      // glow and the displays are dimmed to the night.
      if (Math.abs(k - night) > 0.01) {
        night = k;
        for (const [mt, base] of bases) mt.color.copy(base).multiplyScalar(1 - DARKEN * k);
        const glow = GLOW.day + (GLOW.night - GLOW.day) * k;
        panelMat.emissiveIntensity = glow;
        plateMat.emissiveIntensity = glow;
        overMat.emissiveIntensity = glow * 0.8;
        card.emissiveIntensity = 0.5 * k;
        for (const s of screenMats)
          s.emissiveIntensity = SCREEN.day + (SCREEN.night - SCREEN.day) * k;
        const day = BOUNCE * (1 - k);
        for (const s of spilled) {
          s.emissive.copy(s.color).multiplyScalar(day);
          s.emissive.r += SPILL * k * 0.7;
          s.emissive.g += SPILL * k * 0.8;
          s.emissive.b += SPILL * k;
        }
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const mt of mats) mt.dispose();
      for (const tx of textures) tx.dispose();
      pilot.dispose();
    },
  };
}
