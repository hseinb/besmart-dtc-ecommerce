---
name: capacitor-hybrid-plugins
description: Integration patterns for Capacitor mobile hardware plugins (network, preferences, keyboard, barcode scanning) and remote webview debugging.
---

# Capacitor Hybrid Plugins & Mobile Integration

This skill provides implementation patterns and debugging guidelines for integrating native mobile hardware features into Next.js/React applications via Capacitor.

## 1. Essential Capacitor Plugins

### A. Network Status (`@capacitor/network`)
Detect online/offline status transitions to toggle the offline order replay queue:
```typescript
import { Network } from '@capacitor/network';

export async function setupNetworkMonitoring(onStatusChange: (online: boolean) => void) {
  const status = await Network.getStatus();
  onStatusChange(status.connected);

  Network.addListener('networkStatusChange', (status) => {
    onStatusChange(status.connected);
  });
}
```

### B. Secure Local Storage (`@capacitor/preferences`)
Fast, native key-value storage for auth tokens, last synced timestamps, and device preferences:
```typescript
import { Preferences } from '@capacitor/preferences';

export async function saveAuthToken(token: string) {
  await Preferences.set({ key: 'auth_token', value: token });
}
```

### C. Keyboard & Viewport Management (`@capacitor/keyboard`)
Prevent native virtual keyboards from covering checkout address or promo code inputs:
```typescript
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';

// Set keyboard resize mode to body so layout scrolls smoothly
Keyboard.setResizeMode({ mode: KeyboardResize.Body });
```

### D. Barcode & QR Code Scanning
Integrate camera scanning for instant product lookup using `@capacitor-mlkit/barcode-scanning`:
```typescript
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

export async function scanSkuBarcode(): Promise<string | null> {
  const { barcodes } = await BarcodeScanner.scan();
  return barcodes.length > 0 ? barcodes[0].displayValue : null;
}
```

## 2. Safe Area Insets & Viewport Configuration
- Ensure `viewport-fit=cover` in your Next.js layout:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
  ```
- Use CSS environment variables for header and footer safe areas:
  ```css
  .safe-header {
    padding-top: max(env(safe-area-inset-top), 16px);
  }
  .safe-footer {
    padding-bottom: max(env(safe-area-inset-bottom), 16px);
  }
  ```

## 3. Remote WebView Debugging
- **Android WebView**:
  - Connect device with USB debugging enabled.
  - In desktop Chrome, open `chrome://inspect/#devices`.
  - Click **Inspect** to access the full Chrome DevTools for the running app.
- **iOS WKWebView**:
  - Connect iPhone or start iOS Simulator in Xcode.
  - In desktop Safari, enable `Develop` menu in settings.
  - Select `Develop -> [Simulator/Device] -> [App Title]` to open Web Inspector.
