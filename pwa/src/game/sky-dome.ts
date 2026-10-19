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
import { CONTRAIL_GLSL } from "./contrail-glsl.ts";
import type { Contrails } from "./contrails.ts";
import { SKY_GLSL, type HazeUniforms } from "./haze.ts";
import type { SkyLook } from "./sky.ts";
import { MOON_GLSL } from "./moon-glsl.ts";
import { DISC, surfaceSurge } from "./night-sky.ts";
import { STARFIELD_GLSL, turnBasis } from "./starfield.ts";
import { FAR_AIR } from "./far-ranges-plan.ts";
import { nodeTwin } from "./gpu-backend.ts";

/** THE FAR RANGES PAINTED ON THE DOME (the HORIZON row's PAINTED): the baked skyline
 * (`far-silhouette.ts`) read at this pixel's bearing and turned into an
 * angle from where the lens stands, its two layers laid over the sky as
 * the far ground through the air — the far one paler, the near one nearer
 * the ground's own colour, each lit on the faces turned to the sun and
 * shading off below its crest. */
const SKYLINE_GLSL = /* glsl */ `
// The skyline at bearing \`az\` (turns, 0 along +z, clockwise from above).
vec4 skylineAt(float az) {
  float bins = float(textureSize(uSkyline, 0).x);
  float x = fract(az + 1.0) * bins - 0.5;
  float i0 = floor(x);
  int a = int(mod(i0, bins));
  int b = int(mod(i0 + 1.0, bins));
  return mix(texelFetch(uSkyline, ivec2(a, 0), 0), texelFetch(uSkyline, ivec2(b, 0), 0), x - i0);
}
// The angle a layer's crest stands at from the lens (\`h\`, \`dist\`).
float crestAt(float h, float dist) {
  return atan(h - cameraPosition.y, dist);
}
// A range's colour \`below\` rad under its crest, \`dist\` m off, its face
// turned as the crest runs (\`slope\`: rad of rise a rad to the right).
vec3 ridgeColour(vec3 dh, float dist, float below, float slope) {
  vec3 air = hazeColour(dh);
  // The far ranges' air (\`FAR_AIR\`): the game's haze over the map's
  // scale, the clear air's past it.
  float far = min(dist, ${FAR_AIR.near.toFixed(1)}) + max(dist - ${FAR_AIR.near.toFixed(1)}, 0.0) * ${FAR_AIR.thin.toFixed(3)};
  float seen = exp(-far * uHaze * mix(uHazeFloor, 1.0, 0.5));
  // The face under a crest rising to the right falls away to the left:
  // turned toward the lens, up a mountain's steepness, and to the side
  // the crest falls to — lit as the sun stands to it.
  vec3 right = vec3(dh.z, 0.0, -dh.x);
  vec3 face = normalize(vec3(0.0, 0.8, 0.0) - dh * 0.6 - right * clamp(slope * 3.0, -1.5, 1.5));
  float lit = 0.8 * max(dot(face, uSunDir), 0.0) + 0.2 * max(uSunDir.y, 0.0);
  // The far ground's light (\`FAR_ALBEDO\`, a third, the country's mean)
  // on SNOW at the crests, falling to the woods' and the rock's a degree
  // or so under them.
  float snow = mix(3.0, 1.2, smoothstep(0.0, 0.015, below));
  vec3 ground = (uFarGround + uFarKey * lit) * snow;
  // The foot of a range is seen through the valleys' air under it.
  seen *= mix(1.0, 0.75, smoothstep(0.01, 0.06, below));
  return mix(air, ground, seen);
}
vec3 paintSkyline(vec3 c, vec3 d) {
  vec2 hz = d.xz;
  if (dot(hz, hz) < 1e-8) return c;
  vec3 dh = vec3(normalize(hz), 0.0).xzy;
  float el = asin(clamp(d.y, -1.0, 1.0));
  float px = max(fwidth(el), 1e-5);
  float az = atan(d.x, d.z) / 6.28318531;
  // Two texels either side, for the way each crest runs.
  float step = 2.0 / float(textureSize(uSkyline, 0).x);
  vec4 s = skylineAt(az);
  vec4 l = skylineAt(az - step);
  vec4 r = skylineAt(az + step);
  float span = step * 12.5663706;
  float farEl = crestAt(s.z, s.w);
  float farSlope = (crestAt(r.z, r.w) - crestAt(l.z, l.w)) / span;
  float nearEl = crestAt(s.x, s.y);
  float nearSlope = (crestAt(r.x, r.y) - crestAt(l.x, l.y)) / span;
  c = mix(c, ridgeColour(dh, s.w, farEl - el, farSlope), smoothstep(farEl + px, farEl - px, el));
  c = mix(c, ridgeColour(dh, s.y, nearEl - el, nearSlope), smoothstep(nearEl + px, nearEl - px, el));
  return c;
}
`;

/** The sun's apparent radius, rad — a touch over the real 0.27° so the disc
 * is more than a pixel on a phone. */
export const SUN_RADIUS = 0.0085;

