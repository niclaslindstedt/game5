// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER, as the Blender lab is handed it (`scripts/blender.mjs
// --kind=heli`): `HELI` (`engine/game/defs/heli.ts`) whole — the table the
// flight model flies and the drawing reads, so the model's rotor, tail
// rotor, skids, cabin and fins stand where the engine has them.
export const kind = {
  ids: async () => ["heli"],
  data: async () => ({ heli: (await import("../../../engine/game/defs/heli.ts")).HELI }),
  builder: "heli.py",
  fallback: "heli",
  help: "the one helicopter (heli)",
};
