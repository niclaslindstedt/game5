// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR'S MOTOR UNIT AS DRAWN (`para-scene.ts` straps it on), built
// in code to the foot-launch class's measure (`docs/paramotor.md`): a CAGE
// 1.32 m across of rigid alloy hoop in four sections, eight spokes in to a
// ring round the hub and a cord NET laced zigzag across each sector; the
// FRAME behind the pilot's back — two uprights, the back pad, the cross
// tubes — and the SWAN-NECK ARMS curving round his sides from its foot to
// the hang points under his arms the risers are clipped to (a high hang); the ENGINE low in the
// middle, its finned cylinder standing up, the reduction drive's belt
// pulley above it and the black exhaust can wrapped under; the translucent
// TANK below; and a two-bladed carbon PROPELLER 1.25 m across turning in
// front of the cage, its blades tapering to the tips and smeared into a
// disc as it spools up. The pilot's frame: x right, y up, z forward, his
// centre of gravity at the origin.

import * as THREE from "three";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { SkyLook } from "./sky.ts";

/** THE UNIT's measure in his frame, m. */
export const MOTOR = {
  /** The cage: its centre, radius, the hoop's tube. */
  cage: { y: 0.42, z: -0.52, r: 0.66, tube: 0.011 },
  /** The spokes and the ring they meet at. */
  spokes: 8,
  ring: 0.2,
  /** The propeller: its radius, the blade's root and tip chords; the plane
   * it turns in, just behind the cage's front. */
  prop: { r: 0.62, root: 0.085, tip: 0.04, z: -0.44 },
  /** The hang points the risers are clipped to: either side, at the top of
   * the arms by his shoulders. */
  hang: { x: 0.25, y: 0.42, z: 0.04 },
} as const;

export type MotorUnit = {
  group: THREE.Group;
  /** The propeller, turned about z by the engine's own angle. */
  prop: THREE.Group;
  blades: THREE.Mesh;
  disc: THREE.Mesh;
  /** The seat plate under him, shown only while he sits in it. */
  seat: THREE.Mesh;
  dispose(): void;
};

/** A tube along `points` (his frame), `radius` m. */
function tube(points: [number, number, number][], radius: number, mat: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 6, false), mat);
}

/** A propeller blade along +x from the hub: tapered, twisted, its tip
 * rounded, as a thin solid. */
