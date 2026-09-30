// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE PICTURE COSTS (pwa/src/game/settings-video.ts) and the probe that
// picks a first visit's rung (video-probe.ts): the whole ladder, DOM-free.
// The renderer only ever reads these tables, so a promise the table breaks
// is a promise the game breaks.

import { describe, expect, it } from "vitest";

import {
  DEFAULT_VIDEO,
  DISTANCE_LEVELS,
  DISTANCE_LOOK,
  FOREST_LOOK,
  RESOLUTION_SHARE,
  SHADOW_LEVELS,
  SHADOW_LOOK,
  SPRAY_SHARE,
  TERRAIN_REACH,
  TIERS,
  TRAIL_LEVELS,
  TRAIL_LOOK,
  VIDEO_PRESETS,
  PICTURE_LADDERS,
  PICTURE_ROWS,
  mergeVideo,
  mistFor,
  readPicture,
  videoUntouched,
  writePicture,
  type VideoSettings,
  presetOf,
  terrainLook,
  terrainReach,
  terrainTriangles,
  withPreset,
} from "../pwa/src/game/settings-video.ts";
import { createPictureAuto } from "../pwa/src/game/picture-auto.ts";
import { freshSettings, type Settings } from "../pwa/src/game/settings.ts";
import {
  PROBE_ROUNDS,
  PROBE_SAMPLES,
  PROBE_STALLS,
  PROBE_WARMUP,
  createVideoProbe,
} from "../pwa/src/game/video-probe.ts";
import {
  FIT_BUDGET_MS,
  FLOOR_MS,
  PICTURE_PRICES,
  fitPicture,
  pictureCost,
  pictureWorth,
  samePicture,
} from "../pwa/src/game/picture-fit.ts";

