// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER PICKED BY MODE (`rider-pick.ts`): an AUTO body is stood in the
// hiker on a free ride, the freestyle rider on a tricks run and every
// freestyle contest, and the racer on every race and the ski jump; any body
// picked by hand is left as it is.

import { describe, expect, it } from "vitest";

import { GAME_MODES, MODE_RULES, type GameMode } from "@engine";

import { DEFAULT_OUTFIT, gearOf, type ModelKit } from "../pwa/src/game/outfit.ts";
import { byMode, kitOfRules } from "../pwa/src/game/rider-pick.ts";

const WANT: Record<GameMode, ModelKit> = {
  slalom: "racer",
  giantSlalom: "racer",
  downhill: "racer",
  superG: "racer",
  speedSki: "racer",
  skiCross: "racer",
  timeTrial: "racer",
  free: "hiker",
  tricks: "freestyle",
  slopestyle: "freestyle",
  halfpipe: "freestyle",
  moguls: "freestyle",
  aerials: "freestyle",
  skiJump: "racer",
};

describe("the rider picked by mode", () => {
  it("dresses every mode in its kit", () => {
    for (const mode of GAME_MODES) expect(kitOfRules(MODE_RULES[mode](1)), mode).toBe(WANT[mode]);
  });

  it("stands an auto body in the mode's model, a man's or a woman's", () => {
    expect(byMode(DEFAULT_OUTFIT, "freestyle").body).toBe("freestyle");
    expect(byMode({ ...DEFAULT_OUTFIT, body: "autoWoman" }, "hiker").body).toBe("hikerWoman");
    expect(byMode({ ...DEFAULT_OUTFIT, body: "autoWoman" }, "racer").body).toBe("racerWoman");
    for (const kit of ["hiker", "racer", "freestyle"] as const) {
      expect(gearOf("body", byMode(DEFAULT_OUTFIT, kit).body).model).toBe(kit);
      expect(
        gearOf("body", byMode({ ...DEFAULT_OUTFIT, body: "autoWoman" }, kit).body).female,
      ).toBe(true);
    }
  });

  it("leaves a body picked by hand as it is — the code's man and woman one press away", () => {
    for (const body of ["man", "woman", "hiker", "racerWoman"] as const) {
      const o = { ...DEFAULT_OUTFIT, body };
      expect(byMode(o, "freestyle")).toBe(o);
    }
  });
});
