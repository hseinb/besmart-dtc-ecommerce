import { create } from "zustand";
import { ItemWithImages, SmartCoupon } from "@/types/smart.types";
import { resolveRetailPrice } from "@/lib/pricing";

export interface SmartCartLine {
  item: ItemWithImages;
  quantity: number;
  selected: boolean;
  addedAt: number;
}

const CART_STORAGE_KEY = "bsmart_cart_lines_v1";
const COLLECTED_COUPONS_KEY = "bsmart_collected_coupons_v1";
const APPLIED_COUPON_KEY = "bsmart_applied_coupon_v1";

function loadCartLines(): SmartCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SmartCartLine[]) : [];
  } catch {
    return [];
  }
}

function saveCartLines(lines: SmartCartLine[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {}
}

function loadCollectedCoupons(): SmartCoupon[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COLLECTED_COUPONS_KEY);
    return raw ? (JSON.parse(raw) as SmartCoupon[]) : [];
  } catch {
    return [];
  }
}

function saveCollectedCoupons(coupons: SmartCoupon[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLLECTED_COUPONS_KEY, JSON.stringify(coupons));
  } catch {}
}

export function encodeCartShareParam(
  lines: SmartCartLine[],
  onlySelected = false
): string {
  const source = onlySelected ? lines.filter((l) => l.selected) : lines;
  return source
    .filter((l) => Number(l.item?.item_id) > 0 && Number(l.quantity) > 0)
    .map(
      (l) =>
        `${Math.floor(Number(l.item.item_id))}.${Math.max(
          1,
          Math.floor(Number(l.quantity) || 1)
        )}`
    )
    .join("_");
}

export function decodeCartShareParam(
  rawParam: string | null | undefined
): { itemId: number; quantity: number }[] {
  if (!rawParam || typeof rawParam !== "string") return [];
  const trimmed = rawParam.trim();
  if (!trimmed) return [];

  const tokens = trimmed.split("_");
  const merged = new Map<number, number>();

  for (const token of tokens) {
    if (!token) continue;
    const parts = token.split(".");
    if (parts.length !== 2) continue;

    const itemId = Math.floor(Number(parts[0]));
    const rawQty = Math.floor(Number(parts[1]));

    if (!Number.isFinite(itemId) || itemId <= 0) continue;
    const qty = Number.isFinite(rawQty) && rawQty >= 1 ? Math.min(999, rawQty) : 1;

    if (!merged.has(itemId) && merged.size >= 50) continue;
    merged.set(itemId, Math.min(999, (merged.get(itemId) || 0) + qty));
  }

  return Array.from(merged.entries()).map(([itemId, quantity]) => ({
    itemId,
    quantity,
  }));
}

interface SmartCartState {
  lines: SmartCartLine[];
  collectedCoupons: SmartCoupon[];
  appliedCoupon: SmartCoupon | null;
  hydrated: boolean;
  hydrate: () => void;
  addItem: (item: ItemWithImages, qty?: number) => void;
  setItemQuantity: (itemId: number, qty: number) => void;
  removeItem: (itemId: number) => void;
  toggleLineSelection: (itemId: number) => void;
  selectAllLines: (selected: boolean) => void;
  getItemQuantity: (itemId: number) => number;
  getTotalUnitCount: () => number;
  collectCoupon: (coupon: SmartCoupon) => void;
  isCouponCollected: (code: string) => boolean;
  setAppliedCoupon: (coupon: SmartCoupon | null) => void;
  clearSelectedLines: () => void;
  clearCart: () => void;
  mergeSharedItems: (
    entries: { item: ItemWithImages; quantity: number }[]
  ) => { addedUnits: number; cappedCount: number; skippedOutOfStockCount: number };
  replaceWithSharedItems: (
    entries: { item: ItemWithImages; quantity: number }[]
  ) => { addedUnits: number; cappedCount: number; skippedOutOfStockCount: number };
}

