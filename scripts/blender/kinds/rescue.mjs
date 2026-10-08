// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR AMBULANCE, as the Blender lab is handed it (`scripts/blender.mjs
// --kind=rescue`): `HELI` (`engine/game/defs/heli.ts`) whole, the same
// table the heli-ski machine is built off — the rescue builder
// (`rescue.py`) is that airframe dressed and equipped for mountain rescue.
export const kind = {
  ids: async () => ["rescue"],
  data: async () => ({ heli: (await import("../../../engine/game/defs/heli.ts")).HELI }),
  builder: "rescue.py",
  fallback: "rescue",
  help: "the mountain rescue helicopter (rescue)",
};
