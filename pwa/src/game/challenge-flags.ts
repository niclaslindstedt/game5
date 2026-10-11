// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CHALLENGES IN THE WORLD — what a free ride being judged
// (`challengeSessionOf`, `challenge-run.ts`) plants on the snow for its
// dealt challenges (`docs/challenges.md`), built for `gates.ts` beside the
// course's own marks. Where each thing stands is `challenge-flags-plan.ts`'s
// and every piece is built in code by `challenge-shapes.ts`:
//
//   * a timed line's START and FINISH: a tall feather flag at each end of
//     the gate (START on the gate blue, FINISH on red under a chequered
//     head, and the line being run's FINISH in gold,
//     breathing), a timing post inside each, and the line dyed across the
//     snow, blue at a start and red at a finish;
//   * a trick goal's kicker: a pennant beside its lip in the best medal
//     held there, a slate blue while none is;
//   * a hidden spot, ONLY ONCE FOUND: a cairn with a cyan pennant.
//
// THE CLOTH MOVES IN THE RUN'S WIND, in the vertex shader: each sail and
// pennant turns about its pole to fly downwind as a feather flag on its
// swivel spike does (resting off the run in a calm) and flutters along its
// length, faster and wider as the wind rises — one uniform pair for all of
// them, read off `windAt` by the renderer's `air`.
//
// Seven draws in all, every one instanced or merged; nothing is built
// until a judged run first stands on the map, and nothing shows on a run
// that is not judged.

import * as THREE from "three";
import type { ChallengePlan, GameState, Level, Wind } from "@engine";

import { challengeSessionOf } from "./challenge-run.ts";
import { CHALLENGE_FLAG as F, planFlags, type FlagPlan } from "./challenge-flags-plan.ts";
import {
  cairn,
  FEATHER_CELLS,
  WORD_BAND,
  featherCloth,
  featherPole,
  featherTexture,
  pennantCloth,
  pennantPole,
  timingPost,
} from "./challenge-shapes.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { PALETTE } from "../identity.ts";
import { MEDAL_LOOK } from "./medal-look.ts";
import { LOOSE } from "./trail-stamp.ts";

/** An unmedalled kicker's pennant, a found spot's, and the dyed lines. */
const LOOK = {
  kicker: "#3d5f8f",
  spot: "#4fd0f2",
  dyeStart: PALETTE.gateBlue,
  dyeFinish: PALETTE.flag,
} as const;

export type ChallengeFlags = {
  group: THREE.Group;
  /** The run's moment: shown only on a judged ride, the running line's
   * finish lit, each kicker in its medal, each spot found. */
  update(state: GameState): void;
  /** The cloth in the wind at the run's moment. */
  air(t: number, wind: Wind): void;
  /** The night's light, 0 off … 1. */
  setLamps(on: number): void;
  dispose(): void;
};

/** THE CLOTH'S MOTION: the cloth (built flying along its +x off the pole)
 * swung about the pole to the wind in its instance's frame, and fluttered
 * along its length. */
const SWAY_PARS = /* glsl */ `
uniform vec2 uFlagWind;
uniform float uFlagTime;
`;
const SWAY = /* glsl */ `
vec3 transformed = vec3( position );
{
  #ifdef USE_INSTANCING
    vec3 lw = transpose( mat3( instanceMatrix ) ) * vec3( uFlagWind.x, 0.0, uFlagWind.y );
    float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.61;
  #else
    vec3 lw = vec3( uFlagWind.x, 0.0, uFlagWind.y );
    float ph = 0.0;
  #endif
  float sp = length( lw.xz );
  float gust = min( sp, 14.0 );
  float reach = max( transformed.x, 0.0 );
  transformed.z += reach * ( 0.035 + 0.012 * gust )
    * sin( uFlagTime * ( 2.4 + 0.35 * gust ) - reach * 4.5 + ph );
  vec2 dir = sp > 0.4 ? lw.xz / sp : vec2( 1.0, 0.0 );
  float wob = sin( uFlagTime * 0.55 + ph ) * 0.4 / ( 1.0 + sp * 0.35 );
  float cw = cos( wob );
  float sw = sin( wob );
  dir = vec2( dir.x * cw - dir.y * sw, dir.x * sw + dir.y * cw );
  transformed.xz = vec2(
    transformed.x * dir.x - transformed.z * dir.y,
    transformed.x * dir.y + transformed.z * dir.x
  );
}
`;

/** The sail's print: each instance's cell of the canvas, for the map and
 * the night's glow alike. */
const CELL_UV = /* glsl */ `
#ifdef USE_MAP
  vMapUv.x = ( min( vMapUv.x, 0.985 ) + aCell ) / ${FEATHER_CELLS.count}.0;
#endif
`;

/** The sail printed on both sides: seen from behind, the word's band is
 * read turned end for end, so it reads (downward) rather than mirrored. */
