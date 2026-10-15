// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPRAY'S SHADERS, shared by both ways of flying it (`spray.ts`): the
// CPU pool hands each grain's place and motion in as attributes, the GPU
// ring (`gpu-spray.ts`) flies it in the vertex stage off the clock
// (`spray-flight.ts`) — and from there on a grain is drawn ONE way, so the
// two never look apart. What a grain looks like and how it is lit is said
// in `spray.ts`'s header.
//
// `sprayVertex(source)`: `source` declares what the vertex stage reads and
// defines `bool sprayParcel(out vec3 world, out vec3 move, out float size,
// out float alpha, out float hard, out float glint, out float seed)` — the
// grain's place, velocity, size across, opacity, hardness (0 a grain … 1 a
// clump), glint and its own steady seed; false for a dead slot.

import { LAMP_GLSL, LAMP_SLOTS, SKY_GLSL } from "./haze.ts";
import { SHELTER_GLSL } from "./shelter.ts";
import { AIR_LIGHT_FRAGMENT, AIR_LIGHT_VERTEX } from "./snow-air-light.ts";

export const sprayVertex = (source: string): string => /* glsl */ `
      ${source}
      uniform float uScale;
      uniform float uShutter;
      ${AIR_LIGHT_VERTEX}
      varying vec2 vUv;
      varying float vAlpha;
      varying float vHard;
      varying float vGlint;
      varying float vSeed;
      varying float vSize;
      varying float vPix;
      varying vec2 vSunSide;
      varying vec3 vAxisW;
      varying vec3 vSideW;
      varying vec3 vWorld;
      void main() {
        vec3 world;
        vec3 move;
        float size;
        float alpha;
        float hard;
        float glint;
        float seed;
        if (!sprayParcel(world, move, size, alpha, hard, glint, seed)) {
          // A dead slot: behind the lens, before any light is read for it.
          gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
          vAlpha = 0.0;
          return;
        }
        vec4 head = modelViewMatrix * vec4(world, 1.0);
        // The streak: where it was a shutter ago, a clump streaked less.
        vec3 back = world - move * uShutter * (1.0 - 0.75 * hard);
        vec4 tail = modelViewMatrix * vec4(back, 1.0);
        float depth = max(-head.z, 0.1);
        // A clump is drawn a size smaller than it flies: what reads as a
        // lump of snow at chase range is a fist, never a ball, and the ragged
        // edge the fragment cuts takes the rest of its silhouette.
        float drawn = size * (1.0 - 0.45 * hard);
        // Never thinner than about a pixel at its distance, so a far sheet
        // still reads as a fan rather than vanishing.
        float r = max(0.5 * drawn, 0.9 * depth / uScale);
        vec2 d = head.xy - tail.xy;
        float len = length(d);
        vec2 axis = len > 1e-4 ? d / len : vec2(0.0, 1.0);
        vec2 side = vec2(-axis.y, axis.x);
        vec3 mid = 0.5 * (head.xyz + tail.xyz);
        float along = r + 0.5 * len;
        vec3 at = mid + vec3(axis * along * position.x + side * r * position.y, 0.0);
        vUv = position.xy;
        // Thinned by its length: the same light spread down a longer stroke —
        // and let go of close to the lens, where a grain would be an egg
        // across the picture rather than a grain.
        vAlpha = alpha * sqrt(r / along) * smoothstep(0.7, 2.2, depth);
        vHard = hard;
        vGlint = glint;
        vSeed = seed;
        vSize = size;
        // How many pixels across its half-width is: a grain a pixel or two
        // across is a speck, a big one near the lens is a cluster of them.
        vPix = r * uScale / depth;
        // The sun's side of the quad, in its own (along, across) frame: a
        // clump's facets and a wisp's lit edge are turned to it.
        vec2 sunView = (viewMatrix * vec4(normalize(uSunDir), 0.0)).xy;
        float sl = length(sunView);
        sunView = sl > 1e-3 ? sunView / sl : vec2(0.0, 1.0);
        vSunSide = vec2(dot(sunView, axis), dot(sunView, side));
        // The quad's two axes in the world, for a normal the sky lights.
        vAxisW = (vec4(axis, 0.0, 0.0) * viewMatrix).xyz;
        vSideW = (vec4(side, 0.0, 0.0) * viewMatrix).xyz;
        vWorld = world;
        // The sky's light where the grain is (\`snow-air-light.ts\`).
        airLight(world);
        if (alpha <= 0.0) at = vec3(0.0, 0.0, 1.0); // dead: behind the lens
        gl_Position = projectionMatrix * vec4(at, 1.0);
      }
`;

