// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR BETWEEN THE LENS AND THE HILLS — one sky function in GLSL, and
// the haze every material fades into drawn from it.
//
// The dome (`sky-dome.ts`) is `skyColour(dir)`; the haze a far slope fades
// into is the same function read along that slope's own direction, flattened
// toward the horizon. So a ridge two kilometres off dissolves into exactly
// the colour of the sky behind it — warmer toward the sun, bluer away — and
// no fog colour stands in the picture as a flat grey band. Three's own fog
// is one colour for the whole frame and cannot do that, so this replaces
// its `fog_fragment` in every material that stands in the world
// (`hazeMaterial`), and the uniforms are ONE object shared by reference, so
// the frame the sun moves every surface hears it at once.
//
// Three applies fog AFTER tone mapping and the output conversion, so the
// haze colour goes through `toneMapping` and `linearToOutputTexel` first —
// which is what the dome's own pixels go through, and why the far rim meets
// the sky with no seam.

import * as THREE from "three";

import { FAR_RADIUS } from "./horizon.ts";
import type { Tracks } from "./piste-tracks.ts";
import { SKY_VIEW_AZ, SKY_VIEW_EL } from "./sky-table-format.ts";
import type { SkyLook } from "./sky.ts";
import type { SnowAge } from "./snow-age.ts";
import { TERRAIN_SHADOW_GLSL } from "./terrain-shadow.ts";

/** How many lamps light the world at once: the player's headlamp first,
 * the finish arena's two floods, then the field's headlamps
 * (`headlamp.ts`'s `dealLamps` deals them). The piste lights' masts are
 * not among them: they stand still, so their light is baked into one map
 * (`pisteLight`). */
export const LAMP_SLOTS = 6;
/** How many skiers cast into a map of their own (`hero-shadow.ts`): the
 * player and the field, a quadrant of one atlas each. */
export const HERO_SLOTS = 4;

