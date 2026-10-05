// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE AS DRAWN (`sled.ts`) — the Blender model (`make models
// KIND=sled`, `models/sled.glb`, `SLED_NODES`) hung on the engine's body
// and posed off its readings every frame: the BARS turned with the skis,
// each SKI lifted on its compression and turned about its spindle, the REAR
// SUSPENSION swung up about the drive as the belt's springs take load, the
// PADDLES run round the loop at the belt's own speed (the `run` morph), the
// headlamp lit while the engine runs — and the SKI RACK carrying the rider's
// pair (dressed in his topsheet's colours) while he rides it. While it waits
// for him, parked near him, a halo over it calls him to it.
//
// Presentation only: it reads `GameState.sled` and writes nothing back.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SLED, type GameState, type SledState } from "@engine";

import { glow } from "./glow-sprite.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { SLED_LOOK } from "./sled-look.ts";
import { SLED_NODES, sledModelUrl } from "./skier-models.ts";

/** How near the parked machine a skier is for its halo to call him, m. */
const LIGHT_UP = 45;
/** The rest compression of the skis and the belt (a third of each travel —
 * `SLED_PROBES` hang so), m: what the drawn suspension moves from. */
const SKI_REST = SLED.front.travel / 3;
const TREAD_REST = SLED.rear.travel / 3;
/** How far behind the drive the rear idler stands, m — the arm the rear's
 * lift turns the drawn track about. */
const TRACK_ARM = SLED_LOOK.sprocket.at[0] - SLED_LOOK.idler.at[0];
/** One morph weight carries the belt this far round, m (the builder's
 * `beltRunMetres`, read off the model; this the fallback). */
const RUN_FALLBACK = 0.152;

export type SledView = {
  group: THREE.Group;
  /** Draw the machine at the state's last step, eased from the step before
   * by `alpha`; `player` is where the skier is drawn (the halo's call). */
  update(state: GameState, alpha: number, dt: number, player: { x: number; z: number }): void;
  /** Dress the racked pair in the rider's colours: the topsheet and its trim. */
  dressRack(body: number, trim: number): void;
  /** The machine as drawn this frame. */
  drawn(): { x: number; y: number; z: number; q: THREE.Quaternion } | null;
  dispose(): void;
};

/** A code-built stand-in, should the model not load: a cowl, a tunnel, a
 * belt and two skis — so a missing file is still a sled to take. */
function standIn(haze: HazeUniforms): THREE.Group {
  const g = new THREE.Group();
  const paint = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0xb8241a, roughness: 0.4 }),
    haze,
    "sled",
  );
  const dark = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.7 }),
    haze,
    "sled",
  );
  const box = (w: number, h: number, l: number, m: THREE.Material, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m);
    mesh.position.set(0, y, z);
    g.add(mesh);
    return mesh;
  };
  // In the trace's frame, glTF-turned: z aft from the tunnel's end is −z.
  box(0.65, 0.5, 1.2, paint, 0.6, -2.3);
  box(0.42, 0.25, 1.7, dark, 0.65, -0.85);
  box(0.41, 0.3, 1.6, dark, 0.2, -0.85);
  for (const s of [-1, 1]) {
    const ski = box(0.17, 0.05, 1.05, dark, 0.04, -2.6);
    ski.position.x = (s * SLED.skiStance) / 2;
  }
  return g;
}

