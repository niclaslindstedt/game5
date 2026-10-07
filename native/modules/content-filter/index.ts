// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The TypeScript face of the local CONTENT FILTER native module (ios/
// ContentFilterModule.swift): the device's sensitive-content policy.
//
// Loaded OPTIONALLY: a build without the native module (Android, Expo Go, the
// web target) gets `null` here and the shell says nothing to the page.

import { requireOptionalNativeModule } from "expo";

export type ContentFilterNativeModule = {
  /** A parental control (`child`), the owner's own filter (`filtered`), or
   * neither (`open`). */
  policy(): "child" | "filtered" | "open";
};

/** The native module, or null in a build that doesn't carry it. */
export const ContentFilter =
  requireOptionalNativeModule<ContentFilterNativeModule>("ContentFilter");

export default ContentFilter;