export type HazeUniforms = {
  /** Toward the KEY light — the sun by day, the moon by night: what the
   * snow's wrap and glitter answer to. */
  uSunDir: { value: THREE.Vector3 };
  /** Toward the sun itself, wherever it is: the aureole and the disc. */
  uSunPos: { value: THREE.Vector3 };
  uZenith: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uGlow: { value: THREE.Color };
  uSunCol: { value: THREE.Color };
  /** THE DOME'S RADIANCE (`SkyLook.view`): the physical sky by the azimuth
   * from the sun and the view's elevation, exposed — what `skyColour(dir)`
   * reads. The LOW sky's from the baked table; the GPU sky (MEDIUM, HIGH)
   * renders into the same slot. */
  uSkyView: { value: THREE.DataTexture };
  /** THE LOW AIR IN EARTH'S SHADOW (`SkyLook.hazeShadow`): rgb the
   * shadowed air's colour, w the share of the haze over the ground it
   * takes — none while the sun is up, all of it a few degrees under. */
  uHazeShadow: { value: THREE.Vector4 };
  /** THE TRUE HORIZON AND THE FAR GROUND UNDER IT: `x` how far the
   * horizon dips under the level for this lens, rad (`horizonDip`), `y`
   * the lens's height over the far ground, m — written every frame off the
   * lens's altitude (`renderer.ts`). */
  uFar: { value: THREE.Vector2 };
  /** The far ground's own light (`SkyLook.farGround`, `.farKey`), linear,
   * exposed: what shows under the horizon where the air between is thin —
   * the sky's share, and the key's on a face square to it. */
  uFarGround: { value: THREE.Color };
  uFarKey: { value: THREE.Color };
  uHaze: { value: number };
  /** THE MIST the DISTANCE row closes on (`mistFor`): its wall, m, past
   * which nothing is seen and nothing is drawn; 0 is no mist. */
  uMist: { value: number };
  /** HOW FAR ALOFT the lens is, 0..1 — 0 on the snow and on every ride but
   * a wingsuit's, whose lens high over the snow (`machines.ts`) sets it: the
   * mist is then measured across the ground rather than through the air
   * down to it, thin under him and thickening out to close a little
   * inside its wall — so a flyer hundreds of metres up sees the mountain
   * under him melt into the haze, with no rim where the ground or the
   * woods end. At 0 the mist is exactly the DISTANCE row's. */
  uMistAloft: { value: number };
  /** Where the sun's shadow stands (`shadow-box.ts`): the circle's centre
   * in plan, and the plan distances the fade runs between. Written by
   * `environment.ts`; not the sky's, but it rides the same shared object
   * because every world material already carries it. */
  uShadowFade: { value: THREE.Vector4 };
  /** THE SKIERS' OWN MAPS (`hero-shadow.ts`): the atlas of packed depths,
   * a quadrant a skier; each slot's matrix from the world into its
   * quadrant's own 0..1, whether it is drawn this frame and its normal
   * offset, m; and `x` any drawn (1) or none (0), `y` one texel in a
   * quadrant's own 0..1, `z` the depth bias. */
  uHeroMap: { value: THREE.Texture | null };
  uHeroMatrix: { value: THREE.Matrix4[] };
  uHeroOn: { value: THREE.Vector4 };
  uHeroBias: { value: THREE.Vector4 };
  uHero: { value: THREE.Vector4 };
  /** THE MOUNTAIN'S OWN SHADOW (`terrain-shadow.ts`, `terrain-shade.ts`):
   * the horizon map over the whole map, the world-to-uv of its grid (the
   * origin less half a texel, and one over its span) and `x` whether there
   * is one to read (1) or none (0). Written by `terrain-shade.ts`. */
  uTerrainShade: { value: THREE.Texture | null };
  uTerrainShadeBox: { value: THREE.Vector4 };
  uTerrainShadeOn: { value: THREE.Vector4 };
  /** The haze's thinning height, m, and the share of it left up there. */
  uHazeLift: { value: number };
  uHazeFloor: { value: number };
  /** The snow's cues: how flat the light is, how much it glitters. */
  uFlat: { value: number };
  uGlitter: { value: number };
  /** THE NEW SNOW over the run, m (`GameState.fresh`): what buries the
   * groomer's look. The run's, not the sky's — the renderer writes it. */
  uFresh: { value: number };
  /** THE PISTE THROUGH THE DAY (`GameState.piste`, `piste-day.ts`): how
   * skied up, sun-softened and refrozen the groomer is, each 0..1, and 1
   * in `w` on a run dealt it — all nought on one that was not. The
   * renderer writes it. */
  uPiste: { value: THREE.Vector4 };
  /** HOW OLD THE LOOSE SNOW IS (`snow-age.ts`): `uSnowAge` how new, how
   * old, how wind-packed and how sun-crusted; `uSnowAge2` the surface hoar,
   * the thaw, and the level direction toward the noon sun (x, z). The
   * renderer writes them off the run's snowpack. */
  uSnowAge: { value: THREE.Vector4 };
  uSnowAge2: { value: THREE.Vector4 };
  /** THE OTHER SKIERS' TRACKS on the piste (`piste-tracks.ts`): how many
   * lines, 0..1, and how churned, 0..1. */
  uTracks: { value: THREE.Vector2 };
  /** THE LAMPS: each slot's lamp — a flood or a skier's headlamp — where
   * it is, where it points, how far on (0 for a slot with no lamp), the
   * colour of its light (linear) and its BEAM (`lampReach`): the spot's
   * cosine from its edge to its full, where the wide flood round it
   * starts, and the flood's share of the spot. */
  uLampPos: { value: THREE.Vector3[] };
  uLampDir: { value: THREE.Vector3[] };
  uLampOn: { value: number[] };
  uLampCol: { value: THREE.Vector3[] };
  uLampBeam: { value: THREE.Vector4[] };
  /** Whether the snow glitters toward the lamps (1) or is only lit by
   * them (0): the LAMPS row's (`settings-video.ts`'s `LAMP_GLINT`). */
  uLampGlint: { value: number };
  /** THE PISTE LIGHTS (`piste-lights.ts`): the light their masts lay on
   * the ground over the whole map — a vector irradiance a texel, lux — the
   * world-to-uv of its grid (the origin less half a texel, and one over its
   * span), `x` how far on in the lamp slots' units a lux (0: dark, or no
   * map baked) and the colour of the light, linear. Read by `pisteLight`. */
  uPisteLight: { value: THREE.Texture | null };
  uPisteBox: { value: THREE.Vector4 };
  uPisteOn: { value: THREE.Vector4 };
  uPisteCol: { value: THREE.Vector3 };
  /** THE AVALANCHE IN THE SNOW (`avalanche-glsl.ts`, written by
   * `avalanche-view.ts`): the slab's frame and size, its crown's and
   * flanks' phases, the debris map and its box in the slab's frame, and
   * whether a slab (`x`) and debris (`y`) are drawn — nought with none. */
  uSlab0: { value: THREE.Vector4 };
  uSlab1: { value: THREE.Vector4 };
  uSlabJog: { value: THREE.Vector4 };
  uSlideBox: { value: THREE.Vector4 };
  uSlideOn: { value: THREE.Vector4 };
  /** Where the slab's crack started (u, v), how fast it ran, m/s, and the
   * seconds since the release. */
  uSlabCrack: { value: THREE.Vector4 };
  uSlide: { value: THREE.Texture | null };
};

