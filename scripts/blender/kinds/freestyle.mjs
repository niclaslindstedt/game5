// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARK RIDER, as the Blender lab is handed him or her: a slopestyle and
// halfpipe rider's tall jacket, baggy pants, hood, gaiter and gloves
// (`freestyle.py`) over the skier's own body, bound in the very pose the
// dressed skier is bound in (`dress-loft.ts`'s `bindPose`), so the game poses
// the model bone for bone as it poses the dressed one — and the head in its
// helmet and goggles as the game's own triangles (`helmet-shape.ts`'s
// `helmetParts`). Two ids, one a body of the rider card's (`outfit.ts`'s
// `BODIES`): `freestyle` the man, his hood up over the helmet, and
// `freestyle-woman` the woman — the same kit cut to the women's survey, her
// hood down on her back and her braid over her shoulder.
const BODY_OF = { freestyle: "freestyle", "freestyle-woman": "freestyleWoman" };

export const kind = {
  ids: async () => Object.keys(BODY_OF),
  data: async (id) => {
    const { BODY } = await import("../../../pwa/src/game/skier-pose.ts");
    const { helmetParts } = await import("../../../pwa/src/game/helmet-shape.ts");
    const { bindPose } = await import("../../../pwa/src/game/dress-loft.ts");
    const { BODIES } = await import("../../../pwa/src/game/outfit.ts");
    const { SURVEY } = await import("../../../pwa/src/game/dress-body.ts");
    const { pose, frames } = bindPose();
    const b = BODIES.find((x) => x.id === BODY_OF[id]);
    return {
      body: BODY,
      rest: { pose, bones: frames },
      helmet: { game: helmetParts(1), fine: helmetParts(2) },
      person: { female: b.female, skin: b.skin, hair: b.hair, plait: b.plait },
      survey: b.female ? SURVEY.woman : SURVEY.man,
    };
  },
  builder: "freestyle.py",
  fallback: "freestyle",
  help: "freestyle (or freestyle-woman, or all), the park rider's tall jacket, baggy pants and hood",
};
