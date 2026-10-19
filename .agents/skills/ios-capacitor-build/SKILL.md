---
name: ios-capacitor-build
description: Native iOS project management, Apple distribution code signing, OpenSSL certificate conversion, GitHub Actions macOS cloud build pipelines, and Info.plist configurations for B's Mart (Capacitor Next.js).
---

# iOS Capacitor Build & Code Signing Guide for B's Mart

This skill governs the native iOS build toolchain, Apple code signing infrastructure, Windows-to-Cloud CI/CD pipelines, and Capacitor configuration for the **B's Mart** B2C mobile application.

---

## 1. Project Anatomy & Native Workspace

Capacitor bridges the Next.js static export (`out/`) into an Xcode workspace:
```
ios/
└── App/
    ├── App.xcworkspace/         # Master Xcode workspace (always open this, never .xcodeproj)
    ├── App.xcodeproj/           # Xcode project configuration
    ├── App/
    │   ├── Info.plist           # Native permissions, versioning, and bundle metadata
    │   ├── AppDelegate.swift    # Application lifecycle and Capacitor root controller
    │   └── Assets.xcassets/     # B's Mart app icons and launch screen images
    └── Podfile                  # CocoaPods dependencies for Capacitor core and plugins
```

### Essential Capacitor Synchronization Commands
- **Sync Web Build**: `npx cap sync ios` (copies `out/` into `ios/App/App/public/` and updates pods).
- **Copy Web Only (Fast)**: `npx cap copy ios`.
- **Open in Xcode**: `npx cap open ios`.

---

## 2. Apple Code Signing & Certificate Conversion (Windows OpenSSL)

Apple issues certificates in DER format (`.cer`). Convert to PKCS#12 (`.p12`) for cloud CI/CD signing:
```bash
# 1. Convert DER certificate to PEM format
openssl x509 -in ios_distribution.cer -inform DER -out distribution.pem -outform PEM

# 2. Combine with private key into encrypted PKCS#12
openssl pkcs12 -export -inkey ios_distribution_private.key -in distribution.pem -out distribution.p12 -passout pass:YourPassword
```

---

## 3. Native Permissions & `Info.plist` Governance

Located at `ios/App/App/Info.plist`:
1. **Camera Permission (Barcode / QR Product Lookup)**:
   ```xml
   <key>NSCameraUsageDescription</key>
   <string>Used to scan product barcodes and QR codes to quickly find items in B's Mart.</string>
   ```
2. **Export Compliance Exemption**:
   ```xml
   <key>ITSAppUsesNonExemptEncryption</key>
   <false/>
   ```
3. **Application Display Name**:
   ```xml
   <key>CFBundleDisplayName</key>
   <string>B's Mart</string>
   ```

---

## 4. Safe Area & WebKit Viewport Guidelines
- Set `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />`.
- Use CSS safe area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) on sticky headers, bottom tab bars, and checkout action bars.
- Disable rubber-banding bounce (`overscroll-behavior-y: none;`).
