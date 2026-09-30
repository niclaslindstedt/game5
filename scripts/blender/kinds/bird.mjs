// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BIRD, as the Blender lab is handed it: the roster's row
// (`bird-defs.ts` — the span, the length, the neck, the wing's plan: the
// very numbers `bird-shapes.ts` builds the code's bird from) and, for the
// stills alone, the species' paint (`BIRD_STYLES`, sRGB hex). The game
// dresses a model by its materials' names (`bird-models.ts`), so the glTF
// carries no colour and a repaint remakes no model.
export const kind = {
  ids: async () => [...(await import("../../../pwa/src/game/bird-defs.ts")).BIRD_IDS],
  data: async (id) => {
    const { birdById } = await import("../../../pwa/src/game/bird-defs.ts");
    const { BIRD_STYLES } = await import("../../../pwa/src/game/bird-shapes.ts");
    return { spec: birdById(id), style: BIRD_STYLES[id] };
  },
  builder: "bird.py",
  fallback: "raven",
  help: "a bird of the roster",
};