function bladeGeometry(): THREE.BufferGeometry {
  const P = MOTOR.prop;
  const n = 10;
  const pos: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = 0.06 + (P.r - 0.06) * t;
    const round = t > 0.85 ? Math.sqrt(Math.max(0, 1 - ((t - 0.85) / 0.15) ** 2)) : 1;
    const chord = (P.root + (P.tip - P.root) * t) * Math.max(0.15, round);
    // Pitched more at the root than the tip.
    const twist = 0.55 - 0.35 * t;
    const thick = 0.012 * (1 - 0.6 * t);
    for (const [a, b] of [
      [-0.5, -1],
      [0.5, -1],
      [0.5, 1],
      [-0.5, 1],
    ]) {
      const c = a * chord;
      const h = b * thick * 0.5;
      pos.push(
        x,
        c * Math.cos(twist) - h * Math.sin(twist),
        c * Math.sin(twist) + h * Math.cos(twist),
      );
    }
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k;
      const b = i * 4 + ((k + 1) % 4);
      index.push(a, b, b + 4, a, b + 4, a + 4);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** THE NET: cord laced zigzag across each sector between spokes, from the
 * ring out to the hoop, about the cage's centre. */
function netGeometry(): THREE.BufferGeometry {
  const C = MOTOR.cage;
  const pos: number[] = [];
  const zigs = 7;
  for (let k = 0; k < MOTOR.spokes; k++) {
    const a0 = (k / MOTOR.spokes) * Math.PI * 2;
    const a1 = ((k + 1) / MOTOR.spokes) * Math.PI * 2;
    let last: [number, number] | null = null;
    for (let z = 0; z <= zigs; z++) {
      const r = MOTOR.ring + ((C.r - MOTOR.ring) * z) / zigs;
      const a = z % 2 === 0 ? a0 : a1;
      const p: [number, number] = [Math.cos(a) * r, Math.sin(a) * r];
      if (last) pos.push(last[0], last[1], C.z + 0.01, p[0], p[1], C.z + 0.01);
      last = p;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

/** THE LIGHT ON A LINE: three draws a line unlit, at its paint whatever the
 * hour, so the lines and the cage's net would glow at night. A line is
 * lit instead as a Lambert surface turned every way is: the hemisphere's
 * mean and half the key, over pi — written each frame off the sky
 * (`lineLightOf`) into the one uniform every line material reads. */
export type LineLight = { value: THREE.Color };

export function lineLightOf(look: SkyLook, out: THREE.Color): THREE.Color {
  const a = look.ambient / 2;
  const k = look.keyIntensity / 2;
  const at = (i: number): number =>
    (a * (look.skyLight[i] + look.groundLight[i]) + k * look.keyColour[i]) / Math.PI;
  return out.setRGB(at(0), at(1), at(2));
}

/** A line material in the haze, lit by `light`. */
export function litLine(
  material: THREE.LineBasicMaterial,
  haze: HazeUniforms,
  name: string,
  light: LineLight,
): THREE.LineBasicMaterial {
  return hazeMaterial(material, haze, name, (shader) => {
    shader.uniforms.uLineLight = light;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uLineLight;")
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb *= uLineLight;",
      );
  });
}

export function createMotor(haze: HazeUniforms, light: LineLight): MotorUnit {
  const group = new THREE.Group();
  group.name = "para-motor";
  const C = MOTOR.cage;
  const P = MOTOR.prop;
  const H = MOTOR.hang;
  const mat = (name: string, o: THREE.MeshStandardMaterialParameters) =>
    hazeMaterial(new THREE.MeshStandardMaterial(o), haze, name);
  const alloy = mat("para-alloy", { color: 0xb9bec4, roughness: 0.35, metalness: 0.8 });
  const black = mat("para-frame", { color: 0x16171a, roughness: 0.55, metalness: 0.3 });
  const engineMat = mat("para-engine", { color: 0x8c9096, roughness: 0.4, metalness: 0.75 });
  const carbon = mat("para-carbon", { color: 0x111214, roughness: 0.3, metalness: 0.2 });
  const pad = mat("para-pad", { color: 0x2a2c31, roughness: 0.9 });
  const accent = mat("para-accent", { color: 0xc8241c, roughness: 0.5 });
  const tankMat = mat("para-tank", {
    color: 0xf1ede2,
    roughness: 0.45,
    transparent: true,
    opacity: 0.85,
  });
  const netMat = litLine(
    new THREE.LineBasicMaterial({ color: 0xe8d23a }),
    haze,
    "para-line",
    light,
  );
  const blur = new THREE.MeshBasicMaterial({
    color: 0x101114,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const parts: THREE.Object3D[] = [];
  const put = (o: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Object3D => {
    o.position.set(x, y, z);
    parts.push(o);
    return o;
  };

  // THE CAGE: four hoop sections with sleeves at the joints, the spokes in
  // to the ring round the hub, the net across.
  for (let k = 0; k < 4; k++) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(C.r, C.tube, 6, 24, Math.PI / 2 - 0.02),
      alloy,
    );
    arc.rotation.z = (k * Math.PI) / 2 + 0.01;
    put(arc, 0, C.y, C.z);
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(C.tube * 1.8, C.tube * 1.8, 0.06, 8),
      black,
    );
    const a = (k * Math.PI) / 2;
    sleeve.rotation.z = a;
    put(sleeve, Math.cos(a) * C.r, C.y + Math.sin(a) * C.r, C.z);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(MOTOR.ring, C.tube * 0.9, 6, 24), alloy);
  put(ring, 0, C.y, C.z);
  for (let k = 0; k < MOTOR.spokes; k++) {
    const a = ((k + 0.5) / MOTOR.spokes) * Math.PI * 2;
    const len = C.r - MOTOR.ring;
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(C.tube * 0.8, C.tube * 0.8, len, 5),
      alloy,
    );
    spoke.rotation.z = a - Math.PI / 2;
    const mid = MOTOR.ring + len / 2;
    put(spoke, Math.cos(a) * mid, C.y + Math.sin(a) * mid, C.z);
  }
  // Rotated a half sector so the zigzag runs between the spokes.
  const net = new THREE.LineSegments(netGeometry(), netMat);
  net.rotation.z = Math.PI / MOTOR.spokes;
  put(net, 0, C.y, 0);

  // THE FRAME: the back pad against him, two uprights behind it, the cross
  // tubes, the struts out to the cage.
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 0.06), pad);
  put(back, 0, 0.2, -0.2);
  for (const x of [-0.17, 0.17]) {
    const sx = Math.sign(x);
    put(
      tube(
        [
          [x, -0.25, -0.27],
          [x, 0.15, -0.3],
          [x, 0.5, -0.3],
        ],
        0.013,
        black,
      ),
    );
    // The swan-neck arm: out of the frame's foot round his side and up to
    // the hang point under his arm.
    put(
      tube(
        [
          [x, -0.12, -0.28],
          [sx * 0.29, 0.0, -0.18],
          [sx * 0.31, 0.22, -0.06],
          [sx * H.x, H.y, H.z],
        ],
        0.012,
        black,
      ),
    );
    const clip = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 5, 10), alloy);
    put(clip, sx * H.x, H.y, H.z);
  }
  put(
    tube(
      [
        [-0.17, -0.18, -0.29],
        [0, -0.2, -0.31],
        [0.17, -0.18, -0.29],
      ],
      0.012,
      black,
    ),
  );
  put(
    tube(
      [
        [-0.17, 0.48, -0.3],
        [0, 0.5, -0.32],
        [0.17, 0.48, -0.3],
      ],
      0.012,
      black,
    ),
  );
  for (const a of [0.6, 2.54, 3.68, 5.82]) {
    put(
      tube(
        [
          [Math.cos(a) * 0.17, C.y + Math.sin(a) * 0.3, -0.31],
          [Math.cos(a) * C.r * 0.98, C.y + Math.sin(a) * C.r * 0.98, C.z],
        ],
        0.009,
        black,
      ),
    );
  }

  // THE ENGINE low in the middle: the crankcase, the finned cylinder up, the
  // plug's cap, the reduction drive's pulley above, the exhaust can under.
  const crank = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.15), engineMat);
  put(crank, 0, 0.12, -0.4);
  for (let f = 0; f < 6; f++) {
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.008, 12), engineMat);
    put(fin, 0, 0.21 + f * 0.018, -0.4);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), accent);
  put(cap, 0, 0.33, -0.4);
  const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 20), engineMat);
  pulley.rotation.x = Math.PI / 2;
  put(pulley, 0, C.y, -0.41);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.03, C.y - 0.12, 0.02), black);
  put(belt, 0.05, (C.y + 0.12) / 2, -0.41);
  const can = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 16, Math.PI * 1.1), black);
  can.rotation.set(Math.PI / 2, 0, Math.PI * 0.95);
  put(can, -0.02, 0.0, -0.4);
  // THE TANK under it, its filler cap red.
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.18), tankMat);
  put(tank, 0, -0.14, -0.38);
  const filler = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8), accent);
  put(filler, 0.1, -0.05, -0.38);

  // THE PROPELLER: two carbon blades on a spinner, and the disc its blur is.
  const prop = new THREE.Group();
  prop.position.set(0, C.y, P.z);
  const bladeGeo = bladeGeometry();
  const blades = new THREE.Mesh(bladeGeo, carbon);
  const other = new THREE.Mesh(bladeGeo, carbon);
  other.rotation.z = Math.PI;
  blades.add(other);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 12), black);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.05;
  prop.add(blades, spinner);
  parts.push(prop);
  const disc = new THREE.Mesh(new THREE.RingGeometry(0.06, P.r, 40), blur);
  disc.position.set(0, C.y, P.z);
  parts.push(disc);

  // THE SEAT PLATE under him in the air.
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.36), pad);
  seat.position.set(0, -0.58, 0.04);
  parts.push(seat);

  for (const o of parts) {
    if (o instanceof THREE.Mesh) o.castShadow = true;
    group.add(o);
  }
  disc.castShadow = false;
  const materials = [alloy, black, engineMat, carbon, pad, accent, tankMat, netMat, blur];
  return {
    group,
    prop,
    blades,
    disc,
    seat,
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
      });
      for (const m of materials) m.dispose();
    },
  };
}
