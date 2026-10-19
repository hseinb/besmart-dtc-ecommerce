---
name: b2c-commerce-engine
description: Architecture and business logic guidelines for B's Mart B2C retail pricing, sale discounts, promo codes/coupons, delivery zone fees, free-shipping thresholds, wishlists, reviews, and Guest/Customer checkout state.
---

# B's Mart B2C Retail Commerce Engine

This skill defines the standard calculations, state patterns, and business rules for the **B's Mart** B2C consumer ordering platform.

---

## 1. Retail Pricing & Sale Strikethrough Architecture

Unlike B2B wholesale (which uses dealer-level `DiscPerc`, volume tiers, and carton multipliers), **B's Mart** operates on single-unit retail consumer pricing:

- **Retail Price & Sale Discount Formula**:
  ```typescript
  export interface RetailPriceResult {
    originalPrice: number;       // Base retail SRP
    finalUnitPrice: number;      // Final consumer price after item/flash sale discount
    discountPercent: number;     // Active item discount percentage (0 - 100)
    unitSavings: number;         // Dollar amount saved per unit
    isOnSale: boolean;           // True when discountPercent > 0
  }

  export function resolveRetailPrice(srp: number, itemDiscountPerc: number = 0): RetailPriceResult {
    const clampedDisc = Math.min(Math.max(itemDiscountPerc || 0, 0), 100);
    const finalUnitPrice = Number((srp * (1 - clampedDisc / 100)).toFixed(2));
    const unitSavings = Number((srp - finalUnitPrice).toFixed(2));

    return {
      originalPrice: Number(srp.toFixed(2)),
      finalUnitPrice,
      discountPercent: clampedDisc,
      unitSavings,
      isOnSale: clampedDisc > 0 && unitSavings > 0,
    };
  }
  ```
- **Single-Unit Consumer Increments & Stock Capping**:
  - Consumers order in individual retail units (`1, 2, 3...`). Never multiply by wholesale carton/box quantities.
  - Maximum orderable quantity per SKU is capped at `Math.max(0, item.qtty)` (or an optional retail per-order limit if configured in `smart_app_settings`).
  - When `smart_app_settings.hide_stock_qty` is enabled, enforce the stock cap silently or show a friendly *"Maximum available quantity reached"* toast without exposing the exact warehouse integer.

---

## 2. Promo Codes & Discount Coupons (`smart_coupons`)

Consumers can apply a promo code in the Cart Drawer or Checkout screen:

```typescript
export interface SmartCoupon {
  id: string;
  code: string;                        // Case-insensitive uppercase token (e.g. "WELCOME10")
  discount_type: 'percentage' | 'fixed' | 'free_shipping';
  discount_value: number;              // e.g. 10 (%) or 15 ($15.00)
  min_order_amount: number;            // Minimum cart subtotal required
  max_discount_amount?: number | null; // Optional cap on percentage discounts
  starts_at?: string | null;
  expires_at?: string | null;
  usage_limit?: number | null;
  used_count: number;
  is_active: boolean;
}
```

### Coupon Evaluation Order:
1. Compute `itemsSubtotal` using each item's `finalUnitPrice * quantity`.
2. Verify `coupon.is_active`, date window (`starts_at <= now <= expires_at`), and `usage_limit`.
3. Verify `itemsSubtotal >= coupon.min_order_amount`.
4. Calculate `couponDiscount`:
   - `'percentage'`: `Math.min(itemsSubtotal * (coupon.discount_value / 100), coupon.max_discount_amount ?? Infinity)`
   - `'fixed'`: `Math.min(coupon.discount_value, itemsSubtotal)`
   - `'free_shipping'`: Sets `deliveryFee = 0`.

---

## 3. Delivery Zones & Free-Shipping Progress Bar

B's Mart encourages higher basket sizes via a live **Free-Shipping Progress Bar** in the cart drawer and header:

```typescript
export interface ShippingSummary {
  qualifiesForFreeShipping: boolean;
  amountRemainingForFreeShipping: number;
  progressPercentage: number; // 0 to 100
  deliveryFee: number;
}

export function calculateShipping(
  subtotalAfterCoupon: number,
  zoneDeliveryFee: number,
  freeShippingThreshold: number | null,
  hasFreeShippingCoupon: boolean = false
): ShippingSummary {
  if (hasFreeShippingCoupon || (freeShippingThreshold !== null && freeShippingThreshold > 0 && subtotalAfterCoupon >= freeShippingThreshold)) {
    return {
      qualifiesForFreeShipping: true,
      amountRemainingForFreeShipping: 0,
      progressPercentage: 100,
      deliveryFee: 0,
    };
  }

  const remaining = freeShippingThreshold && freeShippingThreshold > 0
    ? Number(Math.max(0, freeShippingThreshold - subtotalAfterCoupon).toFixed(2))
    : 0;
  const progress = freeShippingThreshold && freeShippingThreshold > 0
    ? Math.min(100, Math.round((subtotalAfterCoupon / freeShippingThreshold) * 100))
    : 0;

  return {
    qualifiesForFreeShipping: false,
    amountRemainingForFreeShipping: remaining,
    progressPercentage: progress,
    deliveryFee: zoneDeliveryFee,
  };
}
```

---

## 4. Open Browsing, Guest Checkout & Account Merge Pattern

1. **Zero Login Walls**:
   - Visitors can browse all categories, reels, search results, and product detail pages, add items to their cart, and save local wishlist items without signing in.
2. **Dual Checkout Flow**:
   - **Guest Checkout**: Collects `full_name`, `phone`, `email` (optional), `city/zone`, `street_address`, `building_floor`, `delivery_notes`, and `payment_method` (e.g. Cash on Delivery). Inserts into `public.smart_orders` with `user_id = null` and a generated `guest_session_id` / tracking token.
   - **Customer Account Checkout**: Pre-fills saved addresses from `public.smart_customers`, links the order to `user_id`, and saves new addresses automatically.
3. **Guest-to-Customer State Merge (Zustand)**:
   - When a guest with items in their local Cart or Wishlist signs in or registers:
     - Merge local cart quantities with any existing cloud cart items (clamped to `item.qtty`).
     - Upsert local wishlist `item_id`s into `public.smart_wishlists` for that `user_id`.

---

## 5. Wishlists & Product Reviews (`smart_wishlists` & `smart_reviews`)

- **Wishlists (`smart_wishlists`)**:
  - Instant optimistic heart-toggle animation in UI (`useWishlistStore`).
  - Persisted in `localStorage` / `IndexedDB` for guests and synchronized with `public.smart_wishlists` for authenticated users.
- **Product Reviews (`smart_reviews`)**:
  - Consumers can view star ratings (`1` to `5`) and written reviews on Product Detail Pages.
  - Authenticated buyers can submit reviews (`rating`, `title`, `comment`), moderated or published per `smart_app_settings`.
