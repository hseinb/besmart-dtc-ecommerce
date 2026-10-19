---
name: nextjs-app-router
description: Architecture guidelines and best practices for Next.js App Router, B2C Storefront routes, Server Components, SEO metadata, and streaming performance.
---

# Next.js App Router Architecture & Patterns for B's Mart (B2C)

This skill establishes best practices for building the **B's Mart** B2C consumer storefront using the Next.js App Router (supporting both Cloudflare Pages web deployment and Capacitor mobile static export).

---

## 1. Directory Structure & B2C Route Grouping
Organize route segments logically to separate storefront, checkout, and customer account layouts:
- `app/(shop)/`: Public consumer storefront (persistent header, search bar, category pills, bottom tab bar on mobile, slide-over cart drawer).
  - `app/(shop)/page.tsx`: Home storefront (hero banners, flash deals, featured categories, shoppable reels).
  - `app/(shop)/category/[slug]/page.tsx`: Category product grid with filter/sort drawers.
  - `app/(shop)/product/[id]/page.tsx`: Product Detail Page (gallery, retail price & savings, reviews, related items).
  - `app/(shop)/wishlist/page.tsx`: Saved favorites (works for both Guest and Signed-In shoppers).
- `app/(checkout)/`: Distraction-free 1-page Guest & Customer Account Checkout and Order Confirmation/Tracking.
- `app/(account)/`: Optional Customer Account hub (order history, saved delivery addresses, profile settings, account deletion).

---

## 2. Server Components vs Client Components
- **Server Components / Static Shells**:
  - Render page layouts, SEO/OpenGraph metadata, and initial skeleton structures with minimal client JS overhead.
- **Client Components (`'use client'`)**:
  - Push `'use client'` down to interactive leaf components (`AddToCartButton`, `CartDrawer`, `CouponInput`, `WishlistHeart`, `AddressForm`, `ReelCarousel`).

---

## 3. Streaming & Skeletons (`<Suspense>`)
- Wrap dynamic product grids, search results, and review sections in `<Suspense>` or shimmer skeleton placeholders so the storefront header and navigation respond instantaneously on mobile and desktop.

---

## 4. Dynamic Imports & Bundle Optimization
- Use `next/dynamic` with `ssr: false` for heavy client-only modals:
  - High-resolution pinch-to-zoom image lightboxes
  - Shoppable video reel players
  - Native Capacitor barcode scanner overlays
