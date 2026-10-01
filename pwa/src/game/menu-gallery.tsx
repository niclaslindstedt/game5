// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GALLERY — the pictures the player took, looked at inside the game and
// sent on from there. Reached from the front door's GALLERY chip, and the
// other half of the shutter: ENTER (or the phone's own screenshot) files a
// picture (screenshots.ts) and this is the only place one is ever shown.
//
// A VIEWER, NOT A GRID. A player has a handful of pictures and wants to look
// at them, so the picture IS the page: one shot fills the frame and the roll
// runs as a filmstrip under it. Flipping is the primary verb — the two
// arrows either side, or a thumbnail — because "show me the next one" is
// what somebody opening a gallery is doing, and a grid would make them press
// twice for it.
//
// THE TWO ARROWS ARE A STEPPER (`data-nav-steps`, menu-nav.ts), which is how
// the keys flip a picture without this page binding a key of its own: the
// cursor treats the pair as ONE stop and sideways moves the picture rather
// than the ring. It is the same shape every value on every card is picked
// with — an arrow either side of the thing being chosen — so a player who
// has walked OPTIONS has already learned this page.
//
// SENDING ONE ON is the other half, and what that MEANS is the platform's
// answer rather than ours (the framework's `shots/share-image`). Every button is offered
// only where it will actually do something: SHARE raises the phone's own
// sheet (and the desktop's, where there is one), COPY is the desktop answer
// where there is not, and SAVE is the floor every browser can manage.
//
// THE PRESS MUST NOT COST ANYTHING. The card goes up on the frame the row is
// pressed, and the pictures arrive after it: the roll is read off disk behind
// the card, and each strip tile asks for its thumbnail only once it has come
// near the visible part of the strip, one shrink at a time and never at full
// size (the framework's `shots/shot-thumbs`). A strip that instead handed forty
// two-megapixel PNGs to forty `<img>` elements in one render is forty full
// decodes on the frame the player pressed — on the same thread the race
// behind this card is being stepped on.

import type { RefObject } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import {
  canCopyImage,
  canShareImage,
  copyImage,
  pngFile,
  saveImage,
  shareImage,
} from "@niclaslindstedt/oss-game-framework/shots/share-image";
import {
  deleteShot,
  loadShots,
  shot,
  shotsRead,
  subscribeShots,
  type ShotMeta,
} from "@niclaslindstedt/oss-game-framework/shots/shot-store";
import { releaseThumbs, thumbUrl } from "@niclaslindstedt/oss-game-framework/shots/shot-thumbs";
import { MenuBody, MenuHead } from "./menu-knobs.tsx";
import { MAX_SHOTS, armScreenshots, shotFileName } from "./screenshots.ts";
import { STRINGS } from "./strings.ts";

/** How long a result line (COPIED, SAVED) stays under the buttons, ms. */
const NOTICE_MS = 2400;

