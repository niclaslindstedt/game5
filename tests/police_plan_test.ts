// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLICE AFTER A DEATH — the scene planned (`police-plan.ts` over
// `police-scene.ts`), held without a renderer: the same plan twice off the
// same map, the machine set down off the cordon, nobody walking through the
// body or the machine, every marker inside the cordon and numbered from the
// impact down to the body, every part in order and long enough to watch,
// the photographs flashed — and the book that calls it (`rescue-book.ts`):
// a death the police, an injury the ambulance, and never one machine for
// both.

import { describe, expect, it } from "vitest";
import {
  createGame,
  rescueBoxes,
  standSkier,
  type Evidence,
  type GameEvent,
  type GameState,
  type StripBox,
} from "@engine";

import { bagAt } from "../pwa/src/game/police-carry.ts";
import { OFFICERS, PHOTO, POLICE } from "../pwa/src/game/police-defs.ts";
import { flashAt, freshPoliceFrame, planPolice, policeAt } from "../pwa/src/game/police-plan.ts";
import { evidenceOf, toSeg } from "../pwa/src/game/police-scene.ts";
import { bookRun, createRescueBook, noteImpact } from "../pwa/src/game/rescue-book.ts";
import { RESCUE } from "../pwa/src/game/rescue-defs.ts";
import { levelFor } from "./support/levels.ts";

const cases = [1, 38].flatMap((seed) =>
  [0.4, 0.6].map((share) => {
    const level = levelFor(seed);
    const pts = level.track.points;
    const hit = pts[Math.floor(pts.length * share)];
    const lay = pts.find((p) => p.s >= hit.s + 22) ?? hit;
    const side = (k: number) => ({
      x: hit.x + (lay.x - hit.x) * k + Math.cos(hit.heading) * 2.5,
      z: hit.z + (lay.z - hit.z) * k - Math.sin(hit.heading) * 2.5,
    });
    const evidence: Evidence[] = [
      { what: "impact", x: hit.x, z: hit.z },
      { what: "blood", ...side(0.2) },
      { what: "piece", ...side(0.55) },
      { what: "ski", ...side(0.8) },
      { what: "body", x: lay.x, z: lay.z },
    ];
    const call = { x: lay.x, z: lay.z, evidence };
    return { name: `seed ${seed} at ${share}`, level, call, plan: planPolice(level, call) };
  }),
);

/** Whether `p` is inside the convex ring. */
function inside(ring: readonly { x: number; z: number }[], p: { x: number; z: number }): boolean {
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const c = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
    if (c > 0) pos++;
    else neg++;
  }
  return pos === 0 || neg === 0;
}

