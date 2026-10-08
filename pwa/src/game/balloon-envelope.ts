// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BALLOON'S ENVELOPE IN THE RENDERER — the cloth of `balloon-look.ts`
// built as one mesh (its gores' lobed panels, the parachute's cap, the
// skirt) and painted in the shader: the colourway's panels, the load tapes
// up every gore seam and across every panel seam, the parachute's rim and
// the crown, the burner's light GLOWING through the fabric from inside,
// the daylight through it seen from under the mouth, and the fire's
// scorch, char and holes. Its shape is worked on the CPU only when it
// changes (`shape`): pushed in on its windward side by the air past it,
// its parachute pulled down off the crown by the cord, shrunk and streamed
// as it burns, and tipped over and laid flat on the snow as it deflates.
//
// THE HOOKS a fire or a light can drive (`EnvelopeLook`): `glow` — the
// burner's light inside, 0..1, the engine's `flame` by default — `burnt`
// and `scorch`, the engine's shares, as uniforms the fragment shader reads.

import * as THREE from "three";
import { BALLOON } from "@engine";

import {
  BURNER_LOOK,
  ENVELOPE_LOOK,
  PAINT_GLSL,
  colourwayColours,
  envelopeLayout,
  laidPoint,
  ventArc,
  type Colourway,
  type Lay,
} from "./balloon-look.ts";
import { FIRE_GLSL } from "./balloon-fire-plan.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { SkyLook } from "./sky.ts";

const E = BALLOON.envelope;

/** What the shader is handed: the burner's glow inside, 0..1; the share of
 * the fabric burnt away and scorched; the daylight through the cloth, seen
 * from inside (linear RGB, set by `light`). */
export type EnvelopeLook = {
  glow: { value: number };
  burnt: { value: number };
  scorch: { value: number };
  through: { value: THREE.Color };
  /** THE FIRE'S SPREAD (`balloon-fire-plan.ts`): where on the cloth it
   * caught (its own frame, m), the front's key, m (`fireFront`), and the
   * clock its flames flicker by, s. */
  catchAt: { value: THREE.Vector3 };
  front: { value: number };
  time: { value: number };
};

/** What the envelope's shape is worked from, a frame. */
export type EnvelopeShape = {
  /** The windward side pushed in, m, and the way the air comes from, in
   * the envelope's frame (rad off +z toward +x). */
  dent: number;
  dentFrom: number;
  /** The parachute pulled down, 0..1 (the engine's `vent`). */
  vent: number;
  /** The share burnt away, 0..1. */
  burnt: number;
  /** Laid on the snow, 0..1 (`deflate`), and where (null standing). */
  lay: number;
  laid: Lay | null;
  /** The envelope's frame in the drawing's (the hang tipped over as it
   * lays down) — read only while it lies. */
  frame: THREE.Matrix4;
};

export type Envelope = {
  mesh: THREE.Mesh;
  look: EnvelopeLook;
  /** Paint it in `c`'s colourway. */
  paint(c: Colourway): void;
  /** Work its shape (only when it has changed). Returns whether the mesh's
   * positions are the drawing's own frame (laid) rather than its own. */
  shape(s: EnvelopeShape): boolean;
  /** The daylight through the fabric, off the sky. */
  light(look: SkyLook): void;
  /** Where the mouth's ring stands for wire `i`, in the frame the mesh is
   * in (its own standing, the drawing's laid). */
  mouthPoint(i: number, out: THREE.Vector3): THREE.Vector3;
  dispose(): void;
};

/** The glow's colour: a propane flame's light through the coated nylon. */
const GLOW = new THREE.Color(1.0, 0.55, 0.22);

const ENVELOPE_GLSL = /* glsl */ `
uniform vec3 uBalPalette[11];
uniform int uBalScheme;
uniform float uBalGlow;
uniform float uBalBurnt;
uniform float uBalScorch;
uniform vec3 uBalThrough;
uniform vec3 uBalGlowColour;
uniform vec3 uBalCatch;
uniform float uBalFront;
uniform float uBalTime;
varying vec4 vPanel;
varying float vWidth;
varying vec3 vRest;
float bHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float bNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bHash(i), bHash(i + vec3(1, 0, 0)), f.x),
                 mix(bHash(i + vec3(0, 1, 0)), bHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(bHash(i + vec3(0, 0, 1)), bHash(i + vec3(1, 0, 1)), f.x),
                 mix(bHash(i + vec3(0, 1, 1)), bHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float bFbm(vec3 p) {
  return 0.55 * bNoise(p) + 0.3 * bNoise(p * 2.13) + 0.15 * bNoise(p * 4.37);
}
${PAINT_GLSL}
${FIRE_GLSL}
`;

