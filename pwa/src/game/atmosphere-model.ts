// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PHYSICAL ATMOSPHERE — the air the sky's colours come out of, as
// physics rather than hand-mixed gradients. Hillaire's model (2020): a
// spherical planet under a shell of air holding three media —
//
//   * RAYLEIGH, the molecules: scattering per kilometre falling with height
//     on an 8 km scale, three times stronger in the blue than the red (what
//     makes the sky blue and a low sun gold);
//   * MIE, the aerosol: grey, mostly forward (Cornette–Shanks phase, g ≈
//     0.8), falling on a 1.2 km scale — the white glow round the sun and the
//     haze low over the valley;
//   * OZONE, absorbing in the red and green in a layer round 25 km — the
//     reason the zenith stays BLUE at twilight instead of going grey;
//
// — over a ground of a given ALBEDO (fresh snow ≈ 0.85: a winter horizon is
// bright because the snow sends the light back up into the air; a summer
// meadow would be ≈ 0.2, so the ground is a parameter, never assumed).
//
// What it gives, all by marching rays through those media:
//
//   * the TRANSMITTANCE from any height along any direction to the top of
//     the air (a table, `transmittanceLut`) — the sun's colour and strength
//     where it is seen; zero below the planet's horizon, which is where
//     EARTH'S SHADOW comes from;
//   * MULTIPLE SCATTERING the way Hillaire states it: the second order of
//     light scattered isotropically, and the infinite series of the higher
//     orders summed as a geometric one, 1/(1 − f_ms) — a 32×32 table by
//     height and the sun's angle (`multiScatterLut`), which is what keeps a
//     twilight sky blue and lit after the sun is under the horizon;
//   * the SKY'S RADIANCE along any view (`skyRadiance`): single scattering
//     from the sun, shadowed by the planet, plus the multiple scattering —
//     so sunrise, sunset, the golden hour, civil and nautical twilight, the
//     EARTH'S SHADOW on the anti-solar horizon and the BELT OF VENUS over
//     it all come out of the physics, never a table of pinks;
//   * the SKY'S LIGHT ON A SURFACE (`skyIrradianceSh`): the radiance of the
//     whole sphere round the lens — the sky above and the lit snow below —
//     projected onto nine spherical harmonics and convolved with the cosine,
//     so evaluating them on a normal is the irradiance that face takes from
//     the sky (Ramamoorthi and Hanrahan's L2 form).
//
// Units: kilometres for lengths; the sun's illuminance at the top of the air
// is 1 in every channel (a white sun), so every radiance here is a share of
// it per steradian and every irradiance a share of it — exposure is the
// look's business (`sky.ts`), not the physics'.
//
// THREE-FREE AND DOM-FREE ON PURPOSE: the bake (`scripts/sky-table.mjs`,
// the generated `sky-table.ts` the LOW sky and every `SkyLook` read) runs it
// in Node, and the suite holds it to known physics
// (`tests/atmosphere_test.ts`). It is too slow for a frame and never runs in
// one: the game reads the baked table; the GPU sky (MEDIUM and HIGH) is the
// same model on render targets.

export type Rgb = [number, number, number];

/** THE AIR: the planet's two radii and the three media. Earth's numbers by
 * default (`EARTH`); a weather that thickens the aerosol scales `mie`. */
export type AtmosphereParams = {
  /** The ground's and the top of the air's radius, km. */
  groundRadius: number;
  topRadius: number;
  /** Rayleigh scattering at the ground, 1/km, per channel; its scale
   * height, km. */
  rayleigh: Rgb;
  rayleighHeight: number;
  /** Mie scattering and extinction at the ground, 1/km (grey); its scale
   * height, km; the phase's asymmetry. */
  mieScattering: number;
  mieExtinction: number;
  mieHeight: number;
  mieG: number;
  /** Ozone's absorption at the layer's peak, 1/km, per channel; the
   * layer's middle and its half-width, km (a tent). */
  ozone: Rgb;
  ozoneCentre: number;
  ozoneWidth: number;
  /** The ground's albedo, 0..1 (fresh snow ≈ 0.85). */
  albedo: number;
};

/** EARTH (Hillaire's numbers, which are Bruneton's): Rayleigh
 * (5.802, 13.558, 33.1)·10⁻⁶ /m on 8 km; Mie scattering 3.996·10⁻⁶ and
 * extinction 4.40·10⁻⁶ /m on 1.2 km, g 0.8 (so its ABSORPTION is the
 * 0.404·10⁻⁶ between them); ozone (0.650, 1.881, 0.085)·10⁻⁶ /m in a 30 km
 * tent round 25 km; the ground under fresh snow. */