describe("the picture's ladders (settings-video.ts)", () => {
  it("runs every ladder cheapest first", () => {
    const shares = TIERS.map((t) => RESOLUTION_SHARE[t]);
    expect(shares).toEqual([...shares].sort((a, b) => a - b));
    expect(RESOLUTION_SHARE.high).toBe(1);
    expect(RESOLUTION_SHARE.low).toBeGreaterThanOrEqual(0.5);

    const sprays = TIERS.map((t) => SPRAY_SHARE[t]);
    expect(sprays).toEqual([...sprays].sort((a, b) => a - b));
    expect(SPRAY_SHARE.high).toBe(1);

    const shadows = SHADOW_LEVELS.map((s) => SHADOW_LOOK[s].size);
    expect(shadows).toEqual([...shadows].sort((a, b) => a - b));
    const reaches = SHADOW_LEVELS.map((s) => SHADOW_LOOK[s].reach);
    expect(reaches).toEqual([...reaches].sort((a, b) => a - b));
    expect(SHADOW_LOOK.off.size).toBe(0);
    // Nothing, the field alone, every tree's too, and that again with
    // every skier sharp in a map of his own — and only HIGH draws those.
    expect(SHADOW_LEVELS).toEqual(["off", "skiers", "medium", "high"]);
    expect(SHADOW_LOOK.skiers.trees).toBe(false);
    expect(SHADOW_LOOK.medium.trees).toBe(true);
    expect(SHADOW_LOOK.high.trees).toBe(true);
    expect(SHADOW_LEVELS.filter((s) => SHADOW_LOOK[s].hero > 0)).toEqual(["high"]);
    expect(VIDEO_PRESETS.medium.shadows).toBe("medium");
    expect(VIDEO_PRESETS.high.shadows).toBe("high");
    // What a tree casts follows how the FOREST row draws it.
    expect(FOREST_LOOK.low.casters).toBe("sketch");
    expect(FOREST_LOOK.high.casters).toBe("full");

    const fine = TRAIL_LEVELS.map((t) => TRAIL_LOOK[t].fineSize * TRAIL_LOOK[t].coarseSize);
    expect(fine).toEqual([...fine].sort((a, b) => a - b));
    expect(TRAIL_LOOK.off.stamp).toBe(false);
    for (const t of TIERS) expect(TRAIL_LOOK[t].stamp).toBe(true);
  });

  it("builds a ground that is coarser down the ladder and never shorter than the view", () => {
    const tris = TIERS.map((t) => terrainTriangles(terrainLook(t)));
    // Each rung down draws strictly fewer triangles...
    expect(tris[0]).toBeLessThan(tris[1]);
    expect(tris[1]).toBeLessThan(tris[2]);
    for (const t of TIERS) {
      for (const d of DISTANCE_LEVELS) {
        const reach = DISTANCE_LOOK[d].view;
        const look = terrainLook(t, reach);
        expect(look.n % 4, t).toBe(0);
        expect(terrainReach(look), `${t} ${d}`).toBeGreaterThanOrEqual(reach);
        // ...and no level more than it needs to get there.
        expect(terrainReach({ ...look, levels: look.levels - 1 }), `${t} ${d}`).toBeLessThan(reach);
      }
    }
    // MAX, and only MAX, draws the ground past the rim.
    expect(DISTANCE_LOOK.max.view).toBe(TERRAIN_REACH);
    expect(terrainLook("medium")).toEqual(terrainLook("medium", TERRAIN_REACH));
    // The ground as it was tuned is the top rung: a quarter metre, 192 cells.
    expect(terrainLook("high")).toMatchObject({ n: 192, spacing: 0.25 });
  });

  it("draws fewer trees down the ladder, and never fewer of the ones a skis can hit", () => {
    for (let i = 1; i < TIERS.length; i++) {
      const lo = FOREST_LOOK[TIERS[i - 1]];
      const hi = FOREST_LOOK[TIERS[i]];
      expect(lo.full).toBeLessThanOrEqual(hi.full);
      expect(lo.farShare).toBeLessThanOrEqual(hi.farShare);
      expect(lo.shapes).toBeLessThanOrEqual(hi.shapes);
    }
    // The top rung's budget carries every variant of a map's main kinds.
    expect(FOREST_LOOK.high.shapes).toBeGreaterThanOrEqual(60);
    // The full band draws EVERY tree — the thinning is the far band's
    // sketches alone — so a trunk in reach of the skis is always drawn.
    for (const t of TIERS) expect(FOREST_LOOK[t].full).toBeLessThan(DISTANCE_LOOK.low.trees);
    expect(FOREST_LOOK.high.farShare).toBe(1);
  });

  it("draws less of the basin down the DISTANCE ladder, and closes a mist before it stops", () => {
    expect(DISTANCE_LEVELS).toEqual(["low", "medium", "high", "max"]);
    const views = DISTANCE_LEVELS.map((d) => DISTANCE_LOOK[d].view);
    const trees = DISTANCE_LEVELS.map((d) => DISTANCE_LOOK[d].trees);
    expect(views).toEqual([...views].sort((a, b) => a - b));
    expect(trees).toEqual([...trees].sort((a, b) => a - b));
    // LOW is only what it takes to ride: a few seconds ahead at speed.
    expect(DISTANCE_LOOK.low.view).toBeLessThanOrEqual(300);
    // A shorter view is a cheaper ground on every TERRAIN stop.
    for (const t of TIERS) {
      const cost = DISTANCE_LEVELS.map((d) =>
        terrainTriangles(terrainLook(t, DISTANCE_LOOK[d].view)),
      );
      expect(cost[0], t).toBeLessThan(cost[3]);
      expect(cost).toEqual([...cost].sort((a, b) => a - b));
    }
    for (const d of DISTANCE_LEVELS) {
      const look = DISTANCE_LOOK[d];
      // The woods stop inside the view — under a mist, where it is nearly
      // whole, so they thin into it rather than ending at a line.
      expect(look.trees, d).toBeLessThan(look.view);
      if (look.mist) expect(look.trees / look.view, d).toBeGreaterThanOrEqual(0.8);
      // Every stop short of MAX closes a mist on its view; MAX has none.
      expect(mistFor(d), d).toBe(d === "max" ? 0 : look.view);
    }
  });

  it("reads a picture back as the preset it is, and CUSTOM once a row moves", () => {
    for (const t of TIERS) {
      expect(presetOf(withPreset(DEFAULT_VIDEO, t))).toBe(t);
      // The canvas's antialiasing is not the preset's.
      expect(presetOf({ ...withPreset(DEFAULT_VIDEO, t), antialias: false })).toBe(t);
    }
    expect(presetOf(DEFAULT_VIDEO)).toBe("medium");
    expect(presetOf({ ...DEFAULT_VIDEO, shadows: "off" })).toBe("custom");
    expect(withPreset({ ...DEFAULT_VIDEO, antialias: false }, "high").antialias).toBe(false);
    // Every preset is a stop on every ladder it names.
    for (const t of TIERS) expect(mergeVideo(VIDEO_PRESETS[t])).toMatchObject(VIDEO_PRESETS[t]);
  });

  it("merges a stored picture row by row", () => {
    expect(mergeVideo(null)).toEqual(DEFAULT_VIDEO);
    expect(mergeVideo({ terrain: "high", trails: "off", antialias: false })).toEqual({
      ...DEFAULT_VIDEO,
      terrain: "high",
      trails: "off",
      antialias: false,
    });
    expect(mergeVideo({ terrain: "ultra", shadows: "max", spray: 3 })).toEqual(DEFAULT_VIDEO);
    // The row's old stops: the quality ladder's LOW is MEDIUM now, and the
    // mode ladder's ALL is HIGH, its skiers sharp.
    expect(mergeVideo({ shadows: "low" }).shadows).toBe("medium");
    expect(mergeVideo({ shadows: "all" }).shadows).toBe("high");
    expect(mergeVideo({ shadows: "high" }).shadows).toBe("high");
  });
});

