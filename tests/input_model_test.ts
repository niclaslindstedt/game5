// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INPUT MATHS — what a held key ramps to, what a thumb on the glass is
// asking for, and the one sign flip between the screen and the engine
// (`pwa/src/game/input-model.ts`), plus the key table the listeners read
// (`settings-input.ts`). DOM-free, so the whole feel of the controls is
// held here without a browser.

import { describe, expect, it } from "vitest";

import { TUNING } from "@engine";

import {
  BACK_TOUCH,
  BAR_REACH_PX,
  JUMP_TAP_GAP,
  JUMP_TAP_MAX,
  KEY_AXIS_SNAP,
  LEAN_REACH_PX,
  LEAN_DEAD_PX,
  LEVER_BRAKE_DEAD_PX,
  LEVER_BRAKE_PX,
  LEVER_EASE_PX,
  NO_KEYS,
  SCREEN_TO_ENGINE,
  barLean,
  barReachPx,
  barSteer,
  createInputModel,
  createJumpTap,
  jumpTapDown,
  jumpTapUp,
  leverBrake,
  leverTuck,
  neutralTouch,
  rampToward,
  sampleHeli,
  POWER_PAD_DEAD,
  powerAxis,
  sampleInput,
  COLLECTIVE_KEY_RATE,
  COLLECTIVE_THUMB_RATE,
  NO_HELI_KEYS,
  createHeliModel,
  type HeliKeysHeld,
  type KeysHeld,
} from "../pwa/src/game/input-model.ts";
import { DEFAULT_KEYS, isHeldAction, type KeyAction } from "../pwa/src/game/settings-input.ts";

const DT = TUNING.dt;

/** Hold `keys` for `seconds` of steps and hand back the last input. */
function hold(keys: Partial<KeysHeld>, seconds: number, model = createInputModel()) {
  const held = { ...NO_KEYS, ...keys };
  let input = sampleInput(model, held, neutralTouch(), DT, false);
  for (let t = DT; t < seconds; t += DT)
    input = sampleInput(model, held, neutralTouch(), DT, false);
  return { input, model };
}

describe("the keyboard's ramps", () => {
  it("eases a held key toward its target and snaps a released one to exactly zero", () => {
    let v = 0;
    for (let i = 0; i < 20; i++) v = rampToward(v, 1, DT, 6, 9);
    expect(v).toBeGreaterThan(0.5);
    expect(v).toBeLessThan(1);
    for (let i = 0; i < 400; i++) v = rampToward(v, 0, DT, 6, 9);
    expect(v).toBe(0);
    expect(rampToward(KEY_AXIS_SNAP / 2, 0, DT, 6, 9)).toBe(0);
  });

  it("opens the tuck over a fraction of a second, not on the press", () => {
    const tap = hold({ tuck: true }, 0.05).input.tuck;
    const held = hold({ tuck: true }, 1.5).input.tuck;
    expect(tap).toBeGreaterThan(0);
    expect(tap).toBeLessThan(0.4);
    expect(held).toBeGreaterThan(0.95);
  });

  it("flips the steer onto the engine's sign once, and never hands out -0", () => {
    const right = hold({ right: true }, 1).input.steer;
    expect(Math.sign(right)).toBe(SCREEN_TO_ENGINE);
    expect(Math.abs(right)).toBeGreaterThan(0.95);
    const none = hold({}, 0.2).input.steer;
    expect(Object.is(none, -0)).toBe(false);
  });

  it("leans BACK (nose up, +1) on the lean-back key and forward on the other", () => {
    expect(hold({ leanBack: true }, 1).input.lean).toBeGreaterThan(0.95);
    expect(hold({ leanForward: true }, 1).input.lean).toBeLessThan(-0.95);
  });

  it("lets the brake WIN over the tuck", () => {
    const { input } = hold({ tuck: true, brake: true }, 1);
    expect(input.brake).toBeGreaterThan(0.9);
    expect(input.tuck).toBe(0);
  });

  it("hands the reset edge through on the step it was banked for", () => {
    const model = createInputModel();
    expect(sampleInput(model, NO_KEYS, neutralTouch(), DT, true).reset).toBe(true);
    expect(sampleInput(model, NO_KEYS, neutralTouch(), DT, false).reset).toBe(false);
  });
});

