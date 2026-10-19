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

### A. Unified Sign-In Flow (Zero Public Admin / Staff References)
- **User Proposal**:
  - Remove all public `"Admin"` buttons and `"Admin / Staff Portal"` references from the storefront ([SmartHeader.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/layout/SmartHeader.tsx) and [SmartMeView.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/profile/SmartMeView.tsx)).
  - Use a single, clean **"Sign In"** button and modal for everyone.
- **Proposed Unified Authentication Flow**:
  1. **Zero Public Admin Clutter**:
     - Anonymous visitors and regular shoppers see **zero** `"Admin"` or `"Staff"` buttons/labels anywhere in the header, mobile bar, or `Me` tab.
     - Only a clean **"Sign In"** button is shown when signed out.
  2. **Single Identifier + Password Input**:
     - The Sign-In form accepts a single identifier field (**Phone Number or Username**) + **Password**.
     - Upon submission, the auth action checks `public.smart_users` (`smart_authenticate_staff`) and `public.smart_customers` (`smart_authenticate_customer`):
       - **If matched in `public.smart_users` (`admin`, `merchandising`, `fulfillment`)**: Signs in as Staff and automatically opens the **Dashboard** (`activeTab = "admin"`). While signed in as Staff, a top navigation toggle lets the staff member switch between the Dashboard and the Storefront or Sign Out.
       - **If matched in `public.smart_customers`**: Signs in as a B2C Customer, merges guest cart/wishlist items, and stays on the customer profile / storefront.
       - **If neither matches**: Returns a generic *"Invalid login credentials"* message without revealing whether staff usernames exist.

