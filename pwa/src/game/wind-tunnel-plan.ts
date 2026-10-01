// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A WIND TUNNEL, AS A PLAN — the resort's horizontal lift along the valley
// floor: a lane a skier is blown down at the tunnel's own speed without
// skiing it, one each way. Three-free, so the suite holds the arithmetic
// (`tests/wind_tunnel_view_test.ts`) and the picture (`wind-tunnels.ts`),
// the minimap (`minimap-view.ts`) and the ear (`audio/tunnel-voice.ts`) all
// ask one place where a point on a tunnel is and whether a skier is in it.
//
// WHAT ONE LOOKS LIKE: a run of ARCHES over the lane every few metres with
// a translucent canopy over them — a ribbed half-pipe laid upside down on
// the snow — a ring of light inside each arch, CHEVRONS on the snow under
// it pointing the way the air goes, a FAN in a cowl at the entrance with a
// sign over it, and STREAKS of blown snow flying down the lane a little
// faster than a skier rides it, so the wind overtakes him. The two tunnels
// are told apart by colour; the way through either is the chevrons' and
// the streaks'.

import type { Level, WindTunnel } from "@engine";

/** One tunnel as the generator lays it (R30): the points from the entrance
 * to the exit every few metres on the snow (`s` the arc from the entrance,
 * `heading` the way the air goes — 0 is +z, clockwise from above), its plan
 * length, its lane's width and the speed it blows a skier at, m/s. */
export type { WindTunnel };

/** A point on a tunnel: where, how high the snow is, and the way the air
 * goes there. */
export type TunnelPoint = { x: number; y: number; z: number; heading: number };

/** The resort's tunnels, or none on a map that has no resort or no
 * tunnels in it. */
export function tunnelsOf(level: Level): readonly WindTunnel[] {
  return level.resort?.tunnels ?? [];
}

/** THE LOOK, m and s — a lane of 8–10 m roofed by an arch a little wider
 * than it, tall enough that a skier stood up on its floor is under a
 * third of it. */
export const TUNNEL_LOOK = {
  /** An arch every this many metres of the lane. */
  archEvery: 9,
  /** The arch stands this far outside the lane's edge, m. */
  archClear: 0.8,
  /** A chevron on the snow every this many metres. */
  chevronEvery: 12,
  /** The streaks fly this much faster than the tunnel carries a skier. */
  streakGain: 1.3,
  /** The fan's turns a second. Slow enough that twelve blades read as
   * blades rather than a strobe. */
  fanTurns: 1.1,
  /** How far before the entrance the fan's cowl stands, m. */
  fanBack: 2,
} as const;

/** HOW MUCH OF A LANE IS DRAWN, by its distance from the lens. A lane is
 * a kilometre and a half of arches; the full rhythm is only seen near,
 * where a skier rides through it, and the far ones are a line of lights.
 * So the arches stand at their full rhythm inside NEAR, every third out to
 * three NEARs, every sixth out to the wall, and none past it — each stride
 * a multiple of the nearer one, so an arch drawn far is still drawn as the
 * lens closes on it and nothing pops on the way in. NEAR is a share of the
 * DISTANCE row's wall (the mist `mistFor` closes on), so that row is the
 * one that buys the lanes' depth. */
export const TUNNEL_LOD = {
  /** NEAR, as a share of the wall, and its clamp, m. Under MEDIUM's 600 m
   * wall the full rhythm runs 90 m: three seconds ahead at a tunnel's pace,
   * past which a 9 m gap is a few pixels. */
  nearShare: 0.15,
  nearMin: 60,
  nearMax: 200,
  /** The strides, and the NEARs each band runs to; the last runs to the
   * wall. */
  strides: [1, 3, 6],
  bands: [1, 3],
  /** Under MAX's unmisted air, the wall an arch is drawn to at all, m: a
   * 5 m arch is two or three pixels there. */
  open: 1600,
  /** The chevrons on the snow and the blown streaks, drawn this many NEARs
   * out: flat on the snow or a few centimetres thick, they are gone first. */
  marks: 1.5,
} as const;

/** The two reaches a lane is drawn by under a wall `wall` m (0 is the
 * unmisted air): NEAR, and the farthest an arch stands. */
export function tunnelReach(wall: number): { near: number; far: number } {
  const far = wall > 0 ? wall : TUNNEL_LOD.open;
  const near =
    wall > 0
      ? Math.min(TUNNEL_LOD.nearMax, Math.max(TUNNEL_LOD.nearMin, wall * TUNNEL_LOD.nearShare))
      : TUNNEL_LOD.nearMax;
  return { near: Math.min(near, far), far };
}

/** The stride arches are drawn at `distance` m from the lens — every
 * `stride`th of a lane — or 0 where none is. */
export function archStride(distance: number, reach: { near: number; far: number }): number {
  if (distance > reach.far) return 0;
  const { strides, bands } = TUNNEL_LOD;
  for (let i = 0; i < bands.length; i++) if (distance <= reach.near * bands[i]) return strides[i];
  return strides[strides.length - 1];
}

/** The two directions' paints, sRGB: the first tunnel amber, the second
 * cyan — a lane read by its colour before its chevrons. */
export const TUNNEL_PAINT: readonly number[] = [0xff9a1f, 0x29d3ff];

