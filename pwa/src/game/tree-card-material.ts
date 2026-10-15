// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARD TREES' MATERIAL — what the forest draws every tree with on the
// MEDIUM and HIGH FOREST rows (`tree-cards.ts`, `forest.ts`): the standard
// lit material over the needle atlas painted at load (`tree-atlas.ts`), its four channels read apart rather than as a
// colour —
//   R  the needles' SHADE inside a spray (the inner shoots darker),
//   G  where SNOW can lie on it (the pillows on the shoots),
//   B  how THIN it is (how much a low sun shines through it),
//   A  its COVERAGE, cut at `ALPHA_CUT`.
//
// THE SNOW is laid here, not painted: the atlas's mask (read a level and a
// half down its mips, so the pillows lie as lumps along a bough rather than
// a speck of white a needle) times what the part can carry (the `card`
// mark's first value: a bough's load off its kind and region, 0 for the
// wood), times how far the surface faces the SKY in the world — snow lies
// on the tops of the boughs, never down their sides — times the tree's own
// load, cut by a narrow step into lumps. A tree LADEN well past the mark
// (1.05) is crusted beyond its pillows too where it faces straight up, its
// needles and its core alike, until a snow ghost is white. The snow lies on
// the needles and never past them: the coverage is the needles' alone.
//
// EVERY CARD IS TWO TRIANGLES A SIDE (`tree-card-parts.ts`'s `twoSided`),
// so the material culls back faces as any solid's does and the closed wood
// and core inside a crown never pay for their hidden insides. A BOUGH'S
// UNDERSIDE (the `card` mark's second value) is darker and bare, its normal
// the top's turned down, so it takes the sky and the snow's light and never
// the sun's; a standing card's back is the crown seen from the other way,
// its normal mirrored through the card.
//
// A card seen EDGE-ON is faded out past grazing: its tile's smallest mips
// are one blot, a grey bar across the crown.
//
// BACKLIGHT: a needle spray between the lens and a low sun glows faintly at
// its thin edges — a rim, never the whole crown lit white, and never the
// snow, which a low sun behind a bough leaves in shade.

import * as THREE from "three";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { ALPHA_CUT, ATLAS_SIZE, paintAtlas } from "./tree-atlas.ts";
import { SNOW, SNOW_SHADE } from "./tree-shapes.ts";

/** The atlas as a texture, its mips the painted levels (their coverage
 * kept, never three's own box filter), first row at the bottom as GL reads
 * it. */
