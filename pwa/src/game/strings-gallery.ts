// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE SHUTTER AND THE GALLERY — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names, so nothing reads it by any other path. Split out because
// it is a subject of its own (`screenshots.ts`, `menu-gallery.tsx`), and a
// table that grew every such block in place would be the one file every
// change to the game had to touch.

export const GALLERY_STRINGS = {
  /** The one line of context a picture carries (`run-news.ts`'s
   * `shotLabel`): the mountain, where on the piste it was (the gate count,
   * or the free ride that counts none), how fast, on which pair. It is the
   * gallery's caption and, slugged, most of the file's name. */
  shotLabel: (parts: {
    seed: number;
    gate: number | null;
    gates: number;
    kmh: number;
    skis: string;
  }): string =>
    [
      `SEED ${parts.seed}`,
      parts.gate === null ? "FREE RIDE" : `GATE ${parts.gate}/${parts.gates}`,
      `${Math.round(parts.kmh)} KM/H`,
      parts.skis.toUpperCase(),
    ].join(" · "),
  /** The receipt, in the news column. A picture is filed frames after the
   * press that asked for it, so the press gets an answer either way — the
   * one thing worse than a failed capture is a shutter that says nothing.
   * The second line is the same picture with a copy of it on the CLIPBOARD,
   * said only once the write has come back: a browser may hold the
   * permission back, and a receipt that promised a paste that is not there
   * is worse than no receipt at all. */
  shotKept: "PICTURE SAVED",
  shotCopied: "PICTURE SAVED · COPIED",
  shotFailed: "PICTURE FAILED",
  /** The front door's chip. */
  menuGallery: "GALLERY",
  /** The gallery. The subtitle counts the roll against its cap, because the
   * oldest picture falling off is the one thing about this page a player
   * would otherwise discover by losing something. */
  galleryTitle: "GALLERY",
  gallerySub: (kept: number, cap: number): string => `${kept}/${cap} — the oldest falls off`,
  /** Before the roll has been read, and after it has come back empty. Two
   * different sentences on purpose: a player with forty pictures must not be
   * told for a frame that they have none. */
  galleryReading: "Reading the roll…",
  galleryEmpty:
    "Nothing here yet. Press P during a run — or take a screenshot on a phone — and the picture lands here.",
  /** The three ways a picture leaves the game, offered only where the
   * browser will actually do them (the framework's `shots/share-image`), and
   * the two-step delete beside them — a stray press must not destroy a
   * picture that cannot be taken again. */
  galleryShare: "SHARE",
  galleryCopy: "COPY",
  gallerySave: "SAVE",
  galleryDelete: "DELETE",
  galleryDeleteArm: "SURE?",
  /** What each of them says afterwards. A dismissed share sheet is an
   * ordinary outcome rather than a failure, and says so. */
  galleryShareOff: "SHARE CANCELLED",
  galleryCopied: "COPIED",
  galleryCopyOff: "COPY REFUSED",
  gallerySaved: "SAVED",
  gallerySaveOff: "SAVE REFUSED",
  /** Which picture of how many, and when it was taken, in the reader's own
   * clock. */
  galleryAt: (at: number, of: number, when: string): string => `${at}/${of} · ${when}`,
  galleryPrev: "Previous screenshot",
  galleryNext: "Next screenshot",
  galleryThumb: (n: number): string => `Screenshot ${n}`,
  /** OPTIONS ▸ KEYS' two rows, and the HUD's switch on OPTIONS itself. */
  keyShot: "SHOT",
  keyHud: "HUD",
  optHud: "HUD",
  optHudHint:
    "The readouts over the snow — off leaves the run and the thumbs and nothing else, and a picture taken then is the snow alone (H)",
} as const;
