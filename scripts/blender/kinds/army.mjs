// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTER, as the Blender lab is handed it (`scripts/blender.mjs
// --kind=army`): `ARMY_HELI` (`engine/game/defs/army-heli.ts`) whole under
// the name the heli's builder reads its blocks by (`heli`), the same table
// the drawing and the army's people read their doors, seats and guns off.
export const kind = {
  ids: async () => ["army"],
  data: async () => ({
    heli: (await import("../../../engine/game/defs/army-heli.ts")).ARMY_HELI,
  }),
  builder: "army.py",
  fallback: "army",
  help: "the army's utility helicopter (army)",
};
