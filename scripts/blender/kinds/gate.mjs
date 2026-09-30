// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE'S MARKS, as the Blender lab is handed them: a CHECKPOINT (the
// banded stake, its pennant and the marker that stands over the owed gate)
// and the START ARCH (the inflatable over the line), off the numbers
// `gates.ts` builds the code's own from (`GATE` and `ARCH` in
// `start-arch.ts`) and, for the stills, the organiser's red. The game
// dresses a model by its materials' names (`gate-models.ts`).
export const kind = {
  ids: async () => ["checkpoint", "start-arch"],
  data: async (id) => {
    const { ARCH, GATE } = await import("../../../pwa/src/game/start-arch.ts");
    const { PALETTE } = await import("../../../pwa/src/identity.ts");
    return { id, arch: ARCH, gate: GATE, flag: PALETTE.flag };
  },
  builder: "gate.py",
  fallback: "checkpoint",
  help: "checkpoint or start-arch",
};
