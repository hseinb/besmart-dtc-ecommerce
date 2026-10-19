# B's Mart (`Besmart`) — DTC E-Commerce Storefront, Hybrid Mobile App & Live ERP Bridge

A high-conversion, SHEIN-inspired **Direct-to-Consumer (DTC / B2C) E-Commerce Platform and Hybrid Mobile App (iOS & Android)** built for **B HOME (Bachir Home)** using **Next.js 14, TypeScript, Tailwind CSS, Zustand, Supabase, Cloudflare R2, and Capacitor 8.5**.

---

## 🎯 Business Problem Solved

Allows a traditional brick-and-mortar and wholesale houseware distributor to launch a full-featured **DTC retail e-commerce channel** powered directly by live warehouse inventory (`BachirHome_2026` MS SQL Server ↔ Supabase via `smartBridge.js`)—without duplicating inventory management or risking oversold stock.

---

## ✨ Key DTC Conversion & Operational Features

1. **5-Tab Mobile-First & Desktop Conversion Experience**:
   - **`Home`**: Collectible coupon strip, Hero campaign slider, circular category bubbles (hydrated via `smart_get_category_thumbnails` PostgreSQL RPC), live **`⚡ Flash Sale` countdown timer**, and infinite 2-column *"For You"* discovery feed.
   - **`Categories`**: Split-screen visual taxonomy explorer with Room and Material sub-grids.
   - **`Deals`**: Discount-tiered merchandising feed (`20%+ Off`, `40%+ Off`, price-bracket filters).
   - **`Bag`**: Live **Free-Shipping Progress Bar**, auto-applied coupon drawer, and *"Frequently Bought Together"* affinity cross-sells.
   - **`Me`**: Phone + **WhatsApp/SMS OTP Verification**, visual order lifecycle tracker (`Pending` → `Confirmed` → `Out for Delivery` → `Delivered`), Wishlist, Recently Viewed, and Guest Order Lookup.
2. **Multi-Method Regional Checkout**:
   - Dynamic delivery fee calculation by governorate/zone (`smart_delivery_zones`) with support for Cash on Delivery (USD/LBP), Whish Money, OMT Pay / BOB Finance, and POS Card on Delivery.
3. **Unified Stealth Staff & Customer Portal**:
   - Single sign-in flow automatically routes staff roles (`admin`, `merchandising`, `fulfillment`) to the internal Merchandising, Banner, Coupon & Order Fulfillment Console while keeping zero admin clutter on the public storefront.
4. **Bi-Directional ERP Sync & OTP Queue (`smartBridge.js`)**:
   - Synchronizes live stock, retail pricing, and web orders with on-premise **MS SQL Server** and dispatches WhatsApp/SMS verification codes via `smart_task_queue`.

---

## 🛠️ Tech Stack

* **Frontend & Mobile**: Next.js 14.2 (App Router), React 18, TypeScript 5.7, Tailwind CSS 3.4, Zustand 5, TanStack React Query v5, Zod, Capacitor 8.5 (Android & iOS)
* **Backend & Cloud**: Supabase (PostgreSQL, PostgREST RPCs, Row-Level Security), Cloudflare R2 Edge CDN, Node.js PM2 Sync Daemon (`smartBridge.js`)
