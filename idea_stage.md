# B's Mart — Idea Stage & Feature Blueprint

This document tracks finalized brand/UI specs, active feature discussions, and the `smart_*` database architecture for **B's Mart** before formalizing technical execution steps in `implementation_plan.md`.

> [!IMPORTANT]
> **STRICT ZERO MOCK DATA POLICY**:
> Never use hardcoded, fake, or mock data anywhere in **B's Mart** (no fake products, fake "100+ sold" counters, fake reviews, fake banners, or dummy coupons). Every product, category, tag, banner, coupon, delivery zone, recommendation, and order must be driven 100% by real Supabase (`nhellhapzcylcukdxcwo`) and MSSQL (`BachirHome_2026`) records. If a table (e.g., `smart_banners` or `smart_coupons`) has 0 active rows, cleanly hide that section or show a genuine empty state.

---

## 1. Finalized Specifications

### A. Brand Identity, Logo, Mood & Colors
- **Status**: Finalized (Variation 6)
- **Assets**: Saved to [public/logo.png](file:///c:/Users/hussi/agy-cli-projects/Besmart/public/logo.png) and [public/icon-1024.png](file:///c:/Users/hussi/agy-cli-projects/Besmart/public/icon-1024.png) (`1024×1024` 24-bit RGB PNG).
- **Identity Summary**:
  - **Logo**: Sweeping white calligraphic `B` + bottom-aligned `'s` (`B's`), 3D-angled **Luminous Metallic Yellow-Gold** shopping bag in the lower-left curve of the `B`, and bold Yellow-Gold-to-White **`MART`** wordmark & rounded bar.
  - **Color Palette**: Rich **Teal-Sapphire Ocean Blue** (`#005A87` / `#04324E`) paired with **Luminous Yellow-Gold** (`#FFB800` / `#F59E0B`), **Flash Sale Coral-Orange** (`#FF5A1F`), and **Crisp Coastal Alabaster** (`#F8FAFC`).

### B. SHEIN-Inspired B2C Storefront & Feature Architecture
- **Status**: Finalized Blueprint
- **Core UX Pillars**:
  1. **Sticky Top Header & Discovery Ribbon**:
     - Smart Search Bar with live visual autocomplete (real catalog items), recent searches, trending tags from real catalog data, and camera **Barcode/QR Scanner**.
     - Horizontal Category & Campaign Ribbon (`All`, `⚡ Flash Sale`, `✨ New In`, plus live categories from `item_class`).
  2. **5-Tab Mobile Bottom Navigation & Modern Desktop Header**:
     - **`Home` (`🏠`)**: Collectible coupon strip (rendered when active public coupons exist in `smart_coupons`), Hero Campaign Slider (`smart_banners`), Circular Category Bubbles (`item_class`), `⚡ Flash Sale` shelf with live countdown (driven by `smart_app_settings` / real discounted items where `discount > 0`), and infinite 2-column "For You" product grid.
     - **`Categories` (`🗂️`)**: SHEIN-style Split-Screen Category Explorer (Left vertical category rail + Right visual sub-grids, room collections from real `house_rooms` / `material` / `tags`, and category products).
     - **`Deals` (`⚡`)**: Dedicated feed of real discounted items (`discount > 0`), filterable by discount tier (`All Deals`, `20%+ Off`, `40%+ Off`, price brackets).
     - **`Bag` (`🛍️`)**: Live **Free-Shipping Progress Bar** (driven by `smart_app_settings.free_shipping_threshold`), per-item selection checkboxes, collectible/auto-applied `smart_coupons` drawer, real *"Frequently Bought Together / You May Also Like"* recommendations, and sticky checkout bar showing total savings.
     - **`Me` (`👤`)**: Phone + WhatsApp/SMS OTP sign-in, SHEIN-style **Order Status Icon Row** (`Pending`, `Confirmed`, `Out for Delivery`, `Delivered`), `♥ Wishlist`, `👁️ Recently Viewed` (persisted locally from real browsed items), `🎟️ My Coupons`, `📍 Address Book`, and `📦 Guest Order Lookup`.
  3. **Product Detail Page (PDP)**:
     - Swipeable R2 image gallery (`thumbs/` $\rightarrow$ `views/` $\rightarrow$ pinch-to-zoom `raws/`).
     - Retail `SRP`, active `discount` strikethrough pricing, and real collectible coupons.
     - **One-Tap Share to WhatsApp / Instagram** with rich OpenGraph product metadata.
     - **"Frequently Bought Together"** & **"You May Also Like"** infinite scroll powered by real catalog/order correlation and category/tag matching.

### C. Checkout, Delivery Zones & Payment Engine
- **Status**: Finalized Blueprint
- **Authentication**:
  - **1-Page Guest Checkout** (Name, Phone, Delivery Zone, Address).
  - **Phone Number + WhatsApp/SMS OTP Verification** (`smart_otp_codes` + `smart_task_queue` / `smartBridge.js`) for Customer Accounts.
- **Delivery Fees**:
  - Configurable **Delivery Zones** (`smart_delivery_zones`: e.g., Beirut, Mount Lebanon, North, South, Bekaa) with per-zone fee + global `free_shipping_threshold` in `smart_app_settings`.
- **Payment Methods (All 4 Supported)**:
  1. Cash on Delivery (COD — USD / LBP)
  2. Whish Money
  3. OMT Pay / BOB Finance
  4. POS Card Machine on Delivery

### D. `smart_*` Supabase Database Schema (`nhellhapzcylcukdxcwo`)
- **Shared Catalog Read Tables**: `items`, `item_class`, `item_images`, `item_tags`.
- **Isolated B's Mart Tables (`smart_*`)**:
  - `smart_app_settings`
  - `smart_delivery_zones`
  - `smart_customers`
  - `smart_addresses`
  - `smart_otp_codes`
  - `smart_coupons`
  - `smart_wishlists`
  - `smart_banners`
  - `smart_orders`
  - `smart_order_items`
  - `smart_task_queue`

---

## 2. Active Discussion
*(No active pending discussions — all approved ideas moved to Completed Ideas below.)*

---

## 3. Completed Ideas

### Phase 9 — Unified Sign-In Flow (Zero Public Admin / Staff References)
- **Status**: Completed
- **Summary**:
  - Removed all public `"Admin"` and `"Staff"` references from `SmartHeader.tsx` and `SmartMeView.tsx`.
  - Implemented `signInUnified(identifier, password)` in `useSmartAuthStore.ts` checking `public.smart_users` (`smart_authenticate_staff`) and `public.smart_customers` (`smart_authenticate_customer`) behind a single `"Sign In"` modal/card.

### Phase 10 — Unified Full-Width Hero Carousel & Horizontal Category Scrollers
- **Status**: Completed
- **Summary**:
  1. **Top Category Pill Bar (`SmartHeader.tsx`)**: Added dynamic Left (`ChevronLeft`) and Right (`ChevronRight`) smooth-scroll arrow buttons (`±320px`) with soft white edge gradients driven by `canScrollLeft` / `canScrollRight` overflow detection.
  2. **Unified Single Full-Width Hero Banner Carousel (`SmartHomeView.tsx`)**: Combined the main B's Mart Hero Banner (kept first as Slide 1, plus any `smart_banners` rows) and **all** `campaignTags` (`Best Sellers`, `New Arrivals`, etc.) into a single full-width Hero Banner Carousel with Left/Right navigation arrows, clickable slide indicator dots, and `5000ms` auto-rotation (pausing on hover).
  3. **Single-Row "Shop by Category" Image Balloons (`SmartHomeView.tsx`)**: Converted the 2-row 20-item slice into a single horizontal line (`flex flex-nowrap overflow-x-auto`) rendering **all** `visibleCategories` with dynamic Left (`ChevronLeft`) and Right (`ChevronRight`) smooth-scroll arrow buttons (`±360px`).

### Phase 11 — Shareable Bag / WhatsApp Cart Link (`?cart=itemId.qty_itemId.qty`)
- **Status**: Completed
- **Summary**:
  1. **Stateless Compact URL Encoding (`useSmartCartStore.ts`)**: Added `encodeCartShareParam`, `decodeCartShareParam`, `mergeSharedItems`, and `replaceWithSharedItems`.
  2. **"Share Bag" Actions (`SmartBagView.tsx` & `SmartBagDrawer.tsx`)**: Added Share Bag buttons in the Free-Shipping progress card (*"Share Bag to Combine Order"*), Bag header bar, Order Summary card, and slide-over Bag Drawer with formatted WhatsApp summary, Native Share sheet, and Copy Link feedback.
  3. **Incoming Shared Bag Preview Modal (`SmartSharedBagModal.tsx` & `SmartAppShell.tsx`)**: Detects `?cart=...`, queries live `public.smart_items` records, cleans the URL via `history.replaceState`, and lets the recipient choose **"Add All to My Bag (Merge)"** or **"Replace My Bag"** while respecting `hide_stock_qty` privacy and real stock caps.

### Phase 12 — RetailSMS OTP Integration for Account Creation, Login & Password Reset
- **Status**: Completed
- **Summary**:
  1. **Supabase Edge Function (`smart-send-otp`) & Database Verification (`smart_verify_otp_and_auth`)**: Server-side OTP generation, per-phone cooldown & hourly rate limiting, RetailSMS Lebanon (`retailsms.net`) gateway dispatch, and atomic OTP verification for `signup`, `login`, and `reset_password`.
  2. **Auth Store Integration (`useSmartAuthStore.ts`)**: Added `sendPhoneOtp(phone, purpose)` and `verifySmsOtpAndAuth({ phone, code, purpose, fullName, password, email })` with automatic guest cart and wishlist merging upon verification.
  3. **2-Tab Auth UI (`SmartMeView.tsx`)**: Replaced the old 3-tab switcher and fallback OTP banner with a clean 2-tab (`Sign In` | `Create Account`) interface supporting Password Sign In, SMS Code Sign In (`otp_login`), Forgot Password SMS Reset (`reset_password`), and 2-step SMS-verified Account Creation (`signup`) with `autoComplete="one-time-code"` and a live `60s` resend countdown timer.

### Phase 13 — Native Android & iOS Capacitor Apps (`com.bsmart.retail`) & Store Compliance
- **Status**: Completed
- **Summary**:
  1. **Apple Guideline 5.1.1(v) Account Deletion RPC (`smart_delete_customer_account`)**: Added a `SECURITY DEFINER` PostgreSQL RPC (`public.smart_delete_customer_account`) and wired `deleteMyAccount` in `useSmartAuthStore.ts` to atomically delete saved addresses, wishlists, and cloud carts, anonymize historical `smart_orders` (`customer_id = NULL, is_guest = true`), and delete the customer record.
  2. **Native Deep-Link Handling (`SmartAppShell.tsx`)**: Integrated `@capacitor/app` (`CapApp.addListener("appUrlOpen", ...)`) alongside web query parameters so tapping `https://bsmartlb.com/?product=...`, `https://bsmartlb.com/?cart=...`, or `bsmart://...` links on Android/iOS opens the Product Detail modal or Shared Bag Preview modal directly inside the app.
  3. **Mobile Safe-Area Polish (`SmartBagDrawer.tsx` & `SmartProductDetailModal.tsx`)**: Added `.pt-safe` padding to the slide-over Bag Drawer top header bar and full-screen Zoom Lightbox top controls bar so iOS notch / Dynamic Island never overlaps interactive controls.

### Phase 14 — Content Creator / Digital Marketer Role & Multi-Quality Asset Studio (`Thumb` / `View` / `Raw`)
- **Status**: Completed
- **Summary**:
  1. **Role & Staff Management (`public.smart_users` & `SmartAdminDashboard.tsx`)**: Added `'content_creator'` (`Content Creator / Digital Marketer`) role alongside `'admin'`, `'merchandising'`, and `'fulfillment'`, with read-only B2C Catalog access and Creator Studio actions.
  2. **Multi-Quality Image & Angle Selector (`SmartCreatorShareModal.tsx` & `src/lib/media.ts`)**: Exposed all populated image slots (`hero1`, `dim1`, `angle1`–`angle5`) across **`Thumb`** (Fast Compact WebP), **`View`** (HD Studio WebP), and **`Raw`** (Original Master via `r2-image-proxy`), with single-angle and **"Save All Angles"** device downloads.
  3. **Accompanying Caption Builder & Native File + Text Share**: Added field toggles (`Item Name`, `Price & Discount`, `Description & Specs`, `SKU Code`, `Product Link`), an editable caption textarea, automatic clipboard copy, and Web Share Level 2 (`navigator.share({ files, title, text })`) across `SmartProductCard.tsx`, `SmartProductDetailModal.tsx`, and `SmartAdminDashboard.tsx`.



