// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND WAVES (`engine/game/army-wave.ts`): the columns the wanted
// level sends up the mountain from the valley — on time, bigger every wave,
// formed up out of his sight down the ski area's own runs, climbing them to
// him without anyone stuck, bounded in number, bringing their snowmobiles,
// arresting him with SAFE FOR WORK on and never wounding him, sent home
// once the hunt is over, and drawing nothing from the run's stream.

import { describe, expect, it } from "vitest";

import {
  ARMY_WAVE,
  NEUTRAL_INPUT,
  TUNING,
  WANTED,
  armySleds,
  armyTroops,
  createGame,
  groundWave,
  placeRun,
  seesQuarry,
  setWanted,
  step,
  wayDown,
  type ArmyEvent,
  type GameEvent,
  type GameState,
  type WantedRoster,
} from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const dt = TUNING.dt;
const level = levelFor(LEVEL_SEEDS[1]);

/** THE WAVES ALONE: the roster's door gunners, soldiers, lifted men and
 * snowmobiles held back and its fire held (`hold`), for the length of
 * `fn`, and the snowmobiles the waves bring set to `sleds` — so what a
 * test reads is the columns. Put back as they were. */
function wavesAlone<T>(fn: () => T, sleds = 0): T {
  const rows = WANTED.roster as WantedRoster[];
  const kept = rows.map((r) => ({ ...r }));
  const W = ARMY_WAVE as { sleds: number };
  const keptSleds = W.sleds;
  for (const r of rows) {
    r.gunners = 0;
    r.soldiers = 0;
    r.lifted = 0;
    r.snowmobiles = 0;
    r.fire = "hold";
  }
  W.sleds = sleds;
  try {
    return fn();
  } finally {
    kept.forEach((r, i) => Object.assign(rows[i], r));
    W.sleds = keptSleds;
  }
}

function hunted(stars: number, sfw = false): GameState {
  const s = createGame({ level, mode: "free", quiet: true, crowd: 0, gore: !sfw, sfw });
  setWanted(s, stars);
  return s;
}

/** Step `seconds` stood still, every event kept; `each` sees every step. */
function run(s: GameState, seconds: number, each?: (s: GameState) => void): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < seconds / dt; i++) {
    step(s, NEUTRAL_INPUT);
    out.push(...s.events);
    each?.(s);
  }
  return out;
}

const waveMen = (s: GameState) => armyTroops(s).filter((m) => m.from === "wave");
const wavesOf = (events: GameEvent[]): ArmyEvent[] =>
  events.filter((e): e is ArmyEvent => e.kind === "army" && e.change === "wave");

describe("the way up", () => {
  it("runs down the ski area's runs from beside him to the valley", () => {
    const p = level.track.points[Math.floor(level.track.points.length / 3)];
    const down = wayDown(level, p.x, p.z);
    expect(down.length).toBeGreaterThan(20);
    expect(Math.hypot(down[0].x - p.x, down[0].z - p.z)).toBeLessThan(60);
    // Down the mountain, end to end, a point every `sample` m or so.
    const top = level.groundAt(down[0].x, down[0].z);
    const end = down[down.length - 1];
    expect(level.groundAt(end.x, end.z)).toBeLessThan(top - 50);
    for (let k = 1; k < down.length; k++) {
      const d = Math.hypot(down[k].x - down[k - 1].x, down[k].z - down[k - 1].z);
      expect(d).toBeLessThan(ARMY_WAVE.sample * 3);
    }
  });

  it("forms a column well away from him on dead flat ground, where there is no way down", () => {
    wavesAlone(() => {
      const flat = flatLevel({ grade: 0 });
      const c = flat.size / 2;
      // No ski area and no fall: the way down is his own spot alone.
      expect(wayDown(flat, c, c)).toHaveLength(1);
      const s = createGame({
        level: flat,
        mode: "free",
        quiet: true,
        crowd: 0,
        gore: true,
        sfw: false,
      });
      placeRun(s, { x: c, z: c, heading: 0, speed: 0 });
      setWanted(s, 5);
      const events = run(s, WANTED.waves[5]!.first + 1);
      const [wave] = wavesOf(events);
      expect(wave).toBeDefined();
      expect(Math.hypot(wave.x - c, wave.z - c)).toBeGreaterThanOrEqual(ARMY_WAVE.apart);
      for (const r of s.army!.routes)
        expect(r.pts.length).toBeLessThan(flat.size / ARMY_WAVE.sample + 4);
    });
  });
});

