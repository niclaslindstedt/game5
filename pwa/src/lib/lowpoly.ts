// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PILE OF COLOURED TRIANGLES that becomes one flat-shaded, vertex-coloured
// geometry — how the wildlife is sculpted (`bird-shapes.ts`,
// `beast-shapes.ts`). Every vertex is its own, so `computeVertexNormals`
// yields one normal a face and a loft reads as panels; a few percent of
// brightness per facet, hashed off the facet's index, keeps one big flat
// colour from reading as plastic under a light with no texture to break it.
// Generic: nothing of this game in it.

import * as THREE from "three";

export type P = [number, number, number];

export class Builder {
  private pos: number[] = [];
  private col: number[] = [];
  private readonly c = new THREE.Color();
  private n = 0;

  /** How many vertices have been emitted. */
  get vertexCount(): number {
    return this.pos.length / 3;
  }

  tri(a: P, b: P, c: P, color: number): void {
    const jitter = 1 + (((this.n++ * 2654435761) >>> 0) / 4294967296 - 0.5) * 0.08;
    this.c.setHex(color).multiplyScalar(jitter);
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }

  /** Two triangles, wound a→b→c→d seen from the outside. */
  quad(a: P, b: P, c: P, d: P, color: number): void {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** A closed tube from `a` to `b`, `sides` facets round, `rb` the radius
   * at `b` when it tapers. */
  tube(a: P, b: P, r: number, color: number, sides = 6, rb = r): void {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const seed = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(seed, d).normalize();
    const v = new THREE.Vector3().crossVectors(d, u);
    const ring = (o: P, radius: number): P[] => {
      const out: P[] = [];
      for (let k = 0; k < sides; k++) {
        const t = (k / sides) * Math.PI * 2;
        const cx = Math.cos(t) * radius;
        const cy = Math.sin(t) * radius;
        out.push([
          o[0] + u.x * cx + v.x * cy,
          o[1] + u.y * cx + v.y * cy,
          o[2] + u.z * cx + v.z * cy,
        ]);
      }
      return out;
    };
    const ra = ring(a, r);
    const rb2 = ring(b, rb);
    // The ring turns right-handed about the tube's axis, so a→b along the
    // side winds the outside out; the end at `a` fans backward.
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      this.quad(ra[k], ra[k1], rb2[k1], rb2[k], color);
    }
    this.cap(ra, color, true);
    this.cap(rb2, color, false);
  }

  /** A fan over a ring from its first point; `reverse` flips the winding
   * for the end that faces the other way. The ring must be star-shaped
   * from that point. */
  cap(ring: P[], color: number, reverse: boolean): void {
    for (let k = 1; k + 1 < ring.length; k++) {
      if (reverse) this.tri(ring[0], ring[k + 1], ring[k], color);
      else this.tri(ring[0], ring[k], ring[k + 1], color);
    }
  }

  /** Panels between consecutive rings of equal length, `paint[k]` for the
   * panel after point k. Rings that turn right-handed about the direction
   * they advance in wind every panel's outside out. `closed` joins the last
   * point back to the first. */
  loft(rings: P[][], paint: readonly number[], closed: boolean): void {
    const n = rings[0].length;
    const segs = closed ? n : n - 1;
    for (let i = 0; i + 1 < rings.length; i++) {
      const r0 = rings[i];
      const r1 = rings[i + 1];
      for (let k = 0; k < segs; k++) {
        const k1 = (k + 1) % n;
        this.quad(r0[k], r0[k1], r1[k1], r1[k], paint[k]);
      }
    }
  }

  /** The raw arrays, for a caller that adds attributes of its own. */
  arrays(): { position: Float32Array; color: Float32Array } {
    return { position: new Float32Array(this.pos), color: new Float32Array(this.col) };
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}
