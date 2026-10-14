// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HIKER, as the Blender lab is handed him or her: a touring guide's
// kit (`hiker.py`) over the skier's own body, bound in the very pose the
// dressed skier is bound in (`dress-loft.ts`'s `bindPose`), so the game
// poses the model bone for bone as it poses the dressed one — and the
// head, its face and hair, as the game's own triangles (`helmet-shape.ts`'s
// `bareHeadParts`), the climbing helmet and the glacier glasses laid over
// them in the builder. Two ids, one a body of the rider card's
// (`outfit.ts`'s `BODIES`): `hiker` the man, `hiker-woman` the woman — the
// same kit cut to the women's survey and with her braid.
const BODY_OF = { hiker: "hiker", "hiker-woman": "hikerWoman" };

export const kind = {
  ids: async () => Object.keys(BODY_OF),
  data: async (id) => {
    const { BODY } = await import("../../../pwa/src/game/skier-pose.ts");
    const { bareHeadParts } = await import("../../../pwa/src/game/helmet-shape.ts");
    const { bindPose } = await import("../../../pwa/src/game/dress-loft.ts");
    const { BODIES } = await import("../../../pwa/src/game/outfit.ts");
    const { SURVEY } = await import("../../../pwa/src/game/dress-body.ts");
    const { pose, frames } = bindPose();
    const b = BODIES.find((x) => x.id === BODY_OF[id]);
    return {
      body: BODY,
      rest: { pose, bones: frames },
      head: { game: bareHeadParts(1), fine: bareHeadParts(2) },
      person: { female: b.female, skin: b.skin, hair: b.hair, plait: b.plait },
      survey: b.female ? SURVEY.woman : SURVEY.man,
    };
  },
  builder: "hiker.py",
  fallback: "hiker",
  help: "hiker (or hiker-woman, or all), the touring guide's kit",
};
