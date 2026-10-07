// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STORE APP'S SEAM WITH THE PAGE — the word the shell writes on the one
// global, how it classifies a URL before letting the WebView follow it, and
// the menu words a shell presses the game's own buttons with.
//
// Each half is stated twice in files that cannot import each other (the
// page's `shell-host.ts` and the shell's injected script), which is exactly
// the kind of pair that drifts silently: a renamed global is an app that
// quietly runs the PWA update lifecycle it was built to turn off. This file
// is the only thing holding them together.
//
// `isExternalUrl` is worth a test of its own for a sharper reason: the app has
// no address bar and no back button, so a URL judged INTERNAL when it is not
// replaces the game with a page nobody can leave without killing the app.
//
// And the SHUTTER the shell presses when the phone takes a screenshot of its
// own is the same pair a third time, with a fourth failure mode: it is the one
// bridge nobody can see fail. A misspelled event or an unknown command word is
// a script that runs clean, dispatches into nothing, and leaves a skier with
// the picture in their phone's gallery and none in the game's — which is
// exactly what the feature not existing looks like.
//
// The CLOUD SAVE is the same trap with a round trip in it: the page's ask
// (`SHELL_CLOUD`), the shell's listener (`CLOUD_BRIDGE`) and parser
// (`parseCloudAsk`), and the answer's script (`cloudReply`) back onto the
// event the page hears (`SHELL_CLOUD_EVENT`). A rename anywhere is a save
// that never happens and a game that never says so.

import { describe, expect, it } from "vitest";

import { cloudChanged, cloudReply, parseCloudAsk } from "../native/src/cloud-ask.ts";
import {
  CLOUD_BRIDGE,
  NATIVE_FLAG,
  RUMBLE_BRIDGE,
  SHOT_COMMAND,
  VIEWPORT_HARDENING,
  contentFlag,
} from "../native/src/injected.ts";
import { isExternalUrl } from "../native/src/navigation.ts";
import {
  SHELL_CLOUD_EVENT,
  SHELL_COMMAND,
  SHELL_COMMANDS,
  SHELL_CONTENT_GLOBAL,
  SHELL_GLOBAL,
  askShellCloud,
  onShellCloud,
  onShellCommand,
  shellContent,
  shellHost,
  type ShellCloudAsk,
  type ShellCloudReply,
  type ShellCommand,
} from "../pwa/src/shell-host.ts";

const HOME = "http://localhost:9033";

describe("the shell's word", () => {
  it("writes the global the page reads, under the name the page reads it by", () => {
    expect(NATIVE_FLAG).toContain(SHELL_GLOBAL);
    expect(NATIVE_FLAG).toContain('value: "native"');
  });

  it("freezes it, so nothing on the page can later claim to be a browser", () => {
    expect(NATIVE_FLAG).toContain("writable: false");
    expect(NATIVE_FLAG).toContain("configurable: false");
  });

  it("is a script iOS will accept: an IIFE ending in a primitive", () => {
    for (const script of [
      NATIVE_FLAG,
      RUMBLE_BRIDGE,
      CLOUD_BRIDGE,
      SHOT_COMMAND,
      VIEWPORT_HARDENING,
    ]) {
      expect(script.trimEnd().endsWith("})();")).toBe(true);
      expect(script).toContain("true;");
    }
  });

  it("is the value shellHost() names", () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const before = globals[SHELL_GLOBAL];
    try {
      globals[SHELL_GLOBAL] = "native";
      expect(shellHost()).toBe("native");
      globals[SHELL_GLOBAL] = "tauri";
      expect(shellHost()).toBe("tauri");
      globals[SHELL_GLOBAL] = "chrome";
      expect(shellHost()).toBe(null);
    } finally {
      if (before === undefined) delete globals[SHELL_GLOBAL];
      else globals[SHELL_GLOBAL] = before;
    }
  });

  it("really defines the global when run as the WebView runs it", () => {
    // Evaluated as a PROGRAM against a `window`, because asserting on the
    // source would pass on a script that defines nothing.
    const window = {} as Record<string, unknown>;
    new Function("window", NATIVE_FLAG)(window);
    expect(window[SHELL_GLOBAL]).toBe("native");
    // Strict code (this file) throws on the write; the page's sloppy code
    // would fail silently. Either way the word does not change.
    expect(() => {
      window[SHELL_GLOBAL] = "browser";
    }).toThrow(TypeError);
    expect(window[SHELL_GLOBAL]).toBe("native");
  });
});

