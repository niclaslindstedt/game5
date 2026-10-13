// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GPU SPRAY'S SHADERS (`gpu-spray.ts`). Every particle is written ONCE,
// when it is thrown — where, how fast, how big, what it is, the plane of the
// snow under it — and from then on the vertex shader flies it alone, as a
// closed form of the clock: a body under gravity against a LINEAR drag set by
// its own fall speed, carried by the wind,
//
//   v(t) = v∞ + (v0 − v∞)·e^(−kt),   x(t) = x0 + v∞·t + (v0 − v∞)·(1 − e^(−kt))/k,
//
// with k = g / (fall speed) and v∞ = (wind, −fall speed). Where that path
// meets the snow's plane (bisected, a few steps) the particle LANDS: a veil
// puff melts into the snow, a grain stops and lies as a glint, and a clump
// rolls a hand on and lies as a lump with its own shadow — the fan of broken
// snow a hockey stop leaves lying on a groomer, and the debris round a fall.
//
// Drawn as SOFT LIT SPRITES: each in-flight sprite is shaded as a little
// sphere of snow (its normal off the sprite's disc, turned to the world by
// the view), wrapped round for the veil's translucency, with the sun's
// forward scatter glowing through the thin edges against a low sun — and
// eroded by a noise of its own so a puff reads as a tuft, not a disc. A
// grain is streaked along its own velocity over a short shutter. Every
// sprite fades where it dips into the snow's plane — exact across the quad,
// both being planes — so a veil sits on the snow without a hard line.

