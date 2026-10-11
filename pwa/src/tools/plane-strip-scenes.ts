// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIRSTRIP SHEETS of the jump plane lab (`plane-scenes.ts`): the strip
// the plane flies from as drawn (`strip-view.ts` over the engine's
// `stripSiteOf`) — from the air on the approach and overhead, from the
// village, at a skier's eye down the runway, the hangar, the fuel shed,
// the hut and the windsock close, the plane parked on the apron — by day
// (`airstrip`) and after dark (`airstrip-night`). Every lens is planted off
// the strip's own frame, so the same views read on any seed or face.

import {
  stripPoint,
  stripSiteOf,
  villageOf,
  type GameState,
  type Level,
  type StripBuildingKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import type { Stage } from "./plane-scenes.ts";

type At = { x: number; y: number; z: number };

/** A lens from `eye` to `target`, the eye kept over the snow. */
function lens(level: Level, eye: At, target: At, fov = 45): LensPose {
  const floor = level.groundAt(eye.x, eye.z) + 1.2;
  return { eye: { ...eye, y: Math.max(eye.y, floor) }, target, fov, roll: 0 };
}

/** A point of the strip's frame `up` m over the snow there. */
function onStrip(level: Level, along: number, across: number, up: number): At {
  const s = stripSiteOf(level).strip;
  const p = stripPoint(s, along, across);
  return { x: p.x, y: level.groundAt(p.x, p.z) + up, z: p.z };
}

/** A lens on a building of `kind`: from `out` m in front of it, `side` m
 * along its front, `up` m over its floor. */
function onBuilding(
  level: Level,
  kind: StripBuildingKind[],
  out: number,
  side: number,
  up: number,
  fov = 45,
): LensPose | null {
  const b = stripSiteOf(level).buildings.find((k) => kind.includes(k.kind));
  if (!b) return null;
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  const ex = b.x + fx * (b.depth / 2 + out) + fz * side;
  const ez = b.z + fz * (b.depth / 2 + out) - fx * side;
  return lens(
    level,
    { x: ex, y: b.floor + up, z: ez },
    { x: b.x, y: b.floor + b.eave * 0.45, z: b.z },
    fov,
  );
}

/** The views of the strip on `state`'s map. */
function shots(st: Stage, s: GameState, night: boolean): void {
  const level = s.level;
  const site = stripSiteOf(level);
  const strip = site.strip;
  const half = strip.length / 2;
  const side = site.side;
  // The landing comes in over the threshold: the approach lens behind it.
  const th = strip.land.threshold;
  const lx = Math.sin(strip.land.heading);
  const lz = Math.cos(strip.land.heading);
  const mid = onStrip(level, 0, 0, 0);
  st.shoot(
    s,
    "approach",
    lens(
      level,
      { x: th.x - lx * 420, y: th.y + 55, z: th.z - lz * 420 },
      { x: th.x + lx * 150, y: th.y, z: th.z + lz * 150 },
      40,
    ),
  );
  if (!night) {
    st.shoot(
      s,
      "overhead",
      lens(level, onStrip(level, -60, side * 120, 420), onStrip(level, -20, side * 15, 0), 50),
    );
  }
  // From the village, as a skier stands in its square.
  const v = villageOf(level);
  if (v) {
    const c = v.centre;
    const cy = level.groundAt(c.x, c.z);
    st.shoot(
      s,
      "from village",
      lens(level, { x: c.x, y: cy + 30, z: c.z }, { x: mid.x, y: mid.y + 2, z: mid.z }, 38),
    );
  }
  // At a skier's eye on the runway's end, looking down it.
  st.shoot(
    s,
    "down runway",
    lens(level, onStrip(level, -half - 8, 0, 1.7), onStrip(level, -half + 120, 0, 1.2), 55),
  );
  // The apron: the plane parked beside the hangar.
  st.shoot(
    s,
    "apron",
    lens(
      level,
      onStrip(level, -half + 55, side * 10, 3.5),
      onStrip(level, -half + 10, side * 24, 2.5),
      55,
    ),
  );
  const hangar = onBuilding(level, ["hangar", "leanTo"], 14, 9, 3, 55);
  if (hangar) st.shoot(s, "hangar", hangar);
  if (!night) {
    const fuel = onBuilding(level, ["fuel"], 4.5, 5, 1.7, 55);
    if (fuel) st.shoot(s, "fuel shed", fuel);
    const hut = onBuilding(level, ["hut"], 6, -8, 1.7, 55);
    if (hut) st.shoot(s, "hut", hut);
  }
  const sock = site.sock;
  const sockOff = onStrip(level, 0, 0, 0);
  const dx = sockOff.x - sock.x;
  const dz = sockOff.z - sock.z;
  const d = Math.hypot(dx, dz) || 1;
  st.shoot(
    s,
    "windsock",
    lens(
      level,
      { x: sock.x + (dx / d) * 9, y: sock.y + 3.5, z: sock.z + (dz / d) * 9 },
      { x: sock.x, y: sock.y + 5, z: sock.z },
      50,
    ),
  );
}

export const STRIP_VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  airstrip(st) {
    const s = st.fresh();
    st.run(s, 0.5);
    shots(st, s, false);
  },
  async "airstrip-night"(st) {
    await st.sky({ hour: 21, weather: "clear" });
    const s = st.fresh();
    st.run(s, 0.5);
    shots(st, s, true);
    await st.sky(null);
  },
};

export const STRIP_SHEET = ["airstrip", "airstrip-night"] as const;
