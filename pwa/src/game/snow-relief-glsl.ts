// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW'S MICRO-RELIEF, bent into the per-pixel normal (`grad`) in the
// sample chunk of `snow-glsl.ts`: the wind-packed swells and the grain, the
// day's piste scraped and heaped, new snow skied into heaps, the sastrugi,
// the wind's ripples and scoured slabs, the sun crust's orange-peel, the sun
// cups, the groomer's corduroy and the night's lanes, and the plough's clods.
// Every term fades out before it aliases.

/** In the sample chunk, after the avalanche's normal. */
export const SNOW_RELIEF_SAMPLE = /* glsl */ `
  // THE MICRO-RELIEF: wind-packed swells a few metres long, and a finer
  // grain, both faded out before they alias.
  float nearFade = 1.0 - smoothstep(20.0, 90.0, snowDist);
  float midFade = 1.0 - smoothstep(60.0, 400.0, snowDist);
  // Every term below is skipped outright where its weight is nought — the
  // far band, the groomer, off the berm — rather than computed and zeroed:
  // the answer is the same and most of the screen is far snow.
  if (midFade > 0.0 && snowPacked < 1.0) {
    grad += snowNoiseGrad(p * 0.23, 0.35) * 0.23 * 0.35 * midFade * (1.0 - snowPacked);
  }
  // THE DAY'S PISTE (\`snowWorked\`): scraped swells where the turns have
  // shoved the snow, heaps of it pushed up between, and the scratches of a
  // thousand edges along the way.
  if (snowWorked > 0.01 && midFade > 0.0) {
    vec4 tw = texture2D(uTrackDir, guv);
    vec2 dw = tw.xy * 2.0 - 1.0;
    float tht = 0.5 * atan(dw.y, dw.x);
    vec2 acr = vec2(cos(tht), -sin(tht));
    vec2 alg = vec2(acr.y, -acr.x);
    float k = snowWorked * midFade;
    // Slush heaps the higher; frozen, they keep the shape they had.
    grad += snowNoiseGrad(p * 0.55 + 3.1, 0.3) * 0.55 * 0.16 * k * (1.0 + 0.8 * snowSoft);
    grad += snowNoiseGrad(p * 1.4 + 8.3, 0.25) * 1.4 * 0.05 * k * nearFade;
    vec2 q = vec2(dot(p, acr) * 5.0, dot(p, alg) * 0.22);
    vec2 sg = snowNoiseGrad(q, 0.3);
    grad += (acr * sg.x * 5.0 + alg * sg.y * 0.22) * 0.006 * k * nearFade;
    // ...and, by the afternoon, the start of bumps: the turns' heaps a few
    // metres apart, longer across the piste than down it.
    vec2 bq = vec2(dot(p, acr) * 0.2, dot(p, alg) * 0.32) + 17.0;
    vec2 bg = snowNoiseGrad(bq, 0.3);
    grad += (acr * bg.x * 0.2 + alg * bg.y * 0.32) * 0.55 * k * k;
    // The tracks themselves: a thousand skiers' grooves along the way.
    vec2 tq = vec2(dot(p, acr) * 2.4, dot(p, alg) * 0.06);
    vec2 tg2 = snowNoiseGrad(tq, 0.2);
    grad += (acr * tg2.x * 2.4 + alg * tg2.y * 0.06) * 0.02 * k * nearFade;
  }
  // THE SKIED-IN NEW SNOW: soft heaps a few metres apart where the turns
  // have shoved it, the troughs between scraped through.
  if (snowChop > 0.01 && midFade > 0.0) {
    float k = snowChop * midFade;
    grad += snowNoiseGrad(p * 0.38 + 13.7, 0.3) * 0.38 * 0.32 * k;
    grad += snowNoiseGrad(p * 1.1 + 2.9, 0.25) * 1.1 * 0.07 * k * nearFade;
  }
  // SASTRUGI: the crust carved into ridges across the wind, a few metres
  // apart and a hand high, broken up along their length.
  if (uSastrugi > 0.0 && snowCrust > 0.01) {
    float sFade = 1.0 - smoothstep(40.0, 260.0, snowDist);
    vec2 across = vec2(-uWindDir.y, uWindDir.x);
    float warp = snowNoise(p * 0.08) * 6.0;
    float ph = dot(p, across) * 1.9 + warp;
    float breakUp = smoothstep(0.3, 0.7, snowNoise(p * vec2(0.35, 0.35) + 7.0));
    float k = uSastrugi * snowCrust * sFade * breakUp * (1.0 - snowPress);
    grad += across * cos(ph) * 1.9 * 0.07 * k;
  }
  if (nearFade > 0.0) {
    // New snow lies smooth over the old surface's grain; old snow is the
    // coarser, a wet one the more.
    float grain = (1.0 - 0.6 * snowNew) * (1.0 + 0.7 * snowOld) * (1.0 - 0.5 * snowWind);
    grad += snowNoiseGrad(p * 1.7, 0.3) * 1.7 * 0.035 * nearFade * (1.0 - 0.4 * snowNew);
    grad += snowNoiseGrad(p * 7.0, 0.3) * 7.0 * 0.007 * nearFade * (1.0 - snowPress) * grain;
  }
  // THE WIND'S SLAB: ripples across the way it blew, a hand apart and a
  // centimetre high, wandering and broken, and patches scoured flat and
  // polished between drifted ones — faded before the ripples alias.
  if (snowWind > 0.01 && midFade > 0.0) {
    snowScour = smoothstep(0.45, 0.75, snowNoise(p * 0.11 + 51.0)) * snowWind;
    // The ripples alias out past a few tens of metres: not drawn there.
    if (nearFade > 0.0) {
      float warp = snowNoise(p * 0.5 + 3.0) * 4.0 + snowNoise(p * 1.3) * 1.2;
      float ph = dot(p, uWindDir) * 6.2831853 / 0.32 + warp * 6.2831853;
      float aa = 1.0 - smoothstep(0.25, 0.7, fwidth(ph) / 6.2831853);
      float breakUp = smoothstep(0.25, 0.6, snowNoise(p * 0.7 + 9.0));
      float k = snowWind * aa * breakUp * (1.0 - snowPress) * (1.0 - 0.6 * snowScour);
      grad += uWindDir * sin(ph) * 0.32 * k;
    }
    // ...and the drifts' long, low swells in the lee of the scoured patches.
    grad += snowNoiseGrad(p * 0.16 + 5.0, 0.4) * 0.16 * 0.45 * snowWind * midFade;
  }
  // THE SUN CRUST: a melt-frozen glaze with the faint orange-peel of the
  // grains under it.
  if (snowSunCrust > 0.01 && nearFade > 0.0) {
    grad += snowNoiseGrad(p * 3.4 + 61.0, 0.12) * 3.4 * 0.012 * snowSunCrust * nearFade;
  }
  // SUN CUPS in the thawed snow: hollows half a metre or so across with
  // soft ridges between — an egg-crate of dimples, turned off the axes and
  // warped so no row lines up, faded before it aliases.
  if (snowWet > 0.01 && snowDist < 120.0) {
    // Two crates, turned and sized apart and warped by a metre or two, so
    // the dimples neither line up nor repeat.
    vec2 w = vec2(snowNoise(p * 0.45 + 3.0), snowNoise(p * 0.45 + 8.0)) * 5.0;
    mat2 r1 = mat2(0.8, 0.6, -0.6, 0.8);
    mat2 r2 = mat2(0.28, -0.96, 0.96, 0.28);
    vec2 c1 = r1 * p * 10.5 + w;
    vec2 c2 = r2 * p * 14.0 - w.yx;
    float aa = 1.0 - smoothstep(0.6, 1.6, length(fwidth(c2)));
    float k = snowWet * aa * (1.0 - smoothstep(60.0, 120.0, snowDist)) * (1.0 - snowPress);
    // h = cos x + cos y on each; their slopes turned back into the world.
    grad += (transpose(r1) * -vec2(sin(c1.x), sin(c1.y))) * 10.5 * 0.009 * k;
    grad += (transpose(r2) * -vec2(sin(c2.x), sin(c2.y))) * 14.0 * 0.005 * k;
    snowCup = clamp(0.15 * (cos(c1.x) + cos(c1.y) + cos(c2.x) + cos(c2.y)) + 0.5, 0.0, 1.0) * k;
  }

  // THE CORDUROY: the groomer's comb, running along the track — and WORN
  // along it, in patches a few metres long where skis have scraped it
  // flat and chips a hand across where it has crumbled. A comb running
  // unbroken along the way looks the same however fast it is skied; its
  // wear is what streams past.
  vec4 td = texture2D(uTrackDir, guv);
  snowBerm = td.b * (1.0 - snowGroomed);
  float along = max(length(td.xy * 2.0 - 1.0), snowGroomed);
  if (snowPacked > 0.05 && along > 0.05 && snowWorked < 0.98) {
    vec2 dd = td.xy * 2.0 - 1.0;
    float th = 0.5 * atan(dd.y, dd.x);
    // In a swath the comb runs the way the machine went.
    th = mix(th, groom.z * 3.14159265, step(0.5, snowGroomed));
    vec2 across = vec2(cos(th), -sin(th));
    float phase = dot(p, across) * 6.2831853 / 0.14;
    float aa = 1.0 - smoothstep(0.35, 0.9, fwidth(phase));
    float k = snowPacked * min(along * 2.0, 1.0) * aa * (1.0 - snowPress * 0.7) * (1.0 - snowBelt);

    k *= 1.0 - smoothstep(0.0, 0.25, snowBerm);
    float worn = smoothstep(0.3, 0.7, snowNoise(p * 0.42 + 11.0));
    float chip = snowNoise(p * 2.6 + 5.0);
    // Fresh off the comb it is whole — no wear, no chips — and a touch
    // deeper; the day's piste has none left.
    k *= mix(mix(0.3, 1.0, worn) * mix(0.55, 1.0, chip), 1.25, max(snowGroomed, snowCombed));
    k *= 1.0 - snowWorked;
    // The night's comb, untouched, stands the sharper.
    k *= 1.0 + 0.6 * snowCombed;
    // THE OTHER SKIERS' LINES (\`piste-tracks.ts\`), cutting the comb away.
    k *= 1.0 - pisteTracks(p, across, snowPacked * min(along * 2.0, 1.0) * (1.0 - snowBelt) * (1.0 - snowGroomed), grad);
    grad += across * cos(phase) * 0.14 * k;
    snowCord = sin(phase) * min(k, 1.0);
    // THE NIGHT'S PASSES, seen from further than the comb: the machine's
    // lanes a swath wide side by side, each a shade of its own, a low
    // ridge where the finisher's flaps left the seam between two.
    float kl = snowPacked * min(along * 2.0, 1.0) * (1.0 - snowWorked) * (1.0 - snowPress * 0.7) * (1.0 - snowBelt);
    kl *= 1.0 - smoothstep(0.0, 0.25, snowBerm);
    kl *= mix(0.35, 1.0, max(snowCombed, snowGroomed)) * midFade;
    if (kl > 0.01) {
      float lane = dot(p, across) / 5.2;
      float seam = 1.0 - smoothstep(0.0, 0.035, abs(fract(lane) - 0.5));
      float laa = 1.0 - smoothstep(0.3, 0.8, fwidth(lane) * 12.0);
      grad += across * sign(fract(lane) - 0.5) * seam * 0.08 * kl * laa;
      snowLane = ((snowHash1(vec2(floor(lane), 7.0)) * 2.0 - 1.0) * 0.6 - seam * laa) * kl;
    }
  }

  // THE PLOUGH'S CLODS on the berm: lumps a hand to a forearm across,
  // faded out before they alias.
  if (snowBerm > 0.01 && snowDist < 140.0) {
    float clodFade = 1.0 - smoothstep(30.0, 140.0, snowDist);
    float b = smoothstep(0.0, 0.3, snowBerm);
    grad += snowNoiseGrad(p * 2.2, 0.15) * 2.2 * 0.09 * b * clodFade;
    grad += snowNoiseGrad(p * 6.5, 0.1) * 6.5 * 0.025 * b * clodFade;
  }`;
