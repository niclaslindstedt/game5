// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEVICE'S CONTENT SETTING, the Apple half: whether the person holding the
// phone has asked not to be shown sensitive content.
//
// The one public answer iOS gives is the sensitive-content analysis policy
// (iOS 17+), which reads two switches in Settings ▸ Privacy & Security:
//
//   descriptiveInterventions — COMMUNICATION SAFETY, the parental control on a
//                              child's account (on by default for the
//                              youngest in a family group). Said as "child".
//   simpleInterventions      — SENSITIVE CONTENT WARNING, an adult's own
//                              choice. Said as "filtered".
//   disabled                 — neither. Said as "open".
//
// The game hides the body's injuries for "child" and "filtered", and locks
// the switch for "child" (pwa/src/game/settings.ts's `injuriesShown`).
//
// Needs the Sensitive Content Analysis capability on the App ID; the
// entitlement comes from native/app.config.js. Without it, or before iOS 17,
// the policy reads as disabled and the game shows what it always has.

import ExpoModulesCore
import SensitiveContentAnalysis

public class ContentFilterModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ContentFilter")

    /// The device's word, read when asked — synchronous, so the shell has it
    /// before the page's first script runs.
    Function("policy") { () -> String in
      if #available(iOS 17.0, *) {
        switch SCSensitivityAnalyzer().analysisPolicy {
        case .descriptiveInterventions:
          return "child"
        case .simpleInterventions:
          return "filtered"
        case .disabled:
          return "open"
        @unknown default:
          return "open"
        }
      }
      return "open"
    }
  }
}