describe("the waves", () => {
  it("sends none below two stars, and none before a star's first", () => {
    wavesAlone(() => {
      const one = hunted(1);
      const events = run(one, 40);
      expect(wavesOf(events)).toHaveLength(0);
      expect(waveMen(one)).toHaveLength(0);
      const two = hunted(2);
      run(two, WANTED.waves[2]!.first - 2);
      expect(two.army!.waves).toBe(0);
    });
  });

  it("comes on time, each wave bigger than the last, up to the bound", () => {
    wavesAlone(() => {
      const s = hunted(5);
      const row = WANTED.waves[5]!;
      let most = 0;
      const events = run(s, row.first + row.every * 2 + 1, (st) => {
        most = Math.max(most, waveMen(st).length);
      });
      const waves = wavesOf(events);
      expect(waves).toHaveLength(3);
      expect(waves[0].t).toBeCloseTo(row.first, 0);
      expect(waves[1].t - waves[0].t).toBeCloseTo(row.every, 0);
      const sizes = [0, 1, 2].map((n) => groundWave(5, n)!.foot);
      expect(sizes[1]).toBeGreaterThan(sizes[0]);
      expect(s.army!.marched).toBe(
        Math.min(
          ARMY_WAVE.most[5],
          sizes.reduce((a, b) => a + b, 0),
        ),
      );
      expect(most).toBeLessThanOrEqual(ARMY_WAVE.most[5]);
      // On skis with skins, and every `slog`th man on foot.
      const men = waveMen(s);
      const foot = men.filter((m) => m.role === "foot").length;
      expect(foot).toBeGreaterThan(0);
      expect(foot).toBeLessThan(men.length / 2);
    });
  });

  it("forms up out of his sight and climbs to him, nobody stuck", () => {
    wavesAlone(() => {
      const s = hunted(5);
      const row = WANTED.waves[5]!;
      const events = run(s, row.first + 0.5);
      const head = wavesOf(events)[0];
      const q = { x: s.skier.x, y: s.skier.y, z: s.skier.z };
      const far = Math.hypot(head.x - q.x, head.z - q.z);
      expect(far).toBeGreaterThan(150);
      const seen = seesQuarry(level, { kind: "soldier", x: head.x, y: head.y + 1.6, z: head.z }, q);
      // Out of his sight, or as far down as a column is ever sent.
      if (seen) expect(far).toBeGreaterThan(ARMY_WAVE.hidden * 0.5);
      const first = new Set(waveMen(s).map((m) => m.id));
      const gap = (st: GameState) => {
        const d = waveMen(st)
          .filter((m) => first.has(m.id))
          .map((m) => Math.hypot(m.x - q.x, m.z - q.z))
          .sort((a, b) => a - b);
        return d[d.length >> 1];
      };
      const before = gap(s);
      let stuck = 0;
      run(s, 60, (st) => {
        for (const m of waveMen(st)) if (m.slow >= 3) stuck++;
      });
      expect(gap(s)).toBeLessThan(before - 50);
      expect(stuck).toBe(0);
      for (const m of waveMen(s)) {
        expect(m.x).toBeGreaterThan(0);
        expect(m.z).toBeLessThan(level.size);
        expect(Number.isFinite(m.y)).toBe(true);
      }
    });
  });

  it("brings its snowmobiles out on top of the roster's", () => {
    wavesAlone(() => {
      const s = hunted(5);
      run(s, WANTED.waves[5]!.first + 30);
      expect(s.army!.waveSleds).toBeGreaterThan(0);
      expect(armySleds(s).length).toBeGreaterThan(0);
    }, 2);
  });
});

describe("safe for work", () => {
  it("arrests a man stood still and never wounds him", () => {
    wavesAlone(() => {
      const s = hunted(5, true);
      // The waves' own rules of fire: warning fire, never at him.
      (WANTED.roster as WantedRoster[])[5].fire = "aim";
      let by = -1;
      // Stepped until the hunt ends, five minutes at the most.
      for (let i = 0; i < 300 / dt && !s.wanted!.ended; i++) {
        step(s, NEUTRAL_INPUT);
        for (const e of s.events)
          if (e.kind === "soldier" && e.change === "arrest" && by < 0) by = e.id;
      }
      expect(s.wanted!.ended).toBe("arrested");
      expect(armyTroops(s).find((m) => m.id === by)?.from).toBe("wave");
      expect(s.gunfire?.hits ?? 0).toBe(0);
      expect(s.skier.body.injuries).toHaveLength(0);
    });
  });
});

describe("home", () => {
  it("takes the waves' men out of his sight off the map once the hunt is over", () => {
    wavesAlone(() => {
      const s = hunted(5);
      run(s, WANTED.waves[5]!.first + 20);
      expect(waveMen(s).length).toBeGreaterThan(0);
      setWanted(s, 0);
      run(s, 1);
      const q = s.skier;
      for (const m of waveMen(s))
        expect(Math.hypot(m.x - q.x, m.z - q.z)).toBeLessThanOrEqual(ARMY_WAVE.home);
    });
  });
});

describe("determinism", () => {
  it("runs the same waves the same twice, and draws nothing from the run's stream", () => {
    wavesAlone(() => {
      const a = hunted(5);
      const b = hunted(5);
      const t = WANTED.waves[5]!.first + 40;
      run(a, t);
      run(b, t);
      const sig = (s: GameState) =>
        waveMen(s)
          .map((m) => `${m.id}:${m.mode}:${m.x.toFixed(4)},${m.z.toFixed(4)}`)
          .join("|");
      expect(sig(a).length).toBeGreaterThan(0);
      expect(sig(a)).toBe(sig(b));
      // The same hunt with no wave at all: the run's stream where it was.
      const none = hunted(5);
      const rows = WANTED.waves as (typeof WANTED.waves)[number][];
      const kept = rows.slice();
      rows.fill(null);
      try {
        run(none, t);
      } finally {
        kept.forEach((r, i) => (rows[i] = r));
      }
      expect(waveMen(none)).toHaveLength(0);
      expect(a.rng.next()).toBe(none.rng.next());
    });
  });
});
