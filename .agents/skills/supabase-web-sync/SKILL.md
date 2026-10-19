---
name: supabase-web-sync
description: Supabase JS client integration, PostgREST chunking pagination, shared catalog reads (tbl_items, item_images), isolated smart_* B2C tables, and Realtime order tracking.
---

# Supabase Web Integration & Cloud Sync for B's Mart (B2C)

This skill documents patterns and best practices for integrating Supabase into the **B's Mart** B2C ordering application using `@supabase/supabase-js`.

---

## 1. Shared Supabase Project & Namespace Isolation

B's Mart connects to the shared Supabase project (`https://nhellhapzcylcukdxcwo.supabase.co`) and Cloudflare R2 CDN, using a strict dual-namespace table architecture:

### A. Shared Catalog Read Tables (Read-Only for B's Mart Clients)
1. **`tbl_items`**:
   - `item_id` (PK, integer), `code` (SKU), `item_name`, `class_id`, `description`, `upc`, `qtty`, `price` (Retail SRP), `discount` (Item Discount %), `material`, `house_rooms`, `length`, `width`, `thickness`, `weight`, `tags`, `video_url`, `video_thumbnail_url`, `modified_date`.
2. **`tbl_item_classes`**:
   - `item_class_id` (PK), `item_class` (Category Name), `item_class_description`.
3. **`item_images`**:
   - `ItemID` (PK, integer), `Thumb` (JSONB array of WebP thumb URLs), `View` (JSONB array of medium WebP URLs), `Raw` (JSONB array of high-res master URLs), `UpdateDate`.

### B. Isolated B's Mart B2C Tables (`smart_*` Prefix)
All B2C consumer records, settings, promotions, and orders **MUST** use the `smart_` prefix:
1. **`smart_app_settings`**:
   - B's Mart global settings (`hide_stock_qty`, `hide_out_of_stock`, `require_images`, `hidden_categories`, `default_sort`, `free_shipping_threshold`, `default_delivery_fee`, `latest_version`, `latest_build`, brand theme settings).
2. **`smart_users` / `smart_customers`**:
   - Consumer profiles, phone numbers, email addresses, saved delivery addresses (city/zone, street, building/floor, landmarks), and loyalty metadata.
3. **`smart_orders` & `smart_order_items`**:
   - B2C orders supporting both **Guest Checkout** (`user_id IS NULL`, `guest_name`, `guest_phone`, `delivery_address`, `tracking_token`) and **Registered Customer Checkout** (`user_id`, `customer_id`).
   - Stores `subtotal`, `discount_amount`, `coupon_code`, `delivery_fee`, `total_amount`, `payment_method`, `status` (`Pending`, `Confirmed`, `Out for Delivery`, `Delivered`, `Cancelled`), and `erp_order_id`.
4. **`smart_coupons`**:
   - Promotional discount codes (`code`, `discount_type`, `discount_value`, `min_order_amount`, `max_discount_amount`, `expires_at`, `usage_limit`, `used_count`, `is_active`).
5. **`smart_wishlists`**:
   - Authenticated user saved favorites (`user_id`, `item_id`, `created_at`).
6. **`smart_reviews`**:
   - Consumer product ratings and reviews (`id`, `item_id`, `user_id`, `reviewer_name`, `rating`, `comment`, `is_verified_purchase`, `is_approved`, `created_at`).
7. **`smart_banners`**:
   - B's Mart hero banners and promotional campaign slides (`id`, `title`, `subtitle`, `image_url`, `action_type`, `action_target`, `badge_text`, `badge_color`, `is_active`, `display_order`).
8. **`smart_task_queue`**:
   - Asynchronous RPC broker between B's Mart and the on-premise `smartBridge.js` daemon.

---

## 2. PostgREST Chunking & Pagination Pattern

Supabase PostgREST enforces a 1,000-row limit per request. When fetching full catalog datasets from `tbl_items` or `item_images`, use `.range(from, from + PAGE_SIZE - 1)`:

```typescript
export async function fetchAllCatalogItems(): Promise<Item[]> {
  let allItems: Item[] = [];
  let from = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('tbl_items')
      .select('*')
      .order('item_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error || !data || data.length === 0) break;
    allItems = allItems.concat(data as Item[]);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allItems;
}
```

---

## 3. Realtime Order Status & Stock Subscriptions

Subscribe to `public.smart_orders` changes so shoppers can watch their order progress live (`Pending` $\rightarrow$ `Confirmed` $\rightarrow$ `Out for Delivery` $\rightarrow$ `Delivered`):
```typescript
export function subscribeToOrderStatus(orderId: string, onUpdate: (payload: any) => void) {
  return supabase
    .channel(`smart-order-${orderId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'smart_orders', filter: `id=eq.${orderId}` },
      (payload) => onUpdate(payload.new)
    )
    .subscribe();
}
```
