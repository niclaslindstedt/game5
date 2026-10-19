// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLICE HELICOPTER, as the Blender lab is handed it (`scripts/blender.mjs
// --kind=police`): `HELI` (`engine/game/defs/heli.ts`) whole, the same
// table the heli-ski machine and the air ambulance are built off — the
// police builder (`police.py`) is that airframe dressed and equipped as a
// police air unit's machine.
export const kind = {
  ids: async () => ["police"],
  data: async () => ({ heli: (await import("../../../engine/game/defs/heli.ts")).HELI }),
  builder: "police.py",
  fallback: "police",
  help: "the police helicopter (police)",
};
