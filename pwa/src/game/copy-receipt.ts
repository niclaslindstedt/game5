// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A COPY BUTTON'S RECEIPT: the button wears COPIED (or COULD NOT COPY) for
// two seconds after a press and then goes back to its own label — the
// developer page's REPRO press, the benchmark's report, its history. A copy
// that says nothing is a copy nobody trusts enough to paste.

import { useState } from "preact/hooks";

import { STRINGS } from "./strings.ts";

/** How long a copy button wears its receipt, ms. */
const SAID_MS = 2000;

/** The receipt to show in place of the label (null for the label), and the
 * press: hand it the copy's promise. */
export function useReceipt(): [string | null, (copied: Promise<boolean>) => void] {
  const [said, setSaid] = useState<string | null>(null);
  const say = (copied: Promise<boolean>): void => {
    void copied.then((ok) => {
      setSaid(ok ? STRINGS.devCopied : STRINGS.devCopyFailed);
      setTimeout(() => setSaid(null), SAID_MS);
    });
  };
  return [said, say];
}
