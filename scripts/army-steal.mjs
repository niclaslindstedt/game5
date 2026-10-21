// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S MACHINES TAKEN, DRIVEN BY A SCRIPT (`engine/game/armour.ts`,
// `army-steal.ts`) — Node, a row a machine on a generated mountain: a
// carrier, a truck and a tank of the hunt's ground waves stood on the piste
// a little way down from him, and one of the hunt's helicopters set down
// beside him. Each is taken with the machine press at its door (the heat it
// raised, the stars after), then a scripted driver takes it a distance: the
// ground vehicles down the piste on the tuck, the edge laid toward a point
// of the piste ahead (`trackPointAt`), backed out on the skid whenever it
// stands still with the tuck held; the helicopter up off the snow on the
// collective, held at a height over the ground and flown forward on the
// cyclic. What the table reads: the metres made good, the top and mean
// pace, the seconds stood still with the throttle open, the times backed
// out, the most it climbed — and STUCK, which must read "no" on every row.
// The hunt's own men, machines and waves are held back for the drive, so
// what is measured is the machine he took on the mountain under it.
//
//   node scripts/army-steal.mjs
//   node scripts/army-steal.mjs --seed=7 --seconds=90 --at=0.3
//   node scripts/army-steal.mjs --json=previews/army-steal.json

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    seconds: { kind: "number", default: 60, help: "how long each machine is driven, s" },
    at: {
      kind: "number",
      default: 0.25,
      help: "where on the piste the machines stand, as a share of its length",
    },
    kinds: {
      kind: "string",
      default: "carrier,truck,tank,heli",
      help: "the machines: carrier, truck, tank, heli",
    },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
  },
  "usage: node scripts/army-steal.mjs [--seed=n] [--seconds=s] [--at=share] [--kinds=a,b] [--json=FILE]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));

const dt = E.TUNING.dt;
const level = E.generateLevel(args.seed);
const kinds = args.kinds
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

// THE HUNT HELD BACK: no door gunners, soldiers, lifts, snowmobiles, air
// or waves of its own — only the machine the row stands for him.
for (const r of E.WANTED.roster) {
  r.gunners = 0;
  r.soldiers = 0;
  r.lifted = 0;
  r.snowmobiles = 0;
  r.paramotors = 0;
  r.balloons = 0;
}
E.WANTED.waves.fill(null);

const ask = (o = {}) => ({ ...E.NEUTRAL_INPUT, ...o });

/** A hunt at three stars, him stood on the piste at `share` of its length. */
function hunted() {
  const s = E.createGame({ level, seed: args.seed, mode: "free", quiet: true, crowd: 0 });
  E.setWanted(s, 3);
  E.step(s, E.NEUTRAL_INPUT);
  const p = E.trackPointAt(level, level.track.length * args.at);
  E.standSkier(s, p.x, p.z, p.heading);
  E.step(s, E.NEUTRAL_INPUT);
  return s;
}

/** One vehicle of `kind` called and stood on the piste 30 m down from him,
 * facing down it, empty and still — the state a wave's leaves one in. */
function standing(s, kind) {
  const from = E.nearestTrackPoint(level, s.skier.x, s.skier.z);
  const p = E.trackPointAt(level, from.s + 30);
  const mix = {
    snowmobiles: 0,
    foot: 0,
    tracked: kind === "carrier" ? 1 : 0,
    trucks: kind === "truck" ? 1 : 0,
    tanks: kind === "tank" ? 1 : 0,
  };
  const down = [
    { x: p.x, z: p.z, w: 12 },
    { x: p.x + 400 * Math.sin(p.heading), z: p.z + 400 * Math.cos(p.heading), w: 12 },
  ];
  E.callVehicles(s, s.army, s.wanted, mix, 0, down, [0, 400], 0, []);
  const v = s.army.vehicles.at(-1);
  Object.assign(v, {
    mode: kind === "tank" ? "halt" : "park",
    due: 0,
    t: 0,
    x: p.x,
    z: p.z,
    y: level.groundAt(p.x, p.z),
    heading: p.heading,
    rear: p.heading,
    speed: 0,
    aboard: 0,
    next: Infinity,
  });
  return v;
}

