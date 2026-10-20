// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTORS AND BALLOONS' TABLE (`make army-flight ARGS=--table=air`):
// the army's air beside its helicopters (`engine/game/army-air.ts`) hunting
// a man off the real engine on a real map, a row a star and a quarry. The
// columns are `scripts/army-flight.mjs`' header's. Reads nothing the engine
// does not publish, so a tree without the air prints its rows at nought —
// the before of the change that brought it.

import process from "node:process";

const f = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const pct = (xs, p) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

/** The rest of the roster held back: the air's own hunt. */
function holdBack(E) {
  for (const row of E.WANTED.roster) {
    row.gunners = 0;
    row.soldiers = 0;
    row.lifted = 0;
    row.snowmobiles = 0;
  }
  for (const row of E.WANTED.waves) {
    if (!row) continue;
    for (const k of Object.keys(row.base)) {
      row.base[k] = 0;
      row.grow[k] = 0;
      row.cap[k] = 0;
    }
  }
}

export function airTable(E, level, args, list) {
  const dt = E.TUNING.dt;
  if (args.alone) holdBack(E);
  const paras = E.armyParas ?? (() => []);
  const balloons = E.armyBalloons ?? (() => []);
  const quarries =
    args.quarry === "skier,heli" ? ["skier", "still", "chase"] : list(args.quarry);
  const rows = [];
  const trunks = [];
  for (const quarry of quarries) {
    for (const stars of list(args.stars).map(Number)) {
      const chase = quarry === "chase";
      const s = E.createGame({
        level,
        seed: args.seed,
        mode: "free",
        quiet: true,
        crowd: 0,
        gore: !args.sfw,
        sfw: args.sfw,
        ...(chase ? { heli: true } : {}),
      });
      if (chase) {
        for (let i = 0; i < 6 / dt; i++)
          E.step(s, E.pilotInput(s, { x: s.heli.x, z: s.heli.z, height: 120 }));
      } else for (let i = 0; i < 4 / dt; i++) E.step(s, E.botInput(s));
      E.setWanted(s, stars);
      const t0 = s.t;
      const row = {
        quarry,
        stars,
        paras: 0,
        parasAtOnce: 0,
        balloons: 0,
        balloonsAtOnce: 0,
        first: NaN,
        contact: NaN,
        bursts: 0,
        rockets: 0,
        near: 0,
        thrown: 0,
        knocked: 0,
        downed: 0,
        lost: 0,
        snow: Infinity,
        crowns: Infinity,
        dead: NaN,
        arrested: NaN,
        ms: NaN,
        ms99: NaN,
      };
      const costs = [];
      for (let i = 0; i < args.seconds / dt; i++) {
        let input;
        if (chase && s.heli?.rider && s.heli.mode !== "wreck") {
          // Over the nearest paramotor flying, its wash down on the wing; else hold.
          let aim = null;
          let best = Infinity;
          for (const p of paras(s)) {
            if (p.mode !== "fly") continue;
            const d = Math.hypot(p.x - s.heli.x, p.z - s.heli.z);
            if (d < best) {
              best = d;
              aim = p;
            }
          }
          input = aim
            ? E.pilotInput(s, {
                x: aim.wing.x,
                z: aim.wing.z,
                height: Math.max(15, aim.wing.y - level.groundAt(aim.wing.x, aim.wing.z) + 8),
              })
            : E.pilotInput(s, { x: s.heli.x, z: s.heli.z, height: 120 });
        } else input = quarry === "still" ? E.NEUTRAL_INPUT : E.botInput(s);
        const c0 = process.hrtime.bigint();
        E.step(s, input);
        costs.push(Number(process.hrtime.bigint() - c0) / 1e6);
        const t = s.t - t0;
        const q = E.quarryOf(s);
        for (const e of s.events) {
          if (e.kind === "army-air") {
            if (e.change === "out") {
              if (e.craft === "paramotor") row.paras++;
              else row.balloons++;
              if (Number.isNaN(row.first)) row.first = t;
            }
            if ((e.change === "fire" || e.change === "rocket") && Number.isNaN(row.contact))
              row.contact = t;
            if (e.change === "fire") row.bursts++;
          }
          if (e.kind === "gunfire" && e.weapon === "rocket" && e.phase === "blast") {
            if (Math.hypot(e.x - q.x, e.y - q.y, e.z - q.z) < E.WEAPONS.rocket.throw) row.near++;
          }
          if (e.kind === "wipeout" && e.cause === "blast") row.thrown++;
          if (e.kind === "soldier" && e.change === "arrest" && Number.isNaN(row.arrested))
            row.arrested = t;
        }
        let flying = 0;
        for (const p of paras(s)) {
          if (p.mode !== "fly" && p.mode !== "leave") continue;
          flying++;
          row.snow = Math.min(row.snow, p.y - level.groundAt(p.x, p.z));
          for (const j of E.treesNear(level, p.wing.x, p.wing.z, 8, trunks)) {
            const tr = level.trees[j];
            if (Math.hypot(tr.x - p.wing.x, tr.z - p.wing.z) < tr.crown + 4)
              row.crowns = Math.min(row.crowns, p.y - (tr.y + tr.height));
          }
        }
        row.parasAtOnce = Math.max(row.parasAtOnce, flying);
        row.balloonsAtOnce = Math.max(
          row.balloonsAtOnce,
          balloons(s).filter((m) => m.mode === "fly" || m.mode === "leave").length,
        );
        if (Number.isNaN(row.dead) && s.gore && s.gore.dead >= 0) row.dead = t;
        if (!s.wanted) break;
      }
      const air = s.army?.air;
      if (air) {
        row.rockets = air.rockets;
        row.knocked = air.knocked;
        row.downed = air.parasDowned;
        row.lost = air.parasLost + air.balloonsLost;
      }
      row.ms = costs.reduce((a, b) => a + b, 0) / Math.max(1, costs.length);
      row.ms99 = pct(costs, 0.99);
      rows.push(row);
    }
  }
  console.log(
    `seed ${args.seed}, ${args.seconds} s a hunt, ${args.sfw ? "SAFE FOR WORK" : "INJURIES on"}${args.alone ? ", the air alone" : ""}\n`,
  );
  console.log(
    "| Quarry | Stars | Paramotors (most at once) | Balloons (most at once) | First in, s | First contact, s | Rifle bursts | Rockets | Burst near him | Thrown | Vehicles knocked out | Brought down | Lost by mistake | Least over snow / crowns, m | Dead, s | Arrested, s | Step, ms (p99) |",
  );
  console.log(
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const r of rows) {
    console.log(
      `| ${r.quarry} | ${r.stars} | ${r.paras} (${r.parasAtOnce}) | ${r.balloons} (${r.balloonsAtOnce}) | ${f(r.first)} | ${f(r.contact)} | ${r.bursts} | ${r.rockets} | ${r.near} | ${r.thrown} | ${r.knocked} | ${r.downed} | ${r.lost} | ${f(r.snow, 1)} / ${f(r.crowns, 1)} | ${f(r.dead)} | ${f(r.arrested)} | ${f(r.ms, 3)} (${f(r.ms99, 3)}) |`,
    );
  }
  return rows;
}