describe("the device's content word", () => {
  it("says nothing at all when the device said nothing", () => {
    expect(contentFlag(null)).toBe("");
  });

  it("writes the global the page reads, frozen, as a script iOS will accept", () => {
    for (const word of ["child", "filtered"] as const) {
      const script = contentFlag(word);
      expect(script).toContain(SHELL_CONTENT_GLOBAL);
      expect(script.trimEnd().endsWith("})();")).toBe(true);
      expect(script).toContain("true;");
      const window = {} as Record<string, unknown>;
      new Function("window", script)(window);
      expect(window[SHELL_CONTENT_GLOBAL]).toBe(word);
      expect(() => {
        window[SHELL_CONTENT_GLOBAL] = "open";
      }).toThrow(TypeError);
    }
  });

  it("is the value shellContent() names", () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const before = globals[SHELL_CONTENT_GLOBAL];
    try {
      expect(shellContent()).toBe(null);
      globals[SHELL_CONTENT_GLOBAL] = "child";
      expect(shellContent()).toBe("child");
      globals[SHELL_CONTENT_GLOBAL] = "filtered";
      expect(shellContent()).toBe("filtered");
      globals[SHELL_CONTENT_GLOBAL] = "open";
      expect(shellContent()).toBe(null);
    } finally {
      if (before === undefined) delete globals[SHELL_CONTENT_GLOBAL];
      else globals[SHELL_CONTENT_GLOBAL] = before;
    }
  });
});

describe("a menu row, pressed", () => {
  /** Stand the page's listener up over a stub event bus, run `body`, and
   * put the globals back however it ends. */
  function withBus(body: (bus: EventTarget) => void): void {
    const globals = globalThis as unknown as Record<string, unknown>;
    const bus = new EventTarget();
    const before = [globals.addEventListener, globals.removeEventListener];
    globals.addEventListener = bus.addEventListener.bind(bus);
    globals.removeEventListener = bus.removeEventListener.bind(bus);
    try {
      body(bus);
    } finally {
      if (before[0] === undefined) delete globals.addEventListener;
      else globals.addEventListener = before[0];
      if (before[1] === undefined) delete globals.removeEventListener;
      else globals.removeEventListener = before[1];
    }
  }

  const press = (bus: EventTarget, command: unknown): void => {
    bus.dispatchEvent(new CustomEvent(SHELL_COMMAND, { detail: { command } }));
  };

  it("hears every word a shell may send, and only until the hand-back", () => {
    withBus((bus) => {
      const heard: ShellCommand[] = [];
      const stop = onShellCommand((command) => heard.push(command));
      for (const word of SHELL_COMMANDS) press(bus, word);
      stop();
      // …and nothing after it, which is what a WebView reloading the page
      // must not leave behind.
      press(bus, "restart");
      expect(heard).toEqual([...SHELL_COMMANDS]);
    });
  });

  it("drops a word the game has no button for, rather than guessing", () => {
    withBus((bus) => {
      const heard: ShellCommand[] = [];
      const stop = onShellCommand((command) => heard.push(command));
      for (const word of ["gallery", "SHOT", "", 3, null]) press(bus, word);
      stop();
      expect(heard).toEqual([]);
    });
  });
});

/** Run one of the shell's injected scripts the way a WebView does — as a
 * PROGRAM, against a `window` — and hand back every `sh-` event it dispatched.
 * Asserting on its source would pass on a script that dispatches nothing. */
function eventsFrom(script: string): CustomEvent[] {
  const seen: CustomEvent[] = [];
  const bus = new EventTarget();
  const window = {
    dispatchEvent(event: Event): boolean {
      seen.push(event as CustomEvent);
      return bus.dispatchEvent(event);
    },
  };
  new Function("window", script)(window);
  return seen;
}

describe("the phone's own shutter, relayed", () => {
  it("presses a button the game already has, by a word the page answers to", () => {
    const [event, ...rest] = eventsFrom(SHOT_COMMAND);
    expect(rest).toEqual([]);
    expect(event.type).toBe(SHELL_COMMAND);
    expect(SHELL_COMMANDS).toContain(event.detail.command);
    expect(event.detail.command).toBe("shot" satisfies ShellCommand);
  });

  it("is heard by the page's own listener, all the way through", () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const before = {
      add: globals.addEventListener,
      remove: globals.removeEventListener,
    };
    const bus = new EventTarget();
    globals.addEventListener = bus.addEventListener.bind(bus);
    globals.removeEventListener = bus.removeEventListener.bind(bus);
    try {
      const heard: ShellCommand[] = [];
      const stop = onShellCommand((command) => heard.push(command));
      for (const event of eventsFrom(SHOT_COMMAND)) bus.dispatchEvent(event);
      stop();
      // ...and nothing after the hand-back, which is what a WebView reloading
      // the page must not leave behind.
      for (const event of eventsFrom(SHOT_COMMAND)) bus.dispatchEvent(event);
      expect(heard).toEqual(["shot"]);
    } finally {
      if (before.add === undefined) delete globals.addEventListener;
      else globals.addEventListener = before.add;
      if (before.remove === undefined) delete globals.removeEventListener;
      else globals.removeEventListener = before.remove;
    }
  });
});