export function GalleryPage({ onBack }: { onBack: () => void }) {
  const [shots, setShots] = useState<readonly ShotMeta[]>([]);
  // An empty roll is two different sentences depending on this: the card is
  // up before the store has answered, and a player with forty pictures must
  // not be told for a frame that they have none.
  const [read, setRead] = useState(shotsRead);
  const [index, setIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // Two-step delete: a stray press must not destroy a picture that cannot be
  // taken again — the trails it caught have long since been ridden over.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    // Name the store before reading it: an unnamed one is a different
    // database, and this mount is routinely the session's first touch of the
    // roll (the front door, with no run ever ridden this visit).
    armScreenshots();
    void loadShots().then(() => setRead(true));
    return subscribeShots(setShots);
  }, []);

  // Thumbnails outlive the page — a gallery opened twice should shrink each
  // picture once — so they are let go of by what has left the ROLL rather
  // than by this component unmounting.
  useEffect(() => {
    if (!read) return;
    releaseThumbs(new Set(shots.map((entry) => entry.id)));
  }, [read, shots]);

  // A delete can shorten the roll under the cursor.
  const at = Math.min(index, Math.max(0, shots.length - 1));
  const current = shots[at] ?? null;

  const say = useCallback((text: string) => {
    setNotice(text);
    setTimeout(() => setNotice((held) => (held === text ? null : held)), NOTICE_MS);
  }, []);

  const step = useCallback(
    (delta: number) => {
      if (shots.length < 2) return;
      setConfirming(false);
      setIndex((was) => (was + delta + shots.length) % shots.length);
    },
    [shots.length],
  );

  // The pixels on screen. Minted once per picture and revoked when it
  // changes: an object URL made in the render body would leak one per frame,
  // and a browse of forty shots would hold forty live blobs.
  const url = useMemo(() => {
    const entry = current ? shot(current.id) : null;
    return entry ? URL.createObjectURL(entry.blob) : null;
  }, [current]);
  useEffect(() => (url ? () => URL.revokeObjectURL(url) : undefined), [url]);

  const file = useMemo(() => {
    const entry = current ? shot(current.id) : null;
    return entry ? pngFile(entry.blob, shotFileName(entry.label, entry.takenAt)) : null;
  }, [current]);

  const canShare = file !== null && canShareImage(file);
  const canCopy = canCopyImage();

  const doShare = useCallback(async () => {
    if (!file) return;
    // Straight into `share` with the blob already in hand: the gesture that
    // opened the sheet is spent by the first await, so nothing may encode or
    // fetch between the press and the call.
    const ok = await shareImage(file, { title: current?.label ?? "", text: current?.label });
    if (!ok) say(STRINGS.galleryShareOff);
  }, [current?.label, file, say]);

  const doCopy = useCallback(async () => {
    if (!file) return;
    say((await copyImage(file)) ? STRINGS.galleryCopied : STRINGS.galleryCopyOff);
  }, [file, say]);

  const doSave = useCallback(() => {
    if (!file) return;
    say(saveImage(file, file.name) ? STRINGS.gallerySaved : STRINGS.gallerySaveOff);
  }, [file, say]);

  const doDelete = useCallback(() => {
    if (!current) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    void deleteShot(current.id);
  }, [confirming, current]);

  return (
    <div class="menu-card menu-card-gallery">
      {/* An empty roll has the card's own empty state under it saying how a
          picture gets here; the head does not say it a second time. */}
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.galleryTitle} />
      <MenuBody>
        {shots.length > 0 && (
          <div class="menu-sub gallery-sub">{STRINGS.gallerySub(shots.length, MAX_SHOTS)}</div>
        )}
        {shots.length === 0 ? (
          <div class="gallery-empty">{read ? STRINGS.galleryEmpty : STRINGS.galleryReading}</div>
        ) : (
          <div class="gallery">
            <div class="gallery-stage" data-nav-steps data-nav-focus>
              <button
                type="button"
                class="gallery-step"
                data-nav-step="left"
                aria-label={STRINGS.galleryPrev}
                disabled={shots.length < 2}
                onClick={() => step(-1)}
              >
                ‹
              </button>
              <div class="gallery-frame">
                {url && (
                  <img src={url} alt={current?.label ?? ""} class="gallery-img" decoding="async" />
                )}
              </div>
              <button
                type="button"
                class="gallery-step"
                data-nav-step="right"
                aria-label={STRINGS.galleryNext}
                disabled={shots.length < 2}
                onClick={() => step(1)}
              >
                ›
              </button>
            </div>

            <div class="gallery-caption">
              <span class="gallery-label">{current?.label ?? ""}</span>
              <span class="gallery-stamp">
                {STRINGS.galleryAt(at + 1, shots.length, stamp(current))}
              </span>
            </div>

            <div class="gallery-actions">
              {canShare && (
                <button type="button" class="gallery-btn" onClick={() => void doShare()}>
                  {STRINGS.galleryShare}
                </button>
              )}
              {canCopy && (
                <button type="button" class="gallery-btn" onClick={() => void doCopy()}>
                  {STRINGS.galleryCopy}
                </button>
              )}
              <button type="button" class="gallery-btn" onClick={doSave}>
                {STRINGS.gallerySave}
              </button>
              <button
                type="button"
                class={`gallery-btn gallery-btn-quiet${confirming ? " gallery-btn-arm" : ""}`}
                onClick={doDelete}
              >
                {confirming ? STRINGS.galleryDeleteArm : STRINGS.galleryDelete}
              </button>
              <span class="gallery-notice">{notice ?? ""}</span>
            </div>

            {/* The filmstrip: the whole roll, newest first, the shown picture
              framed. Scrolls on its own so a full roll never grows the card
              past the viewport. */}
            <div class="gallery-strip">
              {shots.map((entry, n) => (
                <button
                  key={entry.id}
                  type="button"
                  class={`gallery-thumb${n === at ? " gallery-thumb-on" : ""}`}
                  aria-label={STRINGS.galleryThumb(n + 1)}
                  onClick={() => {
                    setConfirming(false);
                    setIndex(n);
                  }}
                >
                  <Thumb meta={entry} />
                </button>
              ))}
            </div>
          </div>
        )}
      </MenuBody>
    </div>
  );
}

