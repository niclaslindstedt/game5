// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A PERSON RUN INTO LEAVES ON THE SNOW — on a free ride with the
// INJURIES switch on, every amateur the player struck hard enough to hurt
// (`CrowdState.struck`, `engine/game/person-hit.ts`) and every person on
// foot — a civilian, a rescue or police crew member (`engine/game/foot.ts`): blood
// out of the WOUND on his body (`crowd-wound.ts`, the struck side of his
// trunk, or a hurt man's face) over the blow's first `SPRAY_FOR`, going
// with him as he is flung and on along his fling, and spattered back at
// the player at first — never out of the air the two met in — a red
// smear under him along his slide, and a pool where he comes to rest that
// grows as he bleeds. A body crushed past `CRUSHED` is torn too: what was
// stove in thrown out with the blood — flesh, the splinters of ribs.
// How much each bleeds and over how long is `crowd-broken.ts`' `bleedOf`.
//
// Blunt force mostly bleeds INSIDE (the crushed chest, the torn liver of
// the research in `docs/body-hits.md`), so a man hurt but alive leaves
// little: his mouth and nose bleeding into a small blot by his head
// (`bleedOf`). The blood is `gore-blood.ts`'s, the pieces `gore-gibs.ts`'
// and `gore-shapes.ts`' — the animal run down (`beast-gore.ts`) is the
// precedent and nothing of either is restated. Presentation only: it reads
// the engine's struck people and writes nothing; what it throws is dealt
// off each meeting's own seed and stepped on the run's clock, so a replay
// throws it again the same. Built the first time a run carries both a
// crowd (or its people on foot) and its injuries, with a PRIMER standing in it (`gore-lumps.ts`'),
// so the blow links no program.

import * as THREE from "three";
import {
  allStruck,
  createRng,
  footDown,
  RAGDOLL,
  type GameState,
  type Level,
  type StruckPerson,
  type Thrown,
} from "@engine";

import { bledBetween, CRUSHED } from "./crowd-broken.ts";
import { DEPTH, woundAt, woundFacing, woundOf, type Wound } from "./crowd-wound.ts";

import { createBlood, type Blood } from "./gore-blood.ts";
import { gibGround, lump } from "./gore-gibs.ts";
import { spreadAt } from "./gore-leaks.ts";
import { createLumps, gorePrimer } from "./gore-lumps.ts";
import { organGeometry, shardGeometry, type OrganKind } from "./gore-shapes.ts";
import { wildGround } from "./wild-ground.ts";

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;

export type CrowdGore = {
  group: THREE.Group;
  update: (state: GameState) => void;
  clear: () => void;
  dispose: () => void;
};

/** How far the body slides between two blots of its smear, m: closer than
 * a blot is across, so the slide reads as one smear, not a dotted line. */
const SMEAR_EVERY = 0.12;

/** How slow a body slides, m/s, before what runs out of it pools. */
const POOL_AT = 0.6;

/** The pieces a torn body throws. */
const ORGANS: readonly OrganKind[] = ["gobbet", "gobbet", "lung", "liver"];

/** How long after the blow the blood goes on coming out of the wound, s
 * of the run's clock: the spurt of a body burst, not one frame's cloud. */
const SPRAY_FOR = 0.3;

/** ...the share of it in which the spatter goes back at the player. */
const BACK_FOR = 0.35;

/** One person struck, as drawn: where the last smear was laid and how long
 * after the blow the pool was last run; the wound the blood comes out of
 * (`crowd-wound.ts`, null until his body can be read), the way he was
 * flung, how far into the spray it has got (s) and the stream it is dealt
 * off. */
type Body = {
  key: string;
  hit: StruckPerson;
  sx: number;
  sz: number;
  ran: number;
  wound: Wound | null;
  dir: THREE.Vector3;
  sprayed: number;
  next: () => number;
  rng: ReturnType<typeof createRng>;
};

/** How many of `total` drops a spray `from`..`to` s into its `span` owes. */
const dropsBetween = (total: number, from: number, to: number, span: number): number =>
  Math.round(total * Math.min(1, to / span)) - Math.round(total * Math.min(1, from / span));

/** The body a meeting threw: the amateur's, or the person on foot's. */
function thrownOf(state: GameState, hit: StruckPerson): Thrown | null | undefined {
  if (hit.foot === undefined) return state.crowd?.amateurs[hit.amateur]?.thrown;
  const d = footDown(state, hit.foot);
  // A body gone over lying (`lying.ts`) is still the one that meeting threw.
  return d && (d.hit === hit || hit.lying) ? d.thrown : null;
}

/** The view's name for a meeting: who, and when. */
const keyOf = (hit: StruckPerson): string =>
  `${hit.foot !== undefined ? `f${hit.foot}` : `a${hit.amateur}`}:${hit.t}`;

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const v4 = new THREE.Vector3();
const facing = { x: 0, y: 0, z: 0 };

