// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE'S MARKS BY NAME — the two things `gates.ts` draws that have a
// model of their own (`gate-models.ts`, `scripts/blender/gate.py`): stated
// here alone, three-free, so the build that packs the models
// (`pwa/models-plugin.ts`) and the registry can name them without
// importing the drawing.

export const GATE_IDS = ["checkpoint", "start-arch"] as const;
export type GateId = (typeof GATE_IDS)[number];
