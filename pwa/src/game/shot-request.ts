// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHUTTER'S REQUEST — a picture asked for at the PRESS and served FRAMES
// LATER, when there is a picture to serve.
//
// The two halves cannot happen at the same moment and that is the whole of
// why this module exists:
//
//   AT THE PRESS the label is read off the run as it stands, the HUD is
//   rasterized as it stands (the framework's `shots/shot-hud`), and THE CLIPBOARD IS CLAIMED —
//   the write wants the press's own user activation and there is none left by
//   the time a buffer can be read (the framework's `shots/share-image`). What comes back is
//   a promise the picture is handed to when it exists.
//
//   AT THE FRAME the pixels are lifted, and only there: the context keeps no
//   back buffer for anyone who asks later, so they have to come off in the
//   same task as the render that filled them. Everything after the grab can
//   wait, and does.
//
// ONE AT A TIME. A held key repeats, and a second request landing on the same
// frame would replace the first one's label with its own.
//
// A FACTORY over the app's own closures, the `app-load.ts` shape.

import { captureFrame } from "./screenshots.ts";
import type { HudLayer } from "@niclaslindstedt/oss-game-framework/shots/shot-hud";
import {
  copyWhenReady,
  type PendingCopy,
} from "@niclaslindstedt/oss-game-framework/shots/share-image";
import { STRINGS } from "./strings.ts";

export type ShotRequestWorld = {
  /** The canvas the picture comes off, or null once the app is gone. */
  canvas: () => HTMLCanvasElement | null;
  /** Whether there is a run to photograph and a news column to answer in.
   * Under the front door the frame is the bot's demo behind a card and the
   * receipt has nowhere to go; the pause card counts, because a held frame is
   * a frame and the card over it is part of what was on the screen. */
  answers: () => boolean;
  /** The one line of context the picture carries (the framework's `shots/shot-plan`). */
  label: () => string;
  /** The HUD as it stood at the press, rasterized. */
  hud: () => HudLayer | null;
  /** A line in the news column — the receipt. */
  say: (text: string, tone: "good" | "bad") => void;
};

export type ShotRequest = {
  /** The shutter, pressed. */
  take: () => void;
  /** Serve whatever was asked for, in the same task as the render that filled
   * the buffer. Called once a frame, right after the draw. */
  serve: () => void;
};

export function createShotRequest(world: ShotRequestWorld): ShotRequest {
  let wanted: { label: string; hud: HudLayer | null; copy: PendingCopy | null } | null = null;
  return {
    take: () => {
      if (!world.answers() || wanted) return;
      wanted = { label: world.label(), hud: world.hud(), copy: copyWhenReady() };
    },
    serve: () => {
      const shot = wanted;
      if (!shot) return;
      wanted = null;
      const canvas = world.canvas();
      if (!canvas) {
        shot.copy?.ready(null);
        world.say(STRINGS.shotFailed, "bad");
        return;
      }
      void captureFrame(canvas, shot.label, shot.hud).then(async (capture) => {
        shot.copy?.ready(capture?.blob ?? null);
        if (!capture) return world.say(STRINGS.shotFailed, "bad");
        // The copy is waited on rather than assumed: a browser can hold the
        // permission back, and one receipt that tells the truth is worth more
        // than an instant one that does not.
        const copied = (await shot.copy?.done) ?? false;
        world.say(copied ? STRINGS.shotCopied : STRINGS.shotKept, "good");
      });
    },
  };
}
