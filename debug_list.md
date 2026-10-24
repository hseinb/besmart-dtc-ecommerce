# B's Mart — Active Debugging & Issue Tracker

This file tracks bugs, UI glitches, sync issues, and platform discrepancies across Web, Android, and iOS for **B's Mart**.

---

## Active Issues
*None currently active.*

---

## Resolved Issues

### BUG-006: Submitted B's Mart Orders Not Appearing on Warehouse Stations (`smart_mirror_order_to_b2b` Failure)
- **Status**: `Resolved`
- **Description & Reproduction Steps**:
  1. Create a customer account (or shop as Guest) and submit an order on B's Mart (e.g., `BSM-20261023-8437`, `order_id = 3`).
  2. Check the warehouse stations / B2B order feed — the order does not appear under wholesale account `acct_id = 3899` (`"Bs Mart"`).
- **Root Cause**:
  1. In `public.smart_mirror_order_to_b2b(p_smart_order_id integer)`, both line-item loops queried `public.items i` and referenced `COALESCE(i.price, i.srp, sod.unit_price, 0)`. However, `public.items` stores the wholesale price in `i.srp` and does not have a `price` column, causing PostgreSQL to abort with `ERROR: 42703: column i.price does not exist`.
  2. In [src/lib/smartOrders.ts](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/lib/smartOrders.ts), `supabase.rpc("smart_mirror_order_to_b2b", ...)` did not destructure `error`, silently swallowing the RPC failure while `b2b_order_id` remained `NULL`.
- **Resolution**:
  1. Updated `public.smart_mirror_order_to_b2b` in Supabase to use `COALESCE(i.srp, si.base_b2b_srp, sod.unit_price, 0)` (joining `public.items i` and `public.smart_items si`).
  2. Backfilled order `BSM-20261023-8437` (`smart_orders.order_id = 3` $\rightarrow$ mirrored to `public.orders.order_id = 67` under `acct_id = 3899`).
  3. Updated [src/lib/smartOrders.ts](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/lib/smartOrders.ts) to explicitly destructure and log `mirrorError` and `parsedMirror?.error`.

### BUG-004: Pressing Zoom on an Image in Item View Brings Up a Broken Link
- **Status**: `Resolved`
- **Description & Reproduction Steps**:
  1. Open any product in the Item View (Product Detail Modal) and tap the image or the **Zoom** button.
  2. The fullscreen Lightbox Zoom overlay opens with a broken image icon.
- **Root Cause**:
  1. In `public.item_images`, 1,582 of 1,584 rows store a legacy Google Drive download link (`https://drive.google.com/uc?export=download&id=...`) in the `raw` tier while `view` (`1200×1200` WebP) and `thumb` (`300×300` WebP) point to Cloudflare R2 (`https://pub-91d344728db8455caa2530306bdfbcb0.r2.dev/...`).
  2. Google Drive blocks `uc?export=download` URLs inside `<img>` tags in modern browsers and mobile WebViews (`Cross-Origin-Resource-Policy` / 403 / 302 redirect). Because `currentSlot.raw` was a truthy string, `currentRawUrl` evaluated to the blocked Google Drive URL instead of falling back to the high-resolution R2 `view` URL.
- **Resolution**:
  1. Updated `parseImageSlot` in [src/lib/media.ts](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/lib/media.ts) and `currentRawUrl` in [SmartProductDetailModal.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/product/SmartProductDetailModal.tsx) to ignore `drive.google.com` links in `raw` and fall back to the Cloudflare R2 `view` / `thumb` URL, plus added an `onError` fallback on the Lightbox `<img>` and interactive `1x` $\leftrightarrow$ `2x` zoom toggle.

### BUG-005: Cannot Swipe Through Images in Item View (Only Buttons Work)
- **Status**: `Resolved`
- **Description & Reproduction Steps**:
  1. Open a multi-angle product in the Item View (Product Detail Modal) or Zoom Lightbox.
  2. Attempt to swipe left/right with touch or mouse drag across the image — nothing happens; only clicking the Prev/Next arrow buttons or thumbnails changed the image.