const SAIL_MAP = /* glsl */ `
#ifdef USE_MAP
  vec2 sailUv = vMapUv;
  if ( !gl_FrontFacing && sailUv.y > ${WORD_BAND[0]} && sailUv.y < ${WORD_BAND[1]} )
    sailUv.y = ${WORD_BAND[0] + WORD_BAND[1]} - sailUv.y;
  // The unturned print's gradients, so the mip does not jump at the band's
  // edges.
  vec4 sailPrint = textureGrad( map, sailUv, dFdx( vMapUv ), dFdy( vMapUv ) );
  diffuseColor *= sailPrint;
#endif
`;

type Wiring = { uFlagWind: { value: THREE.Vector2 }; uFlagTime: { value: number } };

function swayGraft(wiring: Wiring, cells: boolean) {
  return (shader: THREE.WebGLProgramParametersWithUniforms): void => {
    Object.assign(shader.uniforms, wiring);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\n${SWAY_PARS}${cells ? "attribute float aCell;\n" : ""}`,
      )
      .replace("#include <begin_vertex>", SWAY);
    if (cells) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>\n${CELL_UV}`,
      );
      // The night's glow is the print's own, read through the same turn.
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <map_fragment>", SAIL_MAP)
        .replace("#include <emissivemap_fragment>", "totalEmissiveRadiance *= sailPrint.rgb;");
    }
  };
}

