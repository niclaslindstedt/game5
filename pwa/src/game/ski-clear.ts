// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW KEPT UNDER THE PLAYER'S SKIS: the drawn snow is the engine's
// ground with a hand of loose cover over it off the groomer (`LOOSE`) and
// the furrow cut out of it — low-passed to what each level's grid can carry,
// so a ski-wide groove on a 25–40 cm grid is drawn a quarter as deep as it
// is cut. The skis ride the engine's ground less their sink, and on old,
// crusted or settled snow, whose furrow is shallow, the cover drawn round
// them stood over their bases: at speed the skis vanished into the snow
// (the chase lens measured 4–14 cm under, at every TERRAIN and TRAILS stop —
// `make snow-eval ARGS=--under=all`).
//
// The fix is the drawn surface's, never the skier's: every vertex of the
// ground within a ski's half-width and one grid step of a base's line is
// let down to the base there, so the mesh under each ski is no higher than
// the ski, at every level's spacing (the band is the vertex's own `uSpacing`
// wide, so the triangles that span the ski all hinge down to it). The line
// is the drawn ski's own base — five stations read off its mesh, tip to tail
// — so a rockered tip in the air lowers nothing and a ski in flight none.
// The player's alone: his are the skis the lens is on.

import * as THREE from "three";

/** The stations read along each base, as shares of its length from the tip. */
const STATIONS = [0.03, 0.14, 0.5, 0.86, 0.97];
/** Points a ski carries in the uniform (`uSkiLine`), and skis. */
export const SKI_POINTS = STATIONS.length;
export const SKI_LINES = 2;

/** How far under the base the snow is let down, m: the base's own
 * thickness of clearance, so depth never fights at the base. */
const CLEAR = 0.006;

/** The bases' lines, shared by the ground's vertex and fragment stages. */
const SKI_LINE_PARS = /* glsl */ `
uniform vec4 uSkiLine[${SKI_LINES * SKI_POINTS}];
uniform float uSkiClear;
`;

/** The GLSL: `skiClear(p, y)` is `y` let down under any of the player's
 * bases within reach of `p`. Read in the ground's vertex stage after the
 * surface's height is summed. Within the base's half-width and one grid step
 * every vertex goes down to the base, so the triangles spanning the ski all
 * hinge under it — and no further: the cut's walls are the grid's own one
 * step (easing them over a second step was tried, and the chase lens saw
 * the base stand twice as far over the dip it widened), and the groove is
 * drawn in the fragment stage (`SKI_GROOVE_GLSL`). */
export const SKI_CLEAR_GLSL = /* glsl */ `${SKI_LINE_PARS}
float skiClear(vec2 p, float y, float reach) {
  if (uSkiClear < 0.5) return y;
  for (int s = 0; s < ${SKI_LINES}; s++) {
    for (int k = 0; k < ${SKI_POINTS - 1}; k++) {
      vec4 a = uSkiLine[s * ${SKI_POINTS} + k];
      vec4 b = uSkiLine[s * ${SKI_POINTS} + k + 1];
      vec2 ab = b.xz - a.xz;
      float t = clamp(dot(p - a.xz, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      float d = distance(p, a.xz + ab * t);
      if (d <= mix(a.w, b.w, t) + reach) y = min(y, mix(a.y, b.y, t) - ${CLEAR.toFixed(3)});
    }
  }
  return y;
}
`;

/** How deep the groove drawn under a ski is, m: a pressed track the base
 * sits in, the depth a ski packs loose cover to. */
const GROOVE = 0.025;

/** The GLSL: `skiGroove(p, y)` is the narrow groove each of the player's
 * bases presses where it stands — `x` its depth below the snow round it
 * (0..1 of `GROOVE`), `yz` its slope — read per pixel in the ground's
 * fragment stage, so the dip the vertex stage lets down is drawn as a ski's
 * own groove, square-shouldered and a ski wide, whatever the grid. `y` is the
 * drawn snow's height: a base well over it (in the air) presses nothing. */