/** The press at the door: the heat and the stars it raised, whether it took. */
function take(s, door) {
  E.standSkier(s, door.x, door.z, s.skier.heading);
  const heat = s.wanted.heat;
  const offered = E.stealWithin(s);
  E.step(s, ask({ machine: true }));
  const stole = s.events.some((e) => e.kind === "steal");
  return {
    offered: offered?.kind ?? "—",
    stole,
    heat: s.wanted.heat - heat,
    stars: s.wanted.stars,
  };
}

function groundRow(kind) {
  const s = hunted();
  const v = standing(s, kind);
  const row = { kind, ...take(s, E.armourDoor(v)) };
  const b = s.armour?.body;
  if (!b || !s.armour.rider) return { ...row, metres: 0, stuck: "not taken" };
  const x0 = b.x;
  const z0 = b.z;
  const y0 = b.y;
  let top = 0;
  let still = 0;
  let stillMost = 0;
  let backing = 0;
  let backs = 0;
  let path = 0;
  let climb = 0;
  for (let i = 0; i < args.seconds / dt; i++) {
    const px = b.x;
    const pz = b.z;
    const here = E.nearestTrackPoint(level, b.x, b.z);
    const aim = E.trackPointAt(level, here.s + 40);
    const want = Math.atan2(aim.x - b.x, aim.z - b.z);
    const turn = E.angleDiff(b.heading, want);
    let input;
    if (backing > 0) {
      backing -= dt;
      input = ask({ brake: 1, steer: turn > 0 ? -1 : 1 });
    } else {
      input = ask({ tuck: 1, steer: Math.max(-1, Math.min(1, turn * 2)) });
    }
    E.step(s, input);
    const moved = Math.hypot(b.x - px, b.z - pz);
    path += moved;
    top = Math.max(top, Math.abs(b.speed));
    climb = Math.max(climb, b.y - y0);
    if (backing <= 0 && moved / dt < 0.5) {
      still += dt;
      stillMost = Math.max(stillMost, still);
      if (still > 2) {
        backing = 2;
        backs++;
        still = 0;
      }
    } else if (backing <= 0) still = 0;
  }
  const metres = Math.hypot(b.x - x0, b.z - z0);
  return {
    ...row,
    metres,
    path,
    top: top * 3.6,
    mean: (path / args.seconds) * 3.6,
    stillMost,
    backs,
    climb,
    dead: s.armour.dead,
    stuck: metres < 100 ? "STUCK" : "no",
  };
}