export const SPRAY_FRAGMENT = /* glsl */ `
      ${SKY_GLSL}
      ${SHELTER_GLSL}
      ${LAMP_GLSL}
      ${AIR_LIGHT_FRAGMENT}
      uniform float uTime;
      uniform float uFlat;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vHard;
      varying float vGlint;
      varying float vSeed;
      varying float vSize;
      varying float vPix;
      varying vec2 vSunSide;
      varying vec3 vAxisW;
      varying vec3 vSideW;
      varying vec3 vWorld;
      float sprayHash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float sprayNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = sprayHash(i);
        float b = sprayHash(i + vec2(1.0, 0.0));
        float c = sprayHash(i + vec2(0.0, 1.0));
        float e = sprayHash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, e, f.x), f.y);
      }
      void main() {
        float r = dot(vUv, vUv);
        if (r > 1.0 || sheltered(vWorld)) discard;
        vec2 o = vec2(vSeed * 17.3, vSeed * 41.9);
        // THE SILHOUETTE. A clump is a broken lump: its rim pushed in and
        // out round it by a noise of the angle, never a disc. A grain is a
        // soft speck, and a big soft one — the powder a turn puts in the air
        // — is a WISP: a little volume of snow eroded by a noise, thinner
        // the bigger it has spread, so a sheet of them builds a veil rather
        // than a pile of balls.
        float ang = atan(vUv.y, vUv.x);
        float rim = 0.72 + 0.28 * sprayNoise(vec2(ang * 1.1 + o.x, o.y)) + 0.1 * sprayNoise(vec2(ang * 2.6 - o.y, o.x));
        float rc = r / (rim * rim);
        float wisp = smoothstep(0.08, 0.35, vSize) * (1.0 - vHard);
        float n = sprayNoise(vUv * 2.2 + o) * 0.65 + sprayNoise(vUv * 5.3 - o) * 0.35;
        float grain = (1.0 - r) * (1.0 - r);
        float puffy = clamp((1.0 - r) * (0.35 + 1.1 * n) - 0.28, 0.0, 1.0);
        // ONLY A TRUE CLUMP IS ONE LUMP. Anything softer flown as one
        // particle is, seen close, a LITTLE VOLUME OF GRAINS: specks
        // scattered over its footprint (a cell each, jittered, some empty)
        // in a thin haze of the fines — so a powder plume and a stop's sheet
        // read as granular snow in the air, never a pile of soft balls. Far
        // off, where the particle is a pixel or two, it is the speck.
        float clumpy = smoothstep(0.72, 0.95, vHard);
        vec2 q = vUv * 3.2 + o;
        vec2 ci = floor(q);
        vec2 cf = fract(q) - 0.5;
        float hr = sprayHash(ci + o);
        vec2 jit = vec2(sprayHash(ci + 3.1), sprayHash(ci + 7.7)) - 0.5;
        float dotR = 0.12 + 0.2 * hr;
        float speck = smoothstep(dotR, dotR * 0.45, length(cf - jit * 0.55)) * step(0.3, hr);
        float cluster = speck * (1.0 - r) * (0.75 + 0.35 * hr) + 0.22 * puffy;
        float close = smoothstep(3.0, 9.0, vPix);
        float soft = mix(grain, mix(cluster, puffy * 0.45, wisp * 0.6), close);
        float body = mix(soft, smoothstep(1.0, 0.7, rc), clumpy);
        if (body <= 0.003) discard;
        // Spread thin: a puff grown to many times its first size is the
        // same snow over a wider space.
        float thin = mix(1.0, clamp(0.09 / max(vSize, 1e-3), 0.4, 1.0), 1.0 - clumpy);
        vec3 ray = vWorld - cameraPosition;
        float dist = length(ray);
        vec3 view = ray / max(dist, 1e-3);
        // THE LIGHT. A clump has FACETS: a pseudo-normal off its place on
        // the quad and the noise, lit by the key on the sun's side and by
        // the sky on every side (\`airSky\`: the zenith's blue on top, the
        // snow's bounce under it). A grain or a wisp is a little volume that
        // shades itself: seen close, its far side and its middle stand in
        // the sky's light, only the sun's side of it as bright as sunlit
        // snow — so a plume reads against the slope it rose from.
        vec2 facet = normalize(vUv + (vec2(sprayNoise(vUv * 3.0 + o), sprayNoise(vUv * 3.0 - o)) - 0.5) * 1.2 + 1e-4);
        vec2 face = mix(vUv, facet, clumpy);
        vec3 N = normalize(vAxisW * face.x + vSideW * face.y - view * (0.7 - 0.3 * clumpy));
        float toSun = dot(facet, vSunSide);
        float litClump = clamp(0.5 + 0.55 * toSun, 0.0, 1.0);
        float litSoft = clamp(mix(0.62, 0.42, close) + 0.3 * dot(vUv, vSunSide), 0.0, 1.0);
        float lit = mix(litSoft, litClump, clumpy);
        vec3 col = airSky(N) * (1.0 - 0.25 * vHard) + vAirKey * lit * 1.35 * (1.0 - 0.7 * uFlat);
        // FORWARD SCATTER: ice grains between the eye and the sun throw it
        // on along the way it was going (Henyey–Greenstein, g 0.78) — a
        // backlit spray is a silver sheet, a powder plume glows white-gold
        // round a low sun, and the THIN of it glows the most: the edge of a
        // wisp and the fine grains, not the clump's opaque middle. The key
        // that reaches the grain (\`vAirKey\`): none in the mountain's shade.
        float mu = dot(view, normalize(uSunDir));
        float g = 0.78;
        float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
        float through = (1.0 - 0.75 * clumpy) * (1.0 - 0.55 * body);
        float above = smoothstep(-0.02, 0.06, uSunDir.y);
        col += vAirKey * hg * through * above * 0.3 * (1.0 - 0.8 * uFlat);
        // GLINTS: a crystal catching the sun as it turns — a pixel each,
        // more of them toward the sun, a clump's facets the most.
        vec2 gp = gl_FragCoord.xy;
        float flick = sprayHash(floor(gp) + vec2(vSeed * 97.0, floor(uTime * 14.0 + vSeed * 31.0)));
        float odds = (0.03 + 0.05 * vHard) * vGlint * (0.4 + min(hg / 12.0, 3.0) * 0.4);
        col += vAirKey * step(1.0 - odds, flick) * body * 6.0 * above;
        // THE LAMPS after dark: a floodlight's cone, a headlamp's beam,
        // lights the snow it passes through — brightest seen looking back
        // up it. The first empty slot ends them: by day one test.
        for (int i = 0; i < ${LAMP_SLOTS}; i++) {
          if (uLampOn[i] <= 0.0) break;
          vec3 toLamp = uLampPos[i] - vWorld;
          float gap = length(toLamp);
          float toward = 0.5 + 0.5 * pow(max(0.0, dot(view, uLampDir[i])), 3.0);
          col += uLampCol[i] * lampReach(i, toLamp / max(gap, 1e-3), gap) * toward * 1.8;
        }
        col += uPisteCol * length(pisteLight(vWorld)) * 1.2;
        gl_FragColor = vec4(col * 0.96, body * vAlpha * thin);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec3 hz = hazeColour(view);
        #if defined(TONE_MAPPING)
          hz = toneMapping(hz);
        #endif
        hz = linearToOutputTexel(vec4(hz, 1.0)).rgb;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, hz, hazeAmount(dist, ray.y));
      }
`;
