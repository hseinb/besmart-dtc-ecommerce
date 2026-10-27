# B's Mart — Active Debugging & Issue Tracker

This file tracks bugs, UI glitches, sync issues, and platform discrepancies across Web, Android, and iOS for **B's Mart**.

---

## Active Issues
*None currently active.*

---

## Resolved Issues

### BUG-008: Phone Back Button Closes Browser or App Instead of Returning in Navigation
- **Status**: `Resolved`
- **Description & Reproduction Steps**:
  1. Open B's Mart on a mobile browser (Android Chrome, iOS Safari, WhatsApp/Instagram in-app browser) or the native Capacitor Android/iOS app.
  2. Navigate across tabs (`Categories`, `Deals`, `Bag`, `Me`), select a category/campaign filter, open a Product Detail Modal (or image zoom lightbox), or open the Checkout / Bag drawer.
  3. Press the phone's hardware/gesture Back button — the browser tab closes or the app exits instead of stepping back to the previous modal, product, filter, or tab.
- **Root Causes**:
  1. **No Browser History Entries (`window.history.pushState` / `popstate`)**: All navigation state (`activeTab`, `selectedClassId`, `selectedTag`, `selectedProduct`, `isBagDrawerOpen`, and component-level modals) updated client Zustand/React state without pushing entries to `window.history` or listening to `popstate`.
  2. **Missing Capacitor `backButton` Listener ([SmartAppShell.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/layout/SmartAppShell.tsx))**: `CapApp.addListener("appUrlOpen", ...)` was registered for deep links, but `CapApp.addListener("backButton", ...)` was not registered to intercept hardware back presses on Android/iOS.
- **Resolution**:
  1. Added `navHistory`, `productHistory`, a LIFO modal `backHandlers` registry (`registerBackHandler`), `stepBackProductDetail`, and a unified `handleBackNavigation()` action to [useSmartNavStore.ts](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/store/useSmartNavStore.ts) that pushes browser history states on navigation and walks backward through open modals $\rightarrow$ product history $\rightarrow$ drawers $\rightarrow$ tab/category/filter snapshots $\rightarrow$ Home.
  2. Created [useSmartBackGuard.ts](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/hooks/useSmartBackGuard.ts) and wired it to all modals and overlays across [SmartProductDetailModal.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/product/SmartProductDetailModal.tsx), [SmartBagDrawer.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/bag/SmartBagDrawer.tsx), [SmartBagView.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/bag/SmartBagView.tsx), [SmartHeader.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/layout/SmartHeader.tsx), [SmartMeView.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/profile/SmartMeView.tsx), [SmartAdminDashboard.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/admin/SmartAdminDashboard.tsx), and [SmartAppShell.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/layout/SmartAppShell.tsx).
  3. Added a browser history sentinel + `popstate` listener and `CapApp.addListener("backButton", ...)` in [SmartAppShell.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/layout/SmartAppShell.tsx) so pressing Back on phones always returns in navigation and never closes the browser or app.

### BUG-007: Content Creator (`bissan`) Cannot Access Item Image Downloading on Desktop Browser
- **Status**: `Resolved`
- **Description & Reproduction Steps**:
  1. Sign in as `bissan` (`role = 'content_creator'`) on a desktop browser via the `Me` tab / header Sign In form.
  2. Upon signing in, or when browsing items on the storefront / dashboard, the user cannot access or see the item image downloading controls (`Thumb` / `View` / `Raw`).
- **Root Causes**:
  1. **Session Collision & `hydrate()` Wipe ([src/store/useSmartAuthStore.ts](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/store/useSmartAuthStore.ts))**: Signing in as staff (`bissan`) did not clear an existing `customer` session (`bsmart_customer_session_v1`), and if a stale/deleted `savedCustomer` existed in `localStorage`, `hydrate()` called `get().signOut()`, wiping `bsmart_staff_session_v1` (`staffUser: null`). Additionally, `hydrate()` never refreshed `savedStaff` role/status from Supabase.
  2. **`SmartAdminDashboard.tsx` Rendered Disabled B2B/B2C Pricing Table for `content_creator` ([src/components/admin/SmartAdminDashboard.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/admin/SmartAdminDashboard.tsx))**: Signing in as `bissan` redirected to `SmartAdminDashboard`, which locked `content_creator` to `"B2C Catalog Overrides"` — a 7-column B2B/B2C pricing table where all inputs were disabled (`not-allowed`), product rows/thumbnails were not clickable, and no direct `Thumb` / `View` / `Raw` image download buttons were shown.
  3. **Lack of Inline Image Download Bar in `SmartProductDetailModal.tsx` & `SmartProductCard.tsx` ([src/components/product/SmartProductDetailModal.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/product/SmartProductDetailModal.tsx) & [src/components/product/SmartProductCard.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/product/SmartProductCard.tsx))**: Opening an item on the storefront showed no inline `Thumb` / `View` / `Raw` download & share panel under the product image, and product cards only showed a small icon-only sparkle circle without a Download icon/label.
- **Resolution**:
  1. Updated [src/store/useSmartAuthStore.ts](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/store/useSmartAuthStore.ts) so `hydrate()` only clears `CUSTOMER_SESSION_KEY` when a customer account is inactive (preserving `staffUser`), refreshes `savedStaff` live from Supabase, and ensures `signInStaff` / `signInUnified` and customer sign-in clear conflicting sessions.
  2. Added an inline **Content Creator Image Download & Share** card directly below the product image gallery in [SmartProductDetailModal.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/product/SmartProductDetailModal.tsx) with segmented `Thumb` | `View` | `Raw` quality selection, one-click Download Current Image, Download All Angles, and Open Full Caption & Share Studio buttons.
  3. Upgraded the product card button in [SmartProductCard.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/product/SmartProductCard.tsx) to a clear `<Download /> Images` pill button.
  4. Updated [SmartAdminDashboard.tsx](file:///c:/Users/hussi/agy-cli-projects/Besmart/src/components/admin/SmartAdminDashboard.tsx) so `content_creator` sees a dedicated **Product Images & Captions Studio** view with clickable rows, available angle badges (`Main Hero`, `Dimensions`, `Angle 1`–`5`), and a prominent `Download / Share Images (Thumb • View • Raw)` button.

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