export const EARTH: AtmosphereParams = {
  groundRadius: 6360,
  topRadius: 6460,
  rayleigh: [5.802e-3, 13.558e-3, 33.1e-3],
  rayleighHeight: 8,
  mieScattering: 3.996e-3,
  mieExtinction: 4.4e-3,
  mieHeight: 1.2,
  mieG: 0.8,
  ozone: [0.65e-3, 1.881e-3, 0.085e-3],
  ozoneCentre: 25,
  ozoneWidth: 15,
  albedo: 0.85,
};

/** THE GROUND'S ALBEDO the sky is reckoned over, by what lies on it: fresh
 * winter snow, and a summer meadow for a season that has none. */
export const SKY_GROUND_ALBEDO = { snow: 0.85, meadow: 0.2 } as const;

/** The media at a height `h` km over the ground. */
type Medium = {
  /** Rayleigh and Mie scattering, 1/km. */
  sr: Rgb;
  sm: number;
  /** Total extinction, 1/km. */
  ext: Rgb;
};

function mediumAt(p: AtmosphereParams, h: number, out: Medium): Medium {
  const dr = Math.exp(-Math.max(h, 0) / p.rayleighHeight);
  const dm = Math.exp(-Math.max(h, 0) / p.mieHeight);
  const doz = Math.max(0, 1 - Math.abs(h - p.ozoneCentre) / p.ozoneWidth);
  for (let i = 0; i < 3; i++) {
    out.sr[i] = p.rayleigh[i] * dr;
    out.ext[i] = out.sr[i] + p.mieExtinction * dm + p.ozone[i] * doz;
  }
  out.sm = p.mieScattering * dm;
  return out;
}

const newMedium = (): Medium => ({ sr: [0, 0, 0], sm: 0, ext: [0, 0, 0] });

/** Rayleigh's phase function, 1/sr, at the cosine `nu` between the view
 * and the light. */
export function rayleighPhase(nu: number): number {
  return (3 / (16 * Math.PI)) * (1 + nu * nu);
}

/** Cornette and Shanks' phase function for the aerosol, 1/sr. */
export function miePhase(nu: number, g: number): number {
  const k = (3 / (8 * Math.PI)) * ((1 - g * g) / (2 + g * g));
  return (k * (1 + nu * nu)) / Math.pow(1 + g * g - 2 * g * nu, 1.5);
}

/** How far along a ray from radius `r` at the cosine `mu` from the zenith
 * the sphere of radius `R` is met (the far root), km — or −1 when never. */
function toSphere(r: number, mu: number, R: number): number {
  const disc = r * r * (mu * mu - 1) + R * R;
  if (disc < 0) return -1;
  return -r * mu + Math.sqrt(disc);
}

/** How far to the GROUND, km, or −1 when the ray misses it. */
function toGround(p: AtmosphereParams, r: number, mu: number): number {
  if (mu >= 0) return -1;
  const disc = r * r * (mu * mu - 1) + p.groundRadius * p.groundRadius;
  if (disc < 0) return -1;
  return Math.max(0, -r * mu - Math.sqrt(disc));
}

/** The cosine from the zenith below which a ray from radius `r` meets the
 * ground — the planet's horizon. */
function horizonMu(p: AtmosphereParams, r: number): number {
  const s = p.groundRadius / r;
  return -Math.sqrt(Math.max(0, 1 - s * s));
}

/** THE TRANSMITTANCE TABLE: from a radius along a direction to the top of
 * the air, on Bruneton's parametrisation (fine near the horizon, where the
 * colour changes fastest). */
export type TransmittanceLut = {
  width: number;
  height: number;
  /** RGB per texel, row-major (u the direction, v the height). */
  data: Float32Array;
};

const TRANS_W = 256;
const TRANS_H = 64;
const TRANS_STEPS = 40;

function transUv(p: AtmosphereParams, r: number, mu: number): [number, number] {
  const H = Math.sqrt(p.topRadius ** 2 - p.groundRadius ** 2);
  const rho = Math.sqrt(Math.max(0, r * r - p.groundRadius ** 2));
  const d = Math.max(0, toSphere(r, mu, p.topRadius));
  const dMin = p.topRadius - r;
  const dMax = rho + H;
  return [(d - dMin) / Math.max(1e-9, dMax - dMin), rho / H];
}

