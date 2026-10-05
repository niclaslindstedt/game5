// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHELL AROUND A RACE — every rule the cards and the loop stand on that
// can be read without a browser: which surface steps the engine and who
// rides it (`shell.ts`), a load cut into phases (`run-loader.ts`), the URL
// (`url-params.ts`), the attract card's timing (`splash.ts`), what is
// remembered (`settings.ts`) and the game's own buttons (`run-actions.ts`).
// The §37 clock and the cursor's walk are the framework's (`loop/run-clock`,
// `input/menu-cursor`), held by its own suite.

import { describe, expect, it } from "vitest";

import {
  PAUSE_STATS,
  pauseStats,
  type PauseRun,
  type PauseStat,
} from "../pwa/src/game/pause-stats.ts";
import { createRunActions, type RunPress } from "../pwa/src/game/run-actions.ts";
import {
  advanceLoad,
  createLoad,
  loadBudgetMs,
  loadPhase,
  loadTimes,
  type LoadStep,
} from "../pwa/src/game/run-loader.ts";
import {
  DEFAULT_CAMERA,
  RUN_CAMERAS,
  assistOf,
  freshSettings,
  mergeSettings,
  mixOf,
  nextCamera,
} from "../pwa/src/game/settings.ts";
import {
  DEFAULT_KEYS,
  KEY_ACTIONS,
  bindKey,
  boundLabel,
  clashesWith,
  freshKeys,
  keyLabel,
  mergeKeys,
  type KeyAction,
} from "../pwa/src/game/settings-input.ts";
import { DEFAULT_VIDEO } from "../pwa/src/game/settings-video.ts";
import {
  SHELLS,
  appDraws,
  cameraFor,
  canPause,
  hudOver,
  playerRides,
  simulates,
  soundsLive,
  watching,
  type Shell,
} from "../pwa/src/game/shell.ts";
import {
  SPLASH_MIN_MS,
  SPLASH_STUCK_MS,
  splashReady,
  splashSkipped,
} from "../pwa/src/game/splash.ts";
import { dealSeed, readParams } from "../pwa/src/game/url-params.ts";
import { BENCHMARK } from "../pwa/src/game/benchmark-plan.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { SHELL_COMMANDS } from "../pwa/src/shell-host.ts";

describe("the seven surfaces (shell.ts)", () => {
  it("steps the engine behind every card but the pause card — and leaves the bench to its pump", () => {
    for (const s of SHELLS) expect(simulates(s), s).toBe(s !== "pause" && s !== "bench");
    expect(SHELLS.filter((s) => !appDraws(s))).toEqual(["bench"]);
  });

  it("puts the player's hands on the skis only on a run — the bot rides everywhere else", () => {
    for (const s of SHELLS) expect(playerRides(s), s).toBe(s === "run");
    for (const s of SHELLS) expect(soundsLive(s), s).toBe(playerRides(s) || watching(s));
    expect(SHELLS.filter(watching)).toEqual(["replay"]);
  });

  it("keeps the HUD up under the pause card, and reaches the pause card only from a run", () => {
    expect(SHELLS.filter(hudOver)).toEqual(["pause", "run", "replay"]);
    expect(SHELLS.filter(canPause)).toEqual(["run"]);
  });

  it("frames every card with the orbit and a race with the skier's own rung", () => {
    for (const s of SHELLS.filter((s) => s !== "bench")) {
      expect(cameraFor(s, "tips"), s).toBe(hudOver(s) ? "tips" : "orbit");
    }
    // The benchmark states its own view rather than inheriting one.
    expect(cameraFor("bench", "tips")).toBe(BENCHMARK.camera);
  });
});

