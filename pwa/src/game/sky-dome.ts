// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOME — a sphere round the lens painted with `skyColour` (haze.ts),
// and over it what the weather and the hour put there: the sun's disc, the
// moon's (lit as its phase says), the stars, and one layer of cloud of the
// genus R19's sky calls for — fair-weather heaps, high streaks, or a lid.
// It goes through the same tone mapping and output conversion as every lit
// surface, which is what lets the haze meet it without a seam.
//
// THE CLOUD IS A PLANE, not a volume: a direction is carried up to a layer a
// fixed height over the lens and the layer's noise read where it lands, so a
// heap near the horizon is foreshortened into the band it is in a real sky,
// and the layer moves with the WIND (`windAt`) — `drift` is how far it has
// gone, in units of the layer's height. Under a lid the layer is the whole
// sky: its grey is the look's zenith, broken only by the texture of the
// deck's underside. The stars, the Milky Way (`starfield.ts`) and the moon
// are drawn behind the cloud and dimmed by it.

import * as THREE from "three";

import { SKY_GLSL, type HazeUniforms } from "./haze.ts";
import type { SkyLook } from "./sky.ts";
import { STARFIELD_GLSL, turnBasis } from "./starfield.ts";

/** The sun's apparent radius, rad — a touch over the real 0.27° so the disc
 * is more than a pixel on a phone. */
const SUN_RADIUS = 0.0085;
/** The moon's: drawn a little larger again, for the same reason. */
const MOON_RADIUS = 0.011;

export type SkyDome = {
  mesh: THREE.Mesh;
  /** Keep the dome centred on the lens. */
  follow(camera: THREE.Camera): void;
  /** The weather's half of a look, and how far the cloud has drifted. */
  update(look: SkyLook, driftX: number, driftZ: number): void;
  dispose(): void;
};