/** THE RUN'S SNOW into the uniforms: the new snow (`uFresh`), the
 * piste through the day (`uPiste`: worn, soft, hard, and 1 in `w` on a run
 * dealt it — `GameState.piste`) and how old the loose snow is (`uSnowAge`,
 * `uSnowAge2` — settled powder when there is no age to read) and the other
 * skiers' tracks on the piste (`uTracks`). */
export function setRunSnow(
  u: HazeUniforms,
  fresh: number,
  day: { worn: number; soft: number; hard: number } | undefined,
  age?: SnowAge | null,
  tracks?: Tracks,
): void {
  u.uFresh.value = fresh;
  u.uTracks.value.set(tracks?.many ?? 0, tracks?.churn ?? 0);
  if (day) u.uPiste.value.set(day.worn, day.soft, day.hard, 1);
  else u.uPiste.value.set(0, 0, 0, 0);
  if (age) {
    u.uSnowAge.value.set(age.fresh, age.old, age.wind, age.crust);
    u.uSnowAge2.value.set(age.hoar, age.wet, age.noon.x, age.noon.z);
  } else {
    u.uSnowAge.value.set(0, 0, 0, 0);
    u.uSnowAge2.value.set(0, 0, 0, -1);
  }
}

export function createHazeUniforms(): HazeUniforms {
  const vectors = (): THREE.Vector3[] =>
    Array.from({ length: LAMP_SLOTS }, () => new THREE.Vector3(0, 0, 1));
  return {
    uSunDir: { value: new THREE.Vector3(0, 0.4, -1).normalize() },
    uSunPos: { value: new THREE.Vector3(0, 0.4, -1).normalize() },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() },
    uSkyView: { value: skyViewTexture() },
    uHazeShadow: { value: new THREE.Vector4(0, 0, 0, 0) },
    uFar: { value: new THREE.Vector2(0, 0) },
    uFarGround: { value: new THREE.Color() },
    uFarKey: { value: new THREE.Color() },
    uHaze: { value: 1 / 1500 },
    uMist: { value: 0 },
    uMistAloft: { value: 0 },
    uShadowFade: { value: new THREE.Vector4(0, 0, 1e9, 2e9) },
    uHeroMap: { value: null },
    uHeroMatrix: { value: Array.from({ length: HERO_SLOTS }, () => new THREE.Matrix4()) },
    uHeroOn: { value: new THREE.Vector4(0, 0, 0, 0) },
    uHeroBias: { value: new THREE.Vector4(0, 0, 0, 0) },
    uHero: { value: new THREE.Vector4(0, 1, 0, 0) },
    uTerrainShade: { value: null },
    uTerrainShadeBox: { value: new THREE.Vector4(0, 0, 1, 1) },
    uTerrainShadeOn: { value: new THREE.Vector4(0, 0, 0, 0) },
    uHazeLift: { value: 700 },
    uHazeFloor: { value: 0.55 },
    uFlat: { value: 0 },
    uGlitter: { value: 1 },
    uFresh: { value: 0 },
    uPiste: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSnowAge: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSnowAge2: { value: new THREE.Vector4(0, 0, 0, -1) },
    uTracks: { value: new THREE.Vector2(0, 0) },
    uLampPos: { value: vectors() },
    uLampDir: { value: vectors() },
    uLampOn: { value: new Array<number>(LAMP_SLOTS).fill(0) },
    uLampCol: { value: Array.from({ length: LAMP_SLOTS }, () => new THREE.Vector3(1, 1, 1)) },
    uLampBeam: { value: Array.from({ length: LAMP_SLOTS }, () => new THREE.Vector4(1, 1, 1, 0)) },
    uLampGlint: { value: 1 },
    uPisteLight: { value: null },
    uPisteBox: { value: new THREE.Vector4(0, 0, 1, 1) },
    uPisteOn: { value: new THREE.Vector4(0, 0, 0, 0) },
    uPisteCol: { value: new THREE.Vector3(1, 1, 1) },
    uSlab0: { value: new THREE.Vector4(0, 0, 0, 1) },
    uSlab1: { value: new THREE.Vector4(0, 0, 1, 0) },
    uSlabJog: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSlideBox: { value: new THREE.Vector4(0, 0, 1, 1) },
    uSlideOn: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSlabCrack: { value: new THREE.Vector4(0, 0, 1, 1e3) },
    uSlide: { value: null },
  };
}

