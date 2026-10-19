# B's Mart — Active Debugging & Issue Tracker

This file tracks bugs, UI glitches, sync issues, and platform discrepancies across Web, Android, and iOS for **B's Mart**.

---

## Active Issues
*None currently active.*

---

## Resolved Issues

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