/** A tunnel's paint by its place in the resort's list. */
export function tunnelPaint(index: number): number {
  return TUNNEL_PAINT[index % TUNNEL_PAINT.length];
}

/** The arch's radius over a tunnel's lane, m. */
export function archRadius(tunnel: WindTunnel): number {
  return tunnel.width / 2 + TUNNEL_LOOK.archClear;
}

/** The point `s` m along a tunnel from its entrance, interpolated between
 * its stations and clamped to its two ends; written into `out`. */
export function tunnelPointAt(
  tunnel: WindTunnel,
  s: number,
  out: TunnelPoint = { x: 0, y: 0, z: 0, heading: 0 },
): TunnelPoint {
  const pts = tunnel.points;
  if (pts.length === 0) return out;
  if (pts.length === 1 || s <= pts[0].s) {
    out.x = pts[0].x;
    out.y = pts[0].y;
    out.z = pts[0].z;
    out.heading = pts[0].heading;
    return out;
  }
  // Stations are evenly spaced as laid, so the guess lands on or next to
  // the right one; the walk settles it either way.
  const last = pts.length - 1;
  const step = (pts[last].s - pts[0].s) / last || 1;
  let i = Math.min(last - 1, Math.max(0, Math.floor((s - pts[0].s) / step)));
  while (i > 0 && pts[i].s > s) i--;
  while (i < last - 1 && pts[i + 1].s < s) i++;
  const a = pts[i];
  const b = pts[i + 1];
  const t = Math.min(1, Math.max(0, (s - a.s) / Math.max(1e-6, b.s - a.s)));
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  let dh = b.heading - a.heading;
  dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  out.heading = a.heading + dh * t;
  return out;
}

/** Where a point stands against a tunnel: its arc from the entrance, its
 * plan offset from the centreline (positive to the RIGHT of the way the air
 * goes), and whether it is in the lane. */
export type TunnelHit = {
  tunnel: WindTunnel;
  index: number;
  s: number;
  lateral: number;
  /** How far outside the lane the point is, m; 0 in it. */
  out: number;
  inside: boolean;
};

/** The tunnel a point is in, or the nearest one to it within `reach` m of
 * its lane's edge; null when none is that close. */
export function tunnelNear(level: Level, x: number, z: number, reach = 0): TunnelHit | null {
  let best: TunnelHit | null = null;
  let bestOut = Infinity;
  tunnelsOf(level).forEach((tunnel, index) => {
    const pts = tunnel.points;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      const len = Math.sqrt(len2);
      if (len <= 0) continue;
      const u = ((x - a.x) * dx + (z - a.z) * dz) / len2;
      const t = Math.min(1, Math.max(0, u));
      const px = a.x + dx * t;
      const pz = a.z + dz * t;
      // How far outside the lane, m — 0 inside: across it past its edge,
      // or along it, behind the entrance or beyond the exit.
      const across = Math.abs((x - a.x) * dz - (z - a.z) * dx) / len;
      const behind = i === 0 && u < 0 ? -u * len : 0;
      const beyond = i + 2 === pts.length && u > 1 ? (u - 1) * len : 0;
      const inner = i > 0 && u < 0 ? Math.hypot(x - a.x, z - a.z) : 0;
      const outer = i + 2 < pts.length && u > 1 ? Math.hypot(x - b.x, z - b.z) : 0;
      const side = Math.max(inner, outer, across) - tunnel.width / 2;
      const out = Math.max(side, behind, beyond, 0);
      if (out >= bestOut) continue;
      bestOut = out;
      // The right of a heading h is (cos h, −sin h) in (x, z).
      const h = Math.atan2(dx, dz);
      best = {
        tunnel,
        index,
        s: a.s + (b.s - a.s) * t,
        lateral: (x - px) * Math.cos(h) - (z - pz) * Math.sin(h),
        out,
        inside: out === 0,
      };
    }
  });
  return bestOut <= reach ? best : null;
}

/** The tunnel a skier at (x, z) is being blown down, or null. */
export function tunnelUnder(level: Level, x: number, z: number): TunnelHit | null {
  const hit = tunnelNear(level, x, z);
  return hit?.inside ? hit : null;
}

/** Every `every` m along a tunnel from `from`, the arcs a mark stands at —
 * its ends included where `ends` asks. */
export function marksAlong(length: number, every: number, from = 0, ends = false): number[] {
  const out: number[] = [];
  if (ends) out.push(0);
  for (let s = from; s < length - 1e-6; s += every) if (!ends || s > 1e-6) out.push(s);
  if (ends && length > 0) out.push(length);
  return out;
}

/** Where a streak `phase` (0..1 of the lane) has been carried to at `t` s:
 * its arc on the tunnel, wrapped so it enters at the fan again once it
 * leaves the exit. */
export function streakArc(tunnel: WindTunnel, phase: number, t: number): number {
  const len = Math.max(1, tunnel.length);
  const s = phase * len + t * tunnel.speed * TUNNEL_LOOK.streakGain;
  return ((s % len) + len) % len;
}

/** The fan's turn at `t` s, rad. */
export function fanAngle(t: number): number {
  return (t * TUNNEL_LOOK.fanTurns * Math.PI * 2) % (Math.PI * 2);
}