describe("the tuck lever (full on touch, ease off UP, brake further UP)", () => {
  it("is wide open at the anchor and below it, and eases off to shut up the glass", () => {
    expect(leverTuck(0)).toBe(1);
    expect(leverTuck(40)).toBe(1);
    expect(leverTuck(-LEVER_EASE_PX / 2)).toBeCloseTo(0.5);
    expect(leverTuck(-LEVER_EASE_PX)).toBe(0);
    expect(leverTuck(-LEVER_EASE_PX * 3)).toBe(0);
  });

  it("pulls the brake only past a dead band over the shut point, and never with the tuck", () => {
    const shut = LEVER_EASE_PX;
    expect(leverBrake(0)).toBe(0);
    expect(leverBrake(-shut)).toBe(0);
    expect(leverBrake(-(shut + LEVER_BRAKE_DEAD_PX))).toBe(0);
    expect(leverBrake(-(shut + LEVER_BRAKE_DEAD_PX + LEVER_BRAKE_PX / 2))).toBeCloseTo(0.5);
    expect(leverBrake(-(shut + LEVER_BRAKE_DEAD_PX + LEVER_BRAKE_PX))).toBe(1);
    for (let dy = -200; dy <= 200; dy += 5) {
      expect(leverTuck(dy) > 0 && leverBrake(dy) > 0, `dy ${dy}`).toBe(false);
    }
    expect(Object.is(leverBrake(10), -0)).toBe(false);
  });
});

describe("the handlebar", () => {
  it("reaches full lock at the ring, symmetrically, and eases in off centre", () => {
    expect(barSteer(BAR_REACH_PX)).toBe(1);
    expect(barSteer(-BAR_REACH_PX)).toBe(-1);
    expect(barSteer(BAR_REACH_PX * 2)).toBe(1);
    expect(barSteer(BAR_REACH_PX / 2)).toBeLessThan(0.5);
    expect(barSteer(BAR_REACH_PX / 2)).toBeCloseTo(-barSteer(-BAR_REACH_PX / 2));
  });

  it("does not lean inside the dead band, and leans fully at the ring", () => {
    expect(barLean(LEAN_DEAD_PX)).toBe(0);
    expect(barLean(-LEAN_DEAD_PX + 1)).toBe(0);
    expect(barLean(BAR_REACH_PX)).toBe(1);
    expect(barLean(-BAR_REACH_PX)).toBe(-1);
  });

  it("owns steer and lean outright while a thumb is on it", () => {
    const touch = { ...neutralTouch(), bar: true, steer: 0.5, lean: -0.25 };
    const input = sampleInput(createInputModel(), { ...NO_KEYS, left: true }, touch, DT, false);
    expect(input.steer).toBeCloseTo(0.5 * SCREEN_TO_ENGINE);
    expect(input.lean).toBeCloseTo(-0.25);
  });

  it("takes the deeper of key and lever for the tuck", () => {
    const touch = { ...neutralTouch(), lever: true, tuck: 0.7 };
    const input = sampleInput(createInputModel(), NO_KEYS, touch, DT, false);
    expect(input.tuck).toBeCloseTo(0.7);
    const braking = sampleInput(
      createInputModel(),
      { ...NO_KEYS, tuck: true },
      { ...neutralTouch(), lever: true, brake: 0.6 },
      DT,
      false,
    );
    expect(braking.tuck).toBe(0);
    expect(braking.brake).toBeCloseTo(0.6);
  });
});

describe("the thumbs' feel (OPTIONS ▸ CONTROLS)", () => {
  it("shortens every throw by the sensitivity, and the ring with it", () => {
    const quick = { sensitivity: 1.5, invertLean: false };
    expect(barSteer(BAR_REACH_PX / 1.5, quick)).toBeCloseTo(1);
    expect(barSteer(BAR_REACH_PX / 1.5)).toBeLessThan(1);
    expect(barReachPx(quick)).toBeCloseTo(BAR_REACH_PX / 1.5);
    expect(leverTuck(-LEVER_EASE_PX / 1.5, quick)).toBeCloseTo(0);
    expect(
      leverBrake(-(LEVER_EASE_PX + LEVER_BRAKE_DEAD_PX + LEVER_BRAKE_PX) / 1.5, quick),
    ).toBeCloseTo(1);
  });

  it("turns the lean round when inverted, and nothing else", () => {
    const flipped = { sensitivity: 1, invertLean: true };
    expect(barLean(BAR_REACH_PX, flipped)).toBeCloseTo(-barLean(BAR_REACH_PX));
    expect(barLean(-BAR_REACH_PX, flipped)).toBeGreaterThan(0);
    expect(barSteer(40, flipped)).toBe(barSteer(40));
    expect(leverTuck(-25, flipped)).toBe(leverTuck(-25));
  });
});

