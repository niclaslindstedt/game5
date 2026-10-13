// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOME — a sphere round the lens painted with `skyColour` (haze.ts),
// and over it what the weather and the hour put there: the sun's disc, the
// moon's (lit as its phase says), the stars, and the CLOUD FIELD
// (`cloud-field.ts`, `clouds.ts`) — the layers R19's sky stacks at their
// own heights, carried by the wind aloft and lit by the sun at each one.
// It goes through the same tone mapping and output conversion as every lit
// surface, which is what lets the haze meet it without a seam.
//
// THE CLOUD is read off the field along the view from the lens itself: on
// LOW one read where the view crosses each layer's middle (the shell), on
// MEDIUM the slab `clouds.ts` marched at half resolution before the frame,
// on HIGH the raymarched volume's kept picture (`cloud-volume.ts`), read
// where this pixel stands on the screen. Either way a heap
// near the horizon is foreshortened into the band it is in a real sky and
// goes into the air's colour with distance. Under a lid the gaps in the
// deck show the deck's own grey (`SkyLook.view`). The stars, the Milky Way
// (`starfield.ts`) and the moon are drawn behind the cloud and dimmed by
// it; a veil of ice rings the sun with its 22° halo. Under the TRUE
// horizon — the level less the dip a raised lens sees (`horizon.ts`) — the
// dome is the far ground through the air (`haze.ts`'s `farColour`), or,
// over a valley fog, the fog's lit top.

import * as THREE from "three";

import { DOME_CLOUD_GLSL, type Clouds } from "./clouds.ts";
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
  /** The night's half of a look; the cloud's is `clouds`'s uniforms. */
  update(look: SkyLook): void;
  dispose(): void;
};

export function createSkyDome(haze: HazeUniforms, radius: number, clouds: Clouds): SkyDome {
  const geometry = new THREE.SphereGeometry(radius, 48, 24);
  const own = {
    uStars: { value: 0 },
    uGalaxy: { value: 0 },
    uTurn: { value: new THREE.Matrix3() },
    uStarTime: { value: 0 },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uMoonLit: { value: 0 },
    uNight: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: { ...haze, ...clouds.uniforms, ...own },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      varying vec4 vClip;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // Pinned to the far plane so nothing is ever clipped by the sky.
        gl_Position = p.xyww;
        vClip = p;
      }
    `,
    fragmentShader: /* glsl */ `
      ${SKY_GLSL}
      ${DOME_CLOUD_GLSL}
      uniform float uStars;
      uniform float uGalaxy;
      uniform mat3 uTurn;
      uniform float uStarTime;
      uniform vec3 uMoonDir;
      uniform float uMoonLit;
      uniform float uNight;
      varying vec3 vDir;
      varying vec4 vClip;
      ${STARFIELD_GLSL}

      void main() {
        vec3 d = normalize(vDir);
        vec3 c = skyColour(d);
        // THE CLOUD FIELD in front (\`clouds.ts\`): the slab's picture read
        // where this pixel stands on the screen (MEDIUM, HIGH), or the
        // shell's layers read here (LOW) — premultiplied, and the share of
        // what is behind it hidden.
        #if defined(CLOUD_SLAB) && CLOUD_SLAB == 2
          // HIGH's volume: its picture read where this pixel stands.
          vec4 cl = texture(uCloudTex, vClip.xy / vClip.w * 0.5 + 0.5);
        #elif defined(CLOUD_SLAB)
          // A linear read on a texel CORNER is the even mean of the 2 x 2
          // texels round it — the slab's 2 x 2 dither averaged away. Four
          // corners round this pixel, blended by where it stands among them.
          vec2 sz = vec2(textureSize(uCloudTex, 0));
          vec2 g = (vClip.xy / vClip.w * 0.5 + 0.5) * sz;
          vec2 c0 = floor(g);
          vec2 fr = g - c0;
          vec4 cl = mix(
            mix(texture(uCloudTex, c0 / sz), texture(uCloudTex, (c0 + vec2(1.0, 0.0)) / sz), fr.x),
            mix(texture(uCloudTex, (c0 + vec2(0.0, 1.0)) / sz), texture(uCloudTex, (c0 + 1.0) / sz), fr.x),
            fr.y);
        #else
          vec4 cl = cloudStack(cameraPosition, d, uSunPos, c, 0.0);
        #endif
        float hide = cl.a;
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
        // Its brightness follows the air it shines through, so a sun on the
        // horizon is a deep orange disc rather than a white one the tone
        // map clipped; and round it the AUREOLE, the aerosol's forward
        // glow, finer than the sky's grid can hold.
        float lift = 2.5 + 27.5 * smoothstep(0.0, 0.3, uSunPos.y);
        c += uSunCol * disc * lift * (1.0 - hide * 0.97);
        float aureole = exp(-(1.0 - mu) * 900.0) * 0.6 + exp(-(1.0 - mu) * 90.0) * 0.12;
        c += uSunCol * aureole * clearSky * smoothstep(-0.03, 0.01, uSunPos.y);

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

        c = c * clearSky + cl.rgb;
        // THE 22° HALO in a veil of ice round the sun.
        c += cloudHalo(d, uSunPos, uSunCol, uCloudOn.z) * (1.0 - 0.6 * hide);
        // UNDER THE TRUE HORIZON (\`uFar.x\` under the level: the Earth
        // curving away under a raised lens) the sky, its sun, moon, stars
        // and cloud end, and the far ground stands seen through the air
        // (\`farColour\`) — the horizon's own colour where it meets it,
        // darker the further down the view looks.
        // Over it the mist's band (\`mistBand\`), the colour the ground at
        // the mist's wall fades into, so the two meet with no seam.
        float below = -asin(clamp(d.y, -1.0, 1.0)) - uFar.x;
        float band = mistBand(d);
        float under = smoothstep(-0.0004, 0.0004, below);
        c = mix(c, farColour(d, max(smoothstep(0.0, 0.01, below), band)), max(under, band));
        // A VALLEY FOG SEEN FROM ABOVE (\`uSeaK\`): its lit top fills the
        // view under the level, going into the haze's colour far off.
        if (uSeaK > 0.0 && d.y < 0.0 && cameraPosition.y > uSea.w) {
          float t = (uSea.w - cameraPosition.y) / d.y;
          vec2 sp = cameraPosition.xz + d.xz * t;
          vec3 sea = mix(uSea.rgb * seaLumps(sp, t), hazeColour(d), 1.0 - exp(-t / 40000.0));
          c = mix(c, sea, smoothstep(0.0, -0.004, d.y));
        }
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
    update(look) {
      // The slab is read (a program of its own) only when it is drawn.
      const slab = clouds.slab() && clouds.uniforms.uCloudTex.value !== null;
      const want = slab ? (clouds.volume() ? 2 : 1) : 0;
      if ((material.defines.CLOUD_SLAB ?? 0) !== want) {
        if (want) material.defines.CLOUD_SLAB = want;
        else delete material.defines.CLOUD_SLAB;
        material.needsUpdate = true;
      }
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
