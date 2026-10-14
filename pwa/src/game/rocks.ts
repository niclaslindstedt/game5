// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK AS DRAWN — the drops' rock (`rock-shapes.ts`): the engine's rock
// field over every wall too steep for snow, triangulated ADAPTIVELY a tile
// at a time, and every rocky cliff's wall (`cliffWalls`): one draw a tile,
// BUILT ONLY WHEN IT FIRST COMES WITHIN REACH, so a phone never holds the
// rock of a face it never sees. The building is SLICED — the field's
// samples a row at a time, the mesh's errors a thousand triangles at a time
// — for at most `SLICE` ms a frame, so riding toward a rocky face never
// hitches; only the tiles round the lens itself are built whole at once.
// The reach is the DISTANCE row's whole view: a far or high lens looks at
// the walls from across the valley. Past it the snow shader's dark rock
// carries them to the rim.
//
// A TILE IS BUILT AT THE CUT ITS DISTANCE ASKS (`CUTS`): a grid of 1 m and
// a few cm of tolerance near the lens (the surface the physics rides,
// `rock-ground.ts`, within a hair), coarser grids and looser tolerances out
// past each band. Each cut GEOMORPHS into the next over the last stretch
// before its band's edge (`MORPH`), so when a tile changes cut — only past
// a margin, `HYSTERESIS`, so riding to and fro never rebuilds it — the
// coarser cut takes over exactly where the finer one had slid to.
//
// CULLED beyond the frustum: a tile hidden behind the ridge between it and
// the lens (the HORIZON, marched over the map's ground) or facing wholly
// away from it (its normals' CONE) is not drawn. The whole thing hangs off
// the forest (`forest.ts`), which owns the woods' reach.

import * as THREE from "three";
import {
  ROCK_FIELD,
  cliffWalls,
  noRockIn,
  regionOf,
  rockFieldOf,
  type CliffWall,
  type Level,
} from "@engine";

import { PAST_THE_WALL, hazeMaterial, type HazeUniforms } from "./haze.ts";
import { regionLookOf } from "./region-look.ts";
import {
  SNOW_HOLDS,
  SNOW_SLIDES,
  buildWall,
  rockMesh,
  startTile,
  stepTile,
  type RockMesh,
  type TileBuild,
} from "./rock-shapes.ts";
import { summerShown } from "./season-look.ts";

/** A tile's side, m: the rock field's own. */
const TILE = ROCK_FIELD.tile;
/** The building's share of a frame, ms. */
const SLICE = 1.5;
/** Within this of the lens a tile is built whole at once, whatever it
 * costs, m: a crag appearing that close would be seen. */
const NOW = 110;
/** How far past the reach a built tile is kept, m, before it is let go. */
const KEEP = 2 * TILE;
/** The cuts by distance from the lens to a tile's nearest corner: out to
 * `out` m a grid of `step` m at a tolerance of `tol` m. The first is the
 * physics' own grid (`ROCK_FIELD.fine`). */
export const CUTS = [
  { out: 50, step: ROCK_FIELD.fine, tol: 0.015 },
  { out: 180, step: 2 * ROCK_FIELD.fine, tol: 0.3 },
  { out: 700, step: 4 * ROCK_FIELD.fine, tol: 0.8 },
  { out: Infinity, step: 8 * ROCK_FIELD.fine, tol: 3 },
] as const;
/** How far past a band's edge a tile must be before it changes cut, m. */
const HYSTERESIS = 30;
/** Over how much of the way to its band's edge (less the margin) a cut
 * slides onto the next, m. */
const MORPH = 90;

/** The cut a tile `d` m off wants, given the one it has (`had`, or -1). */
export function cutOf(d: number, had: number): number {
  let k = CUTS.findIndex((c) => d < c.out);
  if (had >= 0 && k !== had) {
    // Only past the margin: a coarser cut once `HYSTERESIS` beyond the
    // edge, a finer one once as far inside it.
    const edge = k > had ? CUTS[had].out + HYSTERESIS : CUTS[k].out - HYSTERESIS;
    if (k > had ? d < edge : d > edge) k = had;
  }
  return k;
}