describe("the key table (settings-input.ts)", () => {
  it("binds every action, and every held action is one the ramps know", () => {
    for (const [action, codes] of Object.entries(DEFAULT_KEYS) as [KeyAction, string[]][]) {
      expect(codes.length, action).toBeGreaterThan(0);
    }
    for (const held of Object.keys(NO_KEYS) as KeyAction[]) {
      expect(isHeldAction(held)).toBe(true);
      expect(DEFAULT_KEYS[held].length).toBeGreaterThan(0);
    }
    for (const edge of ["reset", "restart", "camera", "pause"] as KeyAction[]) {
      expect(isHeldAction(edge)).toBe(false);
    }
  });

  it("drives on W / S, leans on the arrows, and puts nothing on Ctrl", () => {
    expect(DEFAULT_KEYS.tuck).toEqual(["KeyW"]);
    expect(DEFAULT_KEYS.brake).toEqual(["KeyS"]);
    expect(DEFAULT_KEYS.jump).toEqual(["Space"]);
    expect(DEFAULT_KEYS.leanForward[0]).toBe("ArrowUp");
    expect(DEFAULT_KEYS.leanBack[0]).toBe("ArrowDown");
    expect(DEFAULT_KEYS.left).toEqual(expect.arrayContaining(["KeyA", "ArrowLeft"]));
    expect(DEFAULT_KEYS.right).toEqual(expect.arrayContaining(["KeyD", "ArrowRight"]));
    expect(DEFAULT_KEYS.reset).toEqual(["KeyR"]);
    expect(DEFAULT_KEYS.restart).toEqual(["KeyB"]);
    expect(DEFAULT_KEYS.camera).toEqual(["KeyC"]);
    expect(DEFAULT_KEYS.pause).toEqual(["Escape"]);
    for (const codes of Object.values(DEFAULT_KEYS)) {
      for (const code of codes) expect(code).not.toMatch(/Control|Meta|Alt/);
    }
  });

  it("gives no key two held jobs that fight each other", () => {
    const seen = new Map<string, KeyAction>();
    for (const [action, codes] of Object.entries(DEFAULT_KEYS) as [KeyAction, string[]][]) {
      for (const code of codes) {
        expect(seen.get(code), `${code} is on ${seen.get(code)} and ${action}`).toBeUndefined();
        seen.set(code, action);
      }
    }
  });
});

describe("the tuck and the brake keys in the air", () => {
  /** Step `keys` for `steps` steps, `airborne` or not, on `model`. */
  function ride(
    model: ReturnType<typeof createInputModel>,
    keys: Partial<KeysHeld>,
    airborne: boolean,
    steps = 60,
  ) {
    const held = { ...NO_KEYS, ...keys };
    let input = sampleInput(model, held, neutralTouch(), DT, false, airborne);
    for (let i = 1; i < steps; i++)
      input = sampleInput(model, held, neutralTouch(), DT, false, airborne);
    return input;
  }

  it("never lean on the snow", () => {
    const model = createInputModel();
    expect(ride(model, { tuck: true }, false).lean).toBe(0);
    expect(ride(model, { brake: true }, false).lean).toBe(0);
  });

  it("lean forward on W and back on S pressed in the air, S then not braking", () => {
    const model = createInputModel();
    ride(model, {}, true, 1);
    const w = ride(model, { tuck: true }, true, 240);
    expect(w.lean).toBeLessThan(-0.9);
    expect(w.tuck).toBeGreaterThan(0.9);
    ride(model, {}, true, 1);
    const s = ride(model, { brake: true }, true);
    expect(s.lean).toBeGreaterThan(0.9);
    expect(s.brake).toBe(0);
  });

  it("leave a tuck held off the lip a tuck, until it is pressed again", () => {
    const model = createInputModel();
    ride(model, { tuck: true }, false);
    expect(ride(model, { tuck: true }, true).lean).toBe(0);
    ride(model, {}, true, 1);
    expect(ride(model, { tuck: true }, true).lean).toBeLessThan(-0.9);
    // A landing hands it back to the engine alone.
    expect(ride(model, { tuck: true }, false).lean).toBe(0);
  });

  it("give way to a lean key held over them", () => {
    const model = createInputModel();
    ride(model, {}, true, 1);
    expect(ride(model, { tuck: true, leanBack: true }, true).lean).toBeGreaterThan(0.9);
    ride(model, {}, true, 1);
    expect(ride(model, { brake: true, leanForward: true }, true).lean).toBeLessThan(-0.9);
  });
});

