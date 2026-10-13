// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VOLUME IN GLSL — HIGH's (and MAX's) cloud, raymarched through each
// layer of the field (`cloud-field.ts`) by `cloud-volume.ts`'s passes:
//
//   * WHERE: the field's own column is the WEATHER MAP — where a layer's
//     noise passes its cover's cut a column stands, its bottom and top the
//     envelope a cloud may fill (a heap's flat base and its dome, a
//     sheet's thickening about the middle). So the volume stands exactly
//     where the shell, the slab and the clouds' shadow on the snow say a
//     cloud is (`cloudShadow` reads the same columns), only now carved.
//   * WHAT: inside that envelope the Perlin-Worley SHAPE noise
//     (`cloud-volume-noise.ts`) is cut by how deep in the envelope a point
//     stands — near its skin only the fullest puffs survive, so the edge is
//     a pile of rounded cells — and the DETAIL noise eats the thin edge,
//     billowed on top and dragged into wisps underneath. Both carried with
//     the layer's wind and boiled slowly upward.
//   * THE LAYERS ARE SHELLS round the planet, not flat slabs: a straight
//     view rises over the curving ground, so a layer seen toward the
//     horizon closes into the band it is in a real sky and the march is a
//     finite run through it (`volShell`, the curvature's height s²/2R
//     about the map's middle — well conditioned in single floats).
//   * THE LIGHT: toward the sun a few reads of the shape at growing steps
//     (the optical depth), taken through Beer's law with two slower
//     lobes for the light that has scattered on (the many-scattering's
//     octaves: less extinction and a broader phase each), and the POWDER
//     term (a thin skin seen from the sun's side has had little light
//     scattered into it yet, so the edges away from the sun darken — gone
//     looking into the sun). The sun is the sun THROUGH THE AIR TO THAT
//     HEIGHT (`cloud-light.ts`'s base and top), so a towering heap's top
//     keeps a red sun after its base has lost it, and a base lit from
//     under once the sun is beneath the layer's horizon (the beam then
//     runs DOWN through it). The sky lights the rest, greyer toward the
//     base and deeper inside.
//
// The thin ice (cirrus, the veil) keeps the shell's one read: a few hundred
// metres of crystals at 8 km show no volume a lens could resolve.

import { CLOUD_LAYERS } from "./cloud-field.ts";

/** The volume's own uniforms and its density and light. Needs
 * `CLOUD_FIELD_GLSL` and `CLOUD_SHELL_GLSL` before it, and `STEPS` (the
 * steps through a layer) and `LIGHT` (the reads toward the sun) defined. */