export function createSledView(haze: HazeUniforms): SledView {
  const group = new THREE.Group();
  group.name = "snowmobile";
  const machine = new THREE.Group();
  group.add(machine);
  // The model in the TRACE's frame, glTF-turned (nose on −z): a half turn
  // puts the nose on the engine's +z, and `SLED.trace` shifts the trace's
  // origin (the tunnel's end, on the snow) onto the body frame's.
  const frame = new THREE.Group();
  frame.position.set(0, -SLED.trace.y, -SLED.trace.z);
  machine.add(frame);
  const nodes: Partial<Record<keyof typeof SLED_NODES, THREE.Object3D>> = {};
  const rest = new Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion }>();
  let lugs: THREE.Mesh | null = null;
  let run = RUN_FALLBACK;
  const allMats: THREE.Material[] = [];
  const rackMats: { ski: THREE.MeshStandardMaterial[]; trim: THREE.MeshStandardMaterial[] } = {
    ski: [],
    trim: [],
  };
  const lampMats: THREE.MeshStandardMaterial[] = [];
  let dressed: { body: number; trim: number } | null = null;
  let disposed = false;

  // THE HEADLAMP's glow over the lens, and the halo that calls him.
  const sprite = (colour: number, size: number): THREE.Sprite => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow(),
        color: colour,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    s.scale.set(size, size, 1);
    s.renderOrder = 9;
    return s;
  };
  const lamps = SLED_LOOK.lamps;
  const lampGlow = [-1, 1].map((sx) => {
    const s = sprite(0xfff4dc, 0.55);
    s.position.set((sx * lamps.width) / 2, lamps.y - SLED.trace.y, lamps.z - SLED.trace.z + 0.06);
    machine.add(s);
    return s;
  });
  const call = sprite(0x7fe0ff, 3.2);
  call.position.set(0, 1.5, 0);
  machine.add(call);

  const axisOf = (a: readonly number[], b: readonly number[]): THREE.Vector3 =>
    // A trace (z, y) pair to the glTF's frame: z forward is −z there.
    new THREE.Vector3(0, b[1] - a[1], -(b[0] - a[0])).normalize();
  const spindleAxis = axisOf(SLED_LOOK.spindle[0], SLED_LOOK.spindle[1]);
  const postAxis = axisOf(SLED_LOOK.post, [SLED_LOOK.grip[0] + 0.023, SLED_LOOK.grip[1] - 0.045]);

  const adopt = (root: THREE.Object3D): void => {
    root.traverse((o) => {
      for (const [key, name] of Object.entries(SLED_NODES) as [keyof typeof SLED_NODES, string][]) {
        if (o.name === name) {
          nodes[key] = o;
          rest.set(o, { p: o.position.clone(), q: o.quaternion.clone() });
        }
      }
      if (typeof o.userData.beltRunMetres === "number") run = o.userData.beltRunMetres;
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        if (o.name === SLED_NODES.lugs || o.parent?.name === SLED_NODES.lugs) {
          if (o.morphTargetInfluences && o.morphTargetInfluences.length > 0) lugs = o;
        }
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) {
          if (m instanceof THREE.MeshStandardMaterial) {
            hazeMaterial(m, haze, "sled");
            if (m.name === "rack_ski") rackMats.ski.push(m);
            if (m.name === "rack_trim") rackMats.trim.push(m);
            if (/lamp/i.test(m.name) && m.name !== "taillight") lampMats.push(m);
          }
          allMats.push(m);
        }
      }
    });
    frame.add(root);
    if (dressed) paintRack(dressed.body, dressed.trim);
  };
  const paintRack = (body: number, trim: number): void => {
    for (const m of rackMats.ski) m.color.setHex(body);
    for (const m of rackMats.trim) m.color.setHex(trim);
  };

  const url = sledModelUrl();
  (url ? new GLTFLoader().loadAsync(url) : Promise.reject(new Error("no model")))
    .then((gltf) => {
      if (disposed) return;
      gltf.scene.rotation.y = Math.PI;
      adopt(gltf.scene);
    })
    .catch(() => {
      if (!disposed) {
        const g = standIn(haze);
        g.rotation.y = Math.PI;
        adopt(g);
      }
    });

  const prev = { x: 0, y: 0, z: 0, q: new THREE.Quaternion(), tick: -1 };
  const cur = { x: 0, y: 0, z: 0, q: new THREE.Quaternion(), tick: -1 };
  const q = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  let shown: { x: number; y: number; z: number; q: THREE.Quaternion } | null = null;
  let clock = 0;
  let belt = 0;

  /** A node put back where the model built it, then moved by `lift` m up
   * and turned by `angle` rad about `axis` (its own frame). */
  const pose = (
    node: THREE.Object3D | undefined,
    lift: number,
    axis: THREE.Vector3 | null,
    angle: number,
  ): void => {
    if (!node) return;
    const r = rest.get(node)!;
    node.position.copy(r.p);
    node.position.y += lift;
    node.quaternion.copy(r.q);
    if (axis && angle !== 0) node.quaternion.multiply(turn.setFromAxisAngle(axis, angle));
  };

  return {
    group,
    update(state, alpha, dt, player) {
      const s: SledState | undefined = state.sled;
      group.visible = !!s;
      if (!s) return;
      clock += dt;
      if (cur.tick !== state.tick) {
        prev.x = cur.x;
        prev.y = cur.y;
        prev.z = cur.z;
        prev.q.copy(cur.q);
        prev.tick = cur.tick;
        cur.x = s.x;
        cur.y = s.y;
        cur.z = s.z;
        cur.q.set(s.q.x, s.q.y, s.q.z, s.q.w);
        cur.tick = state.tick;
        if (prev.tick < 0 || state.tick - prev.tick > 2) {
          prev.x = cur.x;
          prev.y = cur.y;
          prev.z = cur.z;
          prev.q.copy(cur.q);
        }
      }
      const k = Math.max(0, Math.min(1, alpha));
      const x = prev.x + (cur.x - prev.x) * k;
      const y = prev.y + (cur.y - prev.y) * k;
      const z = prev.z + (cur.z - prev.z) * k;
      q.slerpQuaternions(prev.q, cur.q, k);
      machine.position.set(x, y, z);
      machine.quaternion.copy(q);
      shown = { x, y, z, q };
      // THE SKIS on their compression, turned about their spindles with
      // the bars (the engine's ski angle, nose to its +x positive — a turn
      // about the glTF's own up, the half turn commuting with it).
      // The model's left ski (its −x) is the body frame's +x side, the
      // engine's second (`skiComp[1]`): the half turn swaps them.
      pose(nodes.skiL, s.skiComp[1] - SKI_REST, spindleAxis, s.skiAngle);
      pose(nodes.skiR, s.skiComp[0] - SKI_REST, spindleAxis, s.skiAngle);
      pose(nodes.bars, 0, postAxis, s.skiAngle * 0.8);
      // THE REAR SUSPENSION: swung up about the drive by the belt's
      // compression past its rest — the rear end rises toward the tunnel.
      pose(nodes.track, 0, null, 0);
      if (nodes.track) {
        const lift = Math.max(-0.12, Math.min(0.25, s.treadComp - TREAD_REST));
        nodes.track.rotateX(-lift / TRACK_ARM);
      }
      // THE PADDLES round the loop at the belt's speed.
      belt += s.treadSpeed * dt;
      if (lugs?.morphTargetInfluences) {
        lugs.morphTargetInfluences[0] = (((belt / run) % 1) + 1) % 1;
      }
      // THE RACK: the rider's pair on it while he rides.
      if (nodes.rack) nodes.rack.visible = s.rider;
      // THE LAMP while the engine runs; the call while it waits near him.
      const running = s.rider || s.rpm > 100;
      for (const l of lampGlow) l.visible = running;
      for (const m of lampMats) m.emissiveIntensity = running ? 1 : 0.05;
      const near = Math.hypot(player.x - s.x, player.z - s.z);
      const waiting = !s.rider && s.mode !== "down" && near < LIGHT_UP && near > 3;
      call.visible = waiting;
      (call.material as THREE.SpriteMaterial).opacity = 0.35 + 0.35 * Math.sin(clock * 4);
    },
    dressRack(body, trim) {
      dressed = { body, trim };
      paintRack(body, trim);
    },
    drawn() {
      return shown;
    },
    dispose() {
      disposed = true;
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
        if (o instanceof THREE.Sprite) o.material.dispose();
      });
      for (const m of allMats) m.dispose();
    },
  };
}