export const GPU_SPRAY_VERTEX = /* glsl */ `
  attribute vec4 aSpot;   // x0, y0, z0, birth
  attribute vec4 aMove;   // vx, vy, vz, flight life
  attribute vec4 aKind;   // size, kind, fall speed, rest
  attribute vec4 aPlane;  // dy/dx, dy/dz, snow height at x0, glint
  uniform float uNow;
  uniform float uScale;
  uniform float uShutter;
  uniform vec3 uWind;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vKind;
  varying float vGlint;
  varying float vLanded;
  varying float vSeed;
  varying float vAbove;
  varying float vRadius;
  varying vec3 vWorld;
  varying vec3 vPlaneN;
  varying vec3 vPlaneA;
  varying vec3 vPlaneB;

  const float G = 9.0;

  vec3 flyAt(float t, vec3 p0, vec3 v0, vec3 vinf, float k) {
    return p0 + vinf * t + (v0 - vinf) * ((1.0 - exp(-k * t)) / k);
  }
  float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

  void main() {
    vec3 p0 = aSpot.xyz;
    vec3 v0 = aMove.xyz;
    float age = uNow - aSpot.w;
    float life = aMove.w;
    float size = aKind.x;
    float kind = aKind.y;
    float term = max(aKind.z, 0.2);
    float rest = aKind.w;
    vSeed = hash(float(gl_InstanceID) * 0.618 + aSpot.w);
    vKind = kind;
    vGlint = aPlane.w;
    if (age < 0.0 || age > life + rest || size <= 0.0) {
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      vAlpha = 0.0;
      return;
    }
    bool veil = kind < 0.05;
    bool clump = kind >= 0.5;
    float k = G / term;
    // The wind carries what hangs; a clump flies through it as a stone.
    float ws = veil ? 1.0 : (clump ? 0.15 : 0.6);
    vec3 vinf = vec3(uWind.x * ws, -term, uWind.z * ws);
    // The snow's plane under where it was thrown.
    vec2 grad = aPlane.xy;
    float h0 = aPlane.z;
    vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
    vec3 p = flyAt(age, p0, v0, vinf, k);
    float lift = veil ? 0.15 * size : 0.012;
    float tl = age;
    float landed = 0.0;
    float over = p.y - (h0 + dot(grad, p.xz - p0.xz)) - lift;
    if (over < 0.0) {
      // Bisect the moment it met the snow.
      float lo = 0.0;
      float hi = age;
      for (int i = 0; i < 9; i++) {
        float mid = 0.5 * (lo + hi);
        vec3 q = flyAt(mid, p0, v0, vinf, k);
        if (q.y - (h0 + dot(grad, q.xz - p0.xz)) - lift > 0.0) lo = mid; else hi = mid;
      }
      tl = hi;
      landed = 1.0;
      p = flyAt(tl, p0, v0, vinf, k);
      // A clump rolls a little on, a grain stops dead.
      vec3 vl = vinf + (v0 - vinf) * exp(-k * tl);
      p.xz += vl.xz * (clump ? 0.07 : 0.015);
      p.y = h0 + dot(grad, p.xz - p0.xz) + lift + (clump ? 0.02 : 0.008);
    }
    vLanded = landed;
    float flown = min(tl, life);
    float u = flown / life;
    float lay = max(age - tl, 0.0);
    // OPACITY: a quick fade in off the edge; a veil thinning as it spreads;
    // what is still up at the end of its flight faded out into the air;
    // what lies on the snow faded over its rest.
    float a = clamp(age * 30.0, 0.0, 1.0);
    if (veil) {
      a *= pow(1.0 - u, 1.6);
      if (landed > 0.5) a *= max(0.0, 1.0 - lay / 0.25);
    } else if (landed > 0.5) {
      a *= 1.0 - smoothstep(0.35 * rest, rest, lay);
    } else {
      a *= 1.0 - smoothstep(0.75, 1.0, u);
    }
    if (landed < 0.5 && age > life) a = 0.0;
    vAlpha = a;
    // A veil swells as it slows; a grain holds its size.
    float r = veil ? size * (0.6 + 1.8 * sqrt(min(age, life))) : size;
    vRadius = r;
    vec3 world;
    vec2 corner = position.xy;
    vUv = corner;
    vPlaneN = n;
    if (landed > 0.5 && !veil) {
      // LYING ON THE SNOW: a decal in its plane, turned by its seed, with
      // room beside it for the shadow it casts.
      float ang = vSeed * 6.2831;
      vec3 t0 = normalize(cross(n, vec3(cos(ang), 0.0, sin(ang))));
      vec3 t1 = cross(n, t0);
      vPlaneA = t0;
      vPlaneB = t1;
      float spread = clump ? 0.45 : 0.4;
      world = p + (t0 * corner.x + t1 * corner.y) * r * spread * 1.6;
      vUv = corner * 1.6;
      vec4 eye = viewMatrix * vec4(world, 1.0);
      vAbove = 1.0;
      vWorld = world;
      gl_Position = projectionMatrix * eye;
      return;
    }
    vPlaneA = vec3(1.0, 0.0, 0.0);
    vPlaneB = vec3(0.0, 0.0, 1.0);
    vec3 vel = vinf + (v0 - vinf) * exp(-k * flown);
    if (landed > 0.5) vel = vec3(0.0);
    vec4 head = modelViewMatrix * vec4(p, 1.0);
    // A grain streaked along its motion over the shutter; a puff is round.
    float streak = veil ? 0.0 : (clump ? 0.25 : 1.0);
    vec4 tail = modelViewMatrix * vec4(p - vel * uShutter * streak, 1.0);
    float depth = max(-head.z, 0.1);
    float rr = max(0.5 * r, 0.8 * depth / uScale);
    vec2 d = head.xy - tail.xy;
    float len = length(d);
    vec2 axis = len > 1e-4 ? d / len : vec2(0.0, 1.0);
    vec2 side = vec2(-axis.y, axis.x);
    float along = rr + 0.5 * len;
    vec3 mid = 0.5 * (head.xyz + tail.xyz);
    vec3 at = mid + vec3(axis * along * corner.x + side * rr * corner.y, 0.0);
    // Thinned by its length, and let go of right at the lens.
    vAlpha *= sqrt(rr / along) * smoothstep(0.5, 1.8, depth);
    // Back to the world for the plane test and the haze.
    world = cameraPosition + transpose(mat3(viewMatrix)) * at;
    vWorld = world;
    vAbove = world.y - (h0 + dot(grad, world.xz - p0.xz));
    gl_Position = projectionMatrix * vec4(at, 1.0);
  }
`;

