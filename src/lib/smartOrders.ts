import { createClient } from "@/lib/supabase/client";
import {
  SmartCoupon,
  SmartOrder,
  SmartPaymentMethod,
} from "@/types/smart.types";
import { SmartCartLine } from "@/store/useSmartCartStore";
import { resolveRetailPrice } from "@/lib/pricing";
import { getOrCreateSmartDeviceId } from "@/store/useSmartWishlistStore";

export interface CouponValidationResult {
  valid: boolean;
  coupon?: SmartCoupon;
  errorMessage?: string;
}

/**
 * Validates a promo code against real rows in public.smart_coupons.
 */
export async function validateSmartCouponCode(
  rawCode: string,
  currentSubtotal: number
): Promise<CouponValidationResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { valid: false, errorMessage: "Please enter a promo code." };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("smart_coupons")
    .select("*")
    .ilike("code", code)
    .eq("is_active", true)
    .limit(1);

  if (error || !data || data.length === 0) {
    return {
      valid: false,
      errorMessage: `Promo code "${code}" is invalid or no longer active.`,
    };
  }

  const coupon = data[0] as SmartCoupon;
  const now = Date.now();

  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return {
      valid: false,
      errorMessage: `Promo code "${coupon.code}" is not active yet.`,
    };
  }

  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
    return {
      valid: false,
      errorMessage: `Promo code "${coupon.code}" has expired.`,
    };
  }

  if (
    coupon.usage_limit != null &&
    Number(coupon.used_count || 0) >= Number(coupon.usage_limit)
  ) {
    return {
      valid: false,
      errorMessage: `Promo code "${coupon.code}" has reached its usage limit.`,
    };
  }

  const minAmount = Number(coupon.min_order_amount || 0);
  if (currentSubtotal < minAmount) {
    const diff = (minAmount - currentSubtotal).toFixed(2);
    return {
      valid: false,
      errorMessage: `Add $${diff} more to use code "${coupon.code}" (Min. order $${minAmount.toFixed(
        2
      )}).`,
    };
  }

  return { valid: true, coupon };
}

export interface SubmitConsumerOrderInput {
  customerId?: string | null;
  isGuest: boolean;
  recipientName: string;
  recipientPhone: string;
  zoneId: number | null;
  zoneName: string | null;
  cityArea: string;
  streetAddress: string;
  buildingFloor?: string | null;
  landmark?: string | null;
  paymentMethod: SmartPaymentMethod;
  note?: string | null;
  selectedLines: SmartCartLine[];
  subtotal: number;
  itemDiscountTotal: number;
  couponCode?: string | null;
  couponDiscount: number;
  deliveryFee: number;
  total: number;
}

export interface SubmitConsumerOrderResult {
  order: SmartOrder;
  itemCount: number;
}

const LOCAL_ORDERS_STORAGE_KEY = "bsmart_local_orders_v1";

export function loadLocalSavedOrders(): SmartOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ORDERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SmartOrder[]) : [];
  } catch {
    return [];
  }
}

