// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BODY LYING ON THE SNOW GONE OVER (`engine/game/lying.ts`): a dead
// amateur and a civilian lying are solid to the player on his skis and on
// the snowmobile — ridden over, the rider slowed by the share of the body
// his skis carry along and the body pushed on; a tip caught under a limb
// lying across the skis throws him; and with the INJURIES switch on the
// body is hurt by what goes over it (a snowmobile's weight breaks a man
// lying, a piste machine's crushes him), with it off only pushed.

import { describe, expect, it } from "vitest";
import { casualtiesOf, step, NEUTRAL_INPUT, type GameEvent } from "@engine";

import { lyingRow, stageLying, type LyingRow } from "./support/lying.ts";

type Struck = Extract<GameEvent, { kind: "struck" }>;

const SPEEDS = [20, 45, 90] as const;

/** Every speed, both bodies, both ways of the switch, on `rider`. */
function sweep(rider: "skis" | "sled"): LyingRow[] {
  const rows: LyingRow[] = [];
  for (const who of ["amateur", "civilian"] as const) {
    for (const gore of [true, false]) {
      for (const kmh of SPEEDS)
        rows.push(lyingRow({ who, as: "dead", rider, kmh, gore }, 1, false));
    }
  }
  return rows;
}

describe("a body lying on the snow, gone over on skis", () => {
  const rows = sweep("skis");

  it("is met once a pass, and takes speed off him the faster he goes — thrown by none", () => {
    for (const r of rows) {
      const at = `${r.who} ${r.kmh} ${r.gore}`;
      expect(r.passes, at).toBe(1);
      expect(r.thrown, at).toBe(false);
      expect(r.taken, at).toBeGreaterThan(0.05 * r.kmh);
      expect(r.taken, at).toBeLessThan(0.25 * r.kmh);
      expect(r.moved, at).toBeGreaterThan(0.05);
    }
    const man = (kmh: number) => rows.find((r) => r.who === "amateur" && r.gore && r.kmh === kmh)!;
    expect(man(90).taken).toBeGreaterThan(man(45).taken);
    expect(man(45).taken).toBeGreaterThan(man(20).taken);
    expect(man(90).moved).toBeGreaterThan(man(20).moved);
  });

  it("is the same body whoever he is: an amateur and a civilian alike", () => {
    for (const gore of [true, false]) {
      for (const kmh of SPEEDS) {
        const a = rows.find((r) => r.who === "amateur" && r.gore === gore && r.kmh === kmh)!;
        const c = rows.find((r) => r.who === "civilian" && r.gore === gore && r.kmh === kmh)!;
        expect(a.taken, `${kmh}`).toBeCloseTo(c.taken, 1);
      }
    }
  });

  it("a dead man stays dead, the rider's legs only jolted; with injuries off nobody is hurt", () => {
    for (const r of rows) {
      expect(r.dead, `${r.who} ${r.kmh}`).toBe(r.gore);
      expect(r.worst, `${r.who} ${r.kmh}`).toBeLessThanOrEqual(2);
      if (!r.gore) expect(r.injured || r.crush > 0).toBe(false);
    }
  });

  it("the body slows him as the run without it shows", () => {
    const r = lyingRow({ who: "civilian", as: "dead", rider: "skis", kmh: 90, gore: true });
    expect(r.lost).toBeGreaterThan(r.taken * 0.7);
    expect(r.lost).toBeLessThan(r.taken * 1.3);
  });

  it("a tip caught under his legs throws the skier from a brisk cruise, not at a crawl", () => {
    const slow = lyingRow(
      { who: "amateur", as: "dead", rider: "skis", kmh: 20, gore: true, lie: "legs" },
      1,
      false,
    );
    expect(slow.thrown).toBe(false);
    for (const kmh of [45, 90]) {
      for (const gore of [true, false]) {
        const r = lyingRow(
          { who: "amateur", as: "dead", rider: "skis", kmh, gore, lie: "legs" },
          1,
          false,
        );
        expect(r.thrown, `${kmh} ${gore}`).toBe(true);
      }
    }
  });

  it("a knocked man about to get up is injured at 90 km/h, not at 20; with injuries off never", () => {
    const at = (kmh: number, gore: boolean) =>
      lyingRow({ who: "civilian", as: "knocked", rider: "skis", kmh, gore }, 1, false);
    expect(at(20, true).injured).toBe(false);
    expect(at(90, true).injured).toBe(true);
    expect(at(90, false).injured).toBe(false);
  });

  it("fires a struck event marked lying, the player's shins struck by it", () => {
    const { state } = stageLying({
      who: "amateur",
      as: "dead",
      rider: "skis",
      kmh: 90,
      gore: true,
    });
    let e: Struck | undefined;
    for (let i = 0; i < 120 && !e; i++) {
      step(state, NEUTRAL_INPUT);
      e = state.events.find((x): x is Struck => x.kind === "struck");
    }
    expect(e?.lying).toBe(true);
    expect(e!.amateur).toBe(0);
    expect(e!.away).toBeUndefined();
    step(state, NEUTRAL_INPUT);
    const all = state.crowd!.struck!;
    const filed = all[all.length - 1];
    expect(filed.lying).toBe(true);
    expect(filed.dosed).toBe(true);
    // Still one body to collect, struck where he was first.
    const him = casualtiesOf(state).find((k) => k.who === "amateur")!;
    expect(him.dead).toBe(true);
  });
});

