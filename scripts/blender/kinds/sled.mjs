// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE, as the Blender lab is handed it (`scripts/blender.mjs
// --kind=sled`): `SLED` (`engine/game/defs/sled.ts`) whole — the table the
// physics rides and the drawing reads — and the mountain class's traced
// look (`pwa/src/game/sled-look.ts`), so the model's skis, belt, bars and
// boards stand where the engine has them.
export const kind = {
  ids: async () => ["sled"],
  data: async () => ({
    sled: (await import("../../../engine/game/defs/sled.ts")).SLED,
    look: (await import("../../../pwa/src/game/sled-look.ts")).SLED_LOOK,
  }),
  builder: "sled.py",
  fallback: "sled",
  help: "the one snowmobile (sled)",
};
