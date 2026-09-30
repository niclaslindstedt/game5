// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A KIND of tree, as the Blender lab is handed it: its ten variant rows
// (`tree-variants.ts`, the numbers the code's builder reads) with each
// one's silhouette sampled off `crownAt`, the reference size a model is
// made at, and — for the stills alone — the kind's colours under the alpine
// paint (linear RGB). The game dresses a model by its materials' names, so
// the glTF carries none.
export const kind = {
  ids: async () => [...(await import("../../../engine/index.ts")).TREE_KINDS],
  data: async (id) => {
    const { TREE_VARIANTS, TREE_REFERENCE, crownAt } =
      await import("../../../pwa/src/game/tree-variants.ts");
    const { kindPaint, treePaint, SNOW, SNOW_SHADE } =
      await import("../../../pwa/src/game/tree-shapes.ts");
    const { regionLookOf } = await import("../../../pwa/src/game/region-look.ts");
    const p = kindPaint(treePaint(regionLookOf("alpine")), id);
    const rgb = (c) => [c.r, c.g, c.b];
    return {
      kind: id,
      reference: TREE_REFERENCE,
      variants: TREE_VARIANTS[id].map((v) => ({
        ...v,
        profile: Array.from({ length: 41 }, (_, i) => crownAt(v, i / 40)),
      })),
      paint: {
        needle: rgb(p.needle),
        dark: rgb(p.dark),
        bark: rgb(p.bark),
        upper: rgb(p.upper),
        twigs: rgb(p.twigs),
        accent: rgb(p.accent),
        marks: rgb(p.marks),
        snow: rgb(SNOW),
        snowShade: rgb(SNOW_SHADE),
      },
    };
  },
  builder: "tree.py",
  fallback: "spruce",
  help: "a kind of tree (its ten variants in one glTF)",
};
