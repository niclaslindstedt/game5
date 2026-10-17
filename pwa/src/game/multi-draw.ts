// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE DRAW, MANY SHAPES, EACH INSTANCED. three's `BatchedMesh` sends every
// shape it holds in one `WEBGL_multi_draw` call — but one copy a shape a
// sub-draw, so a wood of thirty thousand trees would be thirty thousand
// sub-draws. The forest wants the other thing the extension can do: one
// sub-draw a SHAPE, each drawn as many times as there are trees of it
// (`multiDraw*InstancedWEBGL`). three has no path for that, so while one
// batch is ARMED (between its `onBeforeRender` and `onAfterRender`, or the
// shadow pass's pair) the context's draws are redirected to their instanced
// twins with that batch's counts:
//
// - with the extension, `multiDrawArraysWEBGL` / `multiDrawElementsWEBGL`
//   become `multiDrawArraysInstancedWEBGL` / `…ElementsInstancedWEBGL`;
// - without it, three draws a batch one sub-draw at a time (`_gl_DrawID` a
//   uniform), so `drawArrays` / `drawElements` become their instanced
//   twins, each taking the next count.
//
// Nothing else is touched, and an unarmed draw goes through as it was. The
// shader finds its tree from `gl_DrawID` and `gl_InstanceID`
// (`forest-batch.ts`).

type Armed = { instances: Int32Array; next: number };

const slot: Armed = { instances: new Int32Array(0), next: 0 };
let armed: Armed | null = null;
const hooked = new WeakSet<WebGL2RenderingContext>();

/** Install the redirect on `gl` (once a context). */
export function hookMultiDraw(gl: WebGL2RenderingContext): void {
  if (hooked.has(gl)) return;
  hooked.add(gl);
  const ext = gl.getExtension("WEBGL_multi_draw") as {
    multiDrawArraysWEBGL(...a: unknown[]): void;
    multiDrawElementsWEBGL(...a: unknown[]): void;
    multiDrawArraysInstancedWEBGL(...a: unknown[]): void;
    multiDrawElementsInstancedWEBGL(...a: unknown[]): void;
  } | null;
  if (ext) {
    const arrays = ext.multiDrawArraysWEBGL.bind(ext);
    const elements = ext.multiDrawElementsWEBGL.bind(ext);
    ext.multiDrawArraysWEBGL = (mode, firsts, fo, counts, co, drawCount) => {
      if (!armed) return arrays(mode, firsts, fo, counts, co, drawCount);
      ext.multiDrawArraysInstancedWEBGL(
        mode,
        firsts,
        fo,
        counts,
        co,
        armed.instances,
        0,
        drawCount,
      );
    };
    ext.multiDrawElementsWEBGL = (mode, counts, co, type, offsets, oo, drawCount) => {
      if (!armed) return elements(mode, counts, co, type, offsets, oo, drawCount);
      ext.multiDrawElementsInstancedWEBGL(
        mode,
        counts,
        co,
        type,
        offsets,
        oo,
        armed.instances,
        0,
        drawCount,
      );
    };
  }
  const drawArrays = gl.drawArrays.bind(gl);
  const drawElements = gl.drawElements.bind(gl);
  gl.drawArrays = (mode, first, count) => {
    if (!armed) return drawArrays(mode, first, count);
    gl.drawArraysInstanced(mode, first, count, armed.instances[armed.next++]);
  };
  gl.drawElements = (mode, count, type, offset) => {
    if (!armed) return drawElements(mode, count, type, offset);
    gl.drawElementsInstanced(mode, count, type, offset, armed.instances[armed.next++]);
  };
}

/** Every draw from here until `disarm` is instanced, the k-th sub-draw
 * `instances[k]` times. */
export function arm(instances: Int32Array): void {
  slot.instances = instances;
  slot.next = 0;
  armed = slot;
}

export function disarm(): void {
  armed = null;
}