describe("police plan", () => {
  it("is the same plan twice off the same map", () => {
    const { level, call, plan } = cases[0];
    expect(JSON.stringify(planPolice(level, call))).toBe(JSON.stringify(plan));
  });

  for (const { name, level, plan } of cases) {
    describe(name, () => {
      it("sets the machine down off the cordon", () => {
        const s = plan.flight.site;
        for (const p of plan.ring) expect(Math.hypot(p.x - s.x, p.z - s.z)).toBeGreaterThan(5.5);
        expect(inside(plan.ring, s)).toBe(false);
      });

      it("rings every item with room to spare, and stands every marker inside it", () => {
        expect(plan.ring.length).toBeGreaterThanOrEqual(4);
        for (const e of plan.evidence) {
          expect(inside(plan.ring, e)).toBe(true);
          for (let i = 0; i < plan.ring.length; i++) {
            const a = plan.ring[i];
            const b = plan.ring[(i + 1) % plan.ring.length];
            expect(toSeg(e, a, b)).toBeGreaterThan(POLICE.cordon.margin - 0.6);
          }
        }
        for (const m of plan.markers) expect(inside(plan.ring, m)).toBe(true);
      });

      it("numbers the markers in order, from the impact down to the body", () => {
        expect(plan.markers.map((m) => m.n)).toEqual(plan.markers.map((_, i) => i + 1));
        expect(plan.markers[0].what).toBe("impact");
        expect(plan.markers[plan.markers.length - 1].what).toBe("body");
        for (let i = 1; i < plan.markers.length; i++)
          expect(plan.markers[i].placed).toBeGreaterThan(plan.markers[i - 1].placed);
      });

      it("runs its parts in order, and keeps the scene on the snow a good while", () => {
        const a = plan.at;
        const order = [a.out, a.survey, a.cordon, a.taped, a.recover, a.lift, a.gone];
        for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
        expect(a.marked).toBeLessThan(a.recover);
        expect(a.shot).toBeLessThan(a.recover);
        // Landing to lift-off: two and a half to four minutes.
        const onSnow = a.lift - plan.flight.down;
        expect(onSnow).toBeGreaterThan(150);
        expect(onSnow).toBeLessThan(240);
        for (const acts of plan.acts)
          for (let i = 1; i < acts.length; i++) {
            expect(acts[i].t0).toBeCloseTo(acts[i - 1].t1, 6);
            expect(acts[i].t1).toBeGreaterThanOrEqual(acts[i].t0);
          }
        // Stakes in, then the tape along each span, then the markers shot.
        for (const s of plan.spans) expect(s.t1).toBeGreaterThan(s.t0);
        for (const t of plan.stakes) expect(Number.isFinite(t)).toBe(true);
        const ms = plan.markers.map((m) => m.placed);
        for (const f of plan.flashes.slice(8)) expect(f.t).toBeGreaterThan(Math.min(...ms));
      });

      it("never walks anyone through the body or the machine", () => {
        const f = freshPoliceFrame();
        const bad: string[] = [];
        const boxes: StripBox[] = [];
        rescueBoxes(plan.flight.site, boxes);
        for (let t = plan.at.out + 3; t < plan.at.recover; t += 0.2) {
          policeAt(level, plan, t, f);
          f.crew.forEach((c, j) => {
            if (!c.shown) return;
            const near = toSeg(c, plan.body.a, plan.body.b);
            if (near < POLICE.body.room - 0.1 && bad.length < 6)
              bad.push(`t ${t.toFixed(1)} #${j} ${near.toFixed(2)} m off him`);
            for (const b of boxes) {
              const dx = c.x - b.x;
              const dz = c.z - b.z;
              const along = Math.abs(dx * b.dx + dz * b.dz);
              const across = Math.abs(dx * b.dz - dz * b.dx);
              if (along < b.halfLength + 0.25 && across < b.halfWidth + 0.25 && bad.length < 6)
                bad.push(`t ${t.toFixed(1)} #${j} in the machine`);
            }
          });
        }
        expect(bad).toEqual([]);
      });

      it("has three officers out, then two patrollers for the recovery, the photographer aboard", () => {
        const f = freshPoliceFrame();
        policeAt(level, plan, plan.at.out + 4, f);
        expect([0, 1, PHOTO].every((j) => f.crew[j].shown)).toBe(true);
        expect(f.crew[2].shown || f.crew[3].shown).toBe(false);
        policeAt(level, plan, plan.at.recover - 4, f);
        expect(f.crew[2].shown && f.crew[3].shown).toBe(true);
        policeAt(level, plan, plan.at.recover + 1, f);
        expect(f.active).toBe(0);
        const aboard = plan.acts[PHOTO].find((a) => a.kind === "still" && a.doing === "gone")!;
        expect(aboard.t0).toBeLessThan(plan.at.lift);
        policeAt(level, plan, aboard.t0 + 0.1, f);
        expect(f.crew[PHOTO].shown).toBe(false);
        expect(OFFICERS).toHaveLength(3);
      });

      it("carries the bag in in the patrollers' hands, to where the scoop takes it up", () => {
        const f = freshPoliceFrame();
        const c = plan.carry;
        expect(c.t1).toBeCloseTo(plan.at.recover - POLICE.gather, 6);
        policeAt(level, plan, c.t0 - 0.5, f);
        expect(f.trips[0].stretcher.shown).toBe(false);
        // Every moment it is seen, it is between the two who carry it.
        for (let t = c.t0 + 0.05; t < plan.at.recover; t += 0.5) {
          policeAt(level, plan, t, f);
          const st = f.trips[0].stretcher;
          expect(st.shown).toBe(true);
          const holders = t < c.t1 + POLICE.handover ? [2, 3] : [1, 3];
          for (const j of holders) {
            const p = f.crew[j];
            expect(p.shown).toBe(true);
            expect(Math.hypot(p.x - st.x, p.z - st.z)).toBeLessThan(1.3);
          }
          const gy = level.groundAt(st.x, st.z);
          expect(st.y - gy).toBeGreaterThan(0.4);
        }
        // ...and where the scoop has it at its first moment, to the centimetre.
        const before = { ...policeAt(level, plan, plan.at.recover - 0.01, f).trips[0].stretcher };
        const after = policeAt(level, plan, plan.at.recover + 0.01, f).trips[0].stretcher;
        expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(0.05);
        expect(Math.abs(after.y - before.y)).toBeLessThan(0.06);
        expect(Math.abs(after.heading - before.heading)).toBeLessThan(0.02);
        // Every one of the four where the scoop has him then, too.
        const was = policeAt(level, plan, plan.at.recover - 0.01, f).crew.map((p) => ({ ...p }));
        const now = policeAt(level, plan, plan.at.recover + 0.01, f).crew;
        for (let j = 0; j < 4; j++)
          expect(Math.hypot(now[j].x - was[j].x, now[j].z - was[j].z)).toBeLessThan(0.05);
      });

      it("lifts the tape over the bag where it is carried in under it, and only there", () => {
        const c = plan.carry;
        // In from outside the cordon: it crosses the tape at least once.
        expect(inside(plan.ring, c.path.pts[0])).toBe(false);
        expect(c.gates.length).toBeGreaterThan(0);
        const f = freshPoliceFrame();
        for (const g of c.gates) {
          // Up as the frame's middle passes under it — the tape run by then.
          policeAt(level, plan, g.t, f);
          expect(f.scene.tape[g.span]).toBe(1);
          expect(f.scene.lift[g.span]).toBe(1);
        }
        const lifted = new Set(c.gates.map((g) => g.span));
        // Never a span it does not cross, and down again once it is through.
        for (let t = c.t0 - 2; t < plan.at.recover + 15; t += 0.5) {
          policeAt(level, plan, t, f);
          f.scene.lift.forEach((v, i) => {
            if (!lifted.has(i)) expect(v).toBe(0);
          });
        }
        const through = Math.max(...c.gates.map((g) => g.t)) + 5;
        policeAt(level, plan, through, f);
        expect(Math.max(...f.scene.lift)).toBe(0);
      });

      it("opens the bag beside him, and shuts it over him once he is rolled onto it", () => {
        const trip = plan.flight.trips[0];
        const A = trip.plan.at.scoop;
        const T = RESCUE.scoop.time;
        const carried = bagAt(trip.plan, -3);
        expect([carried.open, carried.fill, carried.shut]).toEqual([0, 0, false]);
        const sliding = bagAt(trip.plan, A.slide + T.slide / 2);
        expect(sliding.open).toBeGreaterThan(0.99);
        expect(sliding.shut).toBe(false);
        const on = bagAt(trip.plan, A.back + T.back);
        expect(on.turn).toBeCloseTo(1, 6);
        expect(on.open).toBeGreaterThan(0.99);
        expect(on.fill).toBe(0);
        const done = bagAt(trip.plan, A.stand);
        expect([done.open, done.fill, done.shut]).toEqual([0, 1, true]);
      });

      it("lays the cordon and the markers as it goes, and takes them away with it", () => {
        const f = freshPoliceFrame();
        policeAt(level, plan, plan.at.cordon - 1, f);
        expect(f.scene.up).toBe(true);
        expect(f.scene.stakes).toBe(0);
        expect(f.scene.markers).toBe(0);
        policeAt(level, plan, (plan.at.cordon + plan.at.taped) / 2, f);
        expect(f.scene.stakes).toBeGreaterThan(0);
        expect(f.scene.stakes).toBeLessThan(plan.ring.length);
        policeAt(level, plan, plan.at.recover, f);
        expect(f.scene.stakes).toBe(plan.ring.length);
        expect(f.scene.tape.every((k) => k === 1)).toBe(true);
        expect(f.scene.markers).toBe(plan.markers.length);
        policeAt(level, plan, plan.at.lift + 1, f);
        expect(f.scene.up).toBe(false);
      });

      it("fires a flash at every exposure, bright and brief", () => {
        // The four corners, a mid-range shot a pair of markers and a
        // close-up of each, two exposures every one.
        const n = plan.markers.length;
        expect(plan.flashes.length).toBe(2 * (4 + Math.ceil(n / 2) + n));
        const out = { power: 0, x: 0, y: 0, z: 0 };
        const f0 = plan.flashes[0];
        expect(flashAt(plan, f0.t, out).power).toBeCloseTo(1, 5);
        expect(flashAt(plan, f0.t + 0.2, out).power).toBeLessThan(0.05);
        expect(flashAt(plan, f0.t - 0.05, out).power).toBe(0);
        const h = f0.y - level.groundAt(f0.x, f0.z);
        expect(h).toBeGreaterThan(1.2);
        expect(h).toBeLessThan(1.8);
      });
    });
  }
});