describe("a body lying on the snow, gone over by the snowmobile", () => {
  const rows = sweep("sled");

  it("rides over him barely slowed, never thrown, the body shoved further the faster", () => {
    for (const r of rows) {
      const at = `${r.who} ${r.kmh} ${r.gore}`;
      expect(r.passes, at).toBe(1);
      expect(r.thrown, at).toBe(false);
      expect(r.taken, at).toBeLessThan(0.12 * r.kmh);
      expect(r.worst, at).toBe(0);
    }
    const man = (kmh: number) => rows.find((r) => r.who === "civilian" && r.gore && r.kmh === kmh)!;
    expect(man(90).moved).toBeGreaterThan(man(45).moved);
    expect(man(45).moved).toBeGreaterThan(man(20).moved);
  });

  it("crushes a dead man further at speed, with injuries on only", () => {
    for (const who of ["amateur", "civilian"] as const) {
      const on = rows.find((r) => r.who === who && r.gore && r.kmh === 90)!;
      const off = rows.find((r) => r.who === who && !r.gore && r.kmh === 90)!;
      expect(on.crush, who).toBeGreaterThan(0.2);
      expect(off.crush, who).toBe(0);
      expect(off.dead, who).toBe(false);
    }
  });

  it("breaks a knocked man at any speed and kills an injured one at 90 km/h", () => {
    const at = (as: "knocked" | "injured", kmh: number, gore = true) =>
      lyingRow({ who: "civilian", as, rider: "sled", kmh, gore }, 1, false);
    expect(at("knocked", 20).injured).toBe(true);
    expect(at("knocked", 20, false).injured).toBe(false);
    expect(at("injured", 45).dead).toBe(false);
    expect(at("injured", 90).dead).toBe(true);
  });
});

describe("a body lying on the snow, gone over by a piste machine", () => {
  it("is crushed by its weight even at its working pace with injuries on, only shoved with them off", () => {
    const on = lyingRow(
      { who: "civilian", as: "injured", rider: "groomer", kmh: 9, gore: true },
      4,
      false,
    );
    expect(on.passes).toBe(1);
    expect(on.dead).toBe(true);
    expect(on.crush).toBe(1);
    const off = lyingRow(
      { who: "civilian", as: "knocked", rider: "groomer", kmh: 9, gore: false },
      4,
      false,
    );
    expect(off.passes).toBe(1);
    expect(off.dead || off.injured || off.crush > 0).toBe(false);
    expect(off.moved).toBeGreaterThan(0);
  });
});