export type SkyDome = {
  mesh: THREE.Mesh;
  /** Keep the dome centred on the lens. */
  follow(camera: THREE.Camera): void;
  /** The night's half of a look; the cloud's is `clouds`'s uniforms. */
  update(look: SkyLook): void;
  /** The program the dome reads the clouds' picture with, as the clouds
   * now stand: `update`'s first step, and the load's before it warms. */
  syncClouds(): void;
  /** The SKY row's PLAIN: the air's colour alone, nothing in it. */
  setPlain(on: boolean): void;
  /** The HORIZON row's PAINTED: the far ranges' skyline painted on the
   * dome (`far-silhouette.ts`; null: none, the rings' mesh stands). */
  setSkyline(skyline: THREE.DataTexture | null): void;
  dispose(): void;
};

export function createSkyDome(
  haze: HazeUniforms,
  radius: number,
  clouds: Clouds,
  contrails: Contrails | null = null,
): SkyDome {
  const geometry = new THREE.SphereGeometry(radius, 48, 24);
  const own = {
    uStars: { value: 0 },
    uGalaxy: { value: 0 },
    uTurn: { value: new THREE.Matrix3() },
    uStarTime: { value: 0 },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uMoonDisc: { value: new THREE.Vector4() },
    uMoonCol: { value: new THREE.Vector3() },
    uMoonGlow: { value: new THREE.Vector3() },
    uStarSky: { value: new THREE.Vector4() },
    uSkyline: { value: null as THREE.DataTexture | null },
    uSkylineOn: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: { ...haze, ...clouds.uniforms, ...(contrails?.uniforms ?? {}), ...own },
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
      ${contrails ? CONTRAIL_GLSL : ""}
      uniform float uStars;
      uniform float uGalaxy;
      uniform mat3 uTurn;
      uniform float uStarTime;
      uniform vec3 uMoonDir;
      uniform vec4 uMoonDisc;
      uniform vec3 uMoonCol;
      uniform vec3 uMoonGlow;
      uniform vec4 uStarSky;
      uniform sampler2D uSkyline;
      uniform float uSkylineOn;
      varying vec3 vDir;
      varying vec4 vClip;
      ${STARFIELD_GLSL}
      ${MOON_GLSL}
      ${SKYLINE_GLSL}

      void main() {
        vec3 d = normalize(vDir);
        vec3 c = skyColour(d);
        // A PLAIN SKY (the SKY row's) is the air's own colour and no more:
        // nothing stands in it, so none of what follows is compiled.
        #ifndef PLAIN_SKY
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

        // THE MOON'S SKY close round it: the air's forward glow, warmer
        // and brighter toward the moon than the dome's rows can hold.
        vec3 mo = d - uMoonDir * dot(d, uMoonDir);
        float th = dot(d, uMoonDir) > 0.0 ? length(mo) : 3.0;
        vec3 moonAir = uMoonGlow * (0.035 * exp(-th * 3.0) + 0.08 * exp(-th * th * 900.0));
        c += moonAir * clearSky;
        // THE MOON'S DISC (\`moonDisc\`): what of it covers this pixel.
        vec3 pole = vec3(uTurn[0][2], uTurn[1][2], uTurn[2][2]);
        vec4 moon = moonDisc(d, uMoonDir, uSunPos, pole, uMoonDisc, uMoonCol);

        // THE NIGHT SKY, behind everything: the stars and the Milky Way on
        // the sphere the map's hour has turned (starfield.ts), as many as
        // the sky's own brightness here lets through, taken by the cloud
        // and the moon in front.
        if (uStars > 0.001 || uGalaxy > 0.001) {
          float glare = clamp(dot(uMoonGlow, vec3(0.2126, 0.7152, 0.0722)) * 2.0, 0.0, 1.0)
                      * exp(-th * th * 7.0) * step(-0.02, uMoonDir.y);
          float rel = dot(c, vec3(0.2126, 0.7152, 0.0722)) / max(uStarSky.y, 1e-6);
          float limit = uStarSky.x - uStarSky.z * log2(max(rel, 1e-3)) * 0.30103;
          c += nightSky(uTurn * d, d, d.y, glare, uStars, uGalaxy, uStarTime, limit)
             * clearSky * (1.0 - moon.a);
        }

        // THE SUN'S DISC.
        float mu = dot(d, uSunPos);
        float disc = smoothstep(cos(${SUN_RADIUS.toFixed(5)}) - 0.00002, cos(${SUN_RADIUS.toFixed(5)}) + 0.00001, mu);
        // Its brightness follows the air it shines through, so a sun on the
        // horizon is a deep orange disc rather than a white one the tone
        // map clipped — and the disc IS the sun: its radiance swamps the
        // sky in front of it, so over a low sun it takes the sun's own red
        // rather than the yellow glow round it (added, the glow's green
        // whitened it). Round it the AUREOLE, the aerosol's forward glow,
        // finer than the sky's grid can hold.
        float lift = 2.5 + 27.5 * smoothstep(0.0, 0.3, uSunPos.y);
        float own = smoothstep(0.02, 0.12, uSunPos.y);
        // Under a lid the grey air and the snow between take it too, the
        // more the lower it stands: no orange spark through a blizzard.
        disc *= exp(-uCloudVeil * 600.0 / max(uSunPos.y, 0.03));
        c = mix(c, uSunCol * lift + c * mix(0.15, 1.0, own), disc * (1.0 - hide * 0.97));
        float aureole = exp(-(1.0 - mu) * 900.0) * 0.6 + exp(-(1.0 - mu) * 90.0) * 0.12;
        c += uSunCol * aureole * clearSky * smoothstep(-0.03, 0.01, uSunPos.y);

        // THE MOON in front of the sky behind it (the air's own light is
        // in front of it, so it adds), dimmed by any cloud before it.
        c += moon.rgb * (1.0 - hide * 0.93);

        // THE CONTRAILS (\`contrail-glsl.ts\`): over the sky, the sun and
        // the stars, under every cloud layer (the cirrus stands under the
        // airways).
        ${contrails ? "vec4 tr = contrailSky(cameraPosition, d, c); c = c * (1.0 - tr.a) + tr.rgb;" : ""}
        c = c * clearSky + cl.rgb;
        // THE 22° HALO in a veil of ice round the sun, and round the moon.
        c += cloudHalo(d, uSunPos, uSunCol, uCloudOn.z) * (1.0 - 0.6 * hide);
        c += cloudHalo(d, uMoonDir, uMoonGlow * 1.6, uCloudOn.z) * (1.0 - 0.6 * hide);
        // THE CORONA where thin cloud stands in front of the moon: the
        // droplets' diffraction — a bluish-white aureole a few degrees
        // across and a reddish ring round it.
        c += moonCorona(th, hide, uMoonGlow);
        #endif
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
        if (uSkylineOn > 0.5) {
          // A painted skyline stands down over the far ground too: the
          // country between is the near range's own slopes.
          c = mix(c, farColour(d, smoothstep(0.0, 0.01, below)), under);
          c = paintSkyline(c, d);
          c = mix(c, farColour(d, band), band);
        } else {
          c = mix(c, farColour(d, max(smoothstep(0.0, 0.01, below), band)), max(under, band));
        }
        // A VALLEY FOG SEEN FROM ABOVE (\`uSeaK\`): its lit top fills the
        // view under the level, going into the haze's colour far off.
        if (uSeaK > 0.0 && d.y < 0.0 && cameraPosition.y > uSea.w) {
          float t = (uSea.w - cameraPosition.y) / d.y;
          vec2 sp = cameraPosition.xz + d.xz * t;
          vec3 sea = mix(seaTop(sp, t), hazeColour(d), 1.0 - exp(-t / 40000.0));
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
  // The webgpu paths draw it with its node twin (`sky-dome-tsl.ts`).
  nodeTwin(material, "sky", "dome");
  const basis: number[] = [];
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  const syncClouds = (): void => {
    // The slab is read (a program of its own) only when it is drawn.
    const slab = clouds.slab() && clouds.uniforms.uCloudTex.value !== null;
    const want = slab ? (clouds.volume() ? 2 : 1) : 0;
    if ((material.defines.CLOUD_SLAB ?? 0) !== want) {
      if (want) material.defines.CLOUD_SLAB = want;
      else delete material.defines.CLOUD_SLAB;
      material.needsUpdate = true;
    }
  };
  return {
    mesh,
    follow(camera) {
      mesh.position.copy(camera.position);
    },
    setPlain(on) {
      if (!!material.defines.PLAIN_SKY === on) return;
      if (on) material.defines.PLAIN_SKY = 1;
      else delete material.defines.PLAIN_SKY;
      material.needsUpdate = true;
    },
    setSkyline(skyline) {
      own.uSkyline.value = skyline;
      own.uSkylineOn.value = skyline ? 1 : 0;
    },
    syncClouds,
    update(look) {
      syncClouds();
      own.uStars.value = look.stars;
      own.uGalaxy.value = look.galaxy;
      const m = turnBasis(look.turn, basis);
      own.uTurn.value.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
      // The twinkle's clock, wrapped so a float counting all night keeps
      // the precision a twinkle needs. Presentation only.
      own.uStarTime.value = (performance.now() / 1000) % 3600;
      own.uMoonDir.value.set(look.moon.x, look.moon.y, look.moon.z);
      const md = look.moonDisc;
      own.uMoonDisc.value.set(
        md.radius,
        md.phase,
        Math.pow(surfaceSurge(md.phase), DISC.span),
        md.earthshine,
      );
      own.uMoonCol.value.set(...md.colour);
      own.uMoonGlow.value.set(...md.glow);
      // The faintest star seen at the zenith, the zenith's drawn luminance
      // it is reckoned against, and how many magnitudes a decade of the
      // drawn sky's brightness costs: the twilight's sky is pressed (twice
      // the decades), the night's drawn as it is.
      const zl = 0.2126 * look.zenith[0] + 0.7152 * look.zenith[1] + 0.0722 * look.zenith[2];
      const twilight = Math.min(1, Math.max(0, (look.elevation + 0.245) / 0.14));
      own.uStarSky.value.set(look.starLimit, zl, 1.7 + 3.3 * twilight, 0);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