export function createCrowdGore(level: Level, wrap: Wrap): CrowdGore {
  const group = new THREE.Group();
  group.name = "crowd-gore";
  const blood: Blood = createBlood(wrap);
  group.add(blood.group);
  const flesh = wrap(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.35,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
    "crowd-gore",
  );
  const organs = ORGANS.map((k, i) => organGeometry(k, 3.1 + i * 4.7));
  const shards = [0, 1, 2].map((i) => shardGeometry(0.08 + 0.04 * i, 0.012, i * 3.3));
  const lumps = createLumps(flesh);
  group.add(lumps.group);
  const primer = gorePrimer(flesh, new THREE.Group());
  group.add(primer.group);

  const ground = gibGround(level);
  const drawn = wildGround(level);
  const bloodGround = {
    heightAt: (x: number, z: number) => drawn.snowY(x, z),
    normalAt: (x: number, z: number, out: { x: number; y: number; z: number }) =>
      ground.normalAt(x, z, out),
  };
  const bodies = new Map<string, Body>();
  let last: GameState | null = null;
  let lastT = 0;

  /** WHERE IT COMES OUT of `body` now, into `out`: the wound on his trunk
   * as it lies — a hurt man's face, his head — or, his body not to be
   * read, the spot of the blow. */
  const sourceOf = (body: Body, b: Thrown | null | undefined, out: THREE.Vector3): void => {
    const hit = body.hit;
    if (b && !hit.killed) {
      const h = 3 * RAGDOLL.head;
      out.set(b.points[h], b.points[h + 1], b.points[h + 2]);
      if (body.wound && woundFacing(b.points, body.wound, facing))
        out.addScaledVector(v1.set(facing.x, facing.y, facing.z), DEPTH);
      return;
    }
    if (b && body.wound && woundAt(b.points, body.wound, out)) return;
    out.set(hit.x, hit.y, hit.z);
  };

  /** THE SPRAY, `from`..`to` s after the blow: the share of what comes out
   * of him owed over that while, out of the wound as it now is, going as
   * his body goes (`carry`) and on along the way he was flung — and,
   * early, some back at the player who went through him. */
  const spray = (body: Body, b: Thrown | null | undefined, from: number, to: number): void => {
    const hit = body.hit;
    const dir = body.dir;
    const next = body.next;
    const at = v2;
    sourceOf(body, b, at);
    // Out of the wound at a spurt's few metres a second OVER his own way
    // (`carry`): blood leaves a body flung at the body's speed, so a burst
    // as fast again as the blow outruns him in a frame and reads as a
    // cloud of its own.
    const fast = Math.max(3, hit.given);
    const carry = b ? v3.set(b.vx, b.vy, b.vz) : v3.copy(dir).multiplyScalar(hit.given * 0.5);
    if (!hit.killed) {
      // A face struck: a spatter of drops off it.
      const n = dropsBetween(30, from, to, SPRAY_FOR);
      if (n > 0) blood.emit(at, dir, fast * 0.2, n, 0.9, carry, next);
      return;
    }
    const c = hit.crush;
    const n = dropsBetween(Math.round(90 + 520 * c), from, to, SPRAY_FOR);
    if (n > 0) blood.emit(at, dir, fast * 0.3 + 1, n, 0.8, carry, next);
    // Back at the player, who went through him: off the struck side, with
    // little of the body's own way in it.
    const back = SPRAY_FOR * BACK_FOR;
    const m = dropsBetween(Math.round(30 + 160 * c), from, to, back);
    if (m > 0) {
      v1.copy(dir).negate().setY(0.6).normalize();
      blood.emit(at, v1, 2 + 3 * c, m, 1, v4.copy(carry).multiplyScalar(0.3), next);
    }
  };

  /** THE BLOW: what is torn out of a crushed body at once, out of the
   * wound and flung along `dir`. */
  const burst = (body: Body, b: Thrown | null | undefined): void => {
    const hit = body.hit;
    const c = hit.crush;
    if (!hit.killed || c < CRUSHED) return;
    const dir = body.dir;
    const rng = body.rng;
    const fast = Math.max(3, hit.given);
    sourceOf(body, b, v4);
    const from = { x: v4.x, y: v4.y, z: v4.z };
    const torn = (c - CRUSHED) / (1 - CRUSHED);
    const fling = (geos: readonly THREE.BufferGeometry[], count: number, r: number, k: number) => {
      for (let i = 0; i < count; i++) {
        v1.set(
          dir.x + rng.range(-0.7, 0.7),
          dir.y + rng.range(0, 0.9),
          dir.z + rng.range(-0.7, 0.7),
        );
        v1.normalize();
        const u = fast * rng.range(0.3, 1);
        v2.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
        const piece = lump(
          from,
          { x: v1.x * u, y: v1.y * u, z: v1.z * u },
          r,
          { x: v2.x, y: v2.y, z: v2.z },
          rng.range(5, 16),
          1 / 60,
        );
        lumps.add(rng.pick(geos), piece, k * rng.range(0.7, 1.2));
      }
    };
    fling(organs, Math.round(2 + 6 * torn), 0.03, 0.8);
    fling(shards, Math.round(2 + 5 * torn), 0.01, 1);
  };

  const clear = (): void => {
    lumps.clear();
    bodies.clear();
    blood.clear();
  };

  const update = (state: GameState): void => {
    primer.group.visible = false;
    if (state !== last || state.t < lastT) {
      if (last) clear();
      last = state;
      lastT = state.t;
    }
    const dt = Math.min(0.1, state.t - lastT);
    lastT = state.t;
    if (!state.gore) return;
    for (const hit of allStruck(state)) {
      if (!hit.killed && !hit.injured) continue;
      const key = keyOf(hit);
      if (bodies.has(key)) continue;
      const b = thrownOf(state, hit);
      const heading = b?.heading ?? 0;
      const dir = new THREE.Vector3(b?.vx ?? 0, 0, b?.vz ?? 0);
      if (dir.lengthSq() < 1e-6) dir.set(Math.sin(heading), 0, Math.cos(heading));
      dir.normalize().setY(0.25).normalize();
      const who = hit.foot !== undefined ? 104729 + hit.foot : hit.amateur;
      const rng = createRng(Math.floor(hit.t * 997) ^ (who * 7919) ^ 0x9e75);
      const body: Body = {
        key,
        hit,
        sx: hit.x,
        sz: hit.z,
        ran: 0,
        // Read off his body as it was at the blow: the ragdoll is thrown
        // standing where he stood, so its first points are his stance.
        wound: b ? woundOf(b.points, hit) : null,
        dir,
        sprayed: 0,
        next: () => rng.next(),
        rng,
      };
      bodies.set(key, body);
      burst(body, b);
    }
    if (dt <= 0) return;
    for (const body of bodies.values()) {
      const b = thrownOf(state, body.hit);
      const u = state.t - body.hit.t;
      const to = Math.min(SPRAY_FOR, u);
      if (to > body.sprayed) {
        spray(body, b, body.sprayed, to);
        body.sprayed = to;
      }
      if (!b) continue;
      // The pool where it bleeds: his chest dead, his face alive.
      const at = body.hit.killed
        ? b
        : { x: b.points[3 * RAGDOLL.head], z: b.points[3 * RAGDOLL.head + 2] };
      const low = b.y - drawn.snowY(b.x, b.z) < 0.45;
      // THE SLIDE smeared red under a dead man, blot on blot along the way
      // he went however far a frame took him; a hurt one leaves drops.
      const gone = Math.hypot(b.x - body.sx, b.z - body.sz);
      if (!low || gone <= SMEAR_EVERY) {
        if (!low) {
          body.sx = b.x;
          body.sz = b.z;
        }
      } else if (body.hit.killed) {
        const r = 0.3 + 0.3 * body.hit.crush;
        const n = Math.min(40, Math.floor(gone / SMEAR_EVERY));
        for (let i = 1; i <= n; i++) {
          const x = body.sx + ((b.x - body.sx) * i) / n;
          const z = body.sz + ((b.z - body.sz) * i) / n;
          blood.splat(x, z, r * (0.8 + 0.2 * Math.sin(i * 2.3 + x)), 1, (x * 7 + z * 3) % 6.28);
        }
        body.sx = b.x;
        body.sz = b.z;
      } else if (gone > SMEAR_EVERY * 6) {
        blood.splat(b.x, b.z, 0.04, 0.8, (b.x * 7 + b.z * 3) % 6.28);
        body.sx = b.x;
        body.sz = b.z;
      }
      // THE POOL once he has come to rest — while he slides, what runs out
      // of him is the smear (a pool laid on the move is a line of dots).
      const resting = Math.hypot(b.vx, b.vz) < POOL_AT;
      if (!resting) continue;
      const litres = bledBetween(body.hit, body.ran, u);
      body.ran = u;
      if (litres > 0 && low) blood.pool(body.key, at.x, at.z, litres, spreadAt(state, at.x, at.z));
    }
    lumps.update(ground, dt);
    blood.update(dt, bloodGround);
  };

  return {
    group,
    update,
    clear,
    dispose() {
      clear();
      lumps.dispose();
      primer.dispose();
      for (const g of [...organs, ...shards]) g.dispose();
      flesh.dispose();
      blood.dispose();
    },
  };
}