describe("the back key's two meanings, by order", () => {
  /** Step `keys` for `steps` steps on the snow on `model`. */
  function ride(model: ReturnType<typeof createInputModel>, keys: Partial<KeysHeld>, steps = 30) {
    const held = { ...NO_KEYS, ...keys };
    let input = sampleInput(model, held, neutralTouch(), DT, false);
    for (let i = 1; i < steps; i++) input = sampleInput(model, held, neutralTouch(), DT, false);
    return input;
  }

  it("brakes when pressed first, and swings into a hockey stop with the edge after", () => {
    const model = createInputModel();
    expect(ride(model, { brake: true }).brake).toBeGreaterThan(0.9);
    const stop = ride(model, { brake: true, right: true });
    expect(stop.brake).toBeGreaterThan(0.9);
    expect(stop.carve).toBe(false);
    expect(Math.abs(stop.steer)).toBeGreaterThan(0.5);
  });

  it("cuts the edge harder when pressed with an edge already on, and does not brake", () => {
    const model = createInputModel();
    ride(model, { left: true });
    const cut = ride(model, { left: true, brake: true });
    expect(cut.carve).toBe(true);
    expect(cut.brake).toBe(0);
  });

  it("keeps the meaning it went down with until it is let go", () => {
    const model = createInputModel();
    ride(model, { left: true });
    ride(model, { left: true, brake: true });
    // The edge let go under a held cut: still the cut, never a brake.
    expect(ride(model, { brake: true }).carve).toBe(true);
    ride(model, {});
    expect(ride(model, { brake: true }).brake).toBeGreaterThan(0.9);
  });

  it("is the edge thumb dragged down on the snow, and the lean back in the air", () => {
    const model = createInputModel();
    const touch = neutralTouch();
    touch.bar = true;
    touch.lean = BACK_TOUCH + 0.1;
    let input = sampleInput(model, NO_KEYS, touch, DT, false);
    for (let i = 0; i < 30; i++) input = sampleInput(model, NO_KEYS, touch, DT, false);
    expect(input.brake).toBeGreaterThan(0.9);
    expect(input.lean).toBe(0);
    const air = sampleInput(createInputModel(), NO_KEYS, touch, DT, false, true);
    expect(air.brake).toBe(0);
    expect(air.lean).toBeCloseTo(BACK_TOUCH + 0.1);
    // Across first, then down: the cut.
    const cutModel = createInputModel();
    const across = { ...neutralTouch(), bar: true, steer: 0.8 };
    sampleInput(cutModel, NO_KEYS, across, DT, false);
    const cut = sampleInput(cutModel, NO_KEYS, { ...across, lean: 0.9 }, DT, false);
    expect(cut.carve).toBe(true);
    expect(cut.brake).toBe(0);
    expect(LEAN_REACH_PX).toBeGreaterThan(0);
  });
});

describe("the jump", () => {
  it("is held on its key and let go on the release", () => {
    const model = createInputModel();
    expect(sampleInput(model, { ...NO_KEYS, jump: true }, neutralTouch(), DT, false).jump).toBe(
      true,
    );
    expect(sampleInput(model, NO_KEYS, neutralTouch(), DT, false).jump).toBe(false);
  });

  it("is a tap and a hold on the lever's thumb, and never a plain touch", () => {
    const tap = createJumpTap();
    // A plain touch held: the tuck, no jump.
    expect(jumpTapDown(tap, 0)).toBe(false);
    jumpTapUp(tap, 5);
    expect(jumpTapDown(tap, 5.1)).toBe(false);
    // A tap, and the thumb straight back down: the jump loading.
    jumpTapUp(tap, 5.1 + JUMP_TAP_MAX / 2);
    expect(jumpTapDown(tap, 5.1 + JUMP_TAP_MAX / 2 + JUMP_TAP_GAP / 2)).toBe(true);
    jumpTapUp(tap, 7);
    // The release that sprang him is not a tap for the next touch.
    expect(jumpTapDown(tap, 7.1)).toBe(false);
    // A tap followed too late is a plain touch.
    jumpTapUp(tap, 7.2);
    expect(jumpTapDown(tap, 7.2 + JUMP_TAP_GAP * 2)).toBe(false);
  });
});

