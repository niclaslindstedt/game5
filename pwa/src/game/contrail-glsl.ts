// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CONTRAILS IN GLSL — drawn in the dome (`sky-dome.ts`), behind the
// cloud field and in front of the sky, the sun and the stars, off the
// segments `contrail-plan.ts` hands out each frame (`contrails.ts` packs
// them). No mesh and no pass: each sky pixel asks each trail where the
// view crosses the trail's height and how far that is off its line, and
// only a pixel near one reads its structure. What a trail looks like at
// each age, from the research (`docs/contrails.md`):
//
//   * A DARK GAP behind the plane: the first second or so of exhaust is
//     not yet ice. The plane itself is a GLINT at the head while the sun
//     is on it.
//   * FRESH: two lines (an engine pair under each wing, rolled into the
//     two wing-tip vortices) a few tens of metres apart, crisp and white,
//     merging into one within seconds.
//   * HALF A MINUTE TO A FEW MINUTES: the vortex pair's CROW INSTABILITY
//     — the line kinks into a wave a few hundred metres long, pinches and
//     breaks into a row of PUFFS.
//   * OLD (persistent): a band SPREADING at its lidar rate, thinning as it
//     goes, its edges FIBROUS and its body streaked along its length.
//
// It is lit as thin ice: the sun at the airways' height (`cloud-light.ts`'s
// `ice` — still gold and pink after the snow's sunset), a strong forward
// scatter so a trail near the sun glows, the sky's blue from over it in
// its shade; the air between takes it as it takes a cloud (`cloudAir`), and
// a pixel wider than the trail spreads its ice over the pixel rather than
// flickering. A trail is drawn as dense as it is: a short one's life fades
// it, a persistent one's spread thins it toward grey translucence.

import { CONTRAIL } from "./contrail-plan.ts";

const f = (x: number): string => x.toFixed(5);

/** The most trails a dome reads — the uniforms' size. */
export const TRAIL_SLOTS = CONTRAIL.most;

/** Needs `SKY_GLSL` (`uSunPos`) and `CLOUD_FIELD_GLSL` (`cloudAir`,
 * `uCloudSeaLevel`) before it. */
