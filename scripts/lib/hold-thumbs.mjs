// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THUMBS HELD ON THE GLASS for `scripts/screenshot.mjs`'s `thumbs`: the
// HUD's pads are drawn only under a finger, so a picture of them is taken
// with the fingers still down.

/** Fingers touched down at `[x, y, dx, dy]` (shares of the viewport, then
 * px dragged) and left down: two thumbs at once are a touch stream, which
 * the page's pointer events are made of. */
export async function holdThumbs(page, thumbs) {
  const { width, height } = page.viewportSize();
  const cdp = await page.context().newCDPSession(page);
  const at = (k) =>
    thumbs.map(([x, y, dx, dy], id) => ({
      x: width * x + dx * k,
      y: height * y + dy * k,
      id,
    }));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0) });
  for (let i = 1; i <= 6; i++) {
    await page.waitForTimeout(40);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(i / 6) });
  }
}