function transRMu(p: AtmosphereParams, u: number, v: number): [number, number] {
  const H = Math.sqrt(p.topRadius ** 2 - p.groundRadius ** 2);
  const rho = H * v;
  const r = Math.sqrt(rho * rho + p.groundRadius ** 2);
  const dMin = p.topRadius - r;
  const dMax = rho + H;
  const d = dMin + u * (dMax - dMin);
  const mu = d === 0 ? 1 : (H * H - rho * rho - d * d) / (2 * r * d);
  return [r, Math.max(-1, Math.min(1, mu))];
}

/** The optical depth's transmittance from (`r`, `mu`) to the top, by
 * marching — what the table is filled with. */
export function transmittanceMarched(p: AtmosphereParams, r: number, mu: number, out: Rgb): Rgb {
  const len = Math.max(0, toSphere(r, mu, p.topRadius));
  const dt = len / TRANS_STEPS;
  const m = newMedium();
  let o0 = 0;
  let o1 = 0;
  let o2 = 0;
  for (let i = 0; i < TRANS_STEPS; i++) {
    const t = (i + 0.5) * dt;
    const rr = Math.sqrt(r * r + t * t + 2 * r * mu * t);
    mediumAt(p, rr - p.groundRadius, m);
    o0 += m.ext[0] * dt;
    o1 += m.ext[1] * dt;
    o2 += m.ext[2] * dt;
  }
  out[0] = Math.exp(-o0);
  out[1] = Math.exp(-o1);
  out[2] = Math.exp(-o2);
  return out;
}

export function buildTransmittanceLut(p: AtmosphereParams): TransmittanceLut {
  const data = new Float32Array(TRANS_W * TRANS_H * 3);
  const c: Rgb = [0, 0, 0];
  for (let j = 0; j < TRANS_H; j++)
    for (let i = 0; i < TRANS_W; i++) {
      const [r, mu] = transRMu(p, i / (TRANS_W - 1), j / (TRANS_H - 1));
      transmittanceMarched(p, r, mu, c);
      const k = (j * TRANS_W + i) * 3;
      data[k] = c[0];
      data[k + 1] = c[1];
      data[k + 2] = c[2];
    }
  return { width: TRANS_W, height: TRANS_H, data };
}