describe("fitting the picture to the machine (picture-fit.ts)", () => {
  const top = (): VideoSettings => ({
    ...DEFAULT_VIDEO,
    ...(Object.fromEntries(
      PICTURE_ROWS.map((row) => [row, PICTURE_LADDERS[row][PICTURE_LADDERS[row].length - 1]]),
    ) as Partial<VideoSettings>),
  });
  const bottom = (): VideoSettings => ({
    ...DEFAULT_VIDEO,
    ...(Object.fromEntries(
      PICTURE_ROWS.map((row) => [row, PICTURE_LADDERS[row][0]]),
    ) as Partial<VideoSettings>),
  });

  it("prices every stop of every row, nothing at the cheapest, never less up the ladder", () => {
    for (const row of PICTURE_ROWS) {
      const ladder = PICTURE_LADDERS[row] as readonly string[];
      const prices = PICTURE_PRICES[row] as Record<string, { cost: number; benefit: number }>;
      expect(Object.keys(prices).sort(), row).toEqual([...ladder].sort());
      expect(prices[ladder[0]], row).toEqual({ cost: 0, benefit: 0 });
      for (let i = 1; i < ladder.length; i++) {
        expect(prices[ladder[i]].cost, `${row} ${ladder[i]}`).toBeGreaterThanOrEqual(
          prices[ladder[i - 1]].cost,
        );
        expect(prices[ladder[i]].benefit, `${row} ${ladder[i]}`).toBeGreaterThan(
          prices[ladder[i - 1]].benefit,
        );
      }
    }
    expect(pictureCost(bottom())).toBe(FLOOR_MS);
    expect(pictureWorth(bottom())).toBe(0);
  });

  it("gives a machine with room to spare the whole picture", () => {
    expect(samePicture(fitPicture(DEFAULT_VIDEO, 2), top())).toBe(true);
  });

  it("brings a slow machine under the budget, and keeps the look that shows most", () => {
    const at = top();
    const measured = FIT_BUDGET_MS * 1.3;
    const fit = fitPicture(at, measured);
    const scale = measured / pictureCost(at);
    expect(pictureCost(fit) * scale).toBeLessThanOrEqual(FIT_BUDGET_MS);
    // Thirty per cent over is not a reason to lose the furrows.
    expect(fit.trails).not.toBe("off");
    expect(pictureWorth(fit)).toBeGreaterThan(pictureWorth(bottom()));
  });

  it("never gives a slower machine more of the look than a faster one", () => {
    let last = Infinity;
    for (const measured of [4, 8, 12, 16, 20, 30, 45, 60]) {
      const worth = pictureWorth(fitPicture(DEFAULT_VIDEO, measured));
      expect(worth, `${measured} ms`).toBeLessThanOrEqual(last);
      last = worth;
    }
    // A machine no fit can save gets every row at its cheapest.
    expect(samePicture(fitPicture(DEFAULT_VIDEO, 500), bottom())).toBe(true);
  });

  it("gives up the step that loses least per millisecond first, and never one that saves nothing", () => {
    // Two rows that save the same: the one worth less goes; a row that costs
    // nothing is never taken down and is always taken up.
    const prices = {
      ...PICTURE_PRICES,
      spray: {
        low: { cost: 0, benefit: 0 },
        medium: { cost: 0, benefit: 5 },
        high: { cost: 0, benefit: 9 },
      },
      forest: {
        low: { cost: 0, benefit: 0 },
        medium: { cost: 1, benefit: 2 },
        high: { cost: 2, benefit: 4 },
      },
      terrain: {
        low: { cost: 0, benefit: 0 },
        medium: { cost: 1, benefit: 20 },
        high: { cost: 2, benefit: 40 },
      },
    };
    const at = top();
    const cost = pictureCost(at, prices);
    // Just over by one step's worth: exactly one millisecond has to go.
    const fit = fitPicture(at, cost + 0.5, cost - 0.5, prices);
    expect(fit.forest).toBe("medium");
    expect(fit.terrain).toBe("high");
    expect(fit.spray).toBe("high");
    expect(fitPicture({ ...at, spray: "low" }, cost, cost, prices).spray).toBe("high");
  });

  it("steps down past stops that save nothing to the one that does", () => {
    // TRAILS priced level from LOW up: the whole saving is at OFF.
    const prices = {
      ...PICTURE_PRICES,
      trails: {
        off: { cost: 0, benefit: 0 },
        low: { cost: 0.4, benefit: 50 },
        medium: { cost: 0.4, benefit: 58 },
        high: { cost: 0.4, benefit: 62 },
      },
    };
    expect(fitPicture(DEFAULT_VIDEO, 500, FIT_BUDGET_MS, prices).trails).toBe("off");
  });

  it("keeps the canvas's antialiasing, whatever it fits", () => {
    expect(fitPicture({ ...DEFAULT_VIDEO, antialias: false }, 2).antialias).toBe(false);
    expect(fitPicture({ ...DEFAULT_VIDEO, antialias: true }, 500).antialias).toBe(true);
  });
});