export const useSmartCartStore = create<SmartCartState>((set, get) => ({
  lines: [],
  collectedCoupons: [],
  appliedCoupon: null,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const lines = loadCartLines();
    const collectedCoupons = loadCollectedCoupons();
    let appliedCoupon: SmartCoupon | null = null;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(APPLIED_COUPON_KEY);
        appliedCoupon = raw ? (JSON.parse(raw) as SmartCoupon) : null;
      } catch {}
    }
    set({
      lines,
      collectedCoupons,
      appliedCoupon,
      hydrated: true,
    });
  },

  addItem: (item, qty = 1) => {
    const currentLines = get().lines;
    const maxStock =
      Number(item.qtty) > 0 ? Math.floor(Number(item.qtty)) : 99;
    const existingIndex = currentLines.findIndex(
      (l) => l.item.item_id === item.item_id
    );

    let updated: SmartCartLine[];
    if (existingIndex >= 0) {
      const existing = currentLines[existingIndex];
      const nextQty = Math.min(maxStock, Math.max(1, existing.quantity + qty));
      updated = currentLines.map((l, idx) =>
        idx === existingIndex
          ? { ...l, item, quantity: nextQty, selected: true }
          : l
      );
    } else {
      const initialQty = Math.min(maxStock, Math.max(1, qty));
      updated = [
        {
          item,
          quantity: initialQty,
          selected: true,
          addedAt: Date.now(),
        },
        ...currentLines,
      ];
    }

    saveCartLines(updated);
    set({ lines: updated });
  },

  setItemQuantity: (itemId, qty) => {
    if (qty <= 0) {
      get().removeItem(itemId);
      return;
    }
    const updated = get().lines.map((line) => {
      if (line.item.item_id !== itemId) return line;
      const maxStock =
        Number(line.item.qtty) > 0 ? Math.floor(Number(line.item.qtty)) : 99;
      return {
        ...line,
        quantity: Math.min(maxStock, Math.max(1, Math.floor(qty))),
      };
    });
    saveCartLines(updated);
    set({ lines: updated });
  },

  removeItem: (itemId) => {
    const updated = get().lines.filter((l) => l.item.item_id !== itemId);
    saveCartLines(updated);
    set({ lines: updated });
  },

  toggleLineSelection: (itemId) => {
    const updated = get().lines.map((l) =>
      l.item.item_id === itemId ? { ...l, selected: !l.selected } : l
    );
    saveCartLines(updated);
    set({ lines: updated });
  },

  selectAllLines: (selected) => {
    const updated = get().lines.map((l) => ({ ...l, selected }));
    saveCartLines(updated);
    set({ lines: updated });
  },

  getItemQuantity: (itemId) => {
    const found = get().lines.find((l) => l.item.item_id === itemId);
    return found ? found.quantity : 0;
  },

  getTotalUnitCount: () => {
    return get().lines.reduce((acc, l) => acc + l.quantity, 0);
  },

  collectCoupon: (coupon) => {
    const current = get().collectedCoupons;
    const exists = current.some(
      (c) => c.code.toUpperCase() === coupon.code.toUpperCase()
    );
    if (exists) return;
    const updated = [coupon, ...current];
    saveCollectedCoupons(updated);
    set({ collectedCoupons: updated });
  },

  isCouponCollected: (code) => {
    return get().collectedCoupons.some(
      (c) => c.code.toUpperCase() === code.toUpperCase()
    );
  },

  setAppliedCoupon: (coupon) => {
    if (typeof window !== "undefined") {
      try {
        if (coupon) {
          window.localStorage.setItem(APPLIED_COUPON_KEY, JSON.stringify(coupon));
        } else {
          window.localStorage.removeItem(APPLIED_COUPON_KEY);
        }
      } catch {}
    }
    set({ appliedCoupon: coupon });
  },

  clearSelectedLines: () => {
    const updated = get().lines.filter((l) => !l.selected);
    saveCartLines(updated);
    set({ lines: updated, appliedCoupon: null });
  },

  clearCart: () => {
    saveCartLines([]);
    set({ lines: [], appliedCoupon: null });
  },

  mergeSharedItems: (entries) => {
    const updated = [...get().lines];
    let addedUnits = 0;
    let cappedCount = 0;
    let skippedOutOfStockCount = 0;
    const now = Date.now();

    for (const entry of entries) {
      const { item, quantity } = entry;
      const maxStock = Math.floor(Number(item?.qtty) || 0);
      if (maxStock <= 0) {
        skippedOutOfStockCount += 1;
        continue;
      }

      const reqQty = Math.max(1, Math.floor(Number(quantity) || 1));
      const existingIdx = updated.findIndex(
        (l) => l.item.item_id === item.item_id
      );

      if (existingIdx >= 0) {
        const existing = updated[existingIdx];
        const desired = existing.quantity + reqQty;
        if (desired > maxStock) {
          cappedCount += 1;
        }
        const nextQty = Math.min(maxStock, Math.max(1, desired));
        const delta = Math.max(0, nextQty - existing.quantity);
        addedUnits += delta;
        updated[existingIdx] = {
          ...existing,
          item,
          quantity: nextQty,
          selected: true,
        };
      } else {
        if (reqQty > maxStock) {
          cappedCount += 1;
        }
        const initialQty = Math.min(maxStock, reqQty);
        addedUnits += initialQty;
        updated.unshift({
          item,
          quantity: initialQty,
          selected: true,
          addedAt: now,
        });
      }
    }

    saveCartLines(updated);
    set({ lines: updated });
    return { addedUnits, cappedCount, skippedOutOfStockCount };
  },

  replaceWithSharedItems: (entries) => {
    const updated: SmartCartLine[] = [];
    const seenIds = new Set<number>();
    let addedUnits = 0;
    let cappedCount = 0;
    let skippedOutOfStockCount = 0;
    const now = Date.now();

    for (const entry of entries) {
      const { item, quantity } = entry;
      if (!item || seenIds.has(item.item_id)) continue;

      const maxStock = Math.floor(Number(item.qtty) || 0);
      if (maxStock <= 0) {
        skippedOutOfStockCount += 1;
        continue;
      }

      seenIds.add(item.item_id);
      const reqQty = Math.max(1, Math.floor(Number(quantity) || 1));
      if (reqQty > maxStock) {
        cappedCount += 1;
      }
      const finalQty = Math.min(maxStock, reqQty);
      addedUnits += finalQty;

      updated.push({
        item,
        quantity: finalQty,
        selected: true,
        addedAt: now,
      });
    }

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(APPLIED_COUPON_KEY);
      } catch {}
    }

    saveCartLines(updated);
    set({ lines: updated, appliedCoupon: null });
    return { addedUnits, cappedCount, skippedOutOfStockCount };
  },
}));

