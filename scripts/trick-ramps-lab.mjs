#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICK RAMPS LAB — the free ride's ramps down every piste
// (`engine/mapgen/trick-ramps.ts`) on one seed: how many each run carries
// and of which kind, and then the first ramp of every kind RIDDEN by a skier
// stood in front of it at a ladder of speeds, straight at it, hands off —
// the angle he leaves the lip at, how high over the lip he gets, how long he
// is in the air and how far he flies, and what the landing does to him (the
// load in g, whether it was harsh, a wipeout). A steep lip is right when
// slow is short into its gap, and fast enough lands on the receiver whole.
// Pure Node over the engine: no build, no browser.
//
//   node scripts/trick-ramps-lab.mjs --seed=38
//   node scripts/trick-ramps-lab.mjs --seed=7 --speeds=8,12,16,20,24

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const E = await import(join(root, "engine/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the free ride's map" },
    region: { kind: "string", default: "alpine", help: "the kind of snow country (R21)" },
    speeds: {
      kind: "string",
      default: "8,12,16,20,24",
      help: "the speeds, m/s, the skier is stood in front of each ramp at",
    },
    run: { kind: "number", default: 20, help: "metres short of the ramp's foot he is stood" },
    radius: {
      kind: "number",
      default: 1,
      help: "try every take-off's transition at this multiple of its radius",
    },
  },
  "usage: npm run trick-ramps -- [--seed n] [--region id] [--speeds a,b,c] [--run m]",
);

for (const k of Object.values(E.TRICK_RAMPS.kinds)) k.radius *= args.radius;
const t0 = Date.now();
const base = E.generateLevel(args.seed, { region: args.region });
const built = Date.now() - t0;
const t1 = Date.now();
const level = E.setTrickRamps(base);
const laid = Date.now() - t1;
const ramps = (level.kickers ?? []).filter((k) => k.rampKind);
console.log(
  `seed ${args.seed}: ${ramps.length} ramps over ${level.resort.runs.filter((r) => r.kind === "piste").length} pistes (map ${built} ms, ramps ${laid} ms)`,
);
const kinds = Object.keys(E.TRICK_RAMPS.kinds);
console.log(`run  grade   length  ${kinds.map((k) => k.padStart(7)).join("")}`);
for (const r of level.resort.runs) {
  if (r.kind !== "piste") continue;
  const on = ramps.filter((k) => k.run === r.id);
  const n = kinds.map((k) => String(on.filter((x) => x.rampKind === k).length).padStart(7));
  console.log(
    `${r.id.padStart(3)}  ${r.grade.padEnd(6)} ${String(Math.round(r.length)).padStart(6)}  ${n.join("")}`,
  );
}

/** One ramp ridden from `v` m/s, straight at it. */
function ride(k, v) {
  const state = E.createGame({
    level,
    mode: "free",
    trickRamps: true,
    quiet: true,
    crowd: 0,
    avalanche: false,
  });
  const fx = Math.sin(k.heading);
  const fz = Math.cos(k.heading);
  const back = k.ramp + args.run;
  E.placeRun(state, { x: k.x - fx * back, z: k.z - fz * back, heading: k.heading, speed: v });
  let lipV = null;
  let lipAngle = null;
  let apex = -Infinity;
  let air = 0;
  let land = null;
  let wipe = null;
  let off = 0;
  let lat = null;
  for (let i = 0; i < 120 * 8; i++) {
    // Held on the ramp's line until he leaves the snow, as a player
    // lining up for it would: the heading back towards the line.
    const s0 = state.skier;
    const across = (s0.x - k.x) * Math.cos(k.heading) - (s0.z - k.z) * Math.sin(k.heading);
    const err = Math.atan2(Math.sin(k.heading - s0.heading), Math.cos(k.heading - s0.heading));
    const steer = lipV === null ? Math.max(-1, Math.min(1, 2.5 * err - 0.15 * across)) : 0;
    E.step(state, { ...E.NEUTRAL_INPUT, steer });
    const c = state.skier;
    const u = (c.x - k.x) * fx + (c.z - k.z) * fz;
    if (lat === null && u > -k.ramp)
      lat = (c.x - k.x) * Math.cos(k.heading) - (c.z - k.z) * Math.sin(k.heading);
    if (c.airborne && lipV === null && u > -3) {
      const h = Math.hypot(c.vx, c.vz);
      lipV = Math.hypot(h, c.vy);
      lipAngle = (Math.atan2(c.vy, h) * 180) / Math.PI;
    }
    if (c.airborne && lipV !== null) apex = Math.max(apex, c.y - k.y);
    for (const e of state.events) {
      if (e.kind === "land" && lipV !== null && !land) {
        land = e;
        air = e.airTime;
        off = u;
      }
      if (e.kind === "wipeout" && !wipe) wipe = e.cause;
    }
    if ((land && i > 0 && state.t > air + 2) || wipe) break;
  }
  return { lipV, lipAngle, apex, air, land, wipe, off, lat };
}

