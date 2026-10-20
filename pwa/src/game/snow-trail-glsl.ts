// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A TRAIL AS SHADED: the trail map's furrows read per pixel (their walls
// bent into the normal, the three bands by depth — the scuff, the trough and
// the trench — the trench's hollow out of the sky's light and the clods it
// spills over its rim, the crumbled walls), the deformable snow's own shadow,
// and what pressed and walled snow does to the albedo and to the light. Each
// chunk is spliced into `snow-glsl.ts`'s at its own place.

/** In the sample chunk, after the snow's age: the furrows, per pixel. */
export const SNOW_TRAIL_SAMPLE = /* glsl */ `
  // THE FURROWS, per pixel.
  vec2 tr = trailAt(p);
  snowPress = clamp(tr.x / 0.14, 0.0, 1.0);
  snowWall = 0.0;
  snowWallUp = vec2(0.0);
  // Nothing stamped and no deformable snow: the relief is flat, its
  // gradient nought.
  if (snowDist < 220.0 && uSnowSkip.w < 0.5 && (uFurrowed > 0.5 || uDeformOn > 0.5)) {
    float fineW = trailFineWeight(p);
    float e = mix(mix(uCoarseTexel, uFineTexel * 0.75, fineW), uDeformBox.w, deformWeight(p));
    vec2 tg = vec2(trailRelief(p + vec2(e, 0.0)) - trailRelief(p - vec2(e, 0.0)),
                   trailRelief(p + vec2(0.0, e)) - trailRelief(p - vec2(0.0, e))) / (2.0 * e);
    tg *= 1.0 - smoothstep(120.0, 220.0, snowDist);
    snowWall = clamp(length(tg), 0.0, 1.0);
    snowWallUp = tg;
    grad += tg;
  }
  // THE GROOVE UNDER THE PLAYER'S SKIS (\`ski-clear.ts\`): where the trail
  // map holds none (TRAILS off, or a groove the grid is too coarse for), the
  // dip the ground is let down into under each base is drawn as the base's
  // own pressed groove — its shoulders in the normal, its floor pressed —
  // and none on bare rock.
  if (snowDist < 40.0) {
    vec3 sg = skiGroove(p, vSnowWorld.y);
    float fade = (1.0 - smoothstep(0.01, 0.03, tr.x)) * (1.0 - smoothstep(20.0, 40.0, snowDist))
      * (1.0 - snowRock);
    grad += sg.yz * fade;
    snowPress = max(snowPress, 0.55 * sg.x * fade);
  }

  // The sun the deformable snow's own relief hides (\`deform-glsl.ts\`).
  snowSelf = deformSelf(p, uSunDir, snowDist);

  // THE THREE DEPTHS OF A TRAIL, off the depth the map holds here: a
  // groomer's or a crust's SCUFF a centimetre or two deep — two pencil lines
  // pressed glossy; powder's TROUGH a boot deep — soft, rounded, its walls
  // crumbled; and deep snow's TRENCH — its walls fallen in, chunky, its
  // floor down out of the sky's light going blue (snow lit from the side
  // through its walls and by the sky alone), and the clods it threw out
  // lying over its rim. The trench's depth below the snow round it is read
  // off a ring of the map: down in one, the sky is walled off.
  snowScuff = smoothstep(0.003, 0.012, tr.x) * (1.0 - smoothstep(0.02, 0.05, tr.x));
  snowTrough = smoothstep(0.02, 0.05, tr.x) * (1.0 - smoothstep(0.16, 0.3, tr.x));
  snowTrench = smoothstep(0.16, 0.3, tr.x);
  snowHollow = 0.0;
  snowSpill = 0.0;
  if (snowDist < 110.0 && (tr.x > 0.03 || tr.y > 0.003) && uSnowSkip.w < 0.5) {
    float ring = 0.0;
    float ringMax = 0.0;
    for (int i = 0; i < 6; i++) {
      float a = float(i) * 1.0471976;
      float rd = trailAt(p + vec2(cos(a), sin(a)) * 0.9).x;
      ring += rd;
      ringMax = max(ringMax, rd);
    }
    ring /= 6.0;
    float fade = 1.0 - smoothstep(60.0, 110.0, snowDist);
    // Eased over the whole depth and the rim's lead, so the shade deepens
    // smoothly down a wall rather than in steps that follow its terraces.
    snowHollow = smoothstep(0.04, 0.7, tr.x) * mix(0.45, 1.0, smoothstep(0.0, 0.3, tr.x - ring)) * fade;
    snowSpill = smoothstep(0.12, 0.4, ringMax) * (1.0 - smoothstep(0.03, 0.12, tr.x)) * fade;
  }
  // The trough's walls crumbled; the trench's broken into blocks a hand
  // to a forearm across where they fell in. Faded before they alias.
  if (snowDist < 70.0 && snowWall > 0.02 && tr.x > 0.02) {
    float wf = 1.0 - smoothstep(25.0, 70.0, snowDist);
    float k = snowWall * wf;
    grad += snowNoiseGrad(p * 6.0 + 19.0, 0.05) * 6.0 * 0.03 * k * snowTrough;
    grad += snowNoiseGrad(p * 2.6 + 23.0, 0.08) * 2.6 * 0.09 * k * snowTrench;
    grad += snowNoiseGrad(p * 7.5 + 29.0, 0.05) * 7.5 * 0.025 * k * snowTrench;
  }
  // THE SPILL: lumps and rolled balls of snow over the trench's rim.
  if (snowSpill > 0.01) {
    float lump = smoothstep(0.5, 0.75, snowNoise(p * 3.2 + 37.0));
    grad += snowNoiseGrad(p * 3.2 + 37.0, 0.06) * 3.2 * 0.4 * snowSpill * (0.3 + lump);
    grad += snowNoiseGrad(p * 8.0 + 43.0, 0.04) * 8.0 * 0.06 * snowSpill;
  }`;