export function computeBagTotals(
  lines: SmartCartLine[],
  appliedCoupon: SmartCoupon | null,
  freeShippingThreshold: number,
  selectedZoneFee: number
) {
  const selectedLines = lines.filter((l) => l.selected);

  let originalSrpTotal = 0;
  let subtotalAfterItemDiscounts = 0;
  let itemDiscountSavings = 0;
  let selectedUnitCount = 0;

  for (const line of selectedLines) {
    const pricing = resolveRetailPrice(line.item.srp, line.item.discount);
    originalSrpTotal += pricing.originalPrice * line.quantity;
    subtotalAfterItemDiscounts += pricing.finalUnitPrice * line.quantity;
    itemDiscountSavings += pricing.unitSavings * line.quantity;
    selectedUnitCount += line.quantity;
  }

  originalSrpTotal = Number(originalSrpTotal.toFixed(2));
  subtotalAfterItemDiscounts = Number(subtotalAfterItemDiscounts.toFixed(2));
  itemDiscountSavings = Number(itemDiscountSavings.toFixed(2));

  let couponDiscount = 0;
  let couponFreeShipping = false;

  if (
    appliedCoupon &&
    appliedCoupon.is_active &&
    subtotalAfterItemDiscounts >= Number(appliedCoupon.min_order_amount || 0)
  ) {
    if (appliedCoupon.discount_type === "percentage") {
      const rawCut =
        subtotalAfterItemDiscounts * (Number(appliedCoupon.discount_value) / 100);
      couponDiscount =
        appliedCoupon.max_discount_amount != null
          ? Math.min(rawCut, Number(appliedCoupon.max_discount_amount))
          : rawCut;
    } else if (appliedCoupon.discount_type === "fixed") {
      couponDiscount = Math.min(
        subtotalAfterItemDiscounts,
        Number(appliedCoupon.discount_value)
      );
    } else if (appliedCoupon.discount_type === "free_shipping") {
      couponFreeShipping = true;
    }
  }

  couponDiscount = Number(couponDiscount.toFixed(2));
  const netMerchandiseTotal = Number(
    Math.max(0, subtotalAfterItemDiscounts - couponDiscount).toFixed(2)
  );

  const threshold = Math.max(0, Number(freeShippingThreshold) || 0);
  const qualifiesForFreeShipping =
    couponFreeShipping ||
    (threshold > 0 && netMerchandiseTotal >= threshold && selectedLines.length > 0);

  const amountRemainingForFreeShipping =
    threshold > 0
      ? Number(Math.max(0, threshold - netMerchandiseTotal).toFixed(2))
      : 0;

  const freeShippingProgressPct =
    threshold > 0
      ? Math.min(100, Math.round((netMerchandiseTotal / threshold) * 100))
      : 100;

  const deliveryFee =
    selectedLines.length === 0
      ? 0
      : qualifiesForFreeShipping
      ? 0
      : Number(Math.max(0, Number(selectedZoneFee) || 0).toFixed(2));

  const grandTotal = Number((netMerchandiseTotal + deliveryFee).toFixed(2));
  const totalSavings = Number((itemDiscountSavings + couponDiscount).toFixed(2));

  return {
    selectedLines,
    selectedUnitCount,
    originalSrpTotal,
    subtotalAfterItemDiscounts,
    itemDiscountSavings,
    couponDiscount,
    netMerchandiseTotal,
    qualifiesForFreeShipping,
    amountRemainingForFreeShipping,
    freeShippingProgressPct,
    deliveryFee,
    grandTotal,
    totalSavings,
  };
}
