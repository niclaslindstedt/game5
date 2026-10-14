// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MOON AS DRAWN on the dome (`sky-dome.ts`), off the numbers
// `night-sky.ts` works out: a sphere at its true angular size lit from the
// sun's side at the phase angle, so the bright limb faces the sun on the
// sky and the terminator is the sphere's own; the dusty surface's
// Lommel–Seeliger shape (nearly flat at full, brightest along the limb in a
// crescent) pressed as the whole disc is (`DISC.span`) and lifted by the
// opposition surge (`surfaceSurge`); the dark seas laid on in the moon's own
// frame, its north toward the sky's pole; and the dark part of a young or
// old moon in earthshine. Its corona in thin cloud is drawn here too.

import { DISC } from "./night-sky.ts";

/** `moonDisc(d, M, sunPos, pole, disc, col)`: the moon over the view `d`
 * (rgb premultiplied, a its coverage); `disc` is (radius rad, phase angle
 * rad, the surge pressed, the earthshine pressed); `col` the lit surface's
 * drawn colour at full. `moonCorona(th, hide, glow)`: the diffraction round
 * it where thin cloud (`hide` its cover) stands `th` rad off it. */
export const MOON_GLSL = /* glsl */ `
  // The seas by where they lie on the face as an eye sees it, north up
  // (x to the right of the face, y up, the disc's radius 1): a mean of
  // soft patches and the bright crater in the south.
  float moonSeas(vec2 p) {
    float s = 0.0;
    s += 0.9 * exp(-dot(p - vec2(-0.30, 0.42), p - vec2(-0.30, 0.42)) / 0.045);
    s += 0.8 * exp(-dot(p - vec2(0.12, 0.45), p - vec2(0.12, 0.45)) / 0.018);
    s += 0.8 * exp(-dot(p - vec2(0.30, 0.15), p - vec2(0.30, 0.15)) / 0.025);
    s += 0.9 * exp(-dot(p - vec2(0.70, 0.32), p - vec2(0.70, 0.32)) / 0.008);
    s += 0.6 * exp(-dot(p - vec2(0.55, -0.15), p - vec2(0.55, -0.15)) / 0.015);
    s += 0.6 * exp(-dot(p - vec2(0.33, -0.33), p - vec2(0.33, -0.33)) / 0.008);
    s += 0.7 * exp(-dot(p - vec2(-0.62, 0.08), p - vec2(-0.62, 0.08)) / 0.06);
    s += 0.5 * exp(-dot(p - vec2(-0.20, -0.38), p - vec2(-0.20, -0.38)) / 0.015);
    s += 0.6 * exp(-dot(p - vec2(-0.55, -0.40), p - vec2(-0.55, -0.40)) / 0.006);
    float tycho = exp(-dot(p - vec2(-0.12, -0.72), p - vec2(-0.12, -0.72)) / 0.0015);
    return clamp(1.0 - 0.38 * min(s, 1.0), 0.0, 1.0) + 0.25 * tycho;
  }

  vec4 moonDisc(vec3 d, vec3 M, vec3 sunPos, vec3 pole, vec4 disc, vec3 col) {
    float r = disc.x;
    vec3 q = d - M * dot(d, M);
    float l = dot(d, M) > 0.0 ? length(q) / r : 4.0;
    float aa = max(fwidth(l), 1e-4);
    float a = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, l);
    if (a <= 0.0) return vec4(0.0);
    // The face's own frame: north toward the sky's pole, x to its right.
    vec3 north = pole - M * dot(pole, M);
    north = dot(north, north) > 1e-8 ? normalize(north) : vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(M, north));
    // The lit frame: x toward the sun on the sky (the bright limb).
    vec3 s = sunPos - M * dot(sunPos, M);
    vec3 ex = dot(s, s) > 1e-10 ? normalize(s) : right;
    vec3 ey = cross(M, ex);
    vec2 p = vec2(dot(q, ex), dot(q, ey)) / r;
    float r2 = min(dot(p, p), 1.0);
    vec3 n = vec3(p, sqrt(1.0 - r2));
    vec3 L = vec3(sin(disc.y), 0.0, cos(disc.y));
    float mu0 = dot(n, L);
    float mu = max(n.z, 1e-3);
    // Lommel–Seeliger, 1 at the middle of a full disc, pressed.
    float ls = 2.0 * max(mu0, 0.0) / (max(mu0, 0.0) + mu);
    float lit = smoothstep(-0.015, 0.025, mu0);
    float alb = moonSeas(vec2(dot(q, right), dot(q, north)) / r);
    vec3 day = col * pow(max(ls, 1e-4), ${DISC.span.toFixed(2)}) * disc.z * lit;
    // Earthshine: the night side lit by the nearly full Earth, a cold grey.
    vec3 earth = col * disc.w * vec3(0.8, 0.9, 1.0) * (1.0 - lit) * pow(mu, 0.3);
    return vec4((day + earth) * alb * a, a);
  }

  vec3 moonCorona(float th, float hide, vec3 glow) {
    float thin = clamp(hide * (1.0 - hide) * 4.0, 0.0, 1.0);
    float ring = (th - 0.045) / 0.009;
    return glow * thin * (0.55 * exp(-th / 0.02) * vec3(0.85, 0.92, 1.0)
                        + 0.22 * exp(-ring * ring) * vec3(1.0, 0.72, 0.55));
  }
`;