/** In the colour chunk, after the berm: pressed, walled and dug snow. */
export const SNOW_TRAIL_ALBEDO = /* glsl */ `
  // Pressed snow is on its way to ice: a little less comes back.
  alb *= mix(vec3(1.0), vec3(0.9, 0.93, 0.97), snowPress);
  // A FAST LINE IN LOOSE SNOW: the planing ski's narrow trough, its floor
  // pressed smooth and in its own walls' shade — a cool line the relief
  // alone loses in a flat or a head-on light.
  alb *= mix(vec3(1.0), vec3(0.86, 0.9, 0.96), smoothstep(0.04, 0.29, snowPress) * (1.0 - snowPacked) * (1.0 - snowTrench));
  // THE SCUFF: snow pressed to a polish, a cool grey line.
  alb *= mix(vec3(1.0), vec3(0.86, 0.9, 0.96), snowScuff * (0.35 + 0.65 * snowPacked));
  // THE TRENCH: down out of the sky's light, its snow lit through its walls
  // — the blue of a hole dug in deep snow, the deeper the bluer. A boot or a
  // body deep it is a cool shade, never the cyan of a crevasse: the light
  // has come through a hand of snow, not metres (the sky's own blue in the
  // shade is laid on by the sky's light already).
  alb = mix(alb, vec3(0.78, 0.87, 1.0), 0.55 * snowHollow);
  // ...its broken walls the bluer for the sky they do not see.
  alb *= mix(vec3(1.0), vec3(0.82, 0.9, 1.0), snowWall * snowTrench);
  // THE SPILL: snow turned over and thrown out, fresh white clods.
  alb = mix(alb, fresh, 0.6 * snowSpill);
  // The walls see less sky; a blue-grey the shading alone would not give —
  // the wall turned from the sun the most and the one facing it hardly, so a
  // wide trough reads as ONE groove shaded down one side, never two lines.
  float awayW = 0.5 + 0.5 * dot(normalize(snowWallUp + vec2(1e-6)), normalize(uSunDir.xz + vec2(1e-6)));
  alb *= mix(vec3(1.0), vec3(0.8, 0.86, 0.95), snowWall * mix(0.25, 1.0, awayW));`;

/** In the light chunk, beside the flat light: down in a trench. */
export const SNOW_TRAIL_LIGHT = /* glsl */ `
  // DOWN IN A TRENCH the walls hide most of the sky, and all but a high
  // sun: what light there is comes through the snow, and comes out blue.
  reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(0.6, 0.68, 0.84), snowHollow);
  reflectedLight.directDiffuse *= 1.0 - 0.5 * snowHollow * (1.0 - smoothstep(0.3, 0.9, uSunPos.y / max(length(uSunPos), 1e-3)));`;
