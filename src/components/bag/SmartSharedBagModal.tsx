"use client";

import React, { useMemo } from "react";
import {
  ShoppingBag,
  X,
  Plus,
  RefreshCw,
  Truck,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { ItemWithImages } from "@/types/smart.types";
import { useSmartCartStore } from "@/store/useSmartCartStore";
import { useSmartNavStore } from "@/store/useSmartNavStore";
import { getItemImageUrl } from "@/lib/media";
import { resolveRetailPrice, resolveConsumerStockStatus } from "@/lib/pricing";

export interface SharedBagEntry {
  item: ItemWithImages;
  quantity: number;
}

interface SmartSharedBagModalProps {
  entries: SharedBagEntry[] | null;
  onClose: () => void;
}

export function SmartSharedBagModal({
  entries,
  onClose,
}: SmartSharedBagModalProps) {
  const { lines, mergeSharedItems, replaceWithSharedItems } =
    useSmartCartStore();
  const { setActiveTab, openProductDetail, appSettings } = useSmartNavStore();

  const summary = useMemo(() => {
    if (!entries || entries.length === 0) {
      return {
        subtotal: 0,
        totalSavings: 0,
        totalUnits: 0,
        availableEntriesCount: 0,
      };
    }

    let subtotal = 0;
    let totalSavings = 0;
    let totalUnits = 0;
    let availableEntriesCount = 0;

    for (const entry of entries) {
      const stock = resolveConsumerStockStatus(
        entry.item.qtty,
        appSettings.hide_stock_qty
      );
      if (!stock.isAvailable) continue;
      availableEntriesCount += 1;
      const effectiveQty = Math.min(entry.quantity, stock.maxOrderableQty);
      const pricing = resolveRetailPrice(entry.item.srp, entry.item.discount);
      subtotal += pricing.finalUnitPrice * effectiveQty;
      totalSavings += pricing.unitSavings * effectiveQty;
      totalUnits += effectiveQty;
    }

    return {
      subtotal: Number(subtotal.toFixed(2)),
      totalSavings: Number(totalSavings.toFixed(2)),
      totalUnits,
      availableEntriesCount,
    };
  }, [entries, appSettings.hide_stock_qty]);

  if (!entries || entries.length === 0) return null;

  const threshold = Number(appSettings.free_shipping_threshold || 0);
  const qualifiesForFreeShipping =
    threshold > 0 && summary.subtotal >= threshold;
  const remainingForFreeShipping =
    threshold > 0 ? Math.max(0, threshold - summary.subtotal) : 0;

  const handleMerge = () => {
    mergeSharedItems(entries);
    setActiveTab("bag");
    onClose();
  };

  const handleReplace = () => {
    replaceWithSharedItems(entries);
    setActiveTab("bag");
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-smart-teal-deep via-smart-teal to-[#0077A8] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-smart-gold shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-smart-gold">
                <Sparkles className="w-3 h-3" />
                <span>B&apos;s Mart Shared Shopping Bag</span>
              </div>
              <h2 className="text-sm sm:text-base font-black leading-tight">
                Someone shared {entries.length}{" "}
                {entries.length === 1 ? "item" : "items"} with you!
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close shared bag preview"
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Free-Shipping Status Banner */}
        {threshold > 0 && summary.availableEntriesCount > 0 && (
          <div className="px-5 py-2.5 bg-amber-50/80 border-b border-amber-200/70 flex items-center justify-between gap-2 text-xs font-bold">
            <div className="flex items-center gap-1.5 text-slate-800">
              <Truck className="w-4 h-4 text-smart-teal shrink-0" />
              {qualifiesForFreeShipping ? (
                <span className="text-emerald-700 font-black">
                  🎉 This shared bag qualifies for FREE Delivery!
                </span>
              ) : (
                <span>
                  Add{" "}
                  <strong className="text-smart-sale font-black">
                    ${remainingForFreeShipping.toFixed(2)}
                  </strong>{" "}
                  more to unlock{" "}
                  <strong className="text-smart-teal font-black">
                    FREE Delivery
                  </strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Shared Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-4 sm:p-5">
          {entries.map((entry) => {
            const pricing = resolveRetailPrice(
              entry.item.srp,
              entry.item.discount
            );
            const stock = resolveConsumerStockStatus(
              entry.item.qtty,
              appSettings.hide_stock_qty
            );
            const isCapped =
              stock.isAvailable && entry.quantity > stock.maxOrderableQty;
            const effectiveQty = stock.isAvailable
              ? Math.min(entry.quantity, stock.maxOrderableQty)
              : 0;

            return (
              <div
                key={entry.item.item_id}
                className={`py-3 first:pt-0 last:pb-0 flex items-center gap-3.5 ${
                  !stock.isAvailable ? "opacity-60" : ""
                }`}
              >
                <img
                  src={getItemImageUrl(entry.item, "thumb")}
                  alt={entry.item.item_name}
                  onClick={() => {
                    onClose();
                    openProductDetail(entry.item);
                  }}
                  className="w-16 h-16 rounded-2xl object-cover bg-slate-100 border border-slate-200/80 shrink-0 cursor-pointer hover:scale-105 transition-transform"
                />

                <div className="flex-1 min-w-0 space-y-1">
                  <h3
                    onClick={() => {
                      onClose();
                      openProductDetail(entry.item);
                    }}
                    className="text-xs sm:text-sm font-bold text-slate-900 hover:text-smart-teal line-clamp-2 leading-snug cursor-pointer"
                  >
                    {entry.item.item_name}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-slate-400">
                      SKU: {entry.item.code}
                    </span>
                    {!stock.isAvailable ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-extrabold">
                        <AlertCircle className="w-3 h-3" />
                        Out of Stock
                      </span>
                    ) : isCapped ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                        {appSettings.hide_stock_qty
                          ? "Qty adjusted to available stock"
                          : `Capped at ${stock.maxOrderableQty} available`}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-extrabold text-slate-500">
                    Qty: {stock.isAvailable ? effectiveQty : entry.quantity}
                  </div>
                  <div className="text-sm font-black text-smart-teal tabular-numbers">
                    $
                    {(
                      pricing.finalUnitPrice *
                      (stock.isAvailable ? effectiveQty : entry.quantity)
                    ).toFixed(2)}
                  </div>
                  {pricing.isOnSale && (
                    <div className="text-[10px] text-slate-400 line-through tabular-numbers">
                      ${pricing.originalPrice.toFixed(2)} ea
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Summary & Merge / Replace Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 bg-slate-50 space-y-3 shrink-0 pb-safe">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500">
                Shared Bag Subtotal ({summary.totalUnits}{" "}
                {summary.totalUnits === 1 ? "unit" : "units"})
              </span>
              {summary.totalSavings > 0 && (
                <p className="text-[11px] font-extrabold text-emerald-600">
                  Includes ${summary.totalSavings.toFixed(2)} in sale savings
                </p>
              )}
            </div>
            <span className="text-lg sm:text-xl font-black text-smart-teal tabular-numbers">
              ${summary.subtotal.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={summary.availableEntriesCount === 0}
              onClick={handleMerge}
              className="h-11 px-4 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover disabled:opacity-40 text-white text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4 text-smart-gold" />
              <span>
                {lines.length > 0
                  ? "Add All to My Bag (Merge)"
                  : "Add All to My Bag"}
              </span>
            </button>

            {lines.length > 0 ? (
              <button
                type="button"
                disabled={summary.availableEntriesCount === 0}
                onClick={handleReplace}
                className="h-11 px-4 rounded-2xl bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-800 border border-slate-200 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Replace My Bag</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs sm:text-sm font-bold flex items-center justify-center transition-all cursor-pointer"
              >
                Continue Browsing
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