const f = (x, d = 1, w = 6) => (x === null || !Number.isFinite(x) ? "—" : x.toFixed(d)).padStart(w);
const speeds = args.speeds.split(",").map(Number);
console.log(
  "\nkind     lip°   h m   v m/s  lip v  leave°  apex   air s  flew m  g     harsh  wipeout",
);
for (const kind of kinds) {
  const k = ramps.find((x) => x.rampKind === kind);
  if (!k) {
    console.log(`${kind.padEnd(8)} none laid`);
    continue;
  }
  {
    // Where to stand to look at it: the `--pose` of `make screenshots`.
    const back = k.ramp + 30;
    const px = k.x - Math.sin(k.heading) * back;
    const pz = k.z - Math.cos(k.heading) * back;
    // ...and from beside it, on the run's side, looking across at the gap.
    const run = level.resort.runs.find((r) => r.id === k.run);
    const mid = run.points.reduce((b, p) =>
      Math.hypot(p.x - k.x, p.z - k.z) < Math.hypot(b.x - k.x, b.z - k.z) ? p : b,
    );
    const rx = Math.cos(k.heading);
    const rz = -Math.sin(k.heading);
    const toRun = Math.sign((mid.x - k.x) * rx + (mid.z - k.z) * rz) || 1;
    const along = (E.TRICK_RAMPS.kinds[kind].gap || 4) / 2;
    const sx = k.x + rx * toRun * 24 + Math.sin(k.heading) * along;
    const sz = k.z + rz * toRun * 24 + Math.cos(k.heading) * along;
    const sh = k.heading + (toRun > 0 ? -Math.PI / 2 : Math.PI / 2);
    console.log(
      `${"".padEnd(8)} beside it: --pose ${sx.toFixed(1)},${sz.toFixed(1)},${sh.toFixed(3)},0`,
    );
    console.log(
      `${kind.padEnd(8)} ${k.id} on run ${k.run}: lip at ${k.x.toFixed(0)}, ${k.z.toFixed(0)} — look from --pose ${px.toFixed(1)},${pz.toFixed(1)},${k.heading.toFixed(3)},0`,
    );
  }
  for (const v of speeds) {
    const r = ride(k, v);
    console.log(
      `${kind.padEnd(8)} ${f(E.TRICK_RAMPS.kinds[kind].lip, 0, 4)} ${f(k.height, 1, 5)} ${f(v, 0, 7)} ${f(r.lipV, 1, 6)} ${f(r.lipAngle, 0, 7)} ${f(r.apex, 1, 6)} ${f(r.air, 2, 7)} ${f(r.off, 1, 7)} ${f(r.land?.g ?? null, 1, 5)}  ${r.land ? (r.land.harsh ? "  yes" : "   no") : "    —"}  ${r.wipe ?? ""}  at foot ${f(r.lat, 1, 5)} m across`,
    );
  }
}
