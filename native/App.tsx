// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The native shell. It is deliberately thin: a full-bleed WebView over the copy
// of the game bundled inside the app, so the app looks and plays exactly like
// the website, plus the two things a browser can't give iOS on its own — an
// audio session that lets the game's synthesized sound play through the
// ringer switch, and the phone's haptics under a game that already knows what
// it wants felt (src/rumble.ts, src/haptics.ts) — and it hears the phone's own
// screenshot, which no browser can, so a picture taken with the hardware is
// filed in the game's gallery too (src/screen-capture.ts) — and it carries the
// skier's book between their devices through iCloud, which a browser has no
// way to reach (src/cloud-save.ts). Further platform services
// (achievements, a share sheet) are bridges to be added one at a time on top
// of this, each as its own module under src/ and a flag on the message
// channel below — and each one a thing the website already does first.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { setAudioModeAsync } from "expo-audio";
import * as SplashScreen from "expo-splash-screen";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent, WebViewNavigation } from "react-native-webview";

import { cloudChanged, parseCloudAsk } from "./src/cloud-ask";
import { onCloudChange, serveCloudAsk } from "./src/cloud-save";
import { BRAND_BG, REMOTE_GAME_URL } from "./src/config";
import { playRumble } from "./src/haptics";
import {
  CLOUD_BRIDGE,
  NATIVE_FLAG,
  RUMBLE_BRIDGE,
  SHOT_COMMAND,
  VIEWPORT_HARDENING,
} from "./src/injected";
import { startLocalServer, type LocalServer } from "./src/local-server";
import { isExternalUrl } from "./src/navigation";
import { parseRumble } from "./src/rumble";
import { watchScreenshots } from "./src/screen-capture";