describe("a load, cut into phases (run-loader.ts)", () => {
  const step = (id: string, label: string, run: LoadStep["run"], extra = {}): LoadStep => ({
    id,
    label,
    run,
    ...extra,
  });

  it("counts PHASES, not steps, and never reads past the last", () => {
    const job = createLoad([
      step("a", "One", () => false),
      step("b", "One", () => false),
      step("c", "Two", () => false),
    ]);
    expect(loadPhase(job)).toMatchObject({ label: "One", at: 1, of: 2 });
    advanceLoad(
      job,
      () => true,
      () => 0,
    );
    // A phase boundary ends the slice, so the card names the phase it pays for.
    expect(loadPhase(job)).toMatchObject({ label: "Two", at: 2, of: 2 });
    expect(
      advanceLoad(
        job,
        () => true,
        () => 0,
      ),
    ).toBe(false);
    expect(loadPhase(job).at).toBe(2);
    expect(Object.keys(loadTimes(job)).sort()).toEqual(["a", "b", "c"]);
  });

  it("ends the slice on a step WAITING on a promise rather than spinning on it", () => {
    let runs = 0;
    const job = createLoad([
      step("scene", "Build", () => (++runs, true), { waiting: () => true }),
      step("warm", "Warm", () => false),
    ]);
    advanceLoad(
      job,
      () => true,
      () => 0,
    );
    expect(runs).toBe(1);
  });

  it("abandons a step that throws and says why, rather than throwing out of a frame", () => {
    const job = createLoad([
      step("level", "Mountain", () => {
        throw new Error("no loop on this seed");
      }),
      step("scene", "Forest", () => false),
    ]);
    expect(
      advanceLoad(
        job,
        () => true,
        () => 0,
      ),
    ).toBe(false);
    expect(job.failed).toBe("no loop on this seed");
    expect(loadTimes(job)).toEqual({});
  });

  it("budgets a share of the frame, bounded both ways", () => {
    expect(loadBudgetMs(16)).toBeGreaterThanOrEqual(12);
    expect(loadBudgetMs(1000)).toBeLessThanOrEqual(250);
    expect(loadBudgetMs(100)).toBeCloseTo(60);
  });
});

describe("the URL (url-params.ts, splash.ts)", () => {
  it("boots a race only when the link names one", () => {
    expect(readParams("").rides).toBe(false);
    expect(readParams("?start=race&seed=42")).toMatchObject({ rides: true, seed: 42 });
    expect(readParams("?start=1").rides).toBe(true);
    expect(readParams("?paused=1")).toMatchObject({ rides: true, paused: true });
    expect(readParams("?shot=1&t=8")).toMatchObject({ rides: true, shot: true, t: 8 });
  });

  it("refuses a seed or a camera this build cannot take", () => {
    expect(readParams("?seed=abc").seed).toBe(null);
    expect(readParams("?seed=-3").seed).toBe(null);
    expect(readParams("?seed=1.5").seed).toBe(null);
    expect(readParams("?camera=far").camera).toBe("far");
    expect(readParams("?camera=orbit").camera).toBe(null);
    expect(readParams("?t=-4").t).toBe(0);
    expect(readParams("?start=race&bot=1").bot).toBe(true);
    expect(readParams("?start=race").bot).toBe(false);
    // A SUPER-G (R33): booted into, or the mode the next press rides, and
    // the race card the front door's RACE tile opens.
    expect(readParams("?start=superg")).toMatchObject({ rides: true, mode: "superG" });
    expect(readParams("?menu=levels&mode=superg")).toMatchObject({ rides: false, mode: "superG" });
    expect(readParams("?menu=races").page).toBe("races");
    expect(readParams("?menu=root")).toMatchObject({ menu: true, page: "root" });
    expect(readParams("?menu=options").page).toBe("options");
    expect(readParams("?menu=keys").page).toBe("keys");
    expect(readParams("?menu=gallery").page).toBe("gallery");
    expect(readParams("?menu=cellar").page).toBe("root");
    expect(readParams("?video=low").video).toBe("low");
    expect(readParams("?video=ultra").video).toBe(null);
    expect(readParams("").probe).toBe(true);
    expect(readParams("?probe=0").probe).toBe(false);
  });

  it("reads a held ride: a speed, a move and its seconds, or nothing", () => {
    expect(readParams("?start=race&hold=40").hold).toEqual({
      kmh: 40,
      move: "straight",
      seconds: 3,
    });
    expect(readParams("?hold=15,check,5").hold).toEqual({ kmh: 15, move: "check", seconds: 5 });
    expect(readParams("?hold=15,flail").hold?.move).toBe("straight");
    expect(readParams("?hold=15,carve,99").hold?.seconds).toBe(20);
    expect(readParams("?hold=fast").hold).toBe(null);
    expect(readParams("?hold=400").hold).toBe(null);
    expect(readParams("").hold).toBe(null);
  });

  it("deals a seed in the generator's range", () => {
    expect(dealSeed(() => 0)).toBe(1);
    expect(dealSeed(() => 0.999999)).toBeLessThan(100_000);
  });

  it("skips the attract card for a link into a race or the door, and not otherwise", () => {
    expect(splashSkipped("")).toBe(false);
    expect(splashSkipped("?start=race")).toBe(true);
    expect(splashSkipped("?menu=root")).toBe(true);
    expect(splashSkipped("?paused=1")).toBe(true);
    expect(splashSkipped("?start=race&splash=1")).toBe(false);
    expect(splashSkipped("?splash=0")).toBe(true);
  });

  it("waits for the game before inviting a press, and never forever", () => {
    expect(splashReady(SPLASH_MIN_MS - 1, true)).toBe(false);
    expect(splashReady(SPLASH_MIN_MS, true)).toBe(true);
    expect(splashReady(SPLASH_MIN_MS * 3, false)).toBe(false);
    expect(splashReady(SPLASH_STUCK_MS, false)).toBe(true);
  });
});

