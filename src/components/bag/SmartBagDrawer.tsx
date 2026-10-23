"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  ShoppingBag,
  Truck,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Share2,
  Check,
} from "lucide-react";
import { SmartCoupon, SmartDeliveryZone } from "@/types/smart.types";
import { useSmartNavStore } from "@/store/useSmartNavStore";
import {
  useSmartCartStore,
  computeBagTotals,
  encodeCartShareParam,
} from "@/store/useSmartCartStore";
import { getItemImageUrl } from "@/lib/media";
import { resolveRetailPrice } from "@/lib/pricing";
import { SmartCheckoutModal } from "@/components/checkout/SmartCheckoutModal";

interface SmartBagDrawerProps {
  deliveryZones: SmartDeliveryZone[];
  collectibleCoupons: SmartCoupon[];
}

export function SmartBagDrawer({
  deliveryZones,
  collectibleCoupons,
}: SmartBagDrawerProps) {
  const {
    isBagDrawerOpen,
    setBagDrawerOpen,
    setActiveTab,
    openProductDetail,
    appSettings,
  } = useSmartNavStore();

  const {
    lines,
    appliedCoupon,
    setItemQuantity,
    removeItem,
    toggleLineSelection,
    getTotalUnitCount,
  } = useSmartCartStore();

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [drawerShareCopied, setDrawerShareCopied] = useState(false);

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

  const handleDrawerShareBag = async () => {
    if (lines.length === 0) return;
    const useSelected = bagTotals.selectedLines.length > 0;
    const targetLines = useSelected ? bagTotals.selectedLines : lines;
    const param =
      encodeCartShareParam(lines, useSelected) ||
      encodeCartShareParam(lines, false);
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://bsmartlb.com";
    const shareUrl = `${origin}/?cart=${param}`;
    const totalUnits = targetLines.reduce((acc, l) => acc + l.quantity, 0);
    const subtotal = targetLines.reduce((acc, l) => {
      const p = resolveRetailPrice(l.item.srp, l.item.discount);
      return acc + p.finalUnitPrice * l.quantity;
    }, 0);
    const text = `🛍️ *My B's Mart Shopping Bag (${totalUnits} ${
      totalUnits === 1 ? "item" : "items"
    } • $${subtotal.toFixed(2)})*\nTap to preview or merge into your bag:\n${shareUrl}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "My B's Mart Shopping Bag",
          text,
          url: shareUrl,
        });
        return;
      } catch {}
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setDrawerShareCopied(true);
        setTimeout(() => setDrawerShareCopied(false), 2000);
        return;
      } catch {}
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  if (!isBagDrawerOpen && !isCheckoutOpen) return null;

  return (
    <>
      {isBagDrawerOpen && (
        <div
          onClick={() => setBagDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-smart-teal-deep text-white">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-smart-gold" />
                <span className="text-sm font-black">
                  My Shopping Bag ({getTotalUnitCount()})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {lines.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDrawerShareBag}
                    title="Share Bag Link"
                    className="px-2.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {drawerShareCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-smart-gold" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-smart-gold" />
                        <span>Share</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBagDrawerOpen(false)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Free-Shipping Progress Bar */}
            {appSettings.free_shipping_threshold > 0 && (
              <div className="px-4 py-2.5 bg-amber-50/70 border-b border-amber-200/70 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-slate-800">
                    <Truck className="w-3.5 h-3.5 text-smart-teal" />
                    {bagTotals.qualifiesForFreeShipping ? (
                      <span className="text-emerald-700 font-black">
                        🎉 FREE Delivery Unlocked!
                      </span>
                    ) : (
                      <span>
                        Add{" "}
                        <strong className="text-smart-sale font-black">
                          ${bagTotals.amountRemainingForFreeShipping.toFixed(2)}
                        </strong>{" "}
                        more for FREE Delivery
                      </span>
                    )}
                  </span>
                  <span className="font-black text-smart-teal">
                    {bagTotals.freeShippingProgressPct}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-smart-teal to-smart-gold transition-all duration-300 rounded-full"
                    style={{ width: `${bagTotals.freeShippingProgressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-4">
              {lines.length > 0 ? (
                lines.map((line) => {
                  const p = resolveRetailPrice(
                    line.item.srp,
                    line.item.discount
                  );
                  return (
                    <div
                      key={line.item.item_id}
                      className="py-3 flex items-center gap-3"
                    >
                      <input
                        type="checkbox"
                        checked={line.selected}
                        onChange={() => toggleLineSelection(line.item.item_id)}
                        className="w-4 h-4 rounded border-slate-300 text-smart-teal focus:ring-smart-teal shrink-0 cursor-pointer"
                      />
                      <img
                        src={getItemImageUrl(line.item, "thumb")}
                        alt={line.item.item_name}
                        onClick={() => {
                          setBagDrawerOpen(false);
                          openProductDetail(line.item);
                        }}
                        className="w-14 h-14 rounded-xl object-cover bg-slate-100 border border-slate-200/70 shrink-0 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {line.item.item_name}
                        </p>
                        <p className="text-xs font-black text-smart-teal tabular-numbers mt-0.5">
                          ${p.finalUnitPrice.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="flex items-center bg-slate-100 rounded-full h-7 px-1">
                          <button
                            type="button"
                            onClick={() =>
                              setItemQuantity(
                                line.item.item_id,
                                line.quantity - 1
                              )
                            }
                            className="w-5 h-5 rounded-full hover:bg-white flex items-center justify-center text-slate-700 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="min-w-[18px] text-center text-[11px] font-black tabular-numbers">
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
                            className="w-5 h-5 rounded-full hover:bg-white flex items-center justify-center text-slate-700 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(line.item.item_id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-16 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-500">
                    Your shopping bag is currently empty.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            {lines.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2.5 pb-safe">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">
                    Selected Subtotal ({bagTotals.selectedUnitCount} items)
                  </span>
                  <span className="text-base font-black text-smart-teal tabular-numbers">
                    ${bagTotals.subtotalAfterItemDiscounts.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBagDrawerOpen(false);
                      setActiveTab("bag");
                    }}
                    className="h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-extrabold cursor-pointer"
                  >
                    Open Full Bag
                  </button>
                  <button
                    type="button"
                    disabled={bagTotals.selectedLines.length === 0}
                    onClick={() => {
                      setBagDrawerOpen(false);
                      setIsCheckoutOpen(true);
                    }}
                    className="h-10 rounded-xl bg-smart-teal hover:bg-smart-teal-hover disabled:opacity-40 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Checkout</span>
                    <ArrowRight className="w-3.5 h-3.5 text-smart-gold" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <SmartCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        deliveryZones={deliveryZones}
        availableCoupons={collectibleCoupons}
      />
    </>
  );
}