describe("the probe (video-probe.ts)", () => {
  /** Drive a probe on a machine whose drained frame is `ms` times the
   * picture's reference cost, applying what it hands back. */
  const drive = (speed: number) => {
    const probe = createVideoProbe();
    let at: VideoSettings = { ...DEFAULT_VIDEO };
    let frames = 0;
    const handed: VideoSettings[] = [];
    while (!probe.done() && frames < 5000) {
      const next = probe.frame(16.7, pictureCost(at) * speed, at);
      frames++;
      if (next) {
        handed.push(next);
        at = next;
      }
    }
    return { at, frames, handed };
  };

  it("warms up, measures, and hands back the fit", () => {
    const probe = createVideoProbe();
    let next = null;
    let frames = 0;
    while (next === null && frames < 1000) {
      next = probe.frame(16.7, 2, DEFAULT_VIDEO);
      frames++;
    }
    expect(frames).toBe(PROBE_WARMUP + PROBE_SAMPLES);
    expect(next?.distance).toBe("max");
  });

  it("settles a machine the table describes in one move, and a slow one under the budget", () => {
    const fast = drive(0.5);
    expect(fast.handed.length).toBe(1);
    expect(fast.frames).toBe(2 * (PROBE_WARMUP + PROBE_SAMPLES));
    const slow = drive(3);
    expect(pictureCost(slow.at) * 3).toBeLessThanOrEqual(FIT_BUDGET_MS);
    expect(slow.handed.length).toBeLessThanOrEqual(PROBE_ROUNDS);
  });

  it("gives up on a machine that only ever stalls, and moves nothing", () => {
    const probe = createVideoProbe();
    let next = null;
    for (let i = 0; i < PROBE_STALLS && next === null; i++)
      next = probe.frame(900, 10, DEFAULT_VIDEO);
    expect(next).toBe(null);
    expect(probe.done()).toBe(true);
  });

  it("knows a picture nobody has touched", () => {
    expect(videoUntouched(DEFAULT_VIDEO)).toBe(true);
    expect(videoUntouched({ ...DEFAULT_VIDEO, spray: "low" })).toBe(false);
  });

  it("reads a picture off a link, row by row, and writes it back the same", () => {
    const pic = readPicture("distance:low,shadows:off,nonsense:1,trails:sideways");
    expect(pic).toEqual({ distance: "low", shadows: "off" });
    expect(readPicture(writePicture(pic))).toEqual(pic);
    expect(readPicture(null)).toEqual({});
  });
});

describe("PRESET ▸ AUTO as the app runs it (picture-auto.ts)", () => {
  /** A machine that draws everything in two milliseconds, and the app's
   * settings as the rig moves them. */
  const rig = (allowed = true) => {
    let settings: Settings = freshSettings();
    const auto = createPictureAuto(allowed, (change) => (settings = change(settings)));
    const ride = (frames: number, quiet = true): void => {
      for (let i = 0; i < frames; i++) {
        if (auto.wants(settings.autoPicture, quiet)) auto.frame(16.7, 2, settings.video);
      }
    };
    return { get: () => settings, set: (s: Settings) => (settings = s), ride };
  };

  it("fits the picture once a visit, keeping the canvas's antialiasing", () => {
    const r = rig();
    r.ride(1000);
    expect(r.get().video.distance).toBe("max");
    expect(r.get().video.antialias).toBe(DEFAULT_VIDEO.antialias);
    expect(r.get().probed).toBe(true);
  });

  it("times nothing over a race, off AUTO, or where a link holds it off", () => {
    const racing = rig();
    racing.ride(1000, false);
    expect(racing.get().video).toEqual(DEFAULT_VIDEO);
    const off = rig();
    off.set({ ...off.get(), autoPicture: false });
    off.ride(1000);
    expect(off.get().video).toEqual(DEFAULT_VIDEO);
    const held = rig(false);
    held.ride(1000);
    expect(held.get().video).toEqual(DEFAULT_VIDEO);
  });

  it("fits again the moment AUTO is pressed, and never over the skier's own picture", () => {
    const r = rig();
    r.ride(1000);
    r.set({ ...r.get(), autoPicture: false, video: { ...DEFAULT_VIDEO, spray: "low" } });
    r.ride(1000);
    expect(r.get().video.spray).toBe("low");
    r.set({ ...r.get(), autoPicture: true });
    r.ride(1000);
    expect(r.get().video.spray).toBe("high");
  });
});
