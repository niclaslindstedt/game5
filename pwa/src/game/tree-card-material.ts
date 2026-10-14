// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARD TREES' MATERIAL — what the forest draws every card tree with
// (`tree-cards.ts`): the standard lit material over the needle atlas painted
// at load (`tree-atlas.ts`), its four channels read apart rather than as a
// colour —
//   R  the needles' SHADE inside a spray (the inner shoots darker),
//   G  where SNOW can lie on it (the pillows on the shoots),
//   B  how THIN it is (how much a low sun shines through it),
//   A  its COVERAGE, cut at `ALPHA_CUT` — smoothed by alpha-to-coverage
//      where the picture is multisampled, so a card's ragged edge is
//      antialiased instead of stair-stepped.
//
// THE SNOW is laid here, not painted: the atlas's mask times what the part
// can carry (the `card` mark's first value: a bough's load off its kind and
// region, 0 for the wood), times how much the surface faces the sky in the
// WORLD, times a per-tree load off a hash of where it stands — so no two
// trees carry the same snow — cut by a soft step into lumps. A tree LADEN
// past a mark of 0.8 is crusted beyond its pillows too, its needles and its
// core alike, until a snow ghost is white. A pillow fills its own needles'
// gaps (the alpha is the most of the two), so a loaded bough reads as a
// white shelf with the needles under it.
//
// A BOUGH'S UNDERSIDE (the `card` mark's second value) is darker, its snow
// only the pillows' edges showing round it. Seen from below a card shows
// its back, shaded as the underside it is but lit by its crown's normal like
// its top (turned to face the snow, a bough overhead would stand black
// against the sky). A standing card's other side is the same crown seen
// from the other way. The wood and the core are closed shapes: they are
// drawn two-sided only because the material is.
//
// A card seen EDGE-ON is faded out past grazing: its tile's smallest mips
// are one blot, a grey bar across the crown.
//
// BACKLIGHT: a needle spray between the lens and a low sun glows at its
// thin edges and through its snow — the halo round a spruce at sunset.

import * as THREE from "three";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { ALPHA_CUT, ATLAS_SIZE, paintAtlas } from "./tree-atlas.ts";
import { SNOW } from "./tree-shapes.ts";

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
    float cardHash = 0.5;
    #ifdef USE_INSTANCING
      cardTurn = cardTurn * mat3(instanceMatrix);
      vec2 cardAt = instanceMatrix[3].xz;
      cardHash = fract(sin(dot(cardAt, vec2(12.9898, 78.233))) * 43758.5453);
    #endif
    vCardUp = normalize(cardTurn * objectNormal).y;
    vCardLoad = 0.7 + 0.6 * cardHash;
  }`;

const CARD_FRAGMENT_PARS = `
varying vec2 vCard;
varying float vCardUp;
varying float vCardLoad;
uniform vec3 uCardSnow;
float cardSnow = 0.0;
float cardThin = 0.0;`;

const CARD_MAP = `
  vec4 cardTex = texture2D(map, vMapUv);
  bool cardUnder = vCard.y > 0.5 && !gl_FrontFacing;
  float cardSky = 0.45 + 0.55 * clamp(vCardUp, 0.0, 1.0);
  cardSnow = smoothstep(0.16, 0.36, max(cardTex.g, 0.36 * cardTex.a * smoothstep(0.8, 1.4, vCard.x)) * vCard.x * vCardLoad * cardSky)
    * (cardUnder ? 0.55 : 1.0);
  cardThin = cardTex.b;
  diffuseColor.rgb *= mix(0.75, 1.3, cardTex.r) * (cardUnder ? 0.78 : 1.0);
  diffuseColor.a *= max(cardTex.a, cardSnow);
  // A card seen edge-on samples a mip so small its tile is one blot: it is
  // faded out as it turns past grazing (the solid tile — wood and core —
  // never is).
  if (cardTex.b > 0.02 || cardTex.a < 0.98) {
    vec3 cardFace = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    float cardSeen = abs(dot(cardFace, normalize(vViewPosition)));
    diffuseColor.a *= smoothstep(0.06, 0.28, cardSeen);
  }`;

const CARD_COLOUR = `
#include <color_fragment>
  diffuseColor.rgb = mix(diffuseColor.rgb, uCardSnow, cardSnow);`;

const CARD_BACKLIGHT = `
  #if NUM_DIR_LIGHTS > 0
  {
    float cardBack = max(0.0, dot(normalize(-vViewPosition), directionalLights[0].direction));
    outgoingLight += directionalLights[0].color * diffuseColor.rgb
      * pow(cardBack, 8.0) * (0.35 * cardThin + 0.5 * cardSnow);
  }
  #endif
#include <opaque_fragment>`;

/** The card graft, for `hazeMaterial`'s `extra` beside the forest's own. */
export function graftCards(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.uniforms.uCardSnow = { value: SNOW.clone() };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${CARD_VERTEX_PARS}`)
    .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>\n${CARD_VERTEX}`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${CARD_FRAGMENT_PARS}`)
    .replace("#include <map_fragment>", CARD_MAP)
    .replace("#include <color_fragment>", CARD_COLOUR)
    // Every card is lit by its crown's normal on both faces: a bough seen
    // from below is darkened by its own shade (above), not turned to face
    // the snow, which would leave it black against the sky.
    .replace("normal *= faceDirection;", "")
    .replace("#include <opaque_fragment>", CARD_BACKLIGHT);
}

/** The material every card tree is drawn with: `coverage` where the
 * picture is multisampled (alpha-to-coverage), a plain cut where it is not;
 * `extra` the forest's own grafts (the girth, the hand-over's dither). */
export function cardMaterial(
  haze: HazeUniforms,
  atlas: THREE.Texture,
  coverage: boolean,
  extra: (shader: THREE.WebGLProgramParametersWithUniforms) => void = () => {},
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    map: atlas,
    alphaTest: ALPHA_CUT,
    alphaToCoverage: coverage,
    side: THREE.DoubleSide,
  });
  return hazeMaterial(material, haze, coverage ? "tree-cards-a2c" : "tree-cards", (shader) => {
    extra(shader);
    graftCards(shader);
  });
}