export function atlasTexture(levels: readonly Uint8Array[] = paintAtlas()): THREE.DataTexture {
  const flipped = levels.map((data, k) => {
    const size = Math.max(1, ATLAS_SIZE >> k);
    const row = size * 4;
    const out = new Uint8Array(data.length);
    for (let y = 0; y < size; y++)
      out.set(data.subarray(y * row, (y + 1) * row), (size - 1 - y) * row);
    return { data: out, width: size, height: size };
  });
  const tex = new THREE.DataTexture(flipped[0].data, ATLAS_SIZE, ATLAS_SIZE, THREE.RGBAFormat);
  tex.mipmaps = flipped as unknown as THREE.CompressedTextureMipmap[];
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

const CARD_VERTEX_PARS = `
attribute vec2 card;
varying vec2 vCard;
varying float vCardUp;
varying float vCardLoad;`;

const CARD_VERTEX = `
  vCard = card;
  {
    mat3 cardTurn = mat3(modelMatrix);
    float cardLoad = 1.0;
    #ifdef USE_BATCHING
      // In the forest's batch (forest-batch.ts): the tree's own matrix,
      // and its own LOAD — the one its solid cuts shed their snow by
      // (tree-snow.ts), so a tree handed from the cards to its full cut
      // carries the same snow.
      cardTurn = cardTurn * mat3(batchingMatrix);
      cardLoad = 0.25 + 0.55 * clamp(tbData.w, 0.0, 1.2);
    #elif defined(USE_INSTANCING)
      cardTurn = cardTurn * mat3(instanceMatrix);
      vec2 cardAt = instanceMatrix[3].xz;
      cardLoad = 0.7 + 0.6 * fract(sin(dot(cardAt, vec2(12.9898, 78.233))) * 43758.5453);
    #endif
    vCardUp = normalize(cardTurn * objectNormal).y;
    vCardLoad = cardLoad;
  }`;

const CARD_FRAGMENT_PARS = `
varying vec2 vCard;
varying float vCardUp;
varying float vCardLoad;
uniform vec3 uCardSnow;
uniform vec3 uCardShade;
float cardSnow = 0.0;
float cardSky = 0.0;
float cardThin = 0.0;`;

const CARD_MAP = `
  vec4 cardTex = texture2D(map, vMapUv);
  diffuseColor.a *= cardTex.a;
  // A card seen edge-on samples a mip so small its tile is one blot: it is
  // faded out as it turns past grazing (the solid tile — wood and core —
  // never is).
  if (cardTex.b > 0.02 || cardTex.a < 0.98) {
    vec3 cardFace = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    float cardSeen = abs(dot(cardFace, normalize(vViewPosition)));
    diffuseColor.a *= smoothstep(0.06, 0.28, cardSeen);
  }
  {
    // The snow read a level and a half down the atlas's mips: the pillows as
    // lumps along a bough, never a needle's worth of white each.
    float cardMask = texture2D(map, vMapUv, 1.5).g;
    bool cardUnder = vCard.y > 0.5;
    // Snow lies on what faces the sky and nowhere else; a laden tree is
    // crusted past its pillows only well past the laden mark, and only where
    // it faces nearly straight up (a standing card's lean never does).
    cardSky = smoothstep(0.3, 0.95, vCardUp);
    float cardCrust = 0.32 * cardTex.a * smoothstep(1.05, 1.45, vCard.x) * smoothstep(0.8, 0.95, vCardUp);
    // A narrow step: a lump is snow or needles, never a pale olive between.
    cardSnow = cardUnder ? 0.0
      : smoothstep(0.26, 0.34, max(cardMask, cardCrust) * vCard.x * vCardLoad * (0.3 + 0.7 * cardSky));
    cardThin = cardTex.b;
    diffuseColor.rgb *= mix(0.72, 1.2, cardTex.r) * (cardUnder ? 0.62 : 1.0);
  }`;

const CARD_COLOUR = `
#include <color_fragment>
  // The snow on a face turned from the sky is the blue of snow in shade,
  // never the warm grey the needles' own light would leave on white.
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(uCardShade, uCardSnow, cardSky), cardSnow);`;

const CARD_BACKLIGHT = `
  #if NUM_DIR_LIGHTS > 0
  {
    float cardBack = max(0.0, dot(normalize(-vViewPosition), directionalLights[0].direction));
    outgoingLight += directionalLights[0].color * diffuseColor.rgb
      * pow(cardBack, 12.0) * 0.12 * cardThin * (1.0 - cardSnow);
  }
  #endif
#include <opaque_fragment>`;

/** The card graft, for `hazeMaterial`'s `extra` beside the forest's own. */
export function graftCards(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.uniforms.uCardSnow = { value: SNOW.clone() };
  shader.uniforms.uCardShade = { value: SNOW_SHADE.clone() };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${CARD_VERTEX_PARS}`)
    .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>\n${CARD_VERTEX}`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${CARD_FRAGMENT_PARS}`)
    .replace("#include <map_fragment>", CARD_MAP)
    .replace("#include <color_fragment>", CARD_COLOUR)
    .replace("#include <opaque_fragment>", CARD_BACKLIGHT);
}

/** The material every card tree is drawn with, cut at `ALPHA_CUT`;
 * `extra` the forest's own grafts (the girth, the hand-over's dither). */
export function cardMaterial(
  haze: HazeUniforms,
  atlas: THREE.Texture,
  extra: (shader: THREE.WebGLProgramParametersWithUniforms) => void = () => {},
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    map: atlas,
    alphaTest: ALPHA_CUT,
  });
  return hazeMaterial(material, haze, "tree-cards", (shader) => {
    extra(shader);
    graftCards(shader);
  });
}

/** What the atlas holds on the card, bytes: every painted level, RGBA. */
export function atlasBytes(atlas: THREE.Texture): number {
  const levels = (atlas as THREE.DataTexture).mipmaps as unknown as { data: Uint8Array }[];
  return levels.reduce((n, l) => n + l.data.byteLength, 0);
}