describe("the call after a death", () => {
  const level = levelFor(38);
  const pts = level.track.points;
  const fell = pts[Math.floor(pts.length * 0.45)];
  const fresh = (): GameState =>
    createGame({ level, seed: 38, mode: "free", gore: true, crowd: 0, quiet: true });

  /** A run ended `dead` or hurt at the spot, struck 15 m up the piste. */
  function ended(dead: boolean): GameState {
    const s = fresh();
    standSkier(s, fell.x, fell.z, fell.heading);
    s.t = 30;
    const up = pts.find((p) => p.s >= fell.s - 15) ?? pts[0];
    s.events = [
      { kind: "wipeout", t: 29, cause: "tree", speed: 20, x: up.x, z: up.z } as GameEvent,
    ];
    noteImpact(s);
    if (dead) s.gore!.dead = 29.5;
    else s.gore!.injured = 29.5;
    return s;
  }

  it("calls the police for a death, the impact first and the body last", () => {
    const next = bookRun(createRescueBook(), ended(true), fresh());
    expect(next.rescue).toHaveLength(1);
    const call = next.rescue![0];
    expect(call.kind).toBe("police");
    expect(call.evidence![0].what).toBe("impact");
    expect(call.evidence![call.evidence!.length - 1].what).toBe("body");
  });

  it("never sends one machine to an injury and a death", () => {
    const book = createRescueBook();
    const s1 = bookRun(book, ended(true), fresh());
    s1.t = 20;
    s1.gore!.injured = 10;
    standSkier(s1, fell.x + 3, fell.z, fell.heading);
    const s2 = bookRun(book, s1, fresh());
    expect(s2.rescue).toHaveLength(2);
    expect(s2.rescue!.map((c) => c.kind ?? "ambulance")).toEqual(["police", "ambulance"]);
    expect(s2.rescue!.every((c) => c.casualties.length === 1)).toBe(true);
  });

  it("reads blood, torn pieces and thrown skis as evidence off the run", () => {
    const s = ended(true);
    s.gore!.smears.push({
      what: "limb",
      point: 0,
      t: 29,
      x: fell.x + 6,
      y: level.groundAt(fell.x + 6, fell.z) + 1,
      z: fell.z,
      nx: 1,
      ny: 0,
      nz: 0,
      cx: fell.x + 5.8,
      cz: fell.z,
      r: 0.2,
    });
    const g = level.groundAt(fell.x, fell.z - 8);
    s.gore!.torn.push({
      piece: "armL",
      t: 29,
      x: fell.x,
      y: g + 1,
      z: fell.z - 8,
      vx: 0,
      vy: 2,
      vz: -4,
    });
    const ev = evidenceOf(s, fell, { x: fell.x - 12, z: fell.z });
    expect(ev.map((e) => e.what).sort()).toEqual(["blood", "body", "impact", "piece"]);
    const piece = ev.find((e) => e.what === "piece")!;
    expect(piece.z).toBeLessThan(fell.z - 8);
  });
});
