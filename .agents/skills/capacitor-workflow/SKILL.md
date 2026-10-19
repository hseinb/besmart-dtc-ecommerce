---
name: capacitor-workflow
description: Complete workflow guide for compiling and running Next.js/React web apps on Android and iOS using Capacitor.
---

# Capacitor Cross-Platform Mobile Workflow

This skill outlines best practices for packaging, synchronizing, running, and debugging Next.js/React applications across Android and iOS using Capacitor.

## 1. Core Architecture
- **Web Runtime**: The application runs inside a high-performance native WebView (Android WebView on Android, WKWebView on iOS).
- **Native Bridge**: JavaScript communicates with native device hardware APIs via Capacitor plugins.
- **Build Output**: For standalone offline hybrid packages, Next.js is typically configured with static export (`output: 'export'` in `next.config.js`) so that production HTML/JS/CSS assets are generated into `out/` and copied to native targets.

## 2. Essential Capacitor Commands
- `npx cap sync`: Compiles/copies the latest web build into native `android/` and `ios/` folders and updates native plugins.
- `npx cap copy`: Copies web assets without re-running plugin installations (fast).
- `npx cap run android`: Builds native Android APK and launches on a connected USB device or emulator.
- `npx cap run ios`: Builds native iOS app and launches on an Xcode simulator or connected Mac device.
- `npx cap open android`: Opens the native project in Android Studio for native debugging.
- `npx cap open ios`: Opens the native project in Xcode.
- `npx cap doctor`: Validates installed SDKs, CocoaPods, Node dependencies, and native toolchain health.

## 3. Recommended Capacitor Plugins for B's Mart (B2C)
- `@capacitor/network`: Listen to live network connectivity changes (`Network.addListener('networkStatusChange', ...)`) to toggle offline persistence.
- `@capacitor/preferences`: Fast key-value persistence for customer auth tokens, guest session tokens, and app settings.
- `@capacitor/keyboard`: Manage keyboard appearance and viewport resizing to prevent covering checkout address and coupon inputs.
- `@capacitor-community/barcode-scanner` or `@capacitor-mlkit/barcode-scanning`: Instant product barcode/QR lookup using the shopper's camera.

## 4. Native Styling & Safe Area Directives
- **Safe Area Insets**:
  ```css
  :root {
    --sat: env(safe-area-inset-top);
    --sar: env(safe-area-inset-right);
    --sab: env(safe-area-inset-bottom);
    --sal: env(safe-area-inset-left);
  }
  ```
- **Viewport Meta**: Ensure `viewport-fit=cover` is set in `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- **Disable Rubber-Banding**: Add `overscroll-behavior-y: none;` to the root `body` to avoid jarring bouncing headers on iOS.

## 5. Remote Webview Debugging
- **Android**: Connect device via USB with USB debugging enabled. In desktop Chrome, open `chrome://inspect/#devices` to inspect DOM, network, and console logs inside the running Android WebView.
- **iOS**: Connect device or simulator. In macOS Safari, open `Develop -> [Device Name] -> [App Title]` to inspect webview elements.
