// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICK VENUES' OWN SNOW AS DRAWN — the halfpipe's walls
// (`pipe-view.ts`) and a moguls course's or an aerials site's field
// (`mogul-view.ts`) are meshes laid over a grid cut a little below them.
// Each must FACE UP: a sheet wound the other way is culled from above, so
// the cut grid shows where the walls should be and the sheet's underside
// hangs in the air wherever the grid dips under it.

import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { setAerials, setMoguls, type Level } from "@engine";
import { createPipe } from "../pwa/src/game/pipe-view.ts";
import { createMoguls } from "../pwa/src/game/mogul-view.ts";
import { levelFor } from "./support/levels.ts";
import { pipeLevel } from "./support/synthetic.ts";

const paint = (p: THREE.MeshStandardMaterialParameters): THREE.Material =>
  new THREE.MeshStandardMaterial(p);

/** The least upward share of any face's normal in `group`'s meshes. */
function leastUp(group: THREE.Group): number {
  let least = Infinity;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geo = o.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute("position");
    const index = geo.getIndex()!;
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(pos, index.getX(i));
      b.fromBufferAttribute(pos, index.getX(i + 1));
      c.fromBufferAttribute(pos, index.getX(i + 2));
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      if (n.lengthSq() < 1e-12) continue;
      least = Math.min(least, n.normalize().y);
    }
  });
  return least;
}

describe("the trick venues' snow meshes", () => {
  it("the halfpipe's walls face up, the vert included", () => {
    const pipe = createPipe(pipeLevel(), paint);
    expect(pipe).not.toBeNull();
    expect(leastUp(pipe!.group)).toBeGreaterThan(0);
  });

  const fields: [string, () => Level][] = [
    ["a moguls course", () => setMoguls(levelFor(1))],
    ["an aerials site", () => setAerials(levelFor(1), "double")],
  ];
  for (const [name, build] of fields) {
    it(`${name}'s field faces up`, () => {
      const field = createMoguls(build(), paint);
      expect(field).not.toBeNull();
      expect(leastUp(field!.group)).toBeGreaterThan(0);
    });
  }
});
