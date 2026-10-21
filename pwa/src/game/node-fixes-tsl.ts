// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TWO FIXES TO THREE'S NODE BUILDER, made once as the node renderer's chunk
// loads (`gpu-device.ts`; `docs/webgpu.md`, part 11). Each is a fault of the
// library's own that a program of ours runs into; neither changes what a
// program that built before draws.
//
//   A FUNCTION'S CODE IS ITS PROGRAM'S. Three writes a `Fn` with a layout
//   (`setLayout`) as a function of its own, once, and hands the same code
//   to every program after — with the names the FIRST program gave the
//   uniforms and textures it reads inside. A second program numbering its
//   uniforms otherwise (the ground's twin drawn by a second pipeline, a
//   stage reading what the other stage first wrote) is refused ("unresolved
//   value", "struct member not found"), and the frame it was in is dropped.
//   Here the code is written again for each program and each stage.
//
//   A MORPH'S WEIGHTS ON AN INSTANCED MESH are read off its morph texture,
//   and the mesh's own weights' uniform array is never built — but three
//   still copies into it every frame, into a buffer that was never made. A
//   copy into nothing is skipped.

import { FunctionNode, NodeBuilder, UniformArrayNode } from "three/webgpu";

type Fn = FunctionNode<never[]>;

type Builder = {
  shaderStage: string;
  currentFunctionNode: Fn | null;
  buildFunctionCode(shaderNode: object): string;
};

const written = new WeakMap<object, Map<string, WeakMap<object, Fn>>>();

(NodeBuilder.prototype as unknown as { buildFunctionNode: unknown }).buildFunctionNode = function (
  this: Builder,
  shaderNode: object,
): Fn {
  let stages = written.get(this);
  if (!stages) written.set(this, (stages = new Map()));
  let fns = stages.get(this.shaderStage);
  if (!fns) stages.set(this.shaderStage, (fns = new WeakMap()));
  let fn = fns.get(shaderNode);
  if (!fn) {
    fn = new FunctionNode();
    const previous = this.currentFunctionNode;
    this.currentFunctionNode = fn;
    fn.code = this.buildFunctionCode(shaderNode);
    this.currentFunctionNode = previous;
    fns.set(shaderNode, fn);
  }
  return fn;
};

const fill = UniformArrayNode.prototype.updateBuffer;
UniformArrayNode.prototype.updateBuffer = function (this: { value: unknown }) {
  if (this.value !== null && this.value !== undefined) fill.call(this);
};
