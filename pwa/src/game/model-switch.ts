// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHETHER A BUILD DRAWS THE MODELLED SKIS — read in one place by the page
// (`skier-models.ts`) and by the build that packs them
// (`pwa/models-plugin.ts`), which cannot share anything heavier. ON unless
// the switch says otherwise: `VITE_MODEL_SKIS=0` (or `off`, `false`, `no`)
// draws the code-built skis again — in the environment, the root `.env`,
// or a CI repository variable of the same name. Unset or empty is on. (The
// skier, the trees, the wildlife and the course's marks have no switch:
// every one is built in code.)

export function modelSwitch(value: unknown): boolean {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  return !["0", "off", "false", "no"].includes(v);
}