/** A filmstrip thumbnail. Empty until the tile is near enough to the visible
 * part of the strip to be worth a shrink, and then only ever a thumbnail —
 * the URL belongs to the cache, which is why nothing here revokes it. */
function Thumb({ meta }: { meta: ShotMeta }) {
  const slot = useRef<HTMLSpanElement>(null);
  const near = useNear(slot);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!near) return undefined;
    const entry = shot(meta.id);
    if (!entry) return undefined;
    let live = true;
    void thumbUrl(entry).then((made) => {
      if (live) setUrl(made);
    });
    return () => {
      live = false;
    };
  }, [meta.id, near]);
  return (
    <span class="gallery-thumb-slot" ref={slot}>
      {url && <img src={url} alt="" class="gallery-thumb-img" decoding="async" />}
    </span>
  );
}

/** How far outside the strip's visible run a tile still counts as worth
 * making: about two tiles' worth either side, so a slow flick finds its
 * pictures already there rather than filling in behind the scroll. */
const LOOKAHEAD = "0px 240px";

/** One observer for the whole strip. Forty tiles with an observer each is
 * forty times the bookkeeping for the same answer, and the answer is the
 * same one the player gives: a viewport-rooted intersection is clipped by
 * every scrolling ancestor on the way up, so the strip's own overflow is
 * already accounted for. */
const wanted = new WeakMap<Element, () => void>();
let watcher: IntersectionObserver | null = null;

function watchNear(el: Element, then: () => void): () => void {
  if (typeof IntersectionObserver !== "function") {
    // No observer to gate on: show everything, which is what a strip with no
    // gating at all would do.
    then();
    return () => undefined;
  }
  watcher ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const ready = wanted.get(entry.target);
        wanted.delete(entry.target);
        watcher?.unobserve(entry.target);
        ready?.();
      }
    },
    { rootMargin: LOOKAHEAD },
  );
  wanted.set(el, then);
  watcher.observe(el);
  return () => {
    wanted.delete(el);
    watcher?.unobserve(el);
  };
}

/** True once the element has come near the viewport, and true for good — a
 * tile scrolled back out keeps the picture it already has. */
function useNear(ref: RefObject<Element | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return undefined;
    return watchNear(el, () => setNear(true));
  }, [near, ref]);
  return near;
}

/** The picture's own date, in the reader's own clock. */
function stamp(meta: ShotMeta | null): string {
  if (!meta) return "";
  const when = new Date(meta.takenAt);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ${pad(when.getHours())}:${pad(when.getMinutes())}`;
}
