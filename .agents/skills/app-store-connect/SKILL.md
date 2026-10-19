---
name: app-store-connect
description: App Store Connect API automation, TestFlight beta delivery, B2C e-commerce App Store Review guidelines compliance, and store asset/metadata management for B's Mart.
---

# App Store Connect & TestFlight Deployment Guide for B's Mart (B2C)

This skill governs automated App Store Connect uploads, TestFlight beta distributions, Apple Review Guidelines compliance for B2C retail e-commerce, and store asset specifications for the **B's Mart** mobile app.

---

## 1. B2C E-Commerce App Store Review Compliance

Consumer retail apps selling physical goods must strictly satisfy Apple's App Store Review Guidelines:

### A. Guideline 5.1.1(v) & 2.1: Open Guest Browsing (No Forced Login Wall)
- **Rule**: Consumer e-commerce apps **must not** force users to sign in or create an account just to browse the catalog, view prices, or add items to their cart.
- **B's Mart Compliance**:
  - The entire storefront, categories, search, reels, and cart are 100% accessible without login.
  - Shoppers can complete purchases via **Guest Checkout** or optionally sign in / register for a Customer Account.

### B. Guideline 5.1.1(v): In-App Account Deletion
- **Rule**: Because B's Mart supports optional Customer Account registration, it **must** provide an easily discoverable **"Delete Account"** action inside the Account/Settings screen.
- **Implementation Directives**:
  - In the Customer Account screen, provide a **"Delete My Account"** button with a clear confirmation dialog.
  - Triggering deletion deactivates/removes the user's `smart_users` / `smart_customers` profile and logs a task in `public.smart_task_queue` if ERP cleanup is needed.

### C. Guideline 3.1.1: Physical Goods In-App Purchase (IAP) Exemption
- **Rule**: Apps selling physical consumer goods delivered outside the app **must not** use Apple In-App Purchase (IAP).
- **Apple Review Notes Template**:
  > *"B's Mart is a B2C retail shopping application for purchasing physical home, kitchen, and lifestyle goods delivered directly to customers' homes. In accordance with App Store Review Guideline 3.1.1, In-App Purchase (IAP) is not used because all purchases are for physical merchandise fulfilled via home delivery."*

---

## 2. App Store Connect API & TestFlight Upload

Use `xcrun altool` or `xcrun notarytool` / Transporter in macOS CI/CD runners to upload the signed `.ipa`:
```bash
mkdir -p ~/.appstoreconnect/private_keys
cp path/to/AuthKey_${API_KEY_ID}.p8 ~/.appstoreconnect/private_keys/

xcrun altool --upload-app \
  -f ios/App/build/out/*.ipa \
  -t ios \
  --apiKey "$API_KEY_ID" \
  --apiIssuer "$API_ISSUER_ID"
```

---

## 3. Storefront Merchandising & Asset Checklist

- **App Icon**: `1024 x 1024 px` PNG, RGB only (zero alpha transparency).
- **Required Screenshot Resolutions**:
  - **iPhone 6.7" (Pro Max)**: `1290 x 2796 px`
  - **iPhone 6.5" (Plus / Max)**: `1242 x 2688 px`
  - **iPad Pro 12.9" / 13"** *(if tablet supported)*: `2048 x 2732 px`
- **Database Version Release Order (`smart_app_settings`)**:
  - **NEVER** bump `latest_version` or `latest_build` in `public.smart_app_settings` during the build/upload phase. Only update those values after the user confirms the new version is approved and live on the App Store / Google Play.
