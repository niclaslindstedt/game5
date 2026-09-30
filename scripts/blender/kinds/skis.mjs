// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PAIR OF SKIS, as the Blender lab is handed it (`scripts/blender.mjs`):
// the spec and its class's traced look — the very tables `ski-gear.ts`
// builds the code's pair from — with each ski's stations SAMPLED off the
// same profile, plan and thickness the code lofts (`ski-looks.ts`), the
// boot's place along the ski, and the drawn travel and edge tilt its clips
// run.
export const kind = {
  ids: async () => (await import("../../../engine/index.ts")).SKI_CATALOG.map((s) => s.id),
  data: async (id) => {
    const { SKI_CATALOG, bootOffset } = await import("../../../engine/index.ts");
    const { SKI_LOOKS, baseHeight, halfWidth, thickness } =
      await import("../../../pwa/src/game/ski-looks.ts");
    const { KNEE_TRAVEL, EDGE_TILT, REST_SAG } = await import("../../../pwa/src/game/ski-gear.ts");
    const spec = SKI_CATALOG.find((s) => s.id === id);
    const look = SKI_LOOKS[id];
    const n = 48;
    return {
      spec,
      look,
      // From the tail (s = 0) to the tip, finer at the ends.
      stations: Array.from({ length: n + 1 }, (_, i) => {
        const s = spec.length * (0.5 - 0.5 * Math.cos((Math.PI * i) / n));
        return {
          s,
          w: halfWidth(spec, look, s),
          h: baseHeight(spec, look, s),
          t: thickness(spec, look, s),
        };
      }),
      /** The boot's centre, m from the tail. */
      boot: spec.length / 2 + bootOffset(spec),
      gear: { travel: KNEE_TRAVEL, edgeTilt: EDGE_TILT, restSag: REST_SAG },
    };
  },
  builder: "skis.py",
  fallback: "chamois",
  help: "a pair's id",
};