describe("what the game remembers (settings.ts)", () => {
  it("merges a stored blob field by field and checks every value", () => {
    expect(mergeSettings(null)).toEqual(freshSettings());
    expect(mergeSettings("junk")).toEqual(freshSettings());
    expect(mergeSettings({ camera: "far", sound: false })).toEqual({
      ...freshSettings(),
      camera: "far",
      sound: false,
    });
    // Off the ladder, and the wrong type: back to the defaults.
    expect(mergeSettings({ camera: "orbit", sound: "no" })).toEqual(freshSettings());
    expect(mergeSettings({ camera: "helicopter" }).camera).toBe(DEFAULT_CAMERA);
  });

  it("puts every stored fader, thumb and hand back on its own grid", () => {
    const s = mergeSettings({
      audio: { master: 0.43, engine: 7, effects: "loud" },
      touch: { lever: "left", sensitivity: 1.23, invertLean: true },
      assist: { steer: "off", air: "most" },
      video: { terrain: "high", trails: "sideways" },
      probed: true,
    });
    expect(s.audio).toEqual({ master: 0.4, engine: 1, effects: 1 });
    expect(s.touch).toEqual({ lever: "left", sensitivity: 1.2, invertLean: true });
    expect(s.assist).toEqual({ steer: "off", air: "full" });
    expect(s.video).toEqual({ ...DEFAULT_VIDEO, terrain: "high" });
    expect(s.probed).toBe(true);
    expect(mergeSettings({ touch: { sensitivity: 9 } }).touch.sensitivity).toBe(1.5);
    expect(mergeSettings({ touch: { lever: "up" } }).touch.lever).toBe("right");
  });

  it("fits the picture to the machine unless the skier has made it theirs", () => {
    expect(freshSettings().autoPicture).toBe(true);
    // A blob from before AUTO: the fit's only if nobody moved the picture.
    expect(mergeSettings({ video: DEFAULT_VIDEO }).autoPicture).toBe(true);
    expect(mergeSettings({ video: { ...DEFAULT_VIDEO, spray: "low" } }).autoPicture).toBe(false);
    expect(
      mergeSettings({ video: { ...DEFAULT_VIDEO, spray: "low" }, autoPicture: true }).autoPicture,
    ).toBe(true);
    expect(mergeSettings({ autoPicture: false }).autoPicture).toBe(false);
  });

  it("keeps damage off unless it was asked for, and only as a switch", () => {
    expect(freshSettings().damage).toBe(false);
    expect(mergeSettings({ damage: true }).damage).toBe(true);
    expect(mergeSettings({ damage: "yes" }).damage).toBe(false);
  });

  it("keeps the readouts up unless they were taken down, and only as a switch", () => {
    expect(freshSettings().hud).toBe(true);
    expect(mergeSettings({ hud: false }).hud).toBe(false);
    expect(mergeSettings({ hud: "off" }).hud).toBe(true);
  });

  it("folds the master and the switch into both faders the mixer is handed", () => {
    const s = { ...freshSettings(), audio: { master: 0.5, engine: 0.8, effects: 0.4 } };
    expect(mixOf(s).engine).toBeCloseTo(0.4);
    expect(mixOf(s).effects).toBeCloseTo(0.2);
    expect(mixOf({ ...s, sound: false })).toEqual({ engine: 0, effects: 0 });
  });

  it("hands the engine a number per hand, every hand on by default", () => {
    expect(assistOf(freshSettings().assist)).toEqual({ yaw: 1, air: 1 });
    expect(assistOf({ steer: "half", air: "off" })).toEqual({ yaw: 0.5, air: 0 });
  });

  it("walks the camera ladder round, and back onto it from anywhere off it", () => {
    let rung = RUN_CAMERAS[0];
    const seen = new Set<string>();
    for (let i = 0; i < RUN_CAMERAS.length; i++) {
      seen.add(rung);
      rung = nextCamera(rung);
    }
    expect(rung).toBe(RUN_CAMERAS[0]);
    expect(seen.size).toBe(RUN_CAMERAS.length);
    expect(nextCamera("orbit")).toBe(DEFAULT_CAMERA);
  });
});

