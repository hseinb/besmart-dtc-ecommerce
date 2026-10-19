"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShoppingBag,
  Truck,
  TicketPercent,
  Check,
  Trash2,
  Heart,
  Plus,
  Minus,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Zap,
  Loader2,
} from "lucide-react";
import {
  ItemWithImages,
  SmartCoupon,
  SmartDeliveryZone,
} from "@/types/smart.types";
import { useSmartNavStore } from "@/store/useSmartNavStore";
import {
  useSmartCartStore,
  computeBagTotals,
} from "@/store/useSmartCartStore";
import { useSmartWishlistStore } from "@/store/useSmartWishlistStore";
import { getItemImageUrl } from "@/lib/media";
import { resolveRetailPrice, resolveConsumerStockStatus } from "@/lib/pricing";
import { fetchProductRecommendations } from "@/lib/recommendations";
import { validateSmartCouponCode } from "@/lib/smartOrders";
import { SmartProductCard } from "@/components/product/SmartProductCard";
import { SmartCheckoutModal } from "@/components/checkout/SmartCheckoutModal";

interface SmartBagViewProps {
  deliveryZones: SmartDeliveryZone[];
  collectibleCoupons: SmartCoupon[];
  fallbackItems: ItemWithImages[];
}

export function SmartBagView({
  deliveryZones,
  collectibleCoupons,
  fallbackItems,
}: SmartBagViewProps) {
  const { setActiveTab, openProductDetail, appSettings } = useSmartNavStore();
  const {
    lines,
    collectedCoupons,
    appliedCoupon,
    setItemQuantity,
    removeItem,
    toggleLineSelection,
    selectAllLines,
    collectCoupon,
    setAppliedCoupon,
    clearCart,
  } = useSmartCartStore();

  const { wishlistItems, toggleWishlist } = useSmartWishlistStore();

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [bagRecommendations, setBagRecommendations] = useState<
    ItemWithImages[]
  >([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  const allSelected =
    lines.length > 0 && lines.every((line) => line.selected);

  const defaultFee =
    deliveryZones[0]?.delivery_fee ?? appSettings.default_delivery_fee ?? 3;

  const bagTotals = useMemo(
    () =>
      computeBagTotals(
        lines,
        appliedCoupon,
        appSettings.free_shipping_threshold,
        Number(defaultFee)
      ),
    [lines, appliedCoupon, appSettings.free_shipping_threshold, defaultFee]
  );

  // Merge public collectible coupons + user's collected coupons
  const allAvailableCoupons = useMemo(() => {
    const map = new Map<string, SmartCoupon>();
    for (const c of [...collectibleCoupons, ...collectedCoupons]) {
      map.set(c.code.toUpperCase(), c);
    }
    return Array.from(map.values());
  }, [collectibleCoupons, collectedCoupons]);

  // Fetch real ML recommendations from public.recosys_items based on the top item in the bag
  const topBagItem = lines[0]?.item || null;
  useEffect(() => {
    let cancelled = false;
    if (!topBagItem) {
      setBagRecommendations(fallbackItems.slice(0, 10));
      return;
    }

    setIsLoadingRecs(true);
    fetchProductRecommendations(topBagItem, appSettings, 10)
      .then((res) => {
        if (cancelled) return;
        const inBagIds = new Set(lines.map((l) => l.item.item_id));
        const filtered = res.youMayAlsoLike.filter(
          (i) => !inBagIds.has(i.item_id)
        );
        setBagRecommendations(
          filtered.length > 0 ? filtered : fallbackItems.slice(0, 10)
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRecs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [topBagItem, appSettings, fallbackItems, lines]);

  const handleApplyPromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCodeInput.trim()) return;
    setIsCheckingPromo(true);
    setPromoError(null);
    try {
      const res = await validateSmartCouponCode(
        promoCodeInput,
        bagTotals.subtotalAfterItemDiscounts
      );
      if (res.valid && res.coupon) {
        collectCoupon(res.coupon);
        setAppliedCoupon(res.coupon);
        setPromoCodeInput("");
      } else {
        setPromoError(res.errorMessage || "Invalid promo code.");
      }
    } catch {
      setPromoError("Could not validate promo code.");
    } finally {
      setIsCheckingPromo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Free-Shipping Progress Banner */}
      {appSettings.free_shipping_threshold > 0 && (
        <section className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-bold">
            <div className="flex items-center gap-2 text-slate-800">
              <div className="w-8 h-8 rounded-xl bg-smart-teal-light text-smart-teal flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              {bagTotals.qualifiesForFreeShipping ? (
                <span className="text-emerald-700 font-black">
                  🎉 Congratulations! You&apos;ve unlocked FREE Delivery across
                  Lebanon!
                </span>
              ) : (
                <span>
                  Add{" "}
                  <strong className="text-smart-sale font-black">
                    ${bagTotals.amountRemainingForFreeShipping.toFixed(2)}
                  </strong>{" "}
                  more to your selected bag items to unlock{" "}
                  <strong className="text-smart-teal font-black">
                    FREE Delivery
                  </strong>
                  !
                </span>
              )}
            </div>
            <span className="text-xs font-black text-smart-teal tabular-numbers shrink-0">
              {bagTotals.freeShippingProgressPct}%
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-smart-teal via-[#0077A8] to-smart-gold transition-all duration-300 rounded-full"
              style={{ width: `${bagTotals.freeShippingProgressPct}%` }}
            />
          </div>
        </section>
      )}

      {/* 2. Main Bag Layout: Left Selectable Items List + Right Summary & Coupons */}
      {lines.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Cols: Selectable Bag Items */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {/* Select All Header Bar */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => selectAllLines(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-smart-teal focus:ring-smart-teal cursor-pointer"
                />
                <span className="text-xs sm:text-sm font-black text-slate-900">
                  Select All ({lines.length}{" "}
                  {lines.length === 1 ? "item" : "items"})
                </span>
              </label>

              <button
                type="button"
                onClick={clearCart}
                className="text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              >
                Clear Bag
              </button>
            </div>

            {/* Line Items */}
            <div className="divide-y divide-slate-100">
              {lines.map((line) => {
                const pricing = resolveRetailPrice(
                  line.item.srp,
                  line.item.discount
                );
                const stockStatus = resolveConsumerStockStatus(
                  line.item.qtty,
                  appSettings.hide_stock_qty
                );
                const isWishlisted = wishlistItems.some(
                  (w) => w.item_id === line.item.item_id
                );

                return (
                  <div
                    key={line.item.item_id}
                    className={`p-4 sm:px-6 flex items-start sm:items-center gap-3 sm:gap-4 transition-colors ${
                      line.selected ? "bg-white" : "bg-slate-50/60 opacity-75"
                    }`}
                  >
                    {/* Per-Item SHEIN Selection Checkbox */}
                    <input
                      type="checkbox"
                      checked={line.selected}
                      onChange={() => toggleLineSelection(line.item.item_id)}
                      className="mt-6 sm:mt-0 w-4 h-4 rounded border-slate-300 text-smart-teal focus:ring-smart-teal shrink-0 cursor-pointer"
                      aria-label={`Select ${line.item.item_name}`}
                    />

                    {/* Product Image */}
                    <div
                      onClick={() => openProductDetail(line.item)}
                      className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-slate-100 border border-slate-200/70 overflow-hidden shrink-0 cursor-pointer"
                    >
                      <img
                        src={getItemImageUrl(line.item, "thumb")}
                        alt={line.item.item_name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                      {pricing.isOnSale && (
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-smart-sale text-white text-[9px] font-black">
                          -{pricing.discountPercent}%
                        </span>
                      )}
                    </div>

                    {/* Product Details & Controls */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          onClick={() => openProductDetail(line.item)}
                          className="min-w-0 cursor-pointer"
                        >
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 hover:text-smart-teal line-clamp-2 leading-snug">
                            {line.item.item_name}
                          </h3>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                            SKU: {line.item.code}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleWishlist(line.item)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isWishlisted
                                ? "text-rose-500 bg-rose-50"
                                : "text-slate-400 hover:text-rose-500 hover:bg-slate-100"
                            }`}
                            title="Save to Wishlist"
                          >
                            <Heart
                              className={`w-4 h-4 ${
                                isWishlisted ? "fill-rose-500" : ""
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(line.item.item_id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove from Bag"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        {/* Price & Savings */}
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className={`text-sm sm:text-base font-black tabular-numbers ${
                                pricing.isOnSale
                                  ? "text-smart-sale"
                                  : "text-smart-teal"
                              }`}
                            >
                              ${pricing.finalUnitPrice.toFixed(2)}
                            </span>
                            {pricing.isOnSale && (
                              <span className="text-xs text-slate-400 line-through tabular-numbers">
                                ${pricing.originalPrice.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {pricing.isOnSale && (
                            <p className="text-[10px] font-extrabold text-emerald-600">
                              Save $
                              {(pricing.unitSavings * line.quantity).toFixed(2)}{" "}
                              on this line
                            </p>
                          )}
                        </div>

                        {/* Single-Unit Stepper + Line Total */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-slate-100 rounded-full h-8 px-1 border border-slate-200/70">
                            <button
                              type="button"
                              onClick={() =>
                                setItemQuantity(
                                  line.item.item_id,
                                  line.quantity - 1
                                )
                              }
                              className="w-6 h-6 rounded-full hover:bg-white flex items-center justify-center text-slate-700 cursor-pointer"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="min-w-[24px] text-center text-xs font-black text-slate-900 tabular-numbers">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setItemQuantity(
                                  line.item.item_id,
                                  line.quantity + 1
                                )
                              }
                              disabled={
                                line.quantity >= stockStatus.maxOrderableQty
                              }
                              className="w-6 h-6 rounded-full hover:bg-white disabled:opacity-40 flex items-center justify-center text-slate-700 cursor-pointer"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <span className="text-xs sm:text-sm font-black text-slate-900 tabular-numbers min-w-[60px] text-right">
                            $
                            {(pricing.finalUnitPrice * line.quantity).toFixed(
                              2
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 4 Cols: Promo Vouchers & Checkout Summary */}
          <div className="lg:col-span-4 space-y-4 sticky top-28">
            {/* Promo Code & Collectible Coupons Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-3.5">
              <div className="flex items-center gap-2">
                <TicketPercent className="w-4 h-4 text-smart-teal" />
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                  Promo Code &amp; Vouchers
                </h3>
              </div>

              <form onSubmit={handleApplyPromoCode} className="flex gap-2">
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={(e) =>
                    setPromoCodeInput(e.target.value.toUpperCase())
                  }
                  placeholder="Enter promo code..."
                  className="flex-1 h-10 px-3.5 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-smart-teal"
                />
                <button
                  type="submit"
                  disabled={isCheckingPromo || !promoCodeInput.trim()}
                  className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-smart-gold text-xs font-black cursor-pointer"
                >
                  {isCheckingPromo ? "..." : "Apply"}
                </button>
              </form>

              {promoError && (
                <p className="text-[11px] font-bold text-rose-600">
                  {promoError}
                </p>
              )}

              {/* Available Collectible Vouchers */}
              {allAvailableCoupons.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">
                    Available Vouchers
                  </p>
                  <div className="space-y-1.5">
                    {allAvailableCoupons.map((coupon) => {
                      const isApplied =
                        appliedCoupon?.code.toUpperCase() ===
                        coupon.code.toUpperCase();
                      return (
                        <div
                          key={coupon.coupon_id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                            isApplied
                              ? "border-emerald-300 bg-emerald-50/70"
                              : "border-amber-200 bg-amber-50/40"
                          }`}
                        >
                          <div>
                            <span className="font-mono font-black text-slate-900">
                              {coupon.code}
                            </span>
                            <p className="text-[11px] text-slate-500">
                              {coupon.title}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setAppliedCoupon(isApplied ? null : coupon)
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                              isApplied
                                ? "bg-emerald-600 text-white"
                                : "bg-smart-teal text-white"
                            }`}
                          >
                            {isApplied ? "Applied" : "Use"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary & Checkout Button Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                Order Summary ({bagTotals.selectedUnitCount} selected)
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Retail Value (SRP)</span>
                  <span className="font-bold tabular-numbers">
                    ${bagTotals.originalSrpTotal.toFixed(2)}
                  </span>
                </div>

                {bagTotals.itemDiscountSavings > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Item Sale Discounts</span>
                    <span className="tabular-numbers">
                      -${bagTotals.itemDiscountSavings.toFixed(2)}
                    </span>
                  </div>
                )}

                {bagTotals.couponDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Promo Code ({appliedCoupon?.code})</span>
                    <span className="tabular-numbers">
                      -${bagTotals.couponDiscount.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <span>Estimated Delivery</span>
                  <span
                    className={`font-extrabold tabular-numbers ${
                      bagTotals.deliveryFee === 0
                        ? "text-emerald-600"
                        : "text-slate-900"
                    }`}
                  >
                    {bagTotals.deliveryFee === 0
                      ? "FREE"
                      : `$${bagTotals.deliveryFee.toFixed(2)}`}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex justify-between items-baseline">
                  <span className="text-sm font-black text-slate-900">
                    Estimated Total
                  </span>
                  <span className="text-xl font-black text-smart-teal tabular-numbers">
                    ${bagTotals.grandTotal.toFixed(2)}
                  </span>
                </div>

                {bagTotals.totalSavings > 0 && (
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-[11px] font-extrabold text-center">
                    🎉 You are saving ${bagTotals.totalSavings.toFixed(2)} on
                    this order!
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={bagTotals.selectedLines.length === 0}
                onClick={() => setIsCheckoutOpen(true)}
                className="w-full h-12 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover disabled:opacity-40 text-white font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>
                  Checkout ({bagTotals.selectedUnitCount}) • $
                  {bagTotals.grandTotal.toFixed(2)}
                </span>
                <ArrowRight className="w-4 h-4 text-smart-gold" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-smart-teal" />
                <span>
                  1-Page Guest or Customer Checkout • Pay on Delivery
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty Bag State */
        <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center space-y-3 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-smart-teal-light text-smart-teal flex items-center justify-center mx-auto">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="text-base sm:text-xl font-black text-slate-900">
            Your B&apos;s Mart Shopping Bag is Empty
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Browse our categories or Flash Deals to add items. Free delivery
            across Lebanon unlocks on orders over $
            {Number(appSettings.free_shipping_threshold).toFixed(2)}.
          </p>
          <div className="flex justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab("home")}
              className="px-6 py-2.5 rounded-xl bg-smart-teal hover:bg-smart-teal-hover text-white text-xs sm:text-sm font-black shadow-sm cursor-pointer"
            >
              Explore Catalog
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("deals")}
              className="px-5 py-2.5 rounded-xl bg-smart-sale-light text-smart-sale text-xs sm:text-sm font-black cursor-pointer flex items-center gap-1"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Flash Deals</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. "Add to Unlock Free Shipping / Frequently Bought Together" Bag Recommendations */}
      {bagRecommendations.length > 0 && (
        <section className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-smart-teal" />
              <span>
                {!bagTotals.qualifiesForFreeShipping && lines.length > 0
                  ? `Add $${bagTotals.amountRemainingForFreeShipping.toFixed(
                      2
                    )} More to Unlock FREE Delivery`
                  : "Recommended for Your Bag"}
              </span>
            </h3>
            {isLoadingRecs && (
              <Loader2 className="w-4 h-4 animate-spin text-smart-teal" />
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {bagRecommendations.slice(0, 10).map((recItem) => (
              <SmartProductCard key={recItem.item_id} item={recItem} compact />
            ))}
          </div>
        </section>
      )}

      {/* 1-Page Dual Consumer Checkout Modal */}
      <SmartCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        deliveryZones={deliveryZones}
        availableCoupons={allAvailableCoupons}
      />
    </div>
  );
}