export const gpuSprayFragment = (sky: string, shelter: string): string => /* glsl */ `
  ${sky}
  ${shelter}
  uniform vec3 uLit;
  uniform vec3 uShade;
  uniform float uNow;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vKind;
  varying float vGlint;
  varying float vLanded;
  varying float vSeed;
  varying float vAbove;
  varying float vRadius;
  varying vec3 vWorld;
  varying vec3 vPlaneN;
  varying vec3 vPlaneA;
  varying vec3 vPlaneB;

  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
               mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // Henyey–Greenstein: how much light a thin cloud of ice throws forward.
  float phase(float mu, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
  }

  void main() {
    if (vAlpha <= 0.002 || sheltered(vWorld)) discard;
    bool veil = vKind < 0.05;
    bool clump = vKind >= 0.5;
    vec3 L = normalize(uSunDir);
    float day = step(0.0, uSunDir.y);
    vec3 ray = vWorld - cameraPosition;
    float dist = length(ray);
    vec3 view = ray / max(dist, 1e-3);
    vec3 col;
    float alpha;
    if (vLanded > 0.5 && !veil) {
      // A LUMP ON THE SNOW, and its shadow beside it.
      vec2 uv = vUv;
      vec2 sunUv = vec2(dot(L, vPlaneA), dot(L, vPlaneB));
      float edge = 0.75 + 0.35 * vnoise(uv * 3.0 + vSeed * 17.0);
      float body = 1.0 - smoothstep(edge - 0.18, edge, length(uv));
      float shadow = 1.0 - smoothstep(edge - 0.3, edge, length(uv + sunUv * 0.55 * (clump ? 1.0 : 0.6)));
      vec3 nl = normalize(vPlaneN * 0.8 + (vPlaneA * uv.x + vPlaneB * uv.y) * 0.9);
      // In the shade of its own slope when the snow it lies on faces away.
      float sunny = smoothstep(-0.02, 0.12, dot(vPlaneN, L));
      float lit = clamp(dot(nl, L), 0.0, 1.0) * day * sunny;
      col = mix(uShade, uLit, 0.2 + 0.72 * lit);
      // A grain lying is a crystal face catching the sun; a clump a lump.
      float flick = hash2(floor(vWorld.xz * 60.0) + floor(uNow * 2.0));
      col += uSunCol * vGlint * step(0.9, flick) * body * day * sunny * (clump ? 0.6 : 1.4);
      float sh = shadow * (1.0 - body) * day * sunny * clamp(L.y * 3.0, 0.0, 1.0);
      if (body < 0.02 && sh < 0.02) discard;
      col = mix(uShade * 0.82, col, body / max(body + sh * 0.6, 1e-3));
      alpha = max(body, sh * 0.45) * vAlpha * (clump ? 1.0 : 0.85);
    } else {
      float r2 = dot(vUv, vUv);
      if (r2 > 1.0) discard;
      float n = vnoise(vUv * (veil ? 2.4 : 3.5) + vSeed * 31.0 + (veil ? uNow * 0.3 : 0.0));
      float n2 = vnoise(vUv * 6.0 - vSeed * 13.0);
      float shape = veil
        ? smoothstep(0.0, 0.55, (1.0 - r2) * (0.55 + 0.6 * n) - 0.12 * n2)
        : clump
          ? 1.0 - smoothstep(0.55 + 0.3 * n, 0.95, sqrt(r2))
          : (1.0 - r2) * (1.0 - r2);
      // The sprite as a little sphere of snow, turned to the world.
      vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      vec3 back = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
      vec3 nw = normalize(right * vUv.x + up * vUv.y + back * sqrt(max(1.0 - r2, 0.0)));
      float ndl = dot(nw, L);
      // The veil is translucent: the light wraps round it.
      // A fan of grains is lit as a whole: each one wrapped well round so
      // the sheet reads bright on its sunny side, never a grey sand of
      // half-shaded spheres. Close over snow that faces away from the sun
      // it is in that slope's shade.
      float lit = veil ? pow(clamp(0.5 + 0.5 * ndl, 0.0, 1.0), 1.4) : clamp(0.55 + 0.45 * ndl, 0.0, 1.0);
      float sunny = mix(smoothstep(-0.02, 0.12, dot(vPlaneN, L)), 1.0, smoothstep(0.4, 2.5, vAbove));
      lit *= day * sunny;
      col = mix(uShade, uLit, lit);
      // Self-shadow: the core and the underside of a dense puff are darker.
      if (veil) col *= 1.0 - 0.45 * shape * clamp(0.55 - 0.7 * dot(nw, vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
      // FORWARD SCATTER: seen into the sun the thin edges glow silver.
      float mu = dot(view, L);
      float thin = veil ? 1.15 - shape : 0.6;
      col += uSunCol * phase(mu, 0.78) * (veil ? 0.9 : 0.35) * thin * day * sunny;
      // GLINTS: a crystal in the air catching the sun now and then.
      float flick = hash2(vec2(vSeed * 91.0, floor(uNow * 12.0)));
      col += uSunCol * vGlint * step(0.95, flick) * (1.0 - r2) * (veil ? 0.0 : 1.6) * day * sunny;
      alpha = shape * vAlpha * (veil ? 0.38 : 1.0);
      // Soft where it dips into the snow: exact across the quad.
      alpha *= smoothstep(-0.02, veil ? 0.45 * vRadius : 0.02, vAbove);
    }
    gl_FragColor = vec4(col, alpha);
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