function heliRow() {
  const s = hunted();
  // The hunt's first machine, set down 30 m to his side as a landing
  // leaves one.
  const m = s.army?.helis[0];
  if (!m) return { kind: "heli", offered: "—", stole: false, metres: 0, stuck: "no machine" };
  // The flattest open snow within 200 m, as the army's own landing picks a
  // site a few degrees off level with no crown over the disc
  // (`army-land.ts`), the machine stood on its lean.
  const c = s.skier;
  const n = { x: 0, y: 1, z: 0 };
  let site = null;
  for (let dx = -200; dx <= 200; dx += 6)
    for (let dz = -200; dz <= 200; dz += 6) {
      const x = c.x + dx;
      const z = c.z + dz;
      if (x < 60 || z < 60 || x > level.size - 60 || z > level.size - 60) continue;
      if (E.treesNear(level, x, z, 16, []).length) continue;
      level.normalAt(x, z, n);
      const lean = Math.acos(Math.min(1, n.y)) + Math.hypot(dx, dz) * 1e-5;
      if (!site || lean < site.lean) site = { x, z, lean, nx: n.x, ny: n.y, nz: n.z };
    }
  const heading = c.heading;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const pitch = Math.atan(-(site.nx * fx + site.nz * fz) / site.ny);
  const roll = Math.atan((site.nx * fz - site.nz * fx) / site.ny);
  const { x, z } = site;
  Object.assign(m, { phase: "set", x, z, y: level.groundAt(x, z), vx: 0, vy: 0, vz: 0 });
  Object.assign(m, { heading, pitch, roll, spool: 1 });
  const row = { kind: "heli", ...take(s, E.armyHeliDoor(m)) };
  const h = s.heli;
  if (!h?.rider || h.livery !== "army") return { ...row, metres: 0, stuck: "not taken" };
  const x0 = h.x;
  const z0 = h.z;
  const y0 = h.y;
  let top = 0;
  let path = 0;
  let climb = 0;
  let lost = false;
  let flew = 0;
  for (let i = 0; i < args.seconds / dt; i++) {
    const px = h.x;
    const pz = h.z;
    // Held 60 m over the higher of the snow under it and 80 m ahead, and
    // eased forward to 25 m/s once clear of it.
    const fx = Math.sin(h.heading);
    const fz = Math.cos(h.heading);
    const under = Math.max(level.groundAt(h.x, h.z), level.groundAt(h.x + 80 * fx, h.z + 80 * fz));
    const agl = h.y - under;
    const collective = Math.max(0, Math.min(1, 0.6 + (60 - agl) * 0.02 - h.vy * 0.1));
    const way = h.vx * fx + h.vz * fz;
    // The cyclic flown to an attitude: the nose down a little more the
    // slower it is (tips-up positive), the wings held level.
    const nose = agl > 30 ? Math.max(-0.25, Math.min(0.1, -0.05 - (25 - way) * 0.01)) : 0;
    const clip = (v) => Math.max(-1, Math.min(1, v));
    const pitch = clip((h.pitch - nose) * 3);
    const roll = clip(-h.roll * 3);
    E.step(s, ask({ heli: { collective, pitch, roll, pedal: 0 } }));
    if (s.heli !== h || h.mode !== "flown" || h.livery !== "army") {
      lost = true;
      break;
    }
    flew += dt;
    path += Math.hypot(h.x - px, h.z - pz);
    top = Math.max(top, Math.hypot(h.vx, h.vz));
    climb = Math.max(climb, h.y - y0);
  }
  const metres = Math.hypot(h.x - x0, h.z - z0);
  return {
    ...row,
    metres,
    path,
    top: top * 3.6,
    mean: (path / Math.max(dt, flew)) * 3.6,
    stillMost: 0,
    backs: 0,
    climb,
    dead: lost,
    stuck: metres < 100 || lost ? "STUCK" : "no",
  };
}

const rows = kinds.map((k) => (k === "heli" ? heliRow() : groundRow(k)));

const f = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : "—");
console.log(
  `seed ${args.seed}, the machines stood at ${f(args.at * 100)} % of the piste, ` +
    `${args.seconds} s a drive\n`,
);
console.log(
  "| machine | offered | stolen | heat + | stars | made good m | path m | top km/h | mean km/h | most still s | backed out | climbed m | knocked out | stuck |",
);
console.log(
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
);
for (const r of rows)
  console.log(
    `| ${r.kind} | ${r.offered} | ${r.stole ? "yes" : "no"} | ${f(r.heat, 2)} | ${f(r.stars)} | ` +
      `${f(r.metres)} | ${f(r.path)} | ${f(r.top)} | ${f(r.mean)} | ${f(r.stillMost, 1)} | ` +
      `${f(r.backs)} | ${f(r.climb)} | ${r.dead ? "yes" : "no"} | ${r.stuck} |`,
  );

if (args.json) {
  mkdirSync(dirname(args.json), { recursive: true });
  writeFileSync(args.json, JSON.stringify(rows, null, 2));
}
if (rows.some((r) => r.stuck !== "no")) process.exitCode = 1;