describe("the helicopter flown by hand (sampleHeli)", () => {
  const run = (
    keys: Partial<HeliKeysHeld>,
    touch = neutralTouch(),
    seconds = 1,
    model = createHeliModel(),
  ) => {
    const held = { ...NO_HELI_KEYS, ...keys };
    let out = sampleHeli(model, held, touch, DT);
    for (let i = 1; i < Math.round(seconds / DT); i++) out = sampleHeli(model, held, touch, DT);
    return { out, model };
  };

  it("works the collective as a lever: it moves while held and stays where it is left", () => {
    const { out, model } = run({ collectiveUp: true }, neutralTouch(), 1);
    expect(out.collective).toBeCloseTo(COLLECTIVE_KEY_RATE, 1);
    const left = run({}, neutralTouch(), 2, model).out;
    expect(left.collective).toBeCloseTo(out.collective, 5);
    expect(run({ collectiveDown: true }, neutralTouch(), 5, model).out.collective).toBe(0);
  });

  it("ramps the cyclic and the pedals off their keys, the side axes through the flip", () => {
    const { out } = run({ cyclicForward: true, cyclicRight: true, pedalRight: true });
    expect(out.pitch).toBeGreaterThan(0.95);
    expect(out.roll).toBeLessThan(-0.95);
    expect(out.pedal).toBeLessThan(-0.95);
    expect(Math.sign(out.roll)).toBe(SCREEN_TO_ENGINE);
  });

  it("reads the thumbs: the cyclic pad for the disc, the power pad for the lever and the pedals", () => {
    const touch = {
      ...neutralTouch(),
      stick: true,
      stickX: 0.5,
      stickY: -0.25,
      power: true,
      powerX: -1,
      powerY: 1,
    };
    const { out } = run({}, touch, 1);
    expect(out.pitch).toBeCloseTo(-0.25);
    expect(out.roll).toBeCloseTo(0.5 * SCREEN_TO_ENGINE);
    expect(out.pedal).toBeCloseTo(-1 * SCREEN_TO_ENGINE);
    expect(out.collective).toBeCloseTo(COLLECTIVE_THUMB_RATE, 1);
  });

  it("leaves the collective where the power pad left it, and springs the pedals back", () => {
    const up = { ...neutralTouch(), power: true, powerY: 1 };
    const { out, model } = run({}, up, 1);
    const after = run({}, neutralTouch(), 2, model).out;
    expect(after.collective).toBeCloseTo(out.collective, 5);
    expect(after.pedal).toBe(0);
    const down = { ...neutralTouch(), power: true, powerY: -1 };
    expect(run({}, down, 3, model).out.collective).toBe(0);
  });

  it("holds the power pad's dead band, so the pedals never creep the collective", () => {
    const across = { ...neutralTouch(), power: true, powerX: 1, powerY: POWER_PAD_DEAD * 0.9 };
    const { out } = run({}, across, 2);
    expect(out.collective).toBe(0);
    expect(out.pedal).toBeCloseTo(SCREEN_TO_ENGINE);
    expect(powerAxis(-POWER_PAD_DEAD)).toBe(0);
    expect(powerAxis(-1)).toBe(-1);
    expect(powerAxis(0.5)).toBeCloseTo((0.5 - POWER_PAD_DEAD) / (1 - POWER_PAD_DEAD));
  });

  it("ignores the skier's edge thumb while flying", () => {
    const touch = { ...neutralTouch(), bar: true, steer: 1, lean: -1 };
    const { out } = run({}, touch, 1);
    expect(out.collective).toBe(0);
    expect(out.pedal).toBe(0);
  });
});