describe("the keys page (settings-input.ts)", () => {
  it("lists every action once, the held six first", () => {
    const ids = KEY_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual((Object.keys(DEFAULT_KEYS) as KeyAction[]).sort());
    for (const a of KEY_ACTIONS) expect(a.label.length).toBeGreaterThan(0);
  });

  it("rebinds a row to one key, and says when a key does two jobs", () => {
    const keys = bindKey(freshKeys(), "reset", "KeyC");
    expect(keys.reset).toEqual(["KeyC"]);
    expect(clashesWith(keys, "reset")).toEqual(["camera"]);
    expect(clashesWith(keys, "camera")).toEqual(["reset"]);
    expect(clashesWith(freshKeys(), "tuck")).toEqual([]);
    // The shipped table is never handed out to be rebound.
    const fresh = freshKeys() as Record<KeyAction, string[]>;
    fresh.tuck.push("KeyX");
    expect(DEFAULT_KEYS.tuck).not.toContain("KeyX");
  });

  it("reads a code the way the cap is printed", () => {
    expect(keyLabel("KeyW")).toBe("W");
    expect(keyLabel("ArrowUp")).toBe("UP ARROW");
    expect(keyLabel("ShiftLeft")).toBe("L SHIFT");
    expect(boundLabel([])).toMatch(/\S/);
    expect(boundLabel(["KeyE", "ShiftLeft"])).toBe("E / L SHIFT");
  });

  it("merges stored keys against the actions this build has", () => {
    // A stored row is the skier's; a row the blob does not carry is the
    // shipped one, and takes its keys back off any stored row — the first
    // layout's SPACE on the brake is the jump's, not a skid with it.
    const old = mergeKeys({
      tuck: ["KeyW", "ArrowUp"],
      brake: ["KeyS", "ArrowDown", "Space"],
      leanBack: ["KeyP"],
    });
    // ArrowUp is the lean forward's own, and the blob does not carry it.
    expect(old.tuck).toEqual(["KeyW"]);
    expect(old.brake).toEqual(["KeyS", "ArrowDown"]);
    expect(old.jump).toEqual(["Space"]);
    // ...and a stored row left with nothing is its shipped one.
    expect(mergeKeys({ brake: ["Space"] }).brake).toEqual(DEFAULT_KEYS.brake);
    // A layout that carries the row keeps whatever the skier put there.
    expect(mergeKeys({ jump: ["KeyJ"], brake: ["KeyS", "Space"] }).brake).toEqual([
      "KeyS",
      "Space",
    ]);
    expect(old.leanForward).toEqual(freshKeys().leanForward);
    expect(old.leanBack).toEqual(["KeyP"]);
    expect(mergeKeys(null)).toEqual(freshKeys());
    const merged = mergeKeys({ tuck: ["KeyI", 4, "KeyI"], hover: ["KeyH"], brake: "KeyK" });
    expect(merged.tuck).toEqual(["KeyI"]);
    expect(merged.brake).toEqual(DEFAULT_KEYS.brake);
    expect("hover" in merged).toBe(false);
  });
});