describe("the cloud save, asked and answered", () => {
  /** Point the page's globals at `bus` for the length of `body`. */
  function onBus(bus: EventTarget, body: () => void): void {
    const globals = globalThis as unknown as Record<string, unknown>;
    const names = ["addEventListener", "removeEventListener", "dispatchEvent"] as const;
    const before = names.map((n) => globals[n]);
    for (const n of names) globals[n] = (bus[n] as (...a: unknown[]) => unknown).bind(bus);
    try {
      body();
    } finally {
      names.forEach((n, i) => {
        if (before[i] === undefined) delete globals[n];
        else globals[n] = before[i];
      });
    }
  }

  const ASKS: ShellCloudAsk[] = [
    { action: "status", requestId: "cloud-1" },
    { action: "load", requestId: "cloud-2" },
    { action: "save", requestId: "cloud-3", data: '{"v":1}' },
  ];

  it("carries every ask the page makes to the shell's parser, word for word", () => {
    // The page's own ask, the shell's own listener run as the WebView runs
    // it, and the shell's own parser: a rename in any of the three is an ask
    // that never reaches the cloud, and a save that silently never happens.
    const page = new EventTarget();
    const posted: string[] = [];
    const window = {
      addEventListener: page.addEventListener.bind(page),
      ReactNativeWebView: { postMessage: (raw: string) => posted.push(raw) },
    };
    new Function("window", CLOUD_BRIDGE)(window);
    onBus(page, () => {
      for (const ask of ASKS) askShellCloud(ask);
    });
    expect(posted.map(parseCloudAsk)).toEqual(ASKS);
  });

  it("hands every answer back on the event the page hears", () => {
    const bus = new EventTarget();
    const heard: ShellCloudReply[] = [];
    const replies = [
      cloudReply({ event: "status", requestId: "cloud-1", ok: true, available: true }),
      cloudReply({ event: "load", requestId: "cloud-2", ok: true, data: "x" }),
      cloudChanged(),
    ];
    for (const script of replies) {
      expect(script.trimEnd().endsWith("})();")).toBe(true);
      expect(script).toContain("true;");
    }
    onBus(bus, () => {
      const stop = onShellCloud((reply) => heard.push(reply));
      for (const script of replies) {
        for (const event of eventsFrom(script)) {
          expect(event.type).toBe(SHELL_CLOUD_EVENT);
          bus.dispatchEvent(event);
        }
      }
      stop();
      // ...and nothing after the hand-back.
      for (const event of eventsFrom(cloudChanged())) bus.dispatchEvent(event);
    });
    expect(heard).toEqual([
      { event: "status", requestId: "cloud-1", ok: true, available: true },
      { event: "load", requestId: "cloud-2", ok: true, data: "x" },
      { event: "changed" },
    ]);
  });

  it("lets nothing that is not a cloud ask through to the cloud", () => {
    for (const raw of [
      "not json",
      "null",
      JSON.stringify({ sh: "rumble", ms: 20, strength: 1 }),
      JSON.stringify({ sh: "cloud", action: "save", requestId: "r" }),
      JSON.stringify({ sh: "cloud", action: "wipe", requestId: "r" }),
      JSON.stringify({ sh: "cloud", action: "load" }),
    ]) {
      expect(parseCloudAsk(raw)).toBeNull();
    }
  });
});

describe("isExternalUrl", () => {
  it("keeps the game's own origin inside the WebView, path and query and all", () => {
    expect(isExternalUrl(`${HOME}/`, HOME)).toBe(false);
    expect(isExternalUrl(`${HOME}/?seed=38`, HOME)).toBe(false);
    expect(isExternalUrl(`${HOME}/assets/index-a1b2c3.js`, HOME)).toBe(false);
  });

  it("hands an off-site link to the system browser", () => {
    // The HUD's build label links the commit on GitHub — the one link in the
    // game that leaves the site.
    expect(isExternalUrl("https://github.com/niclaslindstedt/game4", HOME)).toBe(true);
    expect(isExternalUrl("https://game4.niclaslindstedt.se/", HOME)).toBe(true);
  });

  it("judges by ORIGIN, so a lookalike host cannot pass by starting with ours", () => {
    expect(isExternalUrl("http://localhost:9033.evil.test/", HOME)).toBe(true);
    expect(isExternalUrl("http://localhost:9034/", HOME)).toBe(true);
  });

  it("leaves every non-http scheme alone — those are the WebView's own loads", () => {
    expect(isExternalUrl("about:blank", HOME)).toBe(false);
    expect(isExternalUrl("blob:http://localhost:9033/abc", HOME)).toBe(false);
    expect(isExternalUrl("data:text/html,<p>hi", HOME)).toBe(false);
  });

  it("has nothing to be outside of before the source resolves", () => {
    expect(isExternalUrl("https://example.test/", null)).toBe(false);
  });
});
