# B's Mart — Active Debugging & Issue Tracker

This file tracks bugs, UI glitches, sync issues, and platform discrepancies across Web, Android, and iOS for **B's Mart**.

---

## Active Issues

*No active issues currently logged.*

---

## Resolved Issues

### BUG-002: `column "customer_phone" does not exist` When Creating or Signing Into a Customer Account
- **Status**: `Resolved`
- **Description & Reproduction Steps**:
  1. Fill out the **Create Account** form (`Full Name`, `Mobile Phone Number`, `Password`, `Email`) and submit.
  2. Supabase returns error: `column "customer_phone" does not exist`.
- **Root Cause**:
  - In `public.smart_register_customer` and `public.smart_authenticate_customer`, the guest-order linking statement queried `WHERE customer_phone = v_clean_phone`, whereas the actual column on `public.smart_orders` is **`recipient_phone`**.
- **Resolution**:
  - Applied migration `fix_smart_customer_auth_recipient_phone` updating `public.smart_register_customer` and `public.smart_authenticate_customer` to link guest orders via `WHERE recipient_phone = v_clean_phone AND customer_id IS NULL`.

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
