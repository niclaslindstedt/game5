// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The flashes an effect drives are lent a fixed few real lamps
// (`pwa/src/game/flash-lights.ts`), so the lights three counts never move
// while a run is up — a light come or gone relinks every lit program.
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createFlashLamps, FlashPoint } from "../pwa/src/game/flash-lights.ts";

/** The point lights a frame of `scene` would see. */
function lightsSeen(scene: THREE.Object3D): number {
  let n = 0;
  const walk = (o: THREE.Object3D): void => {
    if (!o.visible) return;
    if ((o as THREE.PointLight).isPointLight) n++;
    o.children.forEach(walk);
  };
  walk(scene);
  return n;
}

describe("flash lamps", () => {
  it("keep the count three sees while flashes are built, shown and hidden", () => {
    const scene = new THREE.Scene();
    const lamps = createFlashLamps(1);
    lamps.setCount(1);
    scene.add(lamps.group);
    const before = lightsSeen(scene);
    const effect = new THREE.Group();
    effect.visible = false;
    effect.position.set(10, 2, -4);
    const flash = new FlashPoint(0xff0000, 0, 30, 2);
    effect.add(flash);
    scene.add(effect);
    for (const shown of [false, true, false, true]) {
      effect.visible = shown;
      flash.intensity = 50;
      lamps.lend(scene);
      expect(lightsSeen(scene)).toBe(before);
      const lamp = lamps.group.children[0] as THREE.PointLight;
      expect(lamp.intensity).toBe(shown ? 50 : 0);
    }
    flash.dispose();
    lamps.dispose();
  });

  it("lend the strongest flash shown, at where it is", () => {
    const scene = new THREE.Scene();
    const lamps = createFlashLamps(1);
    scene.add(lamps.group);
    const weak = new FlashPoint(0x00ff00, 5, 10, 1);
    const strong = new FlashPoint(0xffffff, 80, 40, 2);
    const holder = new THREE.Group();
    holder.position.set(3, 0, 0);
    strong.position.set(0, 4, 0);
    holder.add(strong);
    scene.add(weak, holder);
    lamps.lend(scene);
    const lamp = lamps.group.children[0] as THREE.PointLight;
    expect(lamp.intensity).toBe(80);
    expect(lamp.distance).toBe(40);
    expect(lamp.position.toArray()).toEqual([3, 4, 0]);
    // A flash in another scene is never lent this one's lamp.
    holder.removeFromParent();
    new THREE.Scene().add(holder);
    lamps.lend(scene);
    expect(lamp.intensity).toBe(5);
    weak.dispose();
    strong.dispose();
  });

  it("lend nothing on a run that stands none up", () => {
    const scene = new THREE.Scene();
    const lamps = createFlashLamps(1);
    lamps.setCount(0);
    scene.add(lamps.group);
    const f = new FlashPoint(0xffffff, 10);
    scene.add(f);
    lamps.lend(scene);
    expect(lightsSeen(scene)).toBe(0);
    f.dispose();
  });
});
