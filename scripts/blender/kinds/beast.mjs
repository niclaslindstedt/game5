// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN ANIMAL, as the Blender lab is handed it: the roster's row
// (`beast-defs.ts` — its length, its height at the shoulder, its gait) and
// its style (`BEAST_STYLES` in `beast-shapes.ts` — the proportions the
// code's builder shapes it by: the width, the legs, the neck and its
// carriage, the head, the ears, the tail, the hump, the antlers or horns;
// and, for the stills alone, its paint). The game dresses a model by its
// materials' names (`beast-models.ts`), so the glTF carries no colour.
export const kind = {
  ids: async () => [...(await import("../../../pwa/src/game/beast-defs.ts")).BEAST_IDS],
  data: async (id) => {
    const { beastById } = await import("../../../pwa/src/game/beast-defs.ts");
    const { BEAST_STYLES } = await import("../../../pwa/src/game/beast-shapes.ts");
    return { spec: beastById(id), style: BEAST_STYLES[id] };
  },
  builder: "beast.py",
  fallback: "reindeer",
  help: "an animal of the roster",
};
