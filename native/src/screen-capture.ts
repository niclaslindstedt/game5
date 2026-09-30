// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PHONE'S OWN SHUTTER, HEARD — the effect half of the screenshot bridge,
// and the only file in the shell that touches expo-screen-capture.
//
// The website owns the feature, as always: ENTER (or the pause card's TAKE
// PICTURE) takes the picture, composites the HUD into it, stamps the mark and
// files it in the gallery (pwa/src/game/screenshots.ts). What a phone adds is a SECOND shutter — the
// hardware's, two buttons on the side — which fires without the page ever
// hearing it. A browser cannot be told; an app can. So this listens, and the
// shell presses the game's own button (src/injected.ts's SHOT_COMMAND).
//
// WHAT THE SKIER GETS is two pictures of the same moment, which is the point:
// the OS keeps its raw frame in the phone's photo gallery, and the game keeps
// its own in the roll behind GALLERY — signed, with the clock and the lap as
// they stood. Neither is a copy of the other, and neither is lost.
//
// WHERE IT WORKS. iOS: everywhere, no permission — UIKit posts a notification
// after the fact. Android: 14 and up, on `DETECT_SCREEN_CAPTURE`, which is an
// install-time permission and prompts nobody. BELOW ANDROID 14 IT DOES
// NOTHING, deliberately: the older API watches the media store and so wants
// the skier's whole photo library, and a game asking for photo access to
// notice its own screenshots is a bad trade and a Play review question
// (app.config.js blocks both of those permissions for the same reason). The
// module logs and stands down; nothing breaks and no picture is lost, since
// the phone's own screenshot lands in the phone's gallery either way.

import * as ScreenCapture from "expo-screen-capture";

/** Hear every screenshot the skier takes, until the hand-back is called.
 *
 * Wrapped because this is the shell's most optional bridge: a device or a
 * build that cannot listen must cost the game nothing at all, and the whole
 * failure mode of a missing picture is a picture the skier already has in
 * their own gallery. */
export function watchScreenshots(told: () => void): () => void {
  try {
    const sub = ScreenCapture.addScreenshotListener(told);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
