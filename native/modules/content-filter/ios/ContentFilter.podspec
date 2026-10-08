# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# The local Expo module behind the device's CONTENT SETTING on iOS (see
# ../index.ts). Autolinked from ../expo-module.config.json — there is no npm
# package to install.

Pod::Spec.new do |s|
  s.name           = 'ContentFilter'
  s.version        = '1.0.0'
  s.summary        = 'The device sensitive-content policy'
  s.description    = 'Reads whether a parental control or the owner hides sensitive content.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  # Matches the deployment target the SDK's own modules use (expo-haptics).
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # iOS 17 and later; weak, so the app still launches on 16.
  s.weak_frameworks = 'SensitiveContentAnalysis'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
