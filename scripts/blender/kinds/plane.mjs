// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE, as the Blender lab is handed it (`scripts/blender.mjs
// --kind=plane`): `PLANE` (`engine/game/defs/plane.ts`) whole — the table
// the flight model flies and the drawing reads, so the model's wing, struts,
// tail, propeller, gear, cabin and jump door stand where the engine has them.
export const kind = {
  ids: async () => ["plane"],
  data: async () => ({ plane: (await import("../../../engine/game/defs/plane.ts")).PLANE }),
  builder: "plane.py",
  fallback: "plane",
  help: "the one jump plane (plane)",
};