/** THE MARKS for `level`'s challenges, or null on a map with no ski area. */
export function createChallengeFlags(level: Level, haze: HazeUniforms): ChallengeFlags | null {
  if (!level.resort) return null;
  const group = new THREE.Group();
  group.name = "challenge-flags";
  group.visible = false;
  const wiring: Wiring = { uFlagWind: { value: new THREE.Vector2() }, uFlagTime: { value: 0 } };
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const meshes: THREE.Mesh[] = [];
  const tex = featherTexture();
  const solid = (name: string, p: THREE.MeshStandardMaterialParameters = {}) => {
    const m = hazeMaterial(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, ...p }),
      haze,
      name,
    );
    mats.push(m);
    return m;
  };
  const sailMat = hazeMaterial(
    new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      roughness: 0.85,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
    haze,
    "challenge-sail",
    swayGraft(wiring, true),
  );
  const pennantMat = hazeMaterial(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
    haze,
    "challenge-pennant",
    swayGraft(wiring, false),
  );
  mats.push(sailMat, pennantMat);

  let built: ChallengePlan | null = null;
  let plan: FlagPlan | null = null;
  let sails: THREE.InstancedMesh | null = null;
  let cells: THREE.InstancedBufferAttribute | null = null;
  let pennants: THREE.InstancedMesh | null = null;
  let stakes: THREE.InstancedMesh | null = null;
  let cairns: THREE.InstancedMesh | null = null;
  let lit: string | null = null;
  let bookSeen: unknown = null;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const at = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const paint = new THREE.Color();

  const instanced = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    n: number,
    name: string,
    shadow = true,
  ): THREE.InstancedMesh => {
    geos.push(geo);
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    m.count = n;
    m.name = name;
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.frustumCulled = false;
    group.add(m);
    meshes.push(m);
    return m;
  };
  const put = (
    m: THREE.InstancedMesh,
    i: number,
    p: { x: number; y: number; z: number; heading: number },
    lift = 0,
    scale = one,
  ): void => {
    q.setFromAxisAngle(up, p.heading);
    m.setMatrixAt(i, m4.compose(at.set(p.x, p.y + lift, p.z), q, scale));
  };

  const build = (dealt: ChallengePlan): void => {
    const p = planFlags(level, dealt);
    plan = p;
    built = dealt;
    // THE FEATHER FLAGS: their poles and their sails.
    const poles = instanced(
      featherPole(),
      solid("challenge-feather-pole"),
      p.flags.length,
      "poles",
    );
    sails = instanced(featherCloth(), sailMat, p.flags.length, "sails", false);
    cells = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, p.flags.length)), 1);
    sails.geometry.setAttribute("aCell", cells);
    p.flags.forEach((f, i) => {
      put(poles, i, f);
      put(sails!, i, f);
      cells!.setX(i, f.role === "start" ? FEATHER_CELLS.start : FEATHER_CELLS.finish);
      sails!.setColorAt(i, paint.setRGB(1, 1, 1));
    });
    // THE TIMING POSTS.
    const posts = instanced(timingPost(), solid("challenge-timing"), p.sensors.length, "timing");
    p.sensors.forEach((s, i) => put(posts, i, s));
    // THE KICKERS' AND THE SPOTS' PENNANTS, on poles and stakes.
    const n = p.kickers.length + p.spots.length;
    stakes = instanced(pennantPole(F.pennant.pole), solid("challenge-stake"), n, "stakes");
    pennants = instanced(pennantCloth(F.pennant.pole - 0.05), pennantMat, n, "pennants", false);
    cairns = instanced(
      cairn(),
      solid("challenge-cairn", { roughness: 0.95 }),
      p.spots.length,
      "cairns",
    );
    p.kickers.forEach((k, i) => {
      put(stakes!, i, k);
      put(pennants!, i, k);
    });
    // DYED ACROSS THE SNOW: one merged strip a gate.
    const pos: number[] = [];
    const col: number[] = [];
    const lift = (x: number, z: number): number =>
      level.groundAt(x, z) + LOOSE * (1 - level.packedAt(x, z)) + 0.03;
    for (const d of p.dyes) {
      const c = new THREE.Color(d.role === "start" ? LOOK.dyeStart : LOOK.dyeFinish);
      for (let i = 0; i + 1 < d.points.length; i++) {
        const [ax, , az] = d.points[i];
        const [bx, , bz] = d.points[i + 1];
        const len = Math.hypot(bx - ax, bz - az) || 1;
        // Across the dyed line, half its width, toward the line's left.
        const wx = (-(bz - az) / len) * (F.dye.width / 2);
        const wz = ((bx - ax) / len) * (F.dye.width / 2);
        const quad: [number, number][] = [
          [ax - wx, az - wz],
          [bx - wx, bz - wz],
          [bx + wx, bz + wz],
          [ax + wx, az + wz],
        ];
        const v = quad.map(([x, z]) => [x, lift(x, z), z] as const);
        // Wound to face up.
        const ny =
          (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]);
        const order = ny > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        for (const k of order) {
          pos.push(...v[k]);
          col.push(c.r, c.g, c.b);
        }
      }
    }
    if (pos.length > 0) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      geos.push(g);
      const dye = new THREE.Mesh(
        g,
        solid("challenge-dye", {
          roughness: 0.95,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -4,
        }),
      );
      dye.name = "dye";
      dye.receiveShadow = true;
      group.add(dye);
      meshes.push(dye);
    }
    for (const m of meshes) {
      if (!(m instanceof THREE.InstancedMesh)) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    cells.needsUpdate = true;
    lit = null;
    bookSeen = null;
  };

  const clear = (): void => {
    for (const m of meshes) {
      group.remove(m);
      if (m instanceof THREE.InstancedMesh) m.dispose();
    }
    meshes.length = 0;
    for (const g of geos) g.dispose();
    geos.length = 0;
    plan = null;
    built = null;
  };

  return {
    group,
    update(state) {
      const s = challengeSessionOf(state);
      group.visible = s !== null && s.level === level;
      if (!s || !group.visible) return;
      if (built !== s.run.plan) {
        clear();
        build(s.run.plan);
      }
      const p = plan!;
      // THE RUNNING LINE'S FINISH: its two sails gold and breathing.
      const running = s.run.live()?.id ?? null;
      if (running !== lit || running !== null) {
        const glow = 1 + 0.22 * (0.5 + 0.5 * Math.sin(state.t * 4));
        p.flags.forEach((f, i) => {
          const live = f.role === "finish" && f.id === running;
          cells!.setX(
            i,
            live
              ? FEATHER_CELLS.live
              : f.role === "start"
                ? FEATHER_CELLS.start
                : FEATHER_CELLS.finish,
          );
          const k = live ? glow : 1;
          sails!.setColorAt(i, paint.setRGB(k, k, k));
        });
        cells!.needsUpdate = true;
        if (sails!.instanceColor) sails!.instanceColor.needsUpdate = true;
        lit = running;
      }
      // THE BOOK: each kicker's medal, each spot found.
      if (s.book !== bookSeen) {
        bookSeen = s.book;
        const held = s.book.maps[s.run.plan.key] ?? {};
        p.kickers.forEach((k, i) => {
          const medal = held[k.id]?.medal ?? null;
          pennants!.setColorAt(i, paint.set(medal ? MEDAL_LOOK[medal].deep : LOOK.kicker));
        });
        const base = p.kickers.length;
        p.spots.forEach((sp, j) => {
          const found = held[sp.id]?.found?.includes(sp.spot) ?? false;
          const scale = found ? one : zero;
          // The stake stands in the cairn, its pennant over the stones.
          put(stakes!, base + j, sp, F.cairn.stake - F.pennant.pole, scale);
          put(pennants!, base + j, sp, F.cairn.stake - F.pennant.pole, scale);
          pennants!.setColorAt(base + j, paint.set(LOOK.spot));
          put(cairns!, j, sp, 0, scale);
        });
        for (const m of [stakes!, pennants!, cairns!]) {
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
      }
    },
    air(t, wind) {
      wiring.uFlagTime.value = t;
      wiring.uFlagWind.value.set(wind.x, wind.z);
    },
    setLamps(on) {
      sailMat.emissiveIntensity = 0.22 * Math.min(1, Math.max(0, on));
    },
    dispose() {
      clear();
      for (const m of mats) m.dispose();
      tex.dispose();
    },
  };
}