/** THE ROCK CALMED WITH DISTANCE: from `CALM_FROM` m to `CALM_TO` m off the
 * lens every vertex's paint eases to the rock's mean, so a far face keeps
 * its shape and its snow and loses the shade-to-shade detail a pixel
 * cannot hold — it would twinkle as the lens moves. */
const CALM_FROM = 250;
const CALM_TO = 900;

/** AND PULLED TOWARD THE LENS, IN DEPTH ALONE: `PULL` m for every metre
 * past `PULL_FROM` it stands off, out to `PULL_MOST` m. The skin stands a
 * hand proud of the snow, but the depth buffer tells two surfaces apart
 * ever more coarsely the further they are and the snow under it is drawn
 * coarser too, so far out the two fight over the same pixels. Moved along
 * the ray to the eye, a vertex stays on its pixel; only the depth test
 * changes, and the rock wins it against snow that close behind. */
const PULL = 0.004;
const PULL_FROM = 30;
const PULL_MOST = 12;

const f1 = (v: number): string => v.toFixed(1);
const f3 = (v: number): string => v.toFixed(3);

/** The rock's material for cut `k`: the slide onto the next cut, the snow
 * on what faces the sky, the beds banded and the streaks down the face. */
function rockMaterial(
  k: number,
  haze: HazeUniforms,
  mean: readonly number[],
  thick: number,
): THREE.Material {
  const cut = CUTS[k];
  const last = k === CUTS.length - 1;
  const m1 = last ? 1e9 : cut.out - HYSTERESIS;
  const m0 = last ? 1e9 : Math.max(0.5 * cut.out, m1 - MORPH);
  const summer = summerShown();
  const cover = summer ? [0.15, 0.17, 0.1] : [0.86, 0.89, 0.94];
  const most = summer ? 0.5 : 1;
  // How much of the ledges this cut and the next draw as a slab (the field
  // eases them away where they are finer than a cut's grid): that much is
  // painted on instead — the snow on each tread a band across the face.
  const painted = (j: number): number => (j <= 0 ? 0 : j === 1 ? 0.4 : 1);
  const paintNow = painted(k);
  const paintNext = painted(Math.min(k + 1, CUTS.length - 1));
  const riser = ROCK_FIELD.bed.riser;
  const head = /* glsl */ `
attribute vec4 morph;
attribute vec3 mcol;
attribute float phi;
varying float vRockPhi;
varying float vRockSnow;
varying float vRockD;
varying float vRockPaint;
`;
  const colour = /* glsl */ `
#include <color_vertex>
vec3 rockW = (modelMatrix * vec4(position, 1.0)).xyz;
float rockD = distance(rockW, cameraPosition);
float rockMorph = smoothstep(${f1(m0)}, ${f1(m1)}, rockD);
vec3 rockN = normalize(mix(normal, morph.yzw, rockMorph));
vColor.xyz = mix(mix(color.xyz, mcol, rockMorph), vec3(${mean.map(f3).join(", ")}),
  smoothstep(${f1(CALM_FROM)}, ${f1(CALM_TO)}, rockD));
vRockSnow = ${f1(most)} * smoothstep(${f3(SNOW_SLIDES)}, ${f3(SNOW_HOLDS)}, rockN.y);
vRockPhi = phi;
vRockD = rockD;
vRockPaint = mix(${f3(paintNow)}, ${f3(paintNext)}, rockMorph);
`;
  const normalChunk = /* glsl */ `
vec3 objectNormal = rockN;
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`;
  const begin = /* glsl */ `
vec3 transformed = vec3(position.x, mix(position.y, morph.x, rockMorph), position.z);
`;
  const project = /* glsl */ `
#include <project_vertex>
{
  float rockPd = length(mvPosition.xyz);
  float rockPull = clamp((rockPd - ${f1(PULL_FROM)}) * ${PULL.toFixed(4)}, 0.0, ${f1(PULL_MOST)});
  gl_Position = projectionMatrix * vec4(mvPosition.xyz * (1.0 - rockPull / max(rockPd, 1.0)), 1.0);
}
`;
  // The beds' partings and the wet streaks down the face, each faded out
  // where a pixel spans more than a band.
  const fragHead = /* glsl */ `
varying float vRockPhi;
varying float vRockSnow;
varying float vRockD;
varying float vRockPaint;
float rockHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rockNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rockHash(i), rockHash(i + vec2(1.0, 0.0)), f.x),
    mix(rockHash(i + vec2(0.0, 1.0)), rockHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;
  const fragColour = /* glsl */ `
#include <color_fragment>
{
  float bandW = fwidth(vRockPhi);
  float beds = vRockPhi / 0.55;
  float parting = 1.0 - smoothstep(0.0, 0.12, abs(fract(beds) - 0.5) - 0.38);
  float thick = rockNoise(vec2(floor(beds) * 0.37, 3.1));
  float bandFade = 1.0 - smoothstep(0.04, 0.2, bandW);
  float streakFade = 1.0 - smoothstep(60.0, 260.0, vRockD);
  float streak = rockNoise(vHazeWorld.xz * vec2(0.55, 0.55) + vec2(vRockPhi * 0.015));
  // The snow lies on what a FACET turns to the sky, decided a pixel at a
  // time off the drawn triangle itself: read off the corners' normals it
  // would run down a riser in a point from every snowy lip. Far out the
  // facets are calmed to the ground's normal and so is the snow.
  vec3 rockFacet = normalize(cross(dFdx(vHazeWorld), dFdy(vHazeWorld)));
  float rockSnow = mix(${f1(most)} * smoothstep(${f3(SNOW_SLIDES)}, ${f3(SNOW_HOLDS)}, abs(rockFacet.y)),
    vRockSnow, smoothstep(${f1(CALM_FROM)}, ${f1(CALM_TO)}, vRockD));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${cover.map(f3).join(", ")}), rockSnow);
  float rockOnly = 1.0 - rockSnow;
  float k = 1.0;
  k *= mix(1.0, 0.82 + 0.3 * thick, bandFade * rockOnly);
  k *= mix(1.0, 1.0 - 0.15 * parting, bandFade * rockOnly);
  k *= mix(1.0, 0.8 + 0.35 * streak, streakFade * rockOnly);
  diffuseColor.rgb *= k;
  // The ledges painted where the slab stands for them: a band of snow on
  // each tread over the lip, the riser under it dark, faded where a pixel
  // spans a ledge.
  float ledge = vRockPhi / ${f3(thick)};
  float ledgeW = fwidth(ledge);
  float s = fract(ledge);
  float tread = smoothstep(${f3(riser)}, ${f3(riser + 0.04)}, s)
    * (1.0 - smoothstep(${f3(riser + 0.3)}, ${f3(riser + 0.42)}, s));
  float riserDark = 1.0 - smoothstep(0.0, ${f3(riser)}, s);
  // Broken along the strike: a ledge holds snow in stretches, as a real
  // one does where it is wide enough, and the stretches differ bed to bed.
  float held = smoothstep(0.35, 0.75, rockNoise(vHazeWorld.xz * 0.035 + vec2(floor(ledge) * 7.3, 0.0)));
  float paint = vRockPaint * (1.0 - smoothstep(0.2, 0.5, ledgeW)) * rockOnly;
  diffuseColor.rgb *= 1.0 - 0.18 * riserDark * paint;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${cover.map(f3).join(", ")}), ${f1(most)} * 0.6 * held * tread * paint);
}
`;
  return hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    haze,
    `rock${k}${summer ? "s" : ""}`,
    (shader) => {
      PAST_THE_WALL(shader);
      shader.vertexShader = (head + shader.vertexShader)
        .replace("#include <color_vertex>", colour)
        .replace("#include <beginnormal_vertex>", normalChunk)
        .replace("#include <begin_vertex>", begin)
        .replace("#include <project_vertex>", project);
      shader.fragmentShader = (fragHead + shader.fragmentShader).replace(
        "#include <color_fragment>",
        fragColour,
      );
    },
  );
}

export type Rocks = {
  readonly group: THREE.Group;
  /** Show what is within `reach` m of the lens, building what is new. */
  update(eye: THREE.Vector3, reach: number): void;
  dispose(): void;
};

type Tile = {
  readonly cx: number;
  readonly cz: number;
  readonly x0: number;
  readonly z0: number;
  /** The cliffs' rock walls whose middle is on it. */
  readonly walls: CliffWall[];
  /** Whether no wall's rock stands on it at all (never built). */
  readonly bare: boolean;
  /** The build under way and its cut. */
  part: TileBuild | null;
  building: number;
  /** What is on screen, and its cut (-1 for none). */
  mesh: THREE.Mesh | null;
  cut: number;
  /** Its highest rock, m, and its normals' cone (axis, half-angle's sin
   * and cos; `coneCos` −1 where it faces every way). */
  top: number;
  ax: number;
  ay: number;
  az: number;
  coneCos: number;
};

export function createRocks(level: Level, haze: HazeUniforms): Rocks {
  const group = new THREE.Group();
  group.name = "rocks";
  // WHAT THE ROCK HOLDS, for the rock eval lab (`make rock-eval`): every ms
  // spent building it, the tiles in reach still owed their cut, the
  // triangles and bytes built, and the tiles the horizon and the cone hid
  // at the last look. An instrument: nothing draws off it.
  const stats = {
    buildMs: 0,
    owed: 0,
    triangles: 0,
    bytes: 0,
    horizon: 0,
    cone: 0,
  };
  group.userData.rockStats = stats;
  let lastEye: THREE.Vector3 | null = null;
  let lastReach = 0;
  const bed = level.bedrock ?? level;
  const band = regionLookOf(regionOf(level).id).rock;
  const field = rockFieldOf(level);
  const mean = band ? meanOf(band.tone) : [0, 0, 0];
  const materials = CUTS.map((_, k) => rockMaterial(k, haze, mean, field.thick));
  const cols = band ? Math.ceil(level.size / TILE) : 0;
  const wallsOn: CliffWall[][] = Array.from({ length: cols * cols }, () => []);
  if (band) {
    for (const w of cliffWalls(level)) {
      const i = Math.min(cols - 1, Math.max(0, Math.floor(w.x / TILE)));
      const j = Math.min(cols - 1, Math.max(0, Math.floor(w.z / TILE)));
      wallsOn[j * cols + i].push(w);
    }
  }
  const tiles: Tile[] = [];
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      const walls = wallsOn[j * cols + i];
      const x0 = i * TILE;
      const z0 = j * TILE;
      tiles.push({
        cx: x0 + TILE / 2,
        cz: z0 + TILE / 2,
        x0,
        z0,
        walls,
        bare: walls.length === 0 && noRockIn(field, x0, z0, x0 + TILE, z0 + TILE),
        part: null,
        building: -1,
        mesh: null,
        cut: -1,
        top: -Infinity,
        ax: 0,
        ay: 1,
        az: 0,
        coneCos: -1,
      });
    }
  }

  /** Build more of `t` at cut `k`; true when it is whole. */
  const step = (t: Tile, k: number, until: number): boolean => {
    const t0 = performance.now();
    const whole = build(t, k, until);
    stats.buildMs += performance.now() - t0;
    return whole;
  };
  const build = (t: Tile, k: number, until: number): boolean => {
    if (!t.part || t.building !== k) {
      t.part = startTile(field, band!.tone, t.x0, t.z0, TILE, CUTS[k], CUTS[k + 1] ?? null);
      t.building = k;
    }
    const more = (): boolean => performance.now() < until;
    if (!stepTile(t.part, more)) return false;
    const part: RockMesh = t.part.mesh!;
    for (const w of t.walls) buildWall(part, w, band!.tone);
    t.part = null;
    // The cut it replaces goes as the new one arrives.
    const old = t.mesh;
    if (old) {
      forget(old);
      group.remove(old);
      old.geometry.dispose();
      t.mesh = null;
    }
    t.cut = k;
    if (part.pos.length === 0) return true;
    coneOf(t, part);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(part.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(part.nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(part.col, 3));
    g.setAttribute("morph", new THREE.Float32BufferAttribute(part.morph, 4));
    g.setAttribute("mcol", new THREE.Float32BufferAttribute(part.mcol, 3));
    g.setAttribute("phi", new THREE.Float32BufferAttribute(part.phi, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, materials[k]);
    mesh.userData.bytes = ((part.pos.length * 17) / 3) * 4;
    stats.triangles += part.pos.length / 9;
    stats.bytes += mesh.userData.bytes;
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    t.mesh = mesh;
    return true;
  };
  const forget = (m: THREE.Mesh): void => {
    stats.triangles -= (m.geometry.getAttribute("position")?.count ?? 0) / 3;
    stats.bytes -= (m.userData.bytes as number | undefined) ?? 0;
  };
  const drop = (t: Tile): void => {
    t.part = null;
    t.building = -1;
    t.cut = -1;
    if (!t.mesh) return;
    forget(t.mesh);
    group.remove(t.mesh);
    t.mesh.geometry.dispose();
    t.mesh = null;
  };

  /** Whether `t` is hidden from the lens at `eye`: behind the ground
   * between them, or facing wholly away. */
  const hidden = (t: Tile, eye: THREE.Vector3, d: number): boolean => {
    // THE CONE: every face turned from every point of the tile's sphere.
    const s = t.mesh?.geometry.boundingSphere;
    if (s && t.coneCos > 0) {
      const vx = eye.x - s.center.x;
      const vy = eye.y - s.center.y;
      const vz = eye.z - s.center.z;
      const dist = Math.hypot(vx, vy, vz);
      if (dist > s.radius * 1.05) {
        const along = (vx * t.ax + vy * t.ay + vz * t.az) / dist;
        // −sin(α + β), α the cone's half-angle, β the sphere's.
        const sa = Math.sqrt(Math.max(0, 1 - t.coneCos * t.coneCos));
        const sb = s.radius / dist;
        const cb = Math.sqrt(Math.max(0, 1 - sb * sb));
        if (t.coneCos * cb - sa * sb > 0 && along < -(sa * cb + t.coneCos * sb)) {
          stats.cone++;
          return true;
        }
      }
    }
    // THE HORIZON: the ground marched toward the tile's middle and its two
    // far corners; hidden only if every ray's ridge stands over its top.
    if (d < 2 * TILE || t.top === -Infinity) return false;
    const rise = (t.top + 2 - eye.y) / d;
    const reach = d - 4;
    const targets = [
      [t.cx, t.cz],
      [t.x0, t.z0 + TILE],
      [t.x0 + TILE, t.z0],
      [t.x0, t.z0],
      [t.x0 + TILE, t.z0 + TILE],
    ];
    for (const [qx, qz] of targets) {
      const dx = qx - eye.x;
      const dz = qz - eye.z;
      const l = Math.hypot(dx, dz) || 1;
      let ridge = -Infinity;
      for (let q = 1; q <= 28; q++) {
        const r = 30 * Math.pow(reach / 30, q / 28);
        if (r >= reach) break;
        const h = (bed.groundAt(eye.x + (dx / l) * r, eye.z + (dz / l) * r) - eye.y) / r;
        if (h > ridge) ridge = h;
      }
      if (ridge < rise + 0.03) return false;
    }
    stats.horizon++;
    return true;
  };

  group.userData.rockSettle = (): void => {
    if (!lastEye) return;
    const half = TILE / 2;
    for (const t of tiles) {
      if (t.bare) continue;
      const dx = Math.max(0, Math.abs(lastEye.x - t.cx) - half);
      const dz = Math.max(0, Math.abs(lastEye.z - t.cz) - half);
      const d2 = dx * dx + dz * dz;
      if (d2 >= lastReach * lastReach) continue;
      const k = cutOf(Math.sqrt(d2), t.cut);
      if (k === t.cut) continue;
      while (!step(t, k, Infinity));
    }
    stats.owed = 0;
    show(lastEye, lastReach);
  };

  /** Which built tiles are drawn. */
  const show = (eye: THREE.Vector3, reach: number): void => {
    stats.horizon = 0;
    stats.cone = 0;
    const half = TILE / 2;
    for (const t of tiles) {
      if (!t.mesh) continue;
      const dx = Math.max(0, Math.abs(eye.x - t.cx) - half);
      const dz = Math.max(0, Math.abs(eye.z - t.cz) - half);
      const d = Math.hypot(dx, dz);
      t.mesh.visible = d < reach && !hidden(t, eye, d);
    }
  };

  return {
    group,
    update(eye, reach) {
      lastEye = eye.clone();
      lastReach = reach;
      // The tile's corner nearest the lens, so a tile is shown as soon as
      // any of it is in reach.
      const half = TILE / 2;
      let next: Tile | null = null;
      let nextK = 0;
      let nextD2 = Infinity;
      let owed = 0;
      for (const t of tiles) {
        if (t.bare) continue;
        const dx = Math.max(0, Math.abs(eye.x - t.cx) - half);
        const dz = Math.max(0, Math.abs(eye.z - t.cz) - half);
        const d2 = dx * dx + dz * dz;
        const near = d2 < reach * reach;
        const k = near ? cutOf(Math.sqrt(d2), t.cut) : -1;
        if (near && k !== t.cut) {
          owed++;
          // A tile with nothing on screen yet, or one that close, is built
          // whole now; one changing cut keeps its old one meanwhile.
          if (d2 < NOW * NOW && (t.cut < 0 || k < t.cut)) while (!step(t, k, Infinity));
          else if (d2 < nextD2) {
            next = t;
            nextK = k;
            nextD2 = d2;
          }
        }
        // Well out of reach, its triangles are let go, so a long ride never
        // holds the whole mountain's rock.
        if ((t.mesh || t.part) && d2 > (reach + KEEP) ** 2) drop(t);
      }
      // The nearest tile still owed, a slice of a frame's worth of it.
      if (next) step(next, nextK, performance.now() + SLICE);
      show(eye, reach);
      stats.owed = owed;
    },
    dispose() {
      for (const t of tiles) drop(t);
      for (const m of materials) m.dispose();
    },
  };
}

/** The rock's mean paint: a block of middling shade, nothing in a crack. */
function meanOf(tone: readonly [number, number, number]): number[] {
  const WARM = [1.08, 1.0, 0.88];
  const r = tone[0] * WARM[0];
  const g = tone[1] * WARM[1];
  const b = tone[2] * WARM[2];
  const k = (0.27 / Math.max(1e-3, 0.2126 * r + 0.7152 * g + 0.0722 * b)) * 0.92;
  return [r * k, g * k, b * k];
}

/** A built tile's top and its normals' cone. */
function coneOf(t: Tile, m: RockMesh): void {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let top = -Infinity;
  for (let i = 0; i < m.pos.length; i += 3) {
    sx += m.nrm[i];
    sy += m.nrm[i + 1];
    sz += m.nrm[i + 2];
    if (m.pos[i + 1] > top) top = m.pos[i + 1];
  }
  const l = Math.hypot(sx, sy, sz) || 1;
  t.ax = sx / l;
  t.ay = sy / l;
  t.az = sz / l;
  let least = 1;
  for (let i = 0; i < m.nrm.length; i += 3) {
    // The morph's normals too, so the cone holds the slide.
    const a = m.nrm[i] * t.ax + m.nrm[i + 1] * t.ay + m.nrm[i + 2] * t.az;
    if (a < least) least = a;
  }
  for (let i = 0; i < m.morph.length; i += 4) {
    const a = m.morph[i + 1] * t.ax + m.morph[i + 2] * t.ay + m.morph[i + 3] * t.az;
    if (a < least) least = a;
  }
  t.top = top;
  t.coneCos = least;
}

export { rockMesh };
