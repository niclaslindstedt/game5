// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDS' NAMES (`boards.ts`), named as the skis are. Stated apart
// from `skis.ts` because that file is one of the sources the modelled skis
// are stamped against (`make models`, `tests/models_test.ts`): a board
// added to the range draws no ski and should move no model.

/** The snowboards (`boards.ts`). */
export type BoardId = "lynx" | "pika" | "stoat" | "ptarmigan" | "wolf" | "goshawk";
