"use client";

import React from "react";
import { Heart, ShoppingBag, Plus, Minus, Zap, Sparkles } from "lucide-react";
import { ItemWithImages } from "@/types/smart.types";
import { getItemImageUrl, canAccessCreatorStudio } from "@/lib/media";
import { resolveRetailPrice, resolveConsumerStockStatus } from "@/lib/pricing";
import { useSmartNavStore } from "@/store/useSmartNavStore";
import { useSmartCartStore } from "@/store/useSmartCartStore";
import { useSmartWishlistStore } from "@/store/useSmartWishlistStore";
import { useSmartAuthStore } from "@/store/useSmartAuthStore";
import { SmartCreatorShareModal } from "@/components/product/SmartCreatorShareModal";

interface SmartProductCardProps {
  item: ItemWithImages;
  compact?: boolean;
  priority?: boolean;
}

export function SmartProductCard({
  item,
  compact = false,
  priority = false,
}: SmartProductCardProps) {
  const { openProductDetail, appSettings } = useSmartNavStore();
  const { lines, addItem, setItemQuantity } = useSmartCartStore();
  const { wishlistItems, toggleWishlist, addRecentlyViewed } =
    useSmartWishlistStore();
  const staffUser = useSmartAuthStore((s) => s.staffUser);
  const showCreatorBtn = canAccessCreatorStudio(staffUser);
  const [isCreatorModalOpen, setIsCreatorModalOpen] = React.useState(false);

  const pricing = resolveRetailPrice(item.srp, item.discount);
  const stockStatus = resolveConsumerStockStatus(
    item.qtty,
    appSettings.hide_stock_qty
  );

  const isWishlisted = React.useMemo(
    () => wishlistItems.some((w) => w.item_id === item.item_id),
    [wishlistItems, item.item_id]
  );

  const qtyInBag = React.useMemo(() => {
    const found = lines.find((l) => l.item.item_id === item.item_id);
    return found ? found.quantity : 0;
  }, [lines, item.item_id]);

  const handleOpenDetail = () => {
    addRecentlyViewed(item);
    openProductDetail(item);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(item);
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!stockStatus.isAvailable) return;
    addItem(item, 1);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (qtyInBag >= stockStatus.maxOrderableQty) return;
    setItemQuantity(item.item_id, qtyInBag + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    setItemQuantity(item.item_id, qtyInBag - 1);
  };

  const primaryTag = React.useMemo(() => {
    if (!item.tags) return null;
    const parts = item.tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts[0] : null;
  }, [item.tags]);

  return (
    <>
      <div
        onClick={handleOpenDetail}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpenDetail();
          }
        }}
        className="group relative bg-white rounded-2xl border border-slate-200/80 hover:border-smart-teal/40 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col cursor-pointer select-none"
      >
        {/* Square R2 Thumbnail Container */}
        <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
          <img
            src={getItemImageUrl(item, "thumb")}
            alt={item.item_name}
            loading={priority ? "eager" : "lazy"}
            width={300}
            height={300}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Top-Left Badges: Flash Discount % or Real Campaign Tag */}
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1 z-10 pointer-events-none">
            {pricing.isOnSale && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-smart-sale text-white text-[10px] sm:text-[11px] font-black shadow-xs tracking-tight">
                <Zap className="w-2.5 h-2.5 fill-current" />
                <span>-{pricing.discountPercent}%</span>
              </span>
            )}
            {!compact && primaryTag && !pricing.isOnSale && (
              <span className="px-2 py-0.5 rounded-full bg-smart-teal-deep/85 backdrop-blur-xs text-smart-gold text-[10px] font-extrabold shadow-xs">
                {primaryTag}
              </span>
            )}
          </div>

          {/* Top-Right Floating Wishlist Heart */}
          <button
            type="button"
            onClick={handleWishlistClick}
            aria-label={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
            className={`absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-transform active:scale-90 cursor-pointer ${
              isWishlisted
                ? "bg-rose-50 text-rose-500 border border-rose-200"
                : "bg-white/90 backdrop-blur-xs text-slate-600 hover:text-rose-500 border border-slate-200/60"
            }`}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                isWishlisted ? "fill-rose-500 text-rose-500" : ""
              }`}
            />
          </button>

          {/* Creator Studio Button (Only visible to signed-in content_creator / merchandising / admin staff) */}
          {showCreatorBtn && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCreatorModalOpen(true);
              }}
              title="Open Creator Studio (Thumb / View / Raw)"
              aria-label="Open Creator Studio"
              className="absolute top-11 right-2 z-10 w-8 h-8 rounded-full bg-smart-teal-deep/90 hover:bg-smart-teal text-smart-gold border border-white/25 flex items-center justify-center shadow-sm transition-transform active:scale-90 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Out of Stock Overlay (if out of stock is shown) */}
          {!stockStatus.isAvailable && (
            <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px] flex items-center justify-center">
              <span className="px-3 py-1 rounded-full bg-slate-900/90 text-white text-[11px] font-extrabold uppercase tracking-wider">
                Sold Out
              </span>
            </div>
          )}
        </div>

        {/* Product Info & SHEIN-Style Price + Quick-Add Footer */}
        <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-smart-teal transition-colors">
              {item.item_name}
            </h3>
            <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
              <span className="font-mono truncate">{item.code}</span>
              {!compact && item.material && (
                <span className="truncate text-slate-400 font-medium">
                  {item.material}
                </span>
              )}
            </div>
          </div>

          {/* Bottom Price + Single-Unit Quick-Add Stepper */}
          <div className="pt-1 flex items-end justify-between gap-1.5">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span
                  className={`text-sm sm:text-base font-black tabular-numbers leading-none ${
                    pricing.isOnSale ? "text-smart-sale" : "text-smart-teal"
                  }`}
                >
                  ${pricing.finalUnitPrice.toFixed(2)}
                </span>
                {pricing.isOnSale && (
                  <span className="text-[11px] text-slate-400 line-through tabular-numbers leading-none">
                    ${pricing.originalPrice.toFixed(2)}
                  </span>
                )}
              </div>
              {pricing.isOnSale && !compact && (
                <p className="text-[10px] font-extrabold text-emerald-600 mt-0.5">
                  Save ${pricing.unitSavings.toFixed(2)}
                </p>
              )}
            </div>

            {/* Tactile Quick-Add or Single-Unit Stepper */}
            {stockStatus.isAvailable && (
              <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                {qtyInBag > 0 ? (
                  <div className="flex items-center bg-smart-teal text-white rounded-full h-8 px-1 shadow-xs">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      className="w-6 h-6 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="min-w-[20px] text-center text-xs font-black tabular-numbers px-0.5">
                      {qtyInBag}
                    </span>
                    <button
                      type="button"
                      onClick={handleIncrement}
                      disabled={qtyInBag >= stockStatus.maxOrderableQty}
                      className="w-6 h-6 rounded-full hover:bg-white/15 disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleQuickAdd}
                    aria-label={`Add ${item.item_name} to bag`}
                    className="h-8 px-2.5 rounded-full bg-smart-teal hover:bg-smart-teal-hover text-white flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-smart-gold" />
                    <Plus className="w-3 h-3 -ml-0.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreatorBtn && isCreatorModalOpen && (
        <SmartCreatorShareModal
          item={item}
          isOpen={isCreatorModalOpen}
          onClose={() => setIsCreatorModalOpen(false)}
        />
      )}
    </>
  );
}