// Keep the native splash up until the WebView paints its first frame, so the
// skier never sees a white flash or a half-loaded page.
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const webRef = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const canGoBack = useRef(false);
  // The URL the WebView loads: the local server's origin once it is up, or the
  // remote override when EXPO_PUBLIC_GAME_URL is set. null until resolved, so
  // the splash/loader holds until there is something to show.
  const [uri, setUri] = useState<string | null>(null);
  const serverRef = useRef<LocalServer | null>(null);

  // Resolve where to load from: the bundled site over a local HTTP server by
  // default (self-contained, offline), or a remote URL when overridden. Held
  // in a stable callback so RETRY can re-run it after a failure.
  const startSource = useCallback(async () => {
    setFailed(false);
    setLoaded(false);
    if (REMOTE_GAME_URL) {
      setUri(REMOTE_GAME_URL);
      return;
    }
    try {
      if (!serverRef.current) {
        serverRef.current = await startLocalServer();
      }
      setUri(serverRef.current.origin);
    } catch {
      setFailed(true);
    }
  }, []);

  // Start the source on mount; tear the server down on unmount.
  useEffect(() => {
    void startSource();
    return () => {
      void serverRef.current?.stop();
      serverRef.current = null;
    };
  }, [startSource]);

  // Route the game's audio through a playback session so it is audible even
  // when the ringer switch is silenced — a game should sound like a game.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // THE PHONE'S SHUTTER, RELAYED. A screenshot taken with the hardware buttons
  // is invisible to the page, so the shell hears it for the game and presses
  // the game's own shutter — a second way to a button the website already has,
  // never a feature of its own. Only once the page is up: a press into a
  // WebView that has not loaded is a script evaluated against nothing.
  useEffect(() => {
    if (!loaded) return;
    return watchScreenshots(() => {
      webRef.current?.injectJavaScript(SHOT_COMMAND);
    });
  }, [loaded]);

  // Android hardware back navigates the WebView history instead of closing the
  // app, until there's nowhere left to go back to (then default: exit).
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack.current) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const onNavStateChange = useCallback((nav: WebViewNavigation) => {
    canGoBack.current = nav.canGoBack;
  }, []);

  // Keep the WebView on the site and hand anything else to the skier's own
  // browser — see `isExternalUrl`. Returning false cancels the navigation, so
  // the game stays exactly where it was while the link opens elsewhere.
  const onShouldStartLoad = useCallback(
    (req: WebViewNavigation) => {
      if (!isExternalUrl(req.url, uri)) return true;
      void Linking.openURL(req.url).catch(() => {});
      return false;
    },
    [uri],
  );

  // THE MESSAGE CHANNEL. One flag per bridge, and anything the shell has no
  // bridge for is dropped where it lands — the page can post whatever it
  // likes and none of it may reach the shell by accident.
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const raw = event.nativeEvent.data;
    const pulse = parseRumble(raw);
    if (pulse) playRumble(pulse);
    const ask = parseCloudAsk(raw);
    // The cloud answers on its own time, so the reply is injected when it
    // arrives rather than returned (src/cloud-save.ts).
    if (ask) void serveCloudAsk(ask).then((script) => webRef.current?.injectJavaScript(script));
  }, []);

  // ANOTHER DEVICE WROTE THE STORE. iCloud tells the shell, the shell tells
  // the page, and the page pulls and merges (pwa/src/game/use-cloud-sync.ts).
  useEffect(() => onCloudChange(() => webRef.current?.injectJavaScript(cloudChanged())), []);

  const reveal = useCallback(() => {
    setLoaded(true);
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  const retry = useCallback(() => {
    // A loaded page that errored just needs a reload; a failure before the
    // source resolved (e.g. the local server never started) re-runs startup.
    if (uri) {
      setFailed(false);
      setLoaded(false);
      webRef.current?.reload();
    } else {
      void startSource();
    }
  }, [uri, startSource]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {uri && (
        <WebView
          ref={webRef}
          source={{ uri }}
          originWhitelist={["*"]}
          style={styles.web}
          // The game manages its own audio start on first touch; let it play
          // inline without a gesture gate on the media element itself.
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          // Make it feel native: no rubber-band bounce, no page scroll (the
          // game owns the whole viewport and scrolls nothing), no accidental
          // history swipes — a swipe belongs to the handlebars.
          bounces={false}
          scrollEnabled={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          allowsBackForwardNavigationGestures={false}
          // NO TEXT TOOL OVER THE SNOW. The website already says this in CSS
          // — `user-select: none` and `-webkit-touch-callout: none` on every
          // element (pwa/src/styles.css), restated in VIEWPORT_HARDENING for
          // a WKWebView that loads before that stylesheet does — and iOS
          // still answers a double tap, or a press and hold, with the caret
          // loupe: the magnifying lens for placing a text cursor, swum over
          // the snow because a thumb bounced on the screen. The gesture is the
          // WebView's own, recognized in UIKit before the page is consulted,
          // so no stylesheet can reach it; `WKPreferences.textInteractionEnabled`
          // is the switch that can, and this is the only place in the tree
          // that has one. The cost is the seed field on the start card: it
          // still takes focus, raises the keyboard and types, but a caret
          // cannot be placed mid-number, so a correction is retyped rather
          // than edited. A loupe over the game everywhere is the worse trade.
          textInteractionEnabled={false}
          // Kill WKWebView's input accessory bar (the ▲▼/done strip above the
          // keyboard) — on a landscape phone it eats a third of the little
          // space the keyboard leaves, and a typed seed has nothing to
          // navigate between.
          hideKeyboardAccessoryView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          setSupportMultipleWindows={false}
          // No HTTP cache: the site is served from local disk, so caching buys
          // nothing — and a cached index.html from a previous bundle would
          // reference hashed chunks that no longer exist in the new webroot,
          // which surfaces as a silent black screen when a lazily-loaded
          // chunk 404s. (Settings are storage, not cache — they persist.)
          cacheEnabled={false}
          // Persist the game's localStorage (the settings, the seed last
          // raced) across launches.
          domStorageEnabled
          javaScriptEnabled
          // The shell flag must exist before the game's scripts read it, and
          // the rumble and cloud listeners before the first thing that could
          // ask for a pulse or a save; the hardening runs once the document
          // is up.
          injectedJavaScriptBeforeContentLoaded={`${NATIVE_FLAG}\n${RUMBLE_BRIDGE}\n${CLOUD_BRIDGE}`}
          injectedJavaScript={VIEWPORT_HARDENING}
          onMessage={onMessage}
          onNavigationStateChange={onNavStateChange}
          onShouldStartLoadWithRequest={onShouldStartLoad}
          onLoadEnd={reveal}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
        />
      )}

      {!loaded && !failed && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#e0332b" />
        </View>
      )}

      {failed && (
        <View style={styles.overlay}>
          <Text style={styles.title}>The trail is closed</Text>
          <Text style={styles.body}>
            {REMOTE_GAME_URL
              ? "The game needs a connection to load. Check your network and try again."
              : "The game couldn't start up. Try again."}
          </Text>
          <Pressable style={styles.button} onPress={retry}>
            <Text style={styles.buttonText}>RETRY</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// The overlay's colours are the winter-day palette (pwa/src/identity.ts): the
// high sky behind, the HUD's shadow ink for the words, the gate's red on
// the button.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND_BG },
  web: { flex: 1, backgroundColor: BRAND_BG },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_BG,
    paddingHorizontal: 32,
    gap: 16,
  },
  title: { color: "#0d2233", fontSize: 20, fontWeight: "700" },
  body: { color: "#0d2233", fontSize: 14, textAlign: "center", lineHeight: 20 },
  button: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: "#e0332b",
    borderRadius: 6,
  },
  buttonText: { color: "#ffffff", fontWeight: "700", letterSpacing: 1 },
});