/** Bilinear read of a RGB table at (u, v) in 0..1, clamped. */
function sample(data: Float32Array, w: number, h: number, u: number, v: number, out: Rgb): Rgb {
  const x = Math.min(w - 1, Math.max(0, u * (w - 1)));
  const y = Math.min(h - 1, Math.max(0, v * (h - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  for (let c = 0; c < 3; c++) {
    const a = data[(y0 * w + x0) * 3 + c];
    const b = data[(y0 * w + x1) * 3 + c];
    const d = data[(y1 * w + x0) * 3 + c];
    const e = data[(y1 * w + x1) * 3 + c];
    out[c] = (a + (b - a) * fx) * (1 - fy) + (d + (e - d) * fx) * fy;
  }
  return out;
}

/** THE SUN SEEN FROM radius `r` at the cosine `muS` from the zenith: its
 * transmittance through the air, zero once the planet stands in front of
 * it — the hard edge of the Earth's shadow, softened over the sun's own
 * disc. */
export function sunTransmittance(
  p: AtmosphereParams,
  lut: TransmittanceLut,
  r: number,
  muS: number,
  out: Rgb,
): Rgb {
  const hz = horizonMu(p, r);
  // The sun's disc is half a degree across: it sets over that much angle.
  const vis = Math.min(1, Math.max(0, (muS - hz) / 0.0093 + 0.5));
  if (vis <= 0) {
    out[0] = out[1] = out[2] = 0;
    return out;
  }
  const [u, v] = transUv(p, r, Math.max(muS, hz));
  sample(lut.data, lut.width, lut.height, u, v, out);
  out[0] *= vis;
  out[1] *= vis;
  out[2] *= vis;
  return out;
}

/** THE MULTIPLE-SCATTERING TABLE: Ψ_ms by height (v) and the sun's cosine
 * from the zenith (u). */
export type MultiScatterLut = { width: number; height: number; data: Float32Array };

const MS_SIZE = 32;
const MS_STEPS = 20;
/** Directions over the sphere for each texel: 8 × 8, as Hillaire's. */
const MS_DIRS = 8;

export function buildMultiScatterLut(
  p: AtmosphereParams,
  trans: TransmittanceLut,
): MultiScatterLut {
  const data = new Float32Array(MS_SIZE * MS_SIZE * 3);
  const m = newMedium();
  const sunT: Rgb = [0, 0, 0];
  const iso = 1 / (4 * Math.PI);
  for (let j = 0; j < MS_SIZE; j++) {
    const r = p.groundRadius + Math.max(0.01, (j / (MS_SIZE - 1)) * (p.topRadius - p.groundRadius));
    for (let i = 0; i < MS_SIZE; i++) {
      const muS = (i / (MS_SIZE - 1)) * 2 - 1;
      // The sun in the x-y plane, the point on the y axis.
      const sx = Math.sqrt(Math.max(0, 1 - muS * muS));
      const sy = muS;
      const L2: Rgb = [0, 0, 0];
      const F: Rgb = [0, 0, 0];
      const n = MS_DIRS * MS_DIRS;
      for (let a = 0; a < MS_DIRS; a++)
        for (let b = 0; b < MS_DIRS; b++) {
          // Uniform over the sphere.
          const cosT = 1 - (2 * (a + 0.5)) / MS_DIRS;
          const phi = (2 * Math.PI * (b + 0.5)) / MS_DIRS;
          const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
          const dx = sinT * Math.cos(phi);
          const dy = cosT;
          const ground = toGround(p, r, dy);
          const len = ground >= 0 ? ground : Math.max(0, toSphere(r, dy, p.topRadius));
          const dt = len / MS_STEPS;
          const T: Rgb = [1, 1, 1];
          for (let s = 0; s < MS_STEPS; s++) {
            const t = (s + 0.3) * dt;
            // The sample's position (x, y) and radius.
            const px = dx * t;
            const py = r + dy * t;
            const rr = Math.hypot(px, py);
            mediumAt(p, rr - p.groundRadius, m);
            const mu = (px * sx + py * sy) / rr;
            sunTransmittance(p, trans, rr, mu, sunT);
            for (let c = 0; c < 3; c++) {
              const scat = m.sr[c] + m.sm;
              const ext = Math.max(1e-9, m.ext[c]);
              const step = Math.exp(-ext * dt);
              const share = (1 - step) / ext;
              L2[c] += (T[c] * scat * sunT[c] * iso * share) / n;
              F[c] += (T[c] * scat * share) / n;
              T[c] *= step;
            }
          }
          if (ground >= 0) {
            // The snow under the ray, lit by the sun.
            const gx = dx * ground;
            const gy = r + dy * ground;
            const gr = Math.hypot(gx, gy);
            const gmu = (gx * sx + gy * sy) / gr;
            sunTransmittance(p, trans, gr, gmu, sunT);
            const cos = Math.max(0, gmu);
            for (let c = 0; c < 3; c++) L2[c] += (T[c] * sunT[c] * cos * (p.albedo / Math.PI)) / n;
          }
        }
      const k = (j * MS_SIZE + i) * 3;
      // Both integrals over the sphere with the isotropic phase: the mean
      // over directions is that (4π × 1/4π).
      for (let c = 0; c < 3; c++) data[k + c] = L2[c] / (1 - Math.min(0.99, F[c]));
    }
  }
  return { width: MS_SIZE, height: MS_SIZE, data };
}

function multiScatter(
  p: AtmosphereParams,
  lut: MultiScatterLut,
  r: number,
  muS: number,
  out: Rgb,
): Rgb {
  const u = muS * 0.5 + 0.5;
  const v = (r - p.groundRadius) / (p.topRadius - p.groundRadius);
  return sample(lut.data, lut.width, lut.height, u, v, out);
}

/** A whole atmosphere ready to be asked: its media and its two tables. */
export type Atmosphere = {
  params: AtmosphereParams;
  trans: TransmittanceLut;
  ms: MultiScatterLut;
};

export function createAtmosphere(params: AtmosphereParams = EARTH): Atmosphere {
  const trans = buildTransmittanceLut(params);
  const ms = buildMultiScatterLut(params, trans);
  return { params, trans, ms };
}

/** A unit direction: y up, the sun's frame or the world's. */
export type Vec = { x: number; y: number; z: number };

/** The radius of an observer `altitude` m over the sea. */
export function radiusAt(atmo: Atmosphere, altitude: number): number {
  return atmo.params.groundRadius + Math.max(0.002, altitude / 1000);
}

const VIEW_STEPS = 80;

/**
 * THE SKY'S RADIANCE seen from `altitude` m over the sea along `view`
 * with the sun toward `sun` (both unit, y up): single scattering from the
 * sun, shadowed by the planet, and the multiple scattering — per steradian
 * per unit of the sun's illuminance. The sun's own disc is not in it (that
 * is the key light). A view into the ground stops at the ground, and the
 * snow there is not added: the dome below the horizon is the terrain's.
 * `steps` is how many steps the march takes (the GPU sky's tiers take
 * fewer — `sky-gpu-plan.ts` — on the same spacing).
 */
export function skyRadiance(
  atmo: Atmosphere,
  altitude: number,
  view: Vec,
  sun: Vec,
  out: Rgb = [0, 0, 0],
  steps: number = VIEW_STEPS,
): Rgb {
  const p = atmo.params;
  const r = radiusAt(atmo, altitude);
  const mu = view.y;
  const ground = toGround(p, r, mu);
  const len = ground >= 0 ? ground : Math.max(0, toSphere(r, mu, p.topRadius));
  const nu = view.x * sun.x + view.y * sun.y + view.z * sun.z;
  const pr = rayleighPhase(nu);
  const pm = miePhase(nu, p.mieG);
  const m = newMedium();
  const sunT: Rgb = [0, 0, 0];
  const ms: Rgb = [0, 0, 0];
  const T: Rgb = [1, 1, 1];
  out[0] = out[1] = out[2] = 0;
  // Steps packed toward the lens (where the air is thick), ending at the
  // ray's far end: t_i = len · (i / N)².
  let prev = 0;
  for (let s = 1; s <= steps; s++) {
    const f = s / steps;
    const t1 = len * f * f;
    const dt = t1 - prev;
    const t = prev + 0.5 * dt;
    prev = t1;
    // The sample, with the observer at (0, r, 0).
    const px = view.x * t;
    const py = r + view.y * t;
    const pz = view.z * t;
    const rr = Math.sqrt(px * px + py * py + pz * pz);
    mediumAt(p, rr - p.groundRadius, m);
    const muS = (px * sun.x + py * sun.y + pz * sun.z) / rr;
    sunTransmittance(p, atmo.trans, rr, muS, sunT);
    multiScatter(p, atmo.ms, rr, muS, ms);
    for (let c = 0; c < 3; c++) {
      const S = (m.sr[c] * pr + m.sm * pm) * sunT[c] + (m.sr[c] + m.sm) * ms[c];
      const ext = Math.max(1e-9, m.ext[c]);
      const step = Math.exp(-ext * dt);
      out[c] += (T[c] * S * (1 - step)) / ext;
      T[c] *= step;
    }
  }
  return out;
}

/** THE SUN'S TRANSMITTANCE seen from `altitude` m with the sun `elevation`
 * rad up — the colour and strength of the key. */
export function sunThrough(
  atmo: Atmosphere,
  altitude: number,
  elevation: number,
  out: Rgb = [0, 0, 0],
): Rgb {
  return sunTransmittance(
    atmo.params,
    atmo.trans,
    radiusAt(atmo, altitude),
    Math.sin(elevation),
    out,
  );
}

// ── the sky's light as spherical harmonics ────────────────────────────────

/** The nine real L2 basis functions at a unit direction, y up. */
export function shBasis(
  x: number,
  y: number,
  z: number,
  out: number[] = new Array<number>(9),
): number[] {
  out[0] = 0.282095;
  out[1] = 0.488603 * x;
  out[2] = 0.488603 * y;
  out[3] = 0.488603 * z;
  out[4] = 1.092548 * x * z;
  out[5] = 1.092548 * x * y;
  out[6] = 1.092548 * y * z;
  out[7] = 0.315392 * (3 * y * y - 1);
  out[8] = 0.546274 * (x * x - z * z);
  return out;
}

/** The cosine lobe's convolution per band (π, 2π/3, π/4): radiance
 * coefficients to irradiance coefficients. */
const BAND = [
  Math.PI,
  (2 * Math.PI) / 3,
  (2 * Math.PI) / 3,
  (2 * Math.PI) / 3,
  Math.PI / 4,
  Math.PI / 4,
  Math.PI / 4,
  Math.PI / 4,
  Math.PI / 4,
];

/** Irradiance SH (27 numbers: nine coefficients, RGB interleaved per
 * coefficient) at a normal — the light a face of that normal takes. */
export function shIrradiance(sh: ArrayLike<number>, n: Vec, out: Rgb = [0, 0, 0]): Rgb {
  const b = shBasis(n.x, n.y, n.z);
  out[0] = out[1] = out[2] = 0;
  for (let k = 0; k < 9; k++) for (let c = 0; c < 3; c++) out[c] += sh[k * 3 + c] * b[k];
  return out;
}

/** Turn irradiance SH stated in the SUN'S FRAME (the sun at azimuth 0,
 * toward +z) to a sun standing at the world `azimuth` (heading, clockwise
 * from +z). */
export function shRotateY(
  sh: ArrayLike<number>,
  azimuth: number,
  out: number[] = new Array<number>(27),
): number[] {
  const c1 = Math.cos(azimuth);
  const s1 = Math.sin(azimuth);
  const c2 = Math.cos(2 * azimuth);
  const s2 = Math.sin(2 * azimuth);
  for (let c = 0; c < 3; c++) {
    const g = (k: number): number => sh[k * 3 + c];
    out[0 + c] = g(0);
    out[6 + c] = g(2);
    out[21 + c] = g(7);
    out[3 + c] = g(1) * c1 + g(3) * s1;
    out[9 + c] = -g(1) * s1 + g(3) * c1;
    out[15 + c] = g(5) * c1 + g(6) * s1;
    out[18 + c] = -g(5) * s1 + g(6) * c1;
    out[12 + c] = g(4) * c2 - g(8) * s2;
    out[24 + c] = g(4) * s2 + g(8) * c2;
  }
  return out;
}

/**
 * THE SKY'S LIGHT ON A SURFACE at `altitude` m with the sun `elevation`
 * rad up (in the sun's frame: toward +z): the radiance of the whole sphere
 * round the lens — the sky over the horizon, and under it the snow lit by
 * the sun and that sky (`albedo`/π of their irradiance) — projected onto
 * the L2 basis and convolved with the cosine. 27 numbers, RGB per
 * coefficient; `shIrradiance` reads it on a normal. The sun's disc is not
 * in it.
 */
export function skyIrradianceSh(
  atmo: Atmosphere,
  altitude: number,
  elevation: number,
  steps = 24,
): number[] {
  const sun: Vec = { x: 0, y: Math.sin(elevation), z: Math.cos(elevation) };
  const sh = new Array<number>(27).fill(0);
  const b: number[] = new Array<number>(9);
  const L: Rgb = [0, 0, 0];
  const up: Rgb = [0, 0, 0];
  const az = steps * 2;
  const dOmega = (2 * Math.PI) / az / steps; // per cell of (cosθ, φ) over a hemisphere
  // The upper hemisphere, uniform in cos θ.
  for (let a = 0; a < steps; a++) {
    const y = (a + 0.5) / steps;
    const sr = Math.sqrt(1 - y * y);
    for (let q = 0; q < az; q++) {
      const phi = (2 * Math.PI * (q + 0.5)) / az;
      const v: Vec = { x: sr * Math.sin(phi), y, z: sr * Math.cos(phi) };
      skyRadiance(atmo, altitude, v, sun, L);
      shBasis(v.x, v.y, v.z, b);
      for (let k = 0; k < 9; k++) for (let c = 0; c < 3; c++) sh[k * 3 + c] += L[c] * b[k] * dOmega;
      for (let c = 0; c < 3; c++) up[c] += L[c] * y * dOmega;
    }
  }
  // The snow under the lens: a Lambertian floor lit by the sun and the sky.
  const T = sunThrough(atmo, altitude, elevation);
  const ground: Rgb = [0, 0, 0];
  for (let c = 0; c < 3; c++)
    ground[c] = (atmo.params.albedo / Math.PI) * (T[c] * Math.max(0, sun.y) + up[c]);
  for (let a = 0; a < steps; a++) {
    const y = -(a + 0.5) / steps;
    const sr = Math.sqrt(1 - y * y);
    for (let q = 0; q < az; q++) {
      const phi = (2 * Math.PI * (q + 0.5)) / az;
      shBasis(sr * Math.sin(phi), y, sr * Math.cos(phi), b);
      for (let k = 0; k < 9; k++)
        for (let c = 0; c < 3; c++) sh[k * 3 + c] += ground[c] * b[k] * dOmega;
    }
  }
  for (let k = 0; k < 9; k++) for (let c = 0; c < 3; c++) sh[k * 3 + c] *= BAND[k];
  return sh;
}
