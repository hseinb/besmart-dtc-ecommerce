---
name: nextjs-react-tailwind
description: Best practices for building high-converting B's Mart B2C retail web and mobile storefronts with Next.js, React, and Tailwind CSS.
---

# Next.js, React & Tailwind CSS for B's Mart (B2C Storefront)

This skill provides architectural patterns and UI directives for building the **B's Mart** consumer e-commerce storefront across responsive web and Capacitor mobile apps.

---

## 1. B2C Visual Merchandising & Conversion Ergonomics
- **Engaging Product Cards**:
  - Showcase square or 4:5 aspect ratio product imagery using Cloudflare R2 `thumbs/` with explicit dimensions (`aspect-square`) to guarantee zero Cumulative Layout Shift (CLS).
  - Display clear **Sale Badges** (`-20%`), **Strikethrough Compare-At Prices**, star ratings, quick wishlist heart buttons, and a tactile **Add to Cart / `+ -` Stepper** overlay.
- **Discovery & Inspiration**:
  - Hero promotional banners (`smart_banners`), horizontal category pill scrollers, flash-deal carousels, and vertical shoppable video reels/stories.
- **Frictionless Cart & Checkout**:
  - Slide-over Cart Drawer featuring a live **Free-Shipping Progress Bar** (*"Add $12.00 more for FREE delivery!"*), promo code input, and a single-tap transition to Guest or Account Checkout.

---

## 2. Next.js App Router & SEO Architecture
- **Server Components & OpenGraph Metadata**:
  - Generate rich OpenGraph/WhatsApp share previews (`title`, `description`, `images`) for Product Detail Pages and categories so links shared by consumers on WhatsApp or Instagram render rich product cards.
- **Client Components (`'use client'`)**:
  - Isolate interactive state boundaries to client components (`ProductCardActions.tsx`, `CartDrawer.tsx`, `WishlistButton.tsx`, `CouponBox.tsx`, `ReelPlayer.tsx`).
- **Dynamic Imports**:
  - Use `next/dynamic` for offscreen modals, full-screen image zoom galleries, and barcode scanner overlays to keep initial page load fast.

---

## 3. Tailwind CSS & Mobile Safe Area Standards
- **Brand Tokens & Mood**:
  - Consume semantic CSS variables (`--primary`, `--accent`, `--background`, `--surface`, `--sale-badge`) defined in `globals.css` so B's Mart's custom brand identity, colors, and mood apply consistently everywhere.
- **Inventory & Promotion Badges**:
  - Sale / Promo: `bg-rose-600 text-white font-semibold`
  - In Stock / Fast Delivery: `text-emerald-700 bg-emerald-50 border-emerald-200`
  - Low Stock Urgency (*"Only a few left!"*): `text-amber-700 bg-amber-50 border-amber-200`
  - Out of Stock: `text-slate-500 bg-slate-100 border-slate-200`
- **Safe Area Insets (Capacitor iOS & Android)**:
  - Always respect mobile hardware notches, Dynamic Islands, and home indicator bars using `pt-[env(safe-area-inset-top)]` and `pb-[env(safe-area-inset-bottom)]`.