- **Root Cause**:
  1. Neither the main Item View gallery container nor the Lightbox Zoom overlay had `onTouchStart` / `onTouchMove` / `onTouchEnd` or pointer/mouse drag (`onPointerDown` / `onPointerMove` / `onPointerUp`) handlers attached.
- **Resolution**:
  1. Added touch and pointer/mouse drag swipe handlers (`±40px` horizontal threshold with `didSwipeRef` click suppression and `draggable={false}`) to both the main Item View gallery and the Lightbox Zoom overlay in [SmartProductDetailModal.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/product/SmartProductDetailModal.tsx), along with Prev/Next buttons, slide counter badge, and `ArrowLeft` / `ArrowRight` keyboard navigation.

### BUG-003: "Shop by Category" Showing 2-Letter Initials Instead of Product Images
- **Status**: `Resolved`
- **Description & Reproduction Steps**:
  1. Open the B's Mart Home page and view the **"Shop by Category"** circular bubbles grid.
  2. Notice that 15 categories (e.g., `Accent Furniture` -> `AF`, `Barbecue Needs` -> `BN`, `Cleaning Supplies` -> `CS`, `Dining Utensils` -> `DU`, `Bath Textiles` -> `BT`) displayed 2-letter initials instead of a product photograph.
- **Root Causes**:
  1. **Pagination Sampling Starvation ([SmartHomeView.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/home/SmartHomeView.tsx))**: `categoryThumbMap` only scanned `[...initialItems, ...flashDeals, ...items]`, which on initial page load only contained the first 40 catalog items (`range(0, 39)` ordered globally by `image_updated_at DESC`) plus 12 flash deal items. Any category without a product in that initial 40-item slice had no entry in `categoryThumbMap`.
  2. **0-Item Category (`Accent Furniture`)**: `Accent Furniture` (`item_class_id = 1`) had `0` items in `public.smart_items`, causing it to always show `AF` and lead to an empty category view.
- **Resolution**:
  1. Created and wired `public.smart_get_category_thumbnails()` RPC in [page.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/app/page.tsx) and [SmartHomeView.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/home/SmartHomeView.tsx) to return 1 representative product image (`hero1`) and `item_count` per category across the entire catalog.
  2. Filtered out categories with `item_count === 0` (`Accent Furniture`) and seeded `categoryThumbMap` with the RPC thumbnails.

### BUG-001: Sign-In / Create Account Modal Closes While Typing in Fields
- **Status**: `Resolved`
- **Description & Reproduction Steps**:
  1. Navigate to the `Me` tab and click **Sign In**, then switch to **Create Account**.
  2. While typing or selecting text / using browser autofill in the Create Account fields (`Full Name`, `Phone Number`, `Password`, `Email`), the modal unexpectedly closes (`isOtpModalOpen` resets to `false`).
- **Root Causes**:
  1. **Backdrop `onClick` Dismissal ([SmartMeView.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/profile/SmartMeView.tsx))**: The outer overlay `<div onClick={() => setIsOtpModalOpen(false)}>` closed the modal whenever a text-selection drag (`mousedown` inside input $\rightarrow$ `mouseup` outside card) or browser password/autofill popup interaction bubbled a click event to the backdrop.
  2. **Component Remount / Re-render Reset**: `isOtpModalOpen` was stored only in ephemeral local `useState(false)` and required opening a popup modal instead of keeping the Sign-In / Create Account form persistently mounted inline when signed out (`!customer && !staffUser`).
- **Resolution**:
  1. Removed backdrop click dismissal (`onClick={() => setIsOtpModalOpen(false)}`) on the Auth Modal overlay so the modal only closes via the explicit `✕` button or upon successful authentication.
  2. Rendered the Sign In / Create Account / WhatsApp OTP card persistently inline right below the welcome banner on the `Me` tab whenever `!customer && !staffUser`.