describe("the game's own buttons (run-actions.ts)", () => {
  function rig(shell: Shell) {
    const did: string[] = [];
    const act = createRunActions({
      shell: () => shell,
      pause: () => did.push("pause"),
      resume: () => did.push("resume"),
      restart: () => did.push("restart"),
      camera: () => did.push("camera"),
      reset: () => did.push("reset"),
      leave: () => did.push("leave"),
      shoot: () => did.push("shot"),
      toggleHud: () => did.push("hud"),
    });
    return { did, act };
  }

  it("answers every word the desktop shell's menu bar can send", () => {
    for (const command of SHELL_COMMANDS) {
      const { did, act } = rig("run");
      act(command as RunPress);
      expect(did, command).toEqual([command]);
    }
  });

  it("does nothing to a race that is not being ridden, but PAUSE over the card resumes", () => {
    for (const shell of ["splash", "menu", "loading"] as Shell[]) {
      const { did, act } = rig(shell);
      for (const command of SHELL_COMMANDS) act(command as RunPress);
      expect(did, shell).toEqual([]);
    }
    const { did, act } = rig("pause");
    act("pause");
    act("restart");
    expect(did).toEqual(["resume"]);
  });

  // The shutter and the HUD's switch are about the PICTURE, so they answer
  // wherever a race is on screen — the frame held under the pause card and a
  // replay included — and nowhere a card stands over the bot's race.
  it("takes a picture and walks the HUD over a race on screen only", () => {
    for (const shell of ["run", "pause", "replay"] as Shell[]) {
      const { did, act } = rig(shell);
      act("shot");
      act("hud");
      expect(did, shell).toEqual(["shot", "hud"]);
    }
    for (const shell of ["splash", "menu", "loading"] as Shell[]) {
      const { did, act } = rig(shell);
      act("shot");
      act("hud");
      expect(did, shell).toEqual([]);
    }
  });

  it("over a replay walks the camera, leaves on PAUSE and takes a picture, and nothing else", () => {
    const { did, act } = rig("replay");
    for (const command of SHELL_COMMANDS) act(command as RunPress);
    act("reset");
    expect(did.sort()).toEqual(["camera", "leave", "shot"]);
  });
});

describe("what the pause card bills a held race with (pause-stats.ts)", () => {
  /** A race nobody has ridden anywhere yet: every figure at its floor, so
   * each case below turns on exactly the fields it sets. */
  const RESTING: PauseRun = {
    place: 1,
    skiers: 1,
    time: 0,
    free: false,
    taken: 0,
    gates: 24,
    dropped: 0,
    bestAir: 0,
    distance: 0,
    best: null,
  };
  const run = (over: Partial<PauseRun>): PauseRun => ({ ...RESTING, ...over });
  const keys = (over: Partial<PauseRun>): string[] => pauseStats(run(over)).map((stat) => stat.key);

  it("never carries more cells than the card has room for", () => {
    const everything = run({
      skiers: 4,
      place: 2,
      taken: 5,
      dropped: 300,
      bestAir: 1.4,
      distance: 900,
      best: { time: 150, skis: "hare", at: 0 },
    });
    expect(pauseStats(everything)).toHaveLength(PAUSE_STATS);
    expect(pauseStats(everything, 2)).toHaveLength(2);
    expect(pauseStats(everything, -1)).toHaveLength(0);
  });

  it("leads a race with the standing and the clock, then the race's own story", () => {
    expect(keys({ skiers: 4, bestAir: 1.2, distance: 400 })).toEqual([
      "place",
      "time",
      "air",
      "distance",
    ]);
    // With no story yet it IS the corner's reading — nothing else is true.
    expect(keys({ skiers: 4, dropped: 120 })).toEqual(["place", "time", "gate", "dropped"]);
  });

  it("puts the record a time trial is ridden against ahead of the flights", () => {
    expect(keys({ best: { time: 95, skis: "hare", at: 0 }, bestAir: 1, distance: 50 })).toEqual([
      "time",
      "record",
      "air",
      "distance",
    ]);
    const record = pauseStats(run({ best: { time: 95, skis: "hare", at: 0 } })).find(
      (stat) => stat.key === "record",
    )!;
    expect(record.value).toBe(STRINGS.resultTime(95));
    expect(record.label).toBe(STRINGS.pauseRecord);
  });

  it("bills no standing alone, no vertical before the start and no gate on a free ride", () => {
    expect(keys({})).toEqual(["time", "gate"]);
    expect(keys({ free: true, skiers: 1, bestAir: 0.8, distance: 1200, dropped: 400 })).toEqual([
      "time",
      "air",
      "distance",
      "dropped",
    ]);
    expect(keys({ free: true })).toEqual(["time"]);
  });

  it("reads each figure the way the HUD's own chip does", () => {
    const race = pauseStats(run({ skiers: 4, place: 3, time: 72.5, taken: 5, dropped: 212.4 }));
    const by = (key: string): PauseStat => race.find((stat) => stat.key === key)!;
    expect(by("place").value).toBe(STRINGS.place(3, 4));
    expect(by("place").label).toBe(STRINGS.placeLabel);
    expect(by("time").value).toBe(STRINGS.resultTime(72.5));
    expect(by("gate").value).toBe(STRINGS.gates(5, 24));
    expect(by("dropped").value).toBe(STRINGS.dropped(212.4));
  });
});