export function saveOrderToLocalHistory(order: SmartOrder) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadLocalSavedOrders().filter(
      (o) => o.order_id !== order.order_id && o.order_number !== order.order_number
    );
    const updated = [order, ...existing].slice(0, 30);
    window.localStorage.setItem(LOCAL_ORDERS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

function generateSmartOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BSM-${y}${m}${d}-${rand}`;
}

/**
 * Persists a B2C consumer order (Guest or Authenticated Customer) into
 * public.smart_orders and public.smart_order_details.
 */
export async function submitSmartConsumerOrder(
  input: SubmitConsumerOrderInput
): Promise<SubmitConsumerOrderResult> {
  if (!input.selectedLines || input.selectedLines.length === 0) {
    throw new Error("No items selected for checkout.");
  }

  const supabase = createClient();
  const orderNumber = generateSmartOrderNumber();

  // 1. Insert order header into public.smart_orders
  const { data: orderData, error: orderError } = await supabase
    .from("smart_orders")
    .insert({
      order_number: orderNumber,
      customer_id: input.customerId || null,
      is_guest: input.isGuest,
      recipient_name: input.recipientName.trim(),
      recipient_phone: input.recipientPhone.trim(),
      zone_id: input.zoneId,
      zone_name: input.zoneName,
      city_area: input.cityArea.trim(),
      street_address: input.streetAddress.trim(),
      building_floor: input.buildingFloor?.trim() || null,
      landmark: input.landmark?.trim() || null,
      payment_method: input.paymentMethod,
      subtotal: Number(input.subtotal.toFixed(2)),
      item_discount_total: Number(input.itemDiscountTotal.toFixed(2)),
      coupon_code: input.couponCode || null,
      coupon_discount: Number(input.couponDiscount.toFixed(2)),
      delivery_fee: Number(input.deliveryFee.toFixed(2)),
      total: Number(input.total.toFixed(2)),
      status: "Pending",
      note: input.note?.trim() || null,
    })
    .select("*")
    .single();

  if (orderError || !orderData) {
    throw new Error(
      orderError?.message || "Failed to create order in smart_orders."
    );
  }

  const createdOrder = orderData as SmartOrder;

  // 2. Insert order lines into public.smart_order_details
  const detailRows = input.selectedLines.map((line) => {
    const pricing = resolveRetailPrice(line.item.srp, line.item.discount);
    const lineTotal = Number((pricing.finalUnitPrice * line.quantity).toFixed(2));
    return {
      order_id: createdOrder.order_id,
      item_id: line.item.item_id,
      quantity: line.quantity,
      srp: pricing.originalPrice,
      unit_price: pricing.finalUnitPrice,
      discount: pricing.discountPercent,
      total: lineTotal,
      note: null,
    };
  });

  const { error: detailsError } = await supabase
    .from("smart_order_details")
    .insert(detailRows);

  if (detailsError) {
    throw new Error(
      detailsError.message || "Failed to record order line items."
    );
  }

  // 2b. Mirror B's Mart order into B2B warehouse tables (public.orders & public.order_details)
  // under single wholesale account acct_id = 3899 ("Bs Mart") at wholesale prices
  try {
    const { data: mirrorRes, error: mirrorError } = await supabase.rpc(
      "smart_mirror_order_to_b2b",
      {
        p_smart_order_id: createdOrder.order_id,
      }
    );
    if (mirrorError) {
      console.error(
        "RPC smart_mirror_order_to_b2b returned error:",
        mirrorError.message
      );
    } else {
      const parsedMirror = mirrorRes as {
        success?: boolean;
        b2b_order_id?: number;
        error?: string;
      } | null;
      if (parsedMirror?.success && parsedMirror.b2b_order_id) {
        createdOrder.b2b_order_id = parsedMirror.b2b_order_id;
        createdOrder.b2b_status = "Pending";
      } else if (parsedMirror?.error) {
        console.error(
          "smart_mirror_order_to_b2b failed:",
          parsedMirror.error
        );
      }
    }
  } catch (err) {
    console.error("Failed to mirror order to B2B acct_id 3899:", err);
  }

  // 3. Best-effort: increment used_count on smart_coupons if a coupon was applied
  if (input.couponCode) {
    try {
      const { data: couponRows } = await supabase
        .from("smart_coupons")
        .select("coupon_id, used_count")
        .ilike("code", input.couponCode)
        .limit(1);

      if (couponRows && couponRows.length > 0) {
        const c = couponRows[0];
        await supabase
          .from("smart_coupons")
          .update({ used_count: Number(c.used_count || 0) + 1 })
          .eq("coupon_id", c.coupon_id);
      }
    } catch {}
  }

  // 4. Best-effort: record checkout event in public.smart_app_events
  try {
    await supabase.from("smart_app_events").insert({
      customer_id: input.customerId || null,
      device_id: getOrCreateSmartDeviceId(),
      event_type: "checkout_completed",
      event_data: {
        order_id: createdOrder.order_id,
        order_number: createdOrder.order_number,
        total: createdOrder.total,
        payment_method: createdOrder.payment_method,
        zone_name: createdOrder.zone_name,
        is_guest: createdOrder.is_guest,
      },
    });
  } catch {}

  // 5. Save to local device history so Guest & Customer shoppers can track immediately
  saveOrderToLocalHistory(createdOrder);

  const totalUnits = input.selectedLines.reduce((acc, l) => acc + l.quantity, 0);
  return {
    order: createdOrder,
    itemCount: totalUnits,
  };
}