export const CLOUD_VOLUME_GLSL = /* glsl */ `
uniform highp sampler3D uVolShape;
uniform highp sampler3D uVolDetail;
// Per layer: one over the shape's and the detail's tile, m; whether it is
// marched (1) or read as the shell (0); the detail's bite.
uniform vec4 uVolA[${CLOUD_LAYERS}];
// The shape's offset (periods, the wind's carry and the boil; w the
// layer's cover, the share of the sky it hides), and the detail's.
uniform vec4 uVolB[${CLOUD_LAYERS}];
uniform vec4 uVolC[${CLOUD_LAYERS}];
// The sun through the air to each layer's base and its top.
uniform vec3 uCloudSunLo[${CLOUD_LAYERS}];
uniform vec3 uCloudSunHi[${CLOUD_LAYERS}];
// The moon's share of those (taken back out: it is no sun from L's side).
uniform vec3 uCloudMoon;
// The planet: the map's middle (x, z), one over twice its radius, and the
// valley floor's height the layers are measured from.
uniform vec4 uEarth;

float volRemap(float x, float a, float b, float c, float d) {
  return c + (x - a) / max(b - a, 1e-4) * (d - c);
}

// A point's height over the curving ground's plane through the map's
// middle: its own y lifted by how far the planet has fallen away under it.
float volHeight(vec3 p) {
  vec2 s = p.xz - uEarth.xy;
  return p.y + dot(s, s) * uEarth.z;
}

// Where the view from \`e\` along \`d\` crosses the shell at height \`H\`:
// the roots of A t² + B t + C = 0 (C the eye's height over the shell),
// sorted; x > y when it never does.
vec2 volCross(vec3 e, vec3 d, float H) {
  vec2 o = e.xz - uEarth.xy;
  float A = dot(d.xz, d.xz) * uEarth.z;
  float B = d.y + 2.0 * dot(o, d.xz) * uEarth.z;
  float C = volHeight(e) - H;
  float disc = B * B - 4.0 * A * C;
  if (disc < 0.0) return vec2(1.0, -1.0);
  float q = -0.5 * (B + (B >= 0.0 ? 1.0 : -1.0) * sqrt(disc));
  float r1 = abs(A) > 1e-12 ? q / A : 1e9 * (q >= 0.0 ? 1.0 : -1.0);
  float r2 = abs(q) > 1e-9 ? C / q : 0.0;
  return vec2(min(r1, r2), max(r1, r2));
}

// THE RUN THROUGH A LAYER from its base \`yb\` to its top \`yt\` (world
// heights at the map's middle): where the view enters and leaves it ahead
// of the eye, the nearer stretch only (a view that leaves through the base
// and would come up again past the horizon is not followed).
vec2 volShell(vec3 e, vec3 d, float yb, float yt) {
  float h = volHeight(e);
  vec2 rb = volCross(e, d, yb);
  vec2 rt = volCross(e, d, yt);
  if (h < yb) {
    // Below: in through the base, out through the top.
    return vec2(max(rb.y, 0.0), max(rt.y, 0.0));
  }
  if (h <= yt) {
    // Inside: out through the base if the view falls to it first.
    if (rb.x <= rb.y && rb.x > 0.0) return vec2(0.0, rb.x);
    return vec2(0.0, max(rt.y, 0.0));
  }
  // Above: in through the top if the view falls to it at all.
  if (rt.x > rt.y || rt.y <= 0.0) return vec2(1.0, 0.0);
  float out1 = rb.x <= rb.y && rb.x > 0.0 ? rb.x : rt.y;
  return vec2(max(rt.x, 0.0), out1);
}

// THE DENSITY of layer \`i\` at \`p\`, 0..1, and how far up its column the
// point stands (\`k\`, 0 the column's base, 1 its top; −1 where no column
// stands at all). \`fine\` takes the detail's bite too (the view's reads;
// the light's go without).
// How much of the detail's bite the march is taking at its distance (a
// far heap's puffs are under a pixel: carved, they only sparkle).
float volBiteK = 1.0;

float volDensity(int i, vec3 p, float hm, bool fine, out float k) {
  k = -1.0;
  vec2 col = cloudColumn(i, cloudNoise(i, p.xz));
  float span = col.y - col.x;
  if (span <= 0.002) return 0.0;
  k = (hm - col.x) / span;
  if (k <= 0.0 || k >= 1.0) {
    k = 0.0;
    return 0.0;
  }
  float dome = uCloudC[i].w;
  // The envelope's depth at this height: a heap's base flat and its top
  // rounded, a sheet soft both ways; thinner where the column is short
  // (the cloud's own edge).
  float lo = smoothstep(0.0, mix(0.3, 0.07, dome), k);
  float hi = smoothstep(1.0, mix(0.6, 0.45, dome), k);
  float inside = lo * hi * smoothstep(0.0, 0.45, span);
  vec3 q = vec3(p.x, hm * uCloudA[i].y + uCloudA[i].x, p.z);
  vec4 s = texture(uVolShape, q * uVolA[i].x + uVolB[i].xyz);
  float fbm = s.g * 0.625 + s.b * 0.25 + s.a * 0.125;
  float shape = clamp(volRemap(s.r, fbm - 1.0, 1.0, 0.0, 1.0), 0.0, 1.0);
  float dens = clamp(volRemap(shape, 1.0 - inside, 1.0, 0.0, 1.0), 0.0, 1.0);
  if (fine && dens > 0.0) {
    vec3 dt = texture(uVolDetail, q * uVolA[i].y + uVolC[i].xyz).rgb;
    float dn = dt.r * 0.625 + dt.g * 0.25 + dt.b * 0.125;
    // Wisps under the base, billows over the top.
    dn = mix(1.0 - dn, dn, clamp(k * 4.0, 0.0, 1.0));
    dens = clamp(volRemap(dens, dn * uVolA[i].w * volBiteK, 1.0, 0.0, 1.0), 0.0, 1.0);
  }
  return dens;
}

// THE SUN THROUGH THE CLOUD from \`p\` toward \`L\`: the optical depth over
// \`LIGHT\` reads at steps growing from \`step\`.
float volOdToSun(int i, vec3 p, vec3 L, float yb, float depth, float sigma, float step) {
  float od = 0.0;
  float t = 0.0;
  float dt = step;
  float mean = 0.0;
  float hq = 0.0;
  for (int j = 0; j < LIGHT; j++) {
    t += dt;
    vec3 q = p + L * (t - 0.5 * dt);
    hq = (volHeight(q) - yb) / depth;
    if (hq < -0.05 || hq > 1.05) return od;
    float kq;
    float dq = volDensity(i, q, hq, false, kq);
    od += sigma * dq * dt;
    mean += dq / float(LIGHT);
    dt *= 1.9;
  }
  // Still inside the layer when the reads run out (a low sun through a
  // deck goes tens of kilometres through it): the rest of the way out
  // through its top, at the mean density the reads met — a deck's only:
  // past a heap's own puff a low sun crosses the clear air between heaps.
  // (up and out through its top by day; once the sun is down, down and
  // out through its base, so a deck's underside still catches the glow).
  float rest = L.y >= 0.0 ? (1.0 - hq) * depth / max(L.y, 0.03) : hq * depth / max(-L.y, 0.15);
  // A hole the reads happened to stand in does not light a closed deck:
  // the way on is through cloud at the deck's own mean.
  float deck = smoothstep(0.55, 0.95, uVolB[i].w);
  return od + sigma * max(mean, 0.4 * uVolB[i].w) * deck * min(rest, 30000.0);
}

// ONE LAYER MARCHED: premultiplied colour, the share hidden, and in \`dist\`
// the distance the cloud's light comes from (the hidden share's mean).
vec4 cloudLayerVolume(int i, vec3 e, vec3 d, vec3 L, vec3 sky, float jit, out float dist) {
  dist = 0.0;
  float yb = uCloudA[i].x;
  float depth = uCloudA[i].y;
  vec2 run = volShell(e, d, yb, yb + depth);
  if (run.y <= run.x) return vec4(0.0);
  float t0 = run.x;
  if (t0 > 120000.0) return vec4(0.0);
  // A run grazing the layer is followed no further than its cells can be
  // made out through the air; past it the air has the rest.
  float t1 = min(run.y, t0 + 30000.0);
  float sigma = uCloudA[i].w / depth * 1.6;
  float mu = dot(d, L);
  // The light's lobes: the droplets' forward peak (the silver lining), the
  // broad body and a little back-scatter — as the slab's, so the tiers meet.
  float phase = 0.75 + 0.12 * cloudHg(mu, 0.75) + 0.25 * cloudHg(mu, -0.25);
  float phase2 = 0.8 + 0.06 * cloudHg(mu, 0.4);
  float powderOn = 0.5 - 0.5 * mu;
  float lightStep = clamp(depth * 0.04, 15.0, 60.0);
  vec3 acc = vec3(0.0);
  float T = 1.0;
  float wsum = 0.0;
  // Steps a share of the distance (a pixel's footprint grows with it, so
  // a far heap needs no finer read), never under a twentieth of the layer,
  // and longer where no column stands (nothing to read there); the first
  // jittered into its step, so the steps' planes never line up across the
  // screen as rings.
  float least = max(depth / 20.0, 25.0);
  float t = t0 + max(least, 0.03 * t0) * jit;
  for (int k = 0; k < STEPS; k++) {
    if (t > t1) break;
    float dt = max(least, 0.03 * t);
    vec3 p = e + d * t;
    float tc = t;
    float hm = (volHeight(p) - yb) / depth;
    volBiteK = smoothstep(30000.0, 3000.0, t);
    float kc;
    float dens = volDensity(i, p, hm, true, kc);
    t += kc < 0.0 ? 2.5 * dt : dt;
    if (dens <= 0.0) continue;
    float od = volOdToSun(i, p, L, yb, depth, sigma, lightStep);
    // Beer's law and the scattered light's slower lobes.
    float beer = exp(-od) + (0.45 * exp(-0.3 * od) + 0.12 * exp(-0.1 * od)) * phase2 / phase;
    // Deep in a thick deck the light that arrives is the diffused light
    // alone, which thins as one over the depth rather than exponentially
    // (the two-stream answer for a forward-scattering droplet cloud):
    // a deck's base is grey, never black.
    beer = max(beer, 0.8 / ((1.0 + 0.19 * od) * phase));
    float powder = mix(1.0, 1.0 - exp(-sigma * dens * 120.0), powderOn);
    float kl = clamp(hm, 0.0, 1.0);
    vec3 sun = max(mix(uCloudSunLo[i], uCloudSunHi[i], kl) - uCloudMoon, 0.0);
    // The sky on it: the top's light over a heap, the base's grey under,
    // dimmer the deeper in the column the point stands.
    vec3 amb = mix(uCloudBase[i], uCloudTop[i], kl) * (0.72 + 0.28 * kc) + uCloudMoon * (0.3 + 0.3 * kl);
    vec3 c = sun * beer * phase * powder * 0.75 + amb;
    float a = 1.0 - exp(-sigma * dens * dt);
    vec3 air = cloudAir(tc, e.y - uCloudSeaLevel, p.y - uCloudSeaLevel);
    float w = T * a;
    acc += w * (c * air + sky * (1.0 - air));
    dist += w * tc;
    wsum += w;
    T *= 1.0 - a;
    if (T < 0.01) break;
  }
  dist = wsum > 0.0 ? dist / wsum : 0.0;
  float fade = smoothstep(120000.0, 60000.0, t0);
  return vec4(acc, 1.0 - T) * fade;
}

// EVERY LAYER along the view, front to back (the field's layers kept
// sorted by height): the marched ones, and the shell's read for the thin
// ice. \`dist\` the distance the whole stack's light comes from — what the
// reprojection carries a pixel by (far off, the sky's own: 1e5).
vec4 volStack(vec3 e, vec3 d, vec3 L, vec3 sky, float jit, out float dist) {
  vec4 acc = vec4(0.0);
  float dsum = 0.0;
  float wsum = 0.0;
  int n = int(uCloudOn.x + 0.5);
  for (int k = 0; k < ${CLOUD_LAYERS}; k++) {
    if (k >= n) break;
    int i = d.y >= 0.0 ? k : n - 1 - k;
    vec4 c;
    float di = 0.0;
    if (uVolA[i].z > 0.5) {
      c = cloudLayerVolume(i, e, d, L, sky, jit, di);
    } else {
      c = cloudLayerShell(i, e, d, L, sky);
      float yb = uCloudA[i].x + 0.5 * uCloudA[i].y;
      di = abs((yb - e.y) / (abs(d.y) > 1e-3 ? d.y : 1e-3));
    }
    float w = (1.0 - acc.a) * c.a;
    dsum += w * di;
    wsum += w;
    acc.rgb += (1.0 - acc.a) * c.rgb;
    acc.a += (1.0 - acc.a) * c.a;
  }
  dist = wsum > 1e-4 ? dsum / wsum : 1e5;
  return acc * uCloudOn.y;
}
`;