export const SKI_GROOVE_GLSL = /* glsl */ `${SKI_LINE_PARS}
vec3 skiGroove(vec2 p, float y) {
  vec3 g = vec3(0.0);
  if (uSkiClear < 1.5) return g;
  for (int s = 0; s < ${SKI_LINES}; s++) {
    for (int k = 0; k < ${SKI_POINTS - 1}; k++) {
      vec4 a = uSkiLine[s * ${SKI_POINTS} + k];
      vec4 b = uSkiLine[s * ${SKI_POINTS} + k + 1];
      vec2 ab = b.xz - a.xz;
      float t = clamp(dot(p - a.xz, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      vec2 off = p - (a.xz + ab * t);
      float d = length(off);
      float w = mix(a.w, b.w, t);
      if (d > 2.0 * w + 0.05) continue;
      float on = 1.0 - smoothstep(0.03, 0.12, mix(a.y, b.y, t) - y);
      // Flat-floored, its shoulders rounded over a third of the half-width.
      float h = (1.0 - smoothstep(0.85 * w, 1.35 * w, d)) * on;
      if (h > g.x) {
        // The shoulder's slope: the smoothstep's own derivative, its steepest
        // held to a groove wall's ~50°.
        float dh = ${GROOVE.toFixed(3)} * on * 6.0 * (d - 0.85 * w) * (1.35 * w - d) / pow(0.5 * w, 3.0);
        dh = d > 0.85 * w && d < 1.35 * w ? clamp(dh, 0.0, 1.2) : 0.0;
        g = vec3(h, off / max(d, 1e-5) * dh);
      }
    }
  }
  return g;
}
`;

export type SkiClearUniforms = {
  uSkiLine: { value: THREE.Vector4[] };
  uSkiClear: { value: number };
};

export function skiClearUniforms(): SkiClearUniforms {
  return {
    uSkiLine: {
      value: Array.from({ length: SKI_LINES * SKI_POINTS }, () => new THREE.Vector4()),
    },
    uSkiClear: { value: 0 },
  };
}

/** A base's stations in its mesh's frame: the lowest vertex near each share
 * of its length (y), on its axis (x 0), and its half-width there (w). */
function stationsOf(geometry: THREE.BufferGeometry): THREE.Vector4[] {
  const pos = geometry.getAttribute("position");
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    z0 = Math.min(z0, pos.getZ(i));
    z1 = Math.max(z1, pos.getZ(i));
  }
  const band = 0.012 * (z1 - z0) + 0.005;
  return STATIONS.map((u) => {
    const z = z1 - (z1 - z0) * u;
    let y = Infinity;
    let w = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getZ(i) - z) > band) continue;
      y = Math.min(y, pos.getY(i));
      w = Math.max(w, Math.abs(pos.getX(i)));
    }
    return new THREE.Vector4(0, Number.isFinite(y) ? y : 0, z, w);
  });
}

/** Whether a base's figure is drawn: every parent shown (the base itself is
 * folded into the figure's merged draw and is never shown on its own). */
function drawn(mesh: THREE.Object3D): boolean {
  for (let o = mesh.parent; o; o = o.parent) if (!o.visible) return false;
  return mesh.parent !== null;
}

export type SkiClear = {
  /** Read the player's drawn bases (`bases`, world matrices current) into
   * the uniforms; `on` false (thrown, hidden, no skis) clears nothing, and
   * `riding` false (stood still, lying) draws no groove under them — a
   * groove is what a ski moving through the snow presses. */
  update(bases: readonly THREE.Mesh[], on: boolean, riding?: boolean): void;
};

export function createSkiClear(uniforms: SkiClearUniforms): SkiClear {
  const local = new WeakMap<THREE.BufferGeometry, THREE.Vector4[]>();
  const p = new THREE.Vector3();
  const side = new THREE.Vector3();
  return {
    update(bases, on, riding = on) {
      let n = 0;
      if (on) {
        for (const mesh of bases) {
          if (n >= SKI_LINES) break;
          if (!drawn(mesh)) continue;
          let stations = local.get(mesh.geometry);
          if (!stations) {
            stations = stationsOf(mesh.geometry);
            local.set(mesh.geometry, stations);
          }
          mesh.updateWorldMatrix(true, false);
          for (let k = 0; k < SKI_POINTS; k++) {
            const s = stations[k];
            p.set(s.x, s.y, s.z).applyMatrix4(mesh.matrixWorld);
            // The half-width in the world, off the mesh's own scale.
            const scale = side.setFromMatrixColumn(mesh.matrixWorld, 0).length();
            uniforms.uSkiLine.value[n * SKI_POINTS + k].set(p.x, p.y, p.z, s.w * scale);
          }
          n++;
        }
      }
      // A ski not read has no reach, and clears nothing.
      for (let s = n; s < SKI_LINES; s++)
        for (let k = 0; k < SKI_POINTS; k++)
          uniforms.uSkiLine.value[s * SKI_POINTS + k].set(0, 0, 0, -1e6);
      uniforms.uSkiClear.value = n > 0 ? (riding ? 2 : 1) : 0;
    },
  };
}