export function createEnvelope(haze: HazeUniforms): Envelope {
  const layout = envelopeLayout();
  const L = ENVELOPE_LOOK;
  const geo = new THREE.BufferGeometry();
  const position = layout.position.slice();
  const normal = layout.normal.slice();
  const posAttr = new THREE.BufferAttribute(position, 3);
  const nrmAttr = new THREE.BufferAttribute(normal, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  nrmAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", posAttr);
  geo.setAttribute("normal", nrmAttr);
  geo.setAttribute("aPanel", new THREE.BufferAttribute(layout.panel, 4));
  geo.setAttribute("aWidth", new THREE.BufferAttribute(layout.width, 1));
  geo.setAttribute("aRest", new THREE.BufferAttribute(layout.position, 3));
  geo.setIndex(new THREE.BufferAttribute(layout.index, 1));
  // Its bound is the drawing's reach, standing or laid: never culled while
  // it is anywhere near the lens.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, E.height / 2, 0), E.height + 4);

  const look: EnvelopeLook = {
    glow: { value: 0 },
    burnt: { value: 0 },
    scorch: { value: 0 },
    through: { value: new THREE.Color(0.2, 0.2, 0.2) },
    catchAt: { value: new THREE.Vector3(0, 3, E.diameter / 4) },
    front: { value: 0 },
    time: { value: 0 },
  };
  const palette = { value: Array.from({ length: 11 }, () => new THREE.Color()) };
  const scheme = { value: 0 };
  // A panel's height along the gore, m (what the horizontal tapes are drawn
  // in metres by): the panels', the cap's rows', the skirt's.
  const panelM = ventArc() / L.rows;
  const material = hazeMaterial(
    new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
    haze,
    "balloon-envelope",
    (shader) => {
      Object.assign(shader.uniforms, {
        uBalPalette: palette,
        uBalScheme: scheme,
        uBalGlow: look.glow,
        uBalBurnt: look.burnt,
        uBalScorch: look.scorch,
        uBalThrough: look.through,
        uBalGlowColour: { value: GLOW },
        uBalCatch: look.catchAt,
        uBalFront: look.front,
        uBalTime: look.time,
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute vec4 aPanel;\nattribute float aWidth;\nattribute vec3 aRest;\n" +
            "varying vec4 vPanel;\nvarying float vWidth;\nvarying vec3 vRest;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvPanel = aPanel;\nvWidth = aWidth;\nvRest = aRest;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>\n${ENVELOPE_GLSL}\nvec3 bPaint;\nfloat bTape;\nfloat bAlight;\nfloat bStreamer;`,
        )
        .replace(
          "#include <color_fragment>",
          /* glsl */ `#include <color_fragment>
{
  float row = vPanel.y;
  float u = vPanel.z;
  float v = vPanel.w;
  int slot = paintSlot(uBalScheme, vPanel.x, row, u, v);
  vec3 paint = uBalPalette[slot];
  // THE BURN, spread from where it caught (balloon-fire-plan.ts):
  // behind the front the cloth is gone but for its charred streamers.
  float n = bFbm(vRest * 0.42);
  float behind = uBalBurnt > 0.0 ? uBalFront - fireKey(vRest, n) : -99.0;
  bAlight = 0.0;
  bStreamer = 0.0;
  if (behind > FIRE_EDGE) {
    if (n < FIRE_STREAMER) discard;
    bStreamer = 1.0;
  }
  // THE TAPES: a load tape up every gore seam, a tape over every panel
  // seam, in metres; a stitch line down each.
  float across = min(u, 1.0 - u) * vWidth;
  float panelM = row < -0.5 ? ${(L.skirt / L.skirtRows).toFixed(3)} : (row > ${L.rows}.0 - 0.5 ? 1.2 : ${panelM.toFixed(3)});
  float up = min(v, 1.0 - v) * panelM;
  float aa = max(fwidth(across), 1e-4);
  float aav = max(fwidth(up), 1e-4);
  float tapeV = 1.0 - smoothstep(${(L.tape / 2).toFixed(3)} - aa, ${(L.tape / 2).toFixed(3)} + aa, across);
  float tapeH = row < -0.5 ? 0.0 : 1.0 - smoothstep(${(L.band / 2).toFixed(3)} - aav, ${(L.band / 2).toFixed(3)} + aav, up);
  paint = mix(paint, mix(paint, vec3(0.92, 0.9, 0.86), ${L.bandTone.toFixed(2)}), tapeH);
  paint = mix(paint, mix(paint, vec3(0.92, 0.9, 0.86), ${L.tapeTone.toFixed(2)}), tapeV);
  bTape = max(tapeV, tapeH * 0.6);
  float stitch = 1.0 - smoothstep(0.004 - aa, 0.004 + aa, abs(across - ${(L.tape / 2).toFixed(3)}));
  paint *= 1.0 - 0.25 * stitch;
  // The parachute's rim: its edge tape, darker.
  if (row > ${L.rows}.0 - 0.5) paint = mix(paint, uBalPalette[4], 1.0 - smoothstep(0.03, 0.05, v));
  // THE SCORCH where the flame licks the cloth: browned round the point
  // it is laid into, darkest at its heart.
  float near = 1.0 - smoothstep(0.0, 5.5, length(vRest - uBalCatch));
  float lick = uBalScorch * near * (0.55 + 0.45 * smoothstep(0.25, 0.75, n));
  paint = mix(paint, vec3(0.16, 0.08, 0.04), clamp(lick * 1.2, 0.0, 0.92));
  // Ahead of the front the heat browns it; at the front and behind it it
  // is black; the band at the front itself is alight.
  float heat = smoothstep(-FIRE_CHAR, 0.0, behind);
  paint = mix(paint, vec3(0.22, 0.1, 0.04), heat * 0.6);
  float char = max(smoothstep(-0.4, 0.15, behind), bStreamer);
  paint = mix(paint, vec3(0.045, 0.032, 0.028), char);
  bAlight = behind > -0.3 && behind < FIRE_EDGE ? fireFlicker(vRest, behind) : 0.0;
  bPaint = paint;
  diffuseColor.rgb = paint;
}`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          /* glsl */ `#include <emissivemap_fragment>
{
  // THE BURNER'S LIGHT through the cloth: brightest over the flame low in
  // the envelope, fading up to the crown; the inside the more lit.
  float h = vRest.y;
  // The tapes and the seams' doubled cloth stand dark against it.
  // The flame's own warmth tints the cloth it shines through, most where
  // it is hottest, so a lit envelope reads as a lamp and not as paint.
  float fall = exp(-pow((h - 5.0) / 6.0, 2.0)) * 0.9 + 0.05;
  float inside = gl_FrontFacing ? 0.45 : 1.25;
  float shade = 1.0 - 0.7 * bTape;
  vec3 lit = mix(bPaint, vec3(0.9, 0.7, 0.45), 0.3 * fall);
  totalEmissiveRadiance += lit * uBalGlowColour * uBalGlow * fall * inside * shade * 1.2;
  // THE SKIRT AND THE THROAT lit straight by the jet a metre or two off:
  // its inside a bright warm ring round the flame, by day as well, and a
  // little of it through the cloth to the outside.
  float throat = 1.0 - smoothstep(-0.6, 1.6, h);
  totalEmissiveRadiance += mix(bPaint, vec3(1.0), 0.2) * uBalGlowColour * min(uBalGlow, 1.6) * throat * (gl_FrontFacing ? 0.05 : 1.1);
  // THE DAYLIGHT THROUGH IT, seen from under the mouth: the cloth a lamp.
  if (!gl_FrontFacing) totalEmissiveRadiance += bPaint * uBalThrough;
  // THE FIRE ON THE CLOTH: the front's flames, white-hot at their roots,
  // and embers winking on the charred streamers.
  totalEmissiveRadiance += fireGlow(bAlight);
  if (bStreamer > 0.0) totalEmissiveRadiance += fireEmbers(vRest, uBalFront - fireKey(vRest, bFbm(vRest * 0.42)));
}`,
        );
    },
  );
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = "balloon-envelope";
  mesh.castShadow = true;
  mesh.receiveShadow = false;

  const rest = layout.position;
  const restN = layout.normal;
  const n = layout.vertices;
  /** The last shape worked, so an unchanged one is not worked again. */
  const last = { dent: -1, dentFrom: 0, vent: -1, burnt: -1, lay: -1 };
  const p = new THREE.Vector3();
  const vRow = (i: number): number => layout.panel[i * 4 + 1];

  /** A point of the standing envelope as the air, the cord and the fire
   * have it, in its own frame. */
  function standing(i: number, s: EnvelopeShape, out: THREE.Vector3): THREE.Vector3 {
    let x = rest[i * 3];
    let y = rest[i * 3 + 1];
    let z = rest[i * 3 + 2];
    const r = Math.hypot(x, z);
    // THE PARACHUTE pulled down inside the crown, its rim drawn in.
    if (s.vent > 0 && vRow(i) >= L.rows) {
      const drop = s.vent * 2.2;
      y -= drop;
      const k = 1 - 0.15 * s.vent;
      x *= k;
      z *= k;
    }
    // THE WINDWARD SIDE PUSHED IN, most round the lower girth.
    if (s.dent > 0 && r > 0.01) {
      const wx = Math.sin(s.dentFrom);
      const wz = Math.cos(s.dentFrom);
      const facing = (x * wx + z * wz) / r;
      if (facing > 0) {
        const band = Math.exp(-(((y - 7) / 6) ** 2));
        const push = s.dent * facing * facing * band;
        x -= wx * push;
        z -= wz * push;
      }
    }
    // BURNING: the cloth gone slack, shrunk in and streaming up.
    if (s.burnt > 0) {
      const k = 1 - 0.62 * s.burnt * Math.min(1, Math.max(0, y) / 8 + 0.3);
      x *= k;
      z *= k;
      y = y * (1 + 0.12 * s.burnt) + Math.sin(y * 0.9 + x) * 0.4 * s.burnt;
    }
    return out.set(x, y, z);
  }

  const laidAt = new Float32Array(3);
  function shape(s: EnvelopeShape): boolean {
    const lay = s.laid ? s.lay : 0;
    const same =
      Math.abs(s.dent - last.dent) < 0.01 &&
      Math.abs(s.dentFrom - last.dentFrom) < 0.02 &&
      Math.abs(s.vent - last.vent) < 0.01 &&
      Math.abs(s.burnt - last.burnt) < 0.004 &&
      Math.abs(lay - last.lay) < 0.002;
    // A laid envelope is worked in the world, which the basket moves under:
    // it is worked again whenever it lies at all and is still lying down.
    if (same && (lay === 0 || lay >= 1)) return lay > 0;
    last.dent = s.dent;
    last.dentFrom = s.dentFrom;
    last.vent = s.vent;
    last.burnt = s.burnt;
    last.lay = lay;
    const blend = lay > 0 ? smooth(Math.max(0, (lay - 0.25) / 0.75)) : 0;
    for (let i = 0; i < n; i++) {
      standing(i, s, p);
      if (lay > 0 && s.laid) {
        // Its frame tipped over, the girth gone slack as the air leaves.
        const slack = 1 - 0.3 * lay;
        p.x *= slack;
        p.z *= slack;
        p.applyMatrix4(s.frame);
        laidPoint(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2], s.laid, laidAt, 0);
        p.x += (laidAt[0] - p.x) * blend;
        p.y += (laidAt[1] - p.y) * blend;
        p.z += (laidAt[2] - p.z) * blend;
        // Never under the snow.
        const floor = s.laid.groundAt(s.laid.ox + p.x, s.laid.oz + p.z) - s.laid.oy + 0.05;
        if (p.y < floor) p.y = floor;
      }
      position[i * 3] = p.x;
      position[i * 3 + 1] = p.y;
      position[i * 3 + 2] = p.z;
    }
    if (lay > 0) geo.computeVertexNormals();
    else normal.set(restN);
    posAttr.needsUpdate = true;
    nrmAttr.needsUpdate = true;
    return lay > 0;
  }

  return {
    mesh,
    look,
    paint(c) {
      scheme.value = c.scheme;
      colourwayColours(c).forEach((hex, i) => palette.value[i].setHex(hex));
    },
    shape,
    light(sky) {
      // The sun's light through a thin coated nylon, a share of it, and the
      // sky's: what a pilot sees glowing over his head by day.
      const k = 0.06 * sky.keyIntensity * (1 - sky.night);
      const a = 0.1 * sky.ambient;
      look.through.value.setRGB(
        k * sky.keyColour[0] + a * sky.skyLight[0],
        k * sky.keyColour[1] + a * sky.skyLight[1],
        k * sky.keyColour[2] + a * sky.skyLight[2],
      );
    },
    mouthPoint(i, out) {
      // A tape's foot: the first panel row's bottom vertex at the gore's
      // seam (u = 0), as the mesh now has it.
      const v = i * L.rows * (L.across + 1) * (L.down + 1);
      return out.fromArray(position, v * 3);
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}

function smooth(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

/** The burner frame's height under the mouth, m — the envelope's pivot as
 * the drawing hangs it (`balloon-scene.ts`). */
export const MOUTH_OVER_FRAME = E.mouthHeight - BURNER_LOOK.frameY;