export const CONTRAIL_GLSL = /* glsl */ `
// Per trail: head x, z; tail x, z (world).
uniform vec4 uTrailA[${TRAIL_SLOTS}];
// The world y it was laid at; the ages at the head and the tail, s; its
// width as laid, m.
uniform vec4 uTrailB[${TRAIL_SLOTS}];
// Where along the flight path the head and the tail were laid, m; how fast
// it spreads, m/s; a short one's life, s (0 a persistent one).
uniform vec4 uTrailC[${TRAIL_SLOTS}];
// Its optical depth as laid; the puffs' phase (0..1); whether the plane
// is over the head (its glint); 1 for a trail that formed at all.
uniform vec4 uTrailD[${TRAIL_SLOTS}];
// x how many; y how much of the high sky shows; z one pixel's angle, rad;
// w the fibres' detail (the CLOUDS row: 0 on LOW).
uniform vec4 uTrailOn;
// The map's middle (x, z), the reach the trails fade out at, m, and w how
// much the sun lights a plane for its glint (none once it has set up there).
uniform vec4 uTrailMid;
// The sun on the ice at their height, and the sky's light on it.
uniform vec3 uTrailSun;
uniform vec3 uTrailSky;

float trailHash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}
float trailNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 u = p - i;
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(trailHash(i), trailHash(i + vec2(1.0, 0.0)), u.x),
             mix(trailHash(i + vec2(0.0, 1.0)), trailHash(i + 1.0), u.x), u.y);
}
float trailHg(float mu, float g) {
  return (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
}

// The trails in front of the sky along \`d\` from the eye \`e\`, the sky's
// colour there \`sky\`: premultiplied colour and the share hidden.
vec4 contrailSky(vec3 e, vec3 d, vec3 sky) {
  vec4 acc = vec4(0.0);
  if (uTrailOn.y <= 0.0 || d.y < 0.008) return acc;
  int n = int(uTrailOn.x + 0.5);
  float mu = dot(d, uSunPos);
  // Ice's phase: a broad lobe and the crystals' strong forward peak.
  float phase = 0.55 + 0.1 * trailHg(mu, 0.85) + 0.18 * trailHg(mu, -0.2);
  vec2 dh = d.xz / max(length(d.xz), 1e-4);
  for (int k = 0; k < ${TRAIL_SLOTS}; k++) {
    if (k >= n) break;
    vec4 A = uTrailA[k];
    vec4 B = uTrailB[k];
    vec4 C = uTrailC[k];
    vec4 D = uTrailD[k];
    vec2 ax = A.zw - A.xy;
    float L2 = max(dot(ax, ax), 1.0);
    // Where the view crosses the height it was laid at; then again at the
    // height the trail has sunk to there.
    float t1 = (B.x - e.y) / d.y;
    vec2 p = e.xz + d.xz * t1;
    float u = clamp(dot(p - A.xy, ax) / L2, 0.0, 1.0);
    float age = mix(B.y, B.z, u);
    float y = B.x - ${f(CONTRAIL.sink)} * (1.0 - exp(-age / ${f(CONTRAIL.sinkTime)}));
    t1 = (y - e.y) / d.y;
    if (t1 <= 0.0 || t1 > 160000.0) continue;
    p = e.xz + d.xz * t1;
    u = clamp(dot(p - A.xy, ax) / L2, 0.0, 1.0);
    age = mix(B.y, B.z, u);
    float w = B.w + C.z * age;
    vec2 nrm = vec2(ax.y, -ax.x) * inversesqrt(L2);
    vec2 q = p - (A.xy + ax * u);
    float x = dot(q, nrm);
    // The pixel's footprint across the trail on its height: drawn out where
    // the view runs along the slant across it.
    float across = abs(dot(dh, nrm));
    float foot = t1 * uTrailOn.z * mix(1.0, 1.0 / max(d.y, 0.04), across);
    float we = max(w, 1.6 * foot);
    float reach = 1.6 * we + w;
    // The glint first: the plane at the head.
    if (D.z > 0.5) {
      vec3 pl = vec3(A.x, B.x, A.y) - e;
      float dist = length(pl);
      float th = length(cross(d, pl / dist));
      // One soft point, sun-lit only, faded out with the slant distance.
      float size = 32.0 / dist;
      float px = max(size, uTrailOn.z * 1.4);
      float g = exp(-(th * th) / (px * px)) * (size * size) / (px * px);
      g *= smoothstep(${f(CONTRAIL.glintReach)}, ${f(CONTRAIL.glintClear)}, dist);
      vec3 air = cloudAir(dist, e.y - uCloudSeaLevel, B.x - uCloudSeaLevel);
      acc.rgb += (1.0 - acc.a) * uTrailSun * 9.0 * air * g * uTrailMid.w;
    }
    // Past either end, nothing: the head is the dark gap, the tail as thin
    // as its age or the reach leaves it.
    float raw = dot(p - A.xy, ax) / L2;
    if (D.w < 0.5 || abs(x) > reach || raw < 0.0 || raw > 1.0) continue;
    float along = mix(C.x, C.y, u);
    // THE CROW INSTABILITY: a wave along the line, growing, then pinching
    // into puffs that spread into the band.
    float lam = 330.0 + 140.0 * D.y;
    float ph = along / lam * 6.2832 + D.y * 31.0 + 2.2 * trailNoise(vec2(along / 1300.0, D.y * 5.0));
    // Seen from far off the wave is under a few pixels: let it go rather
    // than alias into a hatching.
    float seen = smoothstep(4.0, 12.0, lam / max(t1 * uTrailOn.z, 1.0));
    float crow = seen * smoothstep(12.0, 55.0, age) * (1.0 - smoothstep(110.0, 300.0, age));
    // Its amplitude is the vortex pair's own scale (tens of metres), never
    // the spreading band's.
    float xc = x - crow * 0.45 * min(w, 120.0) * sin(ph);
    // An old band's edges let out and drawn in along its length.
    float old = smoothstep(150.0, 1200.0, age);
    float fib = uTrailOn.w;
    float rag = old * fib * (trailNoise(vec2(along / 2200.0, D.y * 9.0)) - 0.5) * 0.7;
    float r = xc / (0.5 * max(we, 1.0) * (1.0 + rag));
    // FRESH: the pair of lines merging; then one; an old band flat-topped.
    float merge = exp(-age / 7.0) * (w / we);
    float off = 0.62 * merge;
    float sig = mix(0.42, 0.62, 1.0 - merge);
    float two = 0.5 * (exp(-(r - off) * (r - off) / (sig * sig * 0.35)) + exp(-(r + off) * (r + off) / (sig * sig * 0.35)));
    float one = exp(-r * r * mix(2.2, 1.0, old) * mix(1.0, 0.4 * r * r + 0.6, old));
    float prof = mix(one, two * 1.15, merge);
    // The puffs: the line broken into a row of knots.
    float puff = seen * smoothstep(35.0, 100.0, age) * (1.0 - smoothstep(150.0, 420.0, age));
    float knot = 0.5 + 0.5 * cos(ph);
    prof *= 1.0 - 0.7 * puff * (1.0 - knot * knot) * (w / we);
    // Fibres: streaks along the band, and its body patchy.
    if (fib > 0.0 && age > 90.0) {
      float s1 = trailNoise(vec2(along / 900.0 + D.y * 7.0, xc / max(0.22 * w, 1.0)));
      float s2 = trailNoise(vec2(along / 260.0, xc / max(0.07 * w, 1.0) + 13.0));
      // Each scale of streak let go as it nears the pixel, so a far band
      // stays a band rather than a hatching.
      float pxm = max(t1 * uTrailOn.z, 1.0);
      s1 = mix(0.55, s1, smoothstep(4.0, 12.0, 900.0 / pxm));
      s2 = mix(0.5, s2, smoothstep(4.0, 12.0, min(260.0, 0.07 * w) / pxm));
      float streak = 0.45 + 0.8 * s1 * (0.6 + 0.6 * s2);
      prof *= mix(1.0, streak, smoothstep(90.0, 700.0, age) * fib);
    }
    // Its density at this age (\`contrail-plan.ts\`'s \`tauAt\`).
    float persists = step(C.w, 0.0);
    float tau = D.x * pow(B.w / w, 0.55) * (1.0 + 0.6 * persists * smoothstep(0.0, 300.0, age))
      * (1.0 + ${f(CONTRAIL.young)} * exp(-age / ${f(CONTRAIL.youngTime)}));
    tau *= persists > 0.5
      ? 1.0 - smoothstep(${f(CONTRAIL.fade)}, ${f(CONTRAIL.persist)}, age)
      : 1.0 - smoothstep(C.w * 0.35, C.w, age);
    tau *= smoothstep(0.2, ${f(CONTRAIL.gap)}, age);
    // Seen through: a narrow line about as deep as wide at every angle; a
    // wide flat band through its depth, slant the lower it stands.
    float slant = min(1.0 / max(d.y, 0.05), max(1.0, w / 350.0));
    float a = 1.0 - exp(-tau * prof * slant * (w / we));
    a *= smoothstep(uTrailMid.z, uTrailMid.z * 0.72, length(p - uTrailMid.xy));
    // A short trail far off is a speck, not a plane's line: let it go.
    if (persists < 0.5) a *= smoothstep(${f(CONTRAIL.shortReach)}, ${f(CONTRAIL.shortClear)}, length(vec2(t1 * length(d.xz), y - e.y)));
    if (a <= 0.0005) continue;
    // Old and thin, its shade more of the sky's: greyer against the blue.
    vec3 col = uTrailSun * phase * mix(1.0, 0.8, old) + uTrailSky * mix(0.85, 1.0, old);
    vec3 air = cloudAir(t1, e.y - uCloudSeaLevel, y - uCloudSeaLevel);
    col = col * air + sky * (1.0 - air);
    acc.rgb += (1.0 - acc.a) * col * a;
    acc.a += (1.0 - acc.a) * a;
  }
  return acc * uTrailOn.y;
}
`;
