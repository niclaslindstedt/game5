// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINE, as the Blender lab is handed it (`scripts/blender.mjs
// --kind=groomer`): `GROOMER` (`engine/game/defs/groomer.ts`) whole — the
// class's measures the engine works and strikes with — and the layout it is
// drawn to (`pwa/src/game/groomer-look.ts`: the belts' wheels, the cab, the
// blade, the tiller and every lamp), so the model's lenses stand where the
// game hangs their glow and their light.
export const kind = {
  ids: async () => ["groomer"],
  data: async () => ({
    groomer: (await import("../../../engine/game/defs/groomer.ts")).GROOMER,
    look: (await import("../../../pwa/src/game/groomer-look.ts")).GROOMER_LOOK,
  }),
  builder: "groomer.py",
  fallback: "groomer",
  help: "the night's piste machine (groomer)",
};