/** The dome's radiance grid as a texture: half floats, filtered, clamped. */
function skyViewTexture(): THREE.DataTexture {
  const data = new Uint16Array(SKY_VIEW_AZ * SKY_VIEW_EL * 4);
  const tex = new THREE.DataTexture(
    data,
    SKY_VIEW_AZ,
    SKY_VIEW_EL,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** The look's radiance grid into the dome's texture — only when it moved. */
function writeSkyView(tex: THREE.DataTexture, view: Float32Array): void {
  const data = tex.image.data as Uint16Array;
  let moved = false;
  for (let k = 0, n = view.length / 3; k < n; k++)
    for (let c = 0; c < 3; c++) {
      const h = THREE.DataUtils.toHalfFloat(Math.min(65000, view[k * 3 + c]));
      if (data[k * 4 + c] !== h) {
        data[k * 4 + c] = h;
        moved = true;
      }
    }
  if (moved) tex.needsUpdate = true;
}

/** Write a `SkyLook` into the shared uniforms. Colours are LINEAR, so they
 * are set channel by channel rather than through `Color.set`, which would
 * treat them as sRGB. */
export function writeHaze(u: HazeUniforms, look: SkyLook): void {
  u.uSunDir.value.set(look.key.x, look.key.y, look.key.z);
  u.uSunPos.value.set(look.sun.x, look.sun.y, look.sun.z);
  u.uZenith.value.setRGB(...look.zenith);
  u.uHorizon.value.setRGB(...look.horizon);
  u.uGlow.value.setRGB(...look.glow);
  u.uSunCol.value.setRGB(...look.sunColour);
  writeSkyView(u.uSkyView.value, look.view);
  u.uHazeShadow.value.set(...look.hazeShadow);
  u.uFarGround.value.setRGB(...look.farGround);
  u.uFarKey.value.setRGB(...look.farKey);
  u.uHaze.value = look.haze;
  u.uHazeLift.value = look.hazeLift;
  // A valley fog is thick at the floor and gone over the peaks.
  u.uHazeFloor.value = look.fog > 0 ? 0.12 : 0.55;
  u.uFlat.value = look.flat;
  u.uGlitter.value = look.glitter;
}

/** The sky along a direction, in linear light — the dome's own colour. */
export const SKY_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunPos;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSunCol;
uniform sampler2D uSkyView;
uniform vec4 uHazeShadow;
uniform vec2 uFar;
uniform vec3 uFarGround;
uniform vec3 uFarKey;
uniform float uHaze;
uniform float uMist;
uniform float uMistAloft;
uniform float uHazeLift;
uniform float uHazeFloor;

// The physical sky (\`uSkyView\`): its grid is the azimuth from the sun
// packed toward it (u = sqrt(az / pi)) by the view's elevation packed toward
// the horizon (v = sqrt(el / (pi / 2))) — sky-table-format.ts's layout.
// The elevation is counted from the TRUE horizon, \`uFar.x\` under the
// level (the Earth curving away under a lens up a mountain), so the sky
// reaches down to it; under it the dome is the horizon's own air.
vec3 skyColour(vec3 dir) {
  vec3 d = normalize(dir);
  float up = clamp((asin(clamp(d.y, -1.0, 1.0)) + uFar.x) / (1.57079633 + uFar.x), 0.0, 1.0);
  float hl = length(d.xz);
  float sl = length(uSunPos.xz);
  float ca = (hl > 1e-4 && sl > 1e-4) ? dot(d.xz, uSunPos.xz) / (hl * sl) : 1.0;
  float u = sqrt(acos(clamp(ca, -1.0, 1.0)) / 3.14159265);
  float v = sqrt(up);
  vec2 uv = vec2(
    (u * ${(SKY_VIEW_AZ - 1).toFixed(1)} + 0.5) / ${SKY_VIEW_AZ.toFixed(1)},
    (v * ${(SKY_VIEW_EL - 1).toFixed(1)} + 0.5) / ${SKY_VIEW_EL.toFixed(1)});
  return texture2D(uSkyView, uv).rgb;
}

// The colour a far surface fades into along \`dir\`: the sky just over the
// true horizon on that bearing — the air's own light, seen through the
// whole of it.
vec3 hazeColour(vec3 dir) {
  vec3 d = normalize(vec3(dir.x, clamp(dir.y, -0.02 - uFar.x, 0.06), dir.z));
  // After sunset the valleys' air is in Earth's shadow: the far ridges
  // stand dark against the glow, not lit by it.
  return mix(skyColour(d), uHazeShadow.rgb, uHazeShadow.w);
}

// How far the ray along \`dir\` runs to the far ground, m: a sphere under
// the lens by \`uFar.y\` with the Earth's radius stretched by the air's
// bending (\`FAR_RADIUS\`), reckoned in the form that keeps a float's
// digits — 1e9 over the true horizon, where it never comes down.
float farDistance(vec3 dir) {
  float s = -normalize(dir).y;
  float q = s * s - 2.0 * uFar.y / ${FAR_RADIUS.toFixed(1)};
  if (s <= 0.0 || q < 0.0) return 1e9;
  return 2.0 * uFar.y / (s + sqrt(q));
}

// WHAT LIES UNDER THE HORIZON, as the dome and the mist's wall show it:
// the far ground — valleys and ranges beyond the map — seen through the
// air to it. Right under the horizon the ray runs a hundred kilometres
// and more through the low air, so it is the air's colour; looking further
// down the way shortens and the ground shows through, darker than the
// sky by day and dim at dusk. \`shadow\` is how much of Earth's shadow on
// the low air to take (none at the horizon itself, so the dome meets the
// sky there with no step).
vec3 farColour(vec3 dir, float shadow) {
  vec3 d = normalize(vec3(dir.x, clamp(dir.y, -0.02 - uFar.x, 0.06), dir.z));
  vec3 air = mix(skyColour(d), uHazeShadow.rgb, uHazeShadow.w * shadow);
  // The way down runs half its length over the valleys' haze, where the
  // air thins toward \`uHazeFloor\` of its density (\`hazeAir\`'s law, at the
  // way's mean height over the far ground).
  float thin = mix(uHazeFloor, 1.0, exp(-0.5 * uFar.y / uHazeLift));
  float seen = exp(-farDistance(dir) * uHaze * thin);
  // The faces seen are the ones turned toward the lens, a mountain's
  // steepness up: in shade looking into a low sun, lit — the alpenglow on
  // the far ranges — looking away from it.
  vec3 face = normalize(vec3(-d.x, 0.75, -d.z));
  // Between them lie level snowfields and valleys.
  float lit = 0.7 * max(dot(face, uSunDir), 0.0) + 0.3 * max(uSunDir.y, 0.0);
  vec3 ground = uFarGround + uFarKey * lit;
  return mix(air, ground, seen);
}

// How much of that colour stands between the lens and a point \`dist\` m
// away whose height over the lens is \`rise\` m: exponential, thinning with
// altitude so the peaks keep their shape a little longer than the valleys.
float hazeAir(float dist, float rise) {
  float thin = exp(-max(rise, 0.0) / uHazeLift);
  return 1.0 - exp(-dist * uHaze * mix(uHazeFloor, 1.0, thin));
}

// The DISTANCE row's MIST: clear round the skier, thickening with the
// square of the distance and closed whole at its wall, at any height —
// the ground and the woods stop there, and nothing past it may show.
// Aloft (\`uMistAloft\`), across the ground, melting it into the haze over
// most of the way out and whole a little inside the wall — where the woods
// stop — so neither the woods nor the ground ends on a rim.
float hazeMist(float dist, float rise) {
  if (uMist <= 0.0) return 0.0;
  float across = mix(dist, sqrt(max(dist * dist - rise * rise, 0.0)), uMistAloft);
  float m = across / uMist;
  float mist = max(1.0 - exp(-3.0 * m * m), smoothstep(0.7, 1.0, m));
  return mix(mist, smoothstep(0.2, 0.82, m), uMistAloft);
}

// Both together, for what is drawn into the haze's colour alone (the spray,
// the snow's cloud, the water's far hill).
float hazeAmount(float dist, float rise) {
  return max(hazeAir(dist, rise), hazeMist(dist, rise));
}

// The mist on the dome: a band over the true horizon as deep as a mist
// some forty metres thick stands at its wall, so a hill past the ground's
// edge is sky the colour it would have faded into.
float mistBand(vec3 dir) {
  if (uMist <= 0.0) return 0.0;
  return 1.0 - smoothstep(0.0, 40.0 / uMist, max(normalize(dir).y + uFar.x, 0.0));
}
`;

/** THE LAMPS' UNIFORMS AND THEIR BEAM, for any shader, vertex or fragment:
 * `lampReach(i, toLamp, d)` is how much of lamp `i` reaches a point `d` m
 * from it, `toLamp` the unit way back to the lamp — its spot and the wide
 * flood round it (`uLampBeam`), falling off with the square of the
 * distance, and faded out within a metre of the lens, so a headlamp never
 * floods the helmet it is strapped to. The slots are DEALT IN ORDER
 * (`headlamp.ts`'s `dealLamps`: every lamp lit has a slot before any empty
 * one), so a loop over them breaks at the first empty slot — by day, when
 * none is lit, it is one test rather than six (software GL runs a body it
 * skips with `continue` masked, at the whole body's price). And
 * `pisteLight(at)`: the PISTE
 * LIGHTS' vector irradiance at a world point, in the same units — the light
 * on a surface of normal n is `max(dot(n, v), 0)`, and `length(v)` all of
 * it, for what has no one face (a flake, the cloud). */
export const LAMP_GLSL = /* glsl */ `
uniform vec3 uLampPos[${LAMP_SLOTS}];
uniform vec3 uLampDir[${LAMP_SLOTS}];
uniform float uLampOn[${LAMP_SLOTS}];
uniform vec3 uLampCol[${LAMP_SLOTS}];
uniform vec4 uLampBeam[${LAMP_SLOTS}];
uniform float uLampGlint;
float lampReach(int i, vec3 toLamp, float d) {
  float axis = dot(-toLamp, uLampDir[i]);
  vec4 b = uLampBeam[i];
  float beam = smoothstep(b.x, b.y, axis) + b.w * smoothstep(b.z, b.x, axis);
  return uLampOn[i] * beam * smoothstep(0.2, 0.9, d) / (1.0 + 0.012 * d * d);
}
uniform sampler2D uPisteLight;
uniform vec4 uPisteBox;
uniform vec4 uPisteOn;
uniform vec3 uPisteCol;
vec3 pisteLight(vec3 at) {
  if (uPisteOn.x <= 0.0) return vec3(0.0);
  vec2 uv = (at.xz - uPisteBox.xy) * uPisteBox.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0);
  return texture2D(uPisteLight, uv).rgb * uPisteOn.x;
}
`;

/** THE LAMPS ON EVERYTHING ELSE: a tree, a gate, a skier in a beam takes
 * it on the side that faces the lamp. The snow has its own (`snow-glsl.ts`,
 * with its glitter) and says so with `OWN_LAMPS`. */
const LAMP_FRAGMENT = /* glsl */ `
#ifndef OWN_LAMPS
{
  vec3 lpN = inverseTransformDirection(normal, viewMatrix);
  vec3 lpLit = vec3(0.0);
  for (int i = 0; i < ${LAMP_SLOTS}; i++) {
    if (uLampOn[i] <= 0.0) break;
    if (uLampOn[i] <= 0.001) continue;
    vec3 L = uLampPos[i] - vHazeWorld;
    float d = length(L);
    L /= max(d, 1e-3);
    float e = lampReach(i, L, d);
    if (e <= 0.0) continue;
    lpLit += uLampCol[i] * e * max(dot(lpN, L), 0.0);
  }
  if (uPisteOn.x > 0.0) lpLit += uPisteCol * max(dot(lpN, pisteLight(vHazeWorld)), 0.0);
  reflectedLight.directDiffuse += BRDF_Lambert(diffuseColor.rgb) * lpLit * 9.0;
}
#endif
`;

const HAZE_VERTEX = /* glsl */ `
varying vec3 vHazeWorld;
`;

const HAZE_VERTEX_MAIN = /* glsl */ `
{
  vec4 hzw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    hzw = instanceMatrix * hzw;
  #endif
  vHazeWorld = (modelMatrix * hzw).xyz;
}
`;

/** The fog chunk's replacement: `vHazeWorld` must be in scope. */
export const HAZE_FRAGMENT = /* glsl */ `
{
  vec3 hzRay = vHazeWorld - cameraPosition;
  float hzDist = length(hzRay);
  vec3 hzDir = hzRay / max(hzDist, 1e-3);
  vec3 hzCol = hazeColour(hzDir);
  // Into the air's own light by the air between; then, where the DISTANCE
  // row's mist closes the ground, into what the dome shows behind it — so
  // the ground's last ring meets the far ground under the horizon, not a
  // band of sky.
  vec3 hzFar = farColour(hzDir, 1.0);
  #if defined(TONE_MAPPING)
    hzCol = toneMapping(hzCol);
    hzFar = toneMapping(hzFar);
  #endif
  hzCol = linearToOutputTexel(vec4(hzCol, 1.0)).rgb;
  hzFar = linearToOutputTexel(vec4(hzFar, 1.0)).rgb;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hzCol, hazeAir(hzDist, hzRay.y));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hzFar, hazeMist(hzDist, hzRay.y));
}
`;

/** The sun's shadow faded out over the ridge of the circle it is drawn in
 * (`shadow-box.ts`), so the edge of the shadow map is a gradient that
 * travels with the lens rather than a line shadows pop across. */
const SHADOW_FADE_GLSL = /* glsl */ `
uniform vec4 uShadowFade;
float shadowFaded(float shadow) {
  float d = length(vHazeWorld.xz - uShadowFade.xy);
  return mix(shadow, 1.0, smoothstep(uShadowFade.z, uShadowFade.w, d));
}
// Past the ridge the fade is whole, and the map is not read at all.
bool shadowGone() {
  return length(vHazeWorld.xz - uShadowFade.xy) >= uShadowFade.w;
}
`;

/** The skiers' own shadows (`shadow-box.ts`, `hero-shadow.ts`), each looked
 * up in its quadrant of the atlas and taken with the wide map's, the
 * darkest of them. The atlas is a DEPTH texture read through a comparing
 * sampler, so one tap is the GPU's own four compares blended bilinearly —
 * what this did by hand in four reads and a mix — and nine taps a texel and
 * a quarter apart make an edge a few millimetres soft, as the sun's own disc
 * makes it, that slides smoothly rather than stepping a texel at a time; the
 * taps are held inside the quadrant, so a neighbour never bleeds in. Only
 * the pixels inside a skier's box pay for his, and every lit pixel carries
 * the code, so it is kept short. Goes in after `shadowmap_pars_fragment`. */
const HERO_SHADOW_GLSL = /* glsl */ `
#ifdef USE_SHADOWMAP
uniform sampler2DShadow uHeroMap;
uniform mat4 uHeroMatrix[${HERO_SLOTS}];
uniform vec4 uHeroOn;
uniform vec4 uHeroBias;
uniform vec4 uHero;
// \`uv\` in the quadrant's own 0..1; \`corner\` where it sits in the atlas.
float heroLerp(vec2 uv, vec2 corner, float z) {
  float t = uHero.y;
  uv = clamp(uv, vec2(0.5 * t), vec2(1.0 - 1.5 * t));
  return texture(uHeroMap, vec3(corner + 0.5 * uv, z));
}
float heroSlot(vec3 n, mat4 m, float normalBias, vec2 corner) {
  vec4 hc = m * vec4(vHazeWorld + n * normalBias, 1.0);
  vec3 p = hc.xyz / hc.w;
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
  p.z -= uHero.z;
  float gap = uHero.y * 1.25;
  float lit = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      lit += heroLerp(p.xy + vec2(float(i), float(j)) * gap, corner, p.z);
    }
  }
  return lit / 9.0;
}
float heroShadowed(float shadow, vec3 viewNormal) {
  if (uHero.x < 0.5) return shadow;
  vec3 n = inverseTransformDirection(viewNormal, viewMatrix);
  if (uHeroOn.x > 0.5) shadow = min(shadow, heroSlot(n, uHeroMatrix[0], uHeroBias.x, vec2(0.0, 0.0)));
  if (uHeroOn.y > 0.5) shadow = min(shadow, heroSlot(n, uHeroMatrix[1], uHeroBias.y, vec2(0.5, 0.0)));
  if (uHeroOn.z > 0.5) shadow = min(shadow, heroSlot(n, uHeroMatrix[2], uHeroBias.z, vec2(0.0, 0.5)));
  if (uHeroOn.w > 0.5) shadow = min(shadow, heroSlot(n, uHeroMatrix[3], uHeroBias.w, vec2(0.5, 0.5)));
  return shadow;
}
#endif
`;

const DIR_SHADOW_OPEN = "? getShadow( directionalShadowMap[ i ]";
const DIR_SHADOW_CLOSE = "vDirectionalShadowCoord[ i ] ) : 1.0;";

/** Three's `lights_fragment_begin` with the directional light's shadow
 * passed through `shadowFaded` (and not read at all past the ridge, where the
 * fade takes it whole), the skiers' own maps taken with it
 * (`heroShadowed`), and the mountain's own shadow (`terrainLit`) with both —
 * the darkest of them, one shadow model: the key's light taken away and the
 * sky's left, so a ridge's shade is the same blue as a tree's. Built once,
 * and loudly: a three that moved the line would otherwise leave the ridge a
 * hard edge with nothing said. */
let fadedLights: string | null = null;
export function lightsWithFade(): string {
  if (fadedLights !== null) return fadedLights;
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  if (!chunk.includes(DIR_SHADOW_OPEN) || !chunk.includes(DIR_SHADOW_CLOSE)) {
    throw new Error("haze.ts: three's directional shadow line moved; re-graft shadowFaded");
  }
  fadedLights = chunk
    .replace(
      DIR_SHADOW_OPEN,
      "? min( terrainLit( vHazeWorld ), heroShadowed( shadowFaded( shadowGone() ? 1.0 : getShadow( directionalShadowMap[ i ]",
    )
    .replace(
      DIR_SHADOW_CLOSE,
      "vDirectionalShadowCoord[ i ] ) ), geometryNormal ) ) : terrainLit( vHazeWorld );",
    );
  return fadedLights;
}

/** Hook the shared uniforms into a compiled shader. */
export function bindHaze(
  shader: { uniforms: Record<string, THREE.IUniform> },
  u: HazeUniforms,
): void {
  Object.assign(shader.uniforms, u);
}

/**
 * Put the haze into a built-in material. `extra` runs after it with the
 * same shader, for a caller with its own graft (the trees' snow). The
 * program's cache key is three's own parameters plus ours: every material
 * with the haze alone grafts the same source, so they all SHARE one key and
 * three links the program once for the lot (each material keeps its own
 * uniforms either way); a material with an `extra` puts its `name` in the
 * key, since two materials whose `onBeforeCompile` differ must never be
 * handed each other's program. A program linked twice for one source is
 * paid for on the loading card, and on a phone's driver that is the card.
 */
export function hazeMaterial<M extends THREE.Material>(
  material: M,
  u: HazeUniforms,
  name: string,
  extra?: (shader: THREE.WebGLProgramParametersWithUniforms) => void,
): M {
  const key = extra ? `haze:${name}` : "haze";
  material.customProgramCacheKey = (): string => key;
  material.onBeforeCompile = (shader) => {
    bindHaze(shader, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${HAZE_VERTEX}`)
      .replace("#include <fog_vertex>", `#include <fog_vertex>\n${HAZE_VERTEX_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\n${SKY_GLSL}\n${LAMP_GLSL}\n${TERRAIN_SHADOW_GLSL}\n${HAZE_VERTEX}\n${SHADOW_FADE_GLSL}`,
      )
      .replace(
        "#include <shadowmap_pars_fragment>",
        `#include <shadowmap_pars_fragment>\n${HERO_SHADOW_GLSL}`,
      )
      .replace("#include <lights_fragment_begin>", lightsWithFade())
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>\n${LAMP_FRAGMENT}`)
      .replace("#include <fog_fragment>", HAZE_FRAGMENT);
    extra?.(shader);
  };
  return material;
}

/** PAST THE MIST'S WALL NOTHING SHOWS (`hazeAmount`): the ground and the
 * woods stop there, so anything standing up off a far face — a lift's
 * rope and towers, a wind tunnel's arches — would hang in the sky the
 * mountain behind it is no longer drawn on. An `extra` for `hazeMaterial`. */
export const PAST_THE_WALL = (shader: THREE.WebGLProgramParametersWithUniforms): void => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "void main() {",
    "void main() {\n  vec3 hzW = vHazeWorld - cameraPosition;\n  if (uMist > 0.0 && mix(length(hzW), length(hzW.xz), uMistAloft) > uMist) discard;",
  );
};