export function createSkyDome(haze: HazeUniforms, radius: number): SkyDome {
  const geometry = new THREE.SphereGeometry(radius, 48, 24);
  const own = {
    uCloudGenus: { value: 0 },
    uCloudCover: { value: 0 },
    uCloudLit: { value: new THREE.Color() },
    uCloudShade: { value: new THREE.Color() },
    uDrift: { value: new THREE.Vector2() },
    uStars: { value: 0 },
    uGalaxy: { value: 0 },
    uTurn: { value: new THREE.Matrix3() },
    uStarTime: { value: 0 },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uMoonLit: { value: 0 },
    uNight: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: { ...haze, ...own },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // Pinned to the far plane so nothing is ever clipped by the sky.
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      ${SKY_GLSL}
      uniform float uCloudGenus;
      uniform float uCloudCover;
      uniform vec3 uCloudLit;
      uniform vec3 uCloudShade;
      uniform vec2 uDrift;
      uniform float uStars;
      uniform float uGalaxy;
      uniform mat3 uTurn;
      uniform float uStarTime;
      uniform vec3 uMoonDir;
      uniform float uMoonLit;
      uniform float uNight;
      varying vec3 vDir;

      float dh(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.19);
        return fract(p.x * p.y);
      }
      float dn(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(dh(i), dh(i + vec2(1, 0)), u.x), mix(dh(i + vec2(0, 1)), dh(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float s = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          s += a * dn(p);
          p = p * 2.03 + vec2(17.3, 9.1);
          a *= 0.5;
        }
        return s;
      }
      ${STARFIELD_GLSL}

      void main() {
        vec3 d = normalize(vDir);
        vec3 c = skyColour(d);
        float up = max(d.y, 0.0);
        // How much of this direction the cloud hides, 0..1.
        float hide = 0.0;
        vec3 cloud = vec3(0.0);
        if (uCloudGenus > 0.5 && d.y > -0.02) {
          // Carried up to the layer: a unit of the plane is the layer's height.
          vec2 p = d.xz / (up + 0.06) + uDrift;
          float fade = smoothstep(0.0, 0.1, up);
          if (uCloudGenus < 1.5) {
            // HEAPS: flat bases, bright sunward tops.
            float n = fbm(p * 1.3);
            float cov = smoothstep(1.0 - uCloudCover - 0.02, 1.0 - uCloudCover + 0.22, n);
            vec2 toSun = normalize(uSunPos.xz + 1e-4) * 0.08;
            float lit = clamp((n - fbm((p + toSun) * 1.3)) * 6.0 + 0.5, 0.0, 1.0);
            cloud = mix(uCloudShade, uCloudLit, lit);
            hide = cov * fade;
          } else if (uCloudGenus < 2.5) {
            // STREAKS: high ice cloud, drawn out along the wind.
            vec2 q = vec2(p.x * 0.35, p.y * 2.4);
            float n = fbm(q * 0.9) * 0.7 + fbm(p * 3.1) * 0.3;
            float cov = smoothstep(1.0 - uCloudCover, 1.12 - uCloudCover * 0.4, n) * 0.75;
            cloud = mix(uCloudShade, uCloudLit, 0.7);
            hide = cov * fade;
          } else {
            // THE LID: the whole sky, textured by the deck's underside.
            float n = fbm(p * 0.8);
            cloud = mix(uCloudShade, uCloudLit, smoothstep(0.25, 0.75, n));
            // Down at the horizon the lid is the haze's own grey.
            cloud = mix(uHorizon, cloud, smoothstep(0.0, 0.25, up));
            hide = 1.0;
          }
        }
        float clearSky = 1.0 - hide;

        // THE NIGHT SKY, behind everything: the stars and the Milky Way on
        // the sphere the map's hour has turned (starfield.ts), washed out
        // round the moon and taken by the cloud in front.
        if (uStars > 0.001 || uGalaxy > 0.001) {
          float toMoon = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));
          float glare = exp(-toMoon * toMoon * 7.0) * uMoonLit * step(-0.02, uMoonDir.y);
          c += nightSky(uTurn * d, d, d.y, glare, uStars, uGalaxy, uStarTime) * clearSky;
        }

        // THE SUN'S DISC.
        float mu = dot(d, uSunPos);
        float disc = smoothstep(cos(${SUN_RADIUS.toFixed(5)}) - 0.00002, cos(${SUN_RADIUS.toFixed(5)}) + 0.00001, mu);
        c += uSunCol * disc * 30.0 * (1.0 - hide * 0.97);

        // THE MOON: a disc lit on the sun's side as far as its phase says,
        // a faint halo round it, behind the cloud.
        float mm = dot(d, uMoonDir);
        float mr = cos(${MOON_RADIUS.toFixed(5)});
        if (mm > mr - 0.0005 && uMoonDir.y > -0.02) {
          vec3 o = d - uMoonDir * mm;
          vec3 sunSide = uSunPos - uMoonDir * dot(uSunPos, uMoonDir);
          float r = ${MOON_RADIUS.toFixed(5)};
          float side = dot(o, normalize(sunSide + 1e-5)) / r;
          float lit = smoothstep(-0.08, 0.08, side + (2.0 * uMoonLit - 1.0));
          float edge = smoothstep(mr - 0.00004, mr + 0.00002, mm);
          c += vec3(0.95, 0.96, 1.0) * edge * (0.03 + 1.9 * lit) * mix(0.35, 1.0, uNight) * (1.0 - hide * 0.9);
        }
        c += vec3(0.5, 0.6, 0.8) * pow(max(mm, 0.0), 900.0) * 0.12 * uMoonLit * uNight * clearSky;

        c = mix(c, cloud, hide);
        c = mix(c, hazeColour(d), mistBand(d));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
  });
  const basis: number[] = [];
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return {
    mesh,
    follow(camera) {
      mesh.position.copy(camera.position);
    },
    update(look, driftX, driftZ) {
      own.uCloudGenus.value = look.cloud.genus;
      own.uCloudCover.value = look.cloud.cover;
      own.uCloudLit.value.setRGB(...look.cloud.lit);
      own.uCloudShade.value.setRGB(...look.cloud.shade);
      own.uDrift.value.set(driftX, driftZ);
      own.uStars.value = look.stars;
      own.uGalaxy.value = look.galaxy;
      const m = turnBasis(look.turn, basis);
      own.uTurn.value.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
      // The twinkle's clock, wrapped so a float counting all night keeps
      // the precision a twinkle needs. Presentation only.
      own.uStarTime.value = (performance.now() / 1000) % 3600;
      own.uMoonDir.value.set(look.moon.x, look.moon.y, look.moon.z);
      own.uMoonLit.value = look.moonLit;
      own.uNight.value = look.night;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
