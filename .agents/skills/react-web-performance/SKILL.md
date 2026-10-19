---
name: react-web-performance
description: Performance optimization guidelines for B's Mart B2C product grids, shoppable reels, Core Web Vitals (LCP, CLS, INP), 60fps scrolling, and memory management.
---

# React Web Performance & B2C Conversion Optimization

This skill provides performance optimization guidelines, Core Web Vitals benchmarks, and memory management rules for the **B's Mart** B2C consumer storefront.

---

## 1. High-Volume Product Grids & Virtualization
- When rendering large category collections or search results (100+ products), use progressive pagination / infinite scroll or `@tanstack/react-virtual` so the active DOM stays lightweight and scrolls at a locked **60fps** on mobile devices.
- **Zero Layout Shift (CLS < 0.05)**:
  - Always reserve explicit aspect ratios (`aspect-square` or `aspect-[4/5]`) on product card image containers and hero banners before Cloudflare R2 images finish loading.

---

## 2. Preventing Render Cascades in Cart & Wishlist
- **Selective Zustand Subscriptions**:
  - Subscribe individual product cards only to their specific SKU's quantity (`useCartStore(state => state.items[itemId]?.quantity ?? 0)`) and wishlist state (`useWishlistStore(state => state.hasItem(itemId))`) so adding one item to the cart never re-renders the entire product grid.
- **Memoized Price & Shipping Calculations**:
  - Keep retail discount, coupon, and free-shipping threshold computations pure and memoized.

---

## 3. Media, Video Reels & Memory Management
- **R2 Image Tier Discipline**:
  - Product grids and search autocomplete must load `thumbs/` (max 300×300 WebP).
  - Product Detail Page carousels load `views/` (max 1200×1200 WebP).
  - Full-screen pinch-to-zoom loads `raws/` on demand.
- **Video Reel Lifecycle**:
  - In shoppable video reels, only mount/play the active visible `<video>` element and pause/unload offscreen videos to preserve mobile battery and GPU memory.
- **Realtime Channel Cleanup**:
  - Always unsubscribe from Supabase Realtime channels (`smart_orders` tracking) inside `useEffect` cleanup callbacks.

---

## 4. Core Web Vitals Benchmarks
- **Largest Contentful Paint (LCP)**: Under **2.0s** on mobile 4G (prioritize loading the top hero banner or first row of `thumbs/`).
- **Interaction to Next Paint (INP)**: Under **50ms** when tapping *"Add to Cart"*, `+`/`-` steppers, or the Wishlist heart button.
- **Cumulative Layout Shift (CLS)**: **0.00** across all storefront, product detail, and checkout screens.
