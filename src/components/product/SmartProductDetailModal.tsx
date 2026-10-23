"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Heart,
  Share2,
  ShoppingBag,
  Plus,
  Minus,
  Zap,
  Truck,
  ShieldCheck,
  Maximize2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Ruler,
  Layers,
  Home,
  CreditCard,
  Loader2,
} from "lucide-react";
import {
  ItemClass,
  ItemWithImages,
  SmartDeliveryZone,
} from "@/types/smart.types";
import { useSmartNavStore } from "@/store/useSmartNavStore";
import { useSmartCartStore } from "@/store/useSmartCartStore";
import { useSmartWishlistStore } from "@/store/useSmartWishlistStore";
import { getItemGalleryUrls, getItemImageUrl } from "@/lib/media";
import { resolveRetailPrice, resolveConsumerStockStatus } from "@/lib/pricing";
import { fetchProductRecommendations } from "@/lib/recommendations";
import { SmartProductCard } from "@/components/product/SmartProductCard";

interface SmartProductDetailModalProps {
  categories: ItemClass[];
  deliveryZones: SmartDeliveryZone[];
}

export function SmartProductDetailModal({
  categories,
  deliveryZones,
}: SmartProductDetailModalProps) {
  const {
    selectedProduct,
    closeProductDetail,
    openProductDetail,
    setActiveTab,
    navigateToCategory,
    appSettings,
  } = useSmartNavStore();

  const { lines, addItem } = useSmartCartStore();
  const { wishlistItems, toggleWishlist, addRecentlyViewed } =
    useSmartWishlistStore();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [orderQty, setOrderQty] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);

  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const didSwipeRef = useRef<boolean>(false);

  const [frequentlyBought, setFrequentlyBought] = useState<ItemWithImages[]>(
    []
  );
  const [youMayAlsoLike, setYouMayAlsoLike] = useState<ItemWithImages[]>([]);
  const [salesPitch, setSalesPitch] = useState<string | null>(null);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  // Reset gallery & fetch real ML recommendations when selectedProduct changes
  useEffect(() => {
    if (!selectedProduct) return;
    setActiveImageIndex(0);
    setIsLightboxOpen(false);
    setIsZoomedIn(false);
    setOrderQty(1);
    setAddedFeedback(false);
    addRecentlyViewed(selectedProduct);

    let cancelled = false;
    setIsLoadingRecs(true);
    fetchProductRecommendations(selectedProduct, appSettings, 10)
      .then((res) => {
        if (cancelled) return;
        setFrequentlyBought(res.frequentlyBoughtTogether);
        setYouMayAlsoLike(res.youMayAlsoLike);
        setSalesPitch(res.salesPitch);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRecs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProduct, appSettings, addRecentlyViewed]);

  const gallery = selectedProduct ? getItemGalleryUrls(selectedProduct) : [];

  // Close on Escape key & cycle images on ArrowLeft / ArrowRight
  useEffect(() => {
    if (!selectedProduct) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isLightboxOpen) {
          setIsLightboxOpen(false);
          setIsZoomedIn(false);
        } else {
          closeProductDetail();
        }
      } else if (e.key === "ArrowLeft" && gallery.length > 1) {
        setIsZoomedIn(false);
        setActiveImageIndex((prev) =>
          prev === 0 ? gallery.length - 1 : prev - 1
        );
      } else if (e.key === "ArrowRight" && gallery.length > 1) {
        setIsZoomedIn(false);
        setActiveImageIndex((prev) =>
          prev === gallery.length - 1 ? 0 : prev + 1
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedProduct, isLightboxOpen, closeProductDetail, gallery.length]);

  if (!selectedProduct) return null;

  const currentSlot = gallery[activeImageIndex] || gallery[0];
  const currentViewUrl =
    currentSlot?.view ||
    (currentSlot?.raw && !currentSlot.raw.includes("drive.google.com")
      ? currentSlot.raw
      : undefined) ||
    currentSlot?.thumb ||
    getItemImageUrl(selectedProduct, "view");
  const rawCandidate =
    currentSlot?.raw && !currentSlot.raw.includes("drive.google.com")
      ? currentSlot.raw
      : undefined;
  const currentRawUrl = rawCandidate || currentSlot?.view || currentViewUrl;

  const goPrevImage = () => {
    if (gallery.length <= 1) return;
    setIsZoomedIn(false);
    setActiveImageIndex((prev) =>
      prev === 0 ? gallery.length - 1 : prev - 1
    );
  };

  const goNextImage = () => {
    if (gallery.length <= 1) return;
    setIsZoomedIn(false);
    setActiveImageIndex((prev) =>
      prev === gallery.length - 1 ? 0 : prev + 1
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    swipeStartXRef.current = e.touches[0].clientX;
    swipeStartYRef.current = e.touches[0].clientY;
    didSwipeRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeStartXRef.current === null || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - swipeStartXRef.current;
    const dy = e.touches[0].clientY - (swipeStartYRef.current ?? 0);
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      didSwipeRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartXRef.current === null || e.changedTouches.length === 0)
      return;
    const dx = e.changedTouches[0].clientX - swipeStartXRef.current;
    const dy = e.changedTouches[0].clientY - (swipeStartYRef.current ?? 0);
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    if (
      gallery.length > 1 &&
      Math.abs(dx) >= 40 &&
      Math.abs(dx) > Math.abs(dy)
    ) {
      didSwipeRef.current = true;
      if (dx < 0) {
        goNextImage();
      } else {
        goPrevImage();
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    swipeStartXRef.current = e.clientX;
    swipeStartYRef.current = e.clientY;
    didSwipeRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" || swipeStartXRef.current === null) return;
    const dx = e.clientX - swipeStartXRef.current;
    const dy = e.clientY - (swipeStartYRef.current ?? 0);
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      didSwipeRef.current = true;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" || swipeStartXRef.current === null) return;
    const dx = e.clientX - swipeStartXRef.current;
    const dy = e.clientY - (swipeStartYRef.current ?? 0);
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    if (
      gallery.length > 1 &&
      Math.abs(dx) >= 40 &&
      Math.abs(dx) > Math.abs(dy)
    ) {
      didSwipeRef.current = true;
      if (dx < 0) {
        goNextImage();
      } else {
        goPrevImage();
      }
    }
  };

  const pricing = resolveRetailPrice(
    selectedProduct.srp,
    selectedProduct.discount
  );
  const stockStatus = resolveConsumerStockStatus(
    selectedProduct.qtty,
    appSettings.hide_stock_qty
  );

  const isWishlisted = wishlistItems.some(
    (w) => w.item_id === selectedProduct.item_id
  );

  const existingBagLine = lines.find(
    (l) => l.item.item_id === selectedProduct.item_id
  );
  const qtyAlreadyInBag = existingBagLine ? existingBagLine.quantity : 0;

  const categoryName =
    categories.find((c) => c.item_class_id === selectedProduct.class_id)
      ?.item_class || null;

  const hasDimensions =
    Boolean(selectedProduct.length) ||
    Boolean(selectedProduct.width) ||
    Boolean(selectedProduct.thickness);

  const handleAddToBag = () => {
    if (!stockStatus.isAvailable) return;
    addItem(selectedProduct, orderQty);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const handleAddBundleToBag = () => {
    if (stockStatus.isAvailable) {
      addItem(selectedProduct, 1);
    }
    for (const neighbor of frequentlyBought) {
      if (Number(neighbor.qtty) > 0 || !appSettings.hide_out_of_stock) {
        addItem(neighbor, 1);
      }
    }
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const handleWhatsAppShare = () => {
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/?product=${selectedProduct.item_id}`
        : "";
    const text = `Check out *${selectedProduct.item_name}* (SKU: ${
      selectedProduct.code
    }) at B's Mart for $${pricing.finalUnitPrice.toFixed(2)}! ${shareUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleNativeOrCopyShare = async () => {
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/?product=${selectedProduct.item_id}`
        : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${selectedProduct.item_name} | B's Mart`,
          text: `Shop ${selectedProduct.item_name} for $${pricing.finalUnitPrice.toFixed(
            2
          )} on B's Mart`,
          url: shareUrl,
        });
        return;
      } catch {}
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareFeedback(true);
        setTimeout(() => setShareFeedback(false), 2000);
      } catch {}
    }
  };

  const bundleTotalPrice =
    pricing.finalUnitPrice +
    frequentlyBought.reduce(
      (sum, item) =>
        sum + resolveRetailPrice(item.srp, item.discount).finalUnitPrice,
      0
    );

  return (
    <>
      <div
        onClick={closeProductDetail}
        className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Sticky Modal Top Bar */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-white/95 backdrop-blur-xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {categoryName && (
                <button
                  type="button"
                  onClick={() => {
                    const cId = selectedProduct.class_id;
                    closeProductDetail();
                    navigateToCategory(cId);
                  }}
                  className="px-2.5 py-1 rounded-full bg-smart-teal-light text-smart-teal text-[11px] font-extrabold hover:underline truncate cursor-pointer"
                >
                  {categoryName}
                </button>
              )}
              <span className="text-xs font-mono font-bold text-slate-400 truncate">
                SKU: {selectedProduct.code}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="px-2.5 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Share on WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleNativeOrCopyShare}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                title="Copy Product Link"
              >
                {shareFeedback ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={closeProductDetail}
                aria-label="Close product detail"
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
            {/* Top Split: Multi-Angle R2 Image Gallery + Product Details */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left: Multi-Angle R2 Image Gallery */}
              <div className="md:col-span-6 space-y-3">
                <div
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="relative aspect-square rounded-2xl bg-slate-100 border border-slate-200/80 overflow-hidden group select-none touch-pan-y"
                >
                  <img
                    src={currentViewUrl}
                    alt={selectedProduct.item_name}
                    draggable={false}
                    onClick={() => {
                      if (didSwipeRef.current) {
                        didSwipeRef.current = false;
                        return;
                      }
                      setIsZoomedIn(false);
                      setIsLightboxOpen(true);
                    }}
                    className="w-full h-full object-contain bg-white cursor-zoom-in select-none"
                  />

                  {/* Top-Left Discount Badge */}
                  {pricing.isOnSale && (
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-smart-sale text-white text-xs font-black shadow-sm pointer-events-none">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>-{pricing.discountPercent}% OFF</span>
                    </span>
                  )}

                  {/* Fullscreen Zoom Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsZoomedIn(false);
                      setIsLightboxOpen(true);
                    }}
                    className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-xl bg-slate-900/75 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>
                      {activeImageIndex + 1}/{gallery.length} • Zoom
                    </span>
                  </button>

                  {/* Prev / Next Arrows if multiple angles exist */}
                  {gallery.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={goPrevImage}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center cursor-pointer"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={goNextImage}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center cursor-pointer"
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* Multi-Angle Thumbnail Strip */}
                {gallery.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    {gallery.map((slot, idx) => {
                      const thumb =
                        slot.thumb || slot.view || slot.raw || currentViewUrl;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setIsZoomedIn(false);
                            setActiveImageIndex(idx);
                          }}
                          className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                            activeImageIndex === idx
                              ? "border-smart-teal scale-105 shadow-xs"
                              : "border-slate-200 opacity-75 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={thumb}
                            alt={`Angle ${idx + 1}`}
                            draggable={false}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: Pricing, Specs, Assurance & Sales Pitch */}
              <div className="md:col-span-6 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  {/* Title & Safe Stock Badge */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                          stockStatus.isAvailable
                            ? stockStatus.isLowStock
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-50 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            stockStatus.isAvailable
                              ? stockStatus.isLowStock
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                              : "bg-rose-500"
                          }`}
                        />
                        {stockStatus.badgeLabel}
                      </span>

                      {qtyAlreadyInBag > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-smart-teal-light text-smart-teal text-[11px] font-extrabold">
                          {qtyAlreadyInBag} in your Bag
                        </span>
                      )}
                    </div>

                    <h1 className="text-lg sm:text-2xl font-black text-slate-900 leading-snug">
                      {selectedProduct.item_name}
                    </h1>
                  </div>

                  {/* SHEIN-Style Retail Price Box */}
                  <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 sm:p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-baseline gap-2.5">
                        <span
                          className={`text-2xl sm:text-3xl font-black tabular-numbers ${
                            pricing.isOnSale
                              ? "text-smart-sale"
                              : "text-smart-teal"
                          }`}
                        >
                          ${pricing.finalUnitPrice.toFixed(2)}
                        </span>
                        {pricing.isOnSale && (
                          <span className="text-sm text-slate-400 line-through tabular-numbers font-bold">
                            ${pricing.originalPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Retail unit price • Single-item ordering enabled
                      </p>
                    </div>

                    {pricing.isOnSale && (
                      <div className="px-3 py-1.5 rounded-xl bg-smart-sale-light border border-smart-sale/20 text-right">
                        <p className="text-xs font-black text-smart-sale">
                          Save ${pricing.unitSavings.toFixed(2)}
                        </p>
                        <p className="text-[10px] font-bold text-smart-sale/80">
                          {pricing.discountPercent}% Discount
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Real Description or ML Sales Pitch */}
                  {(selectedProduct.description || salesPitch) && (
                    <div className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-smart-teal-light/35 border border-smart-teal/15 rounded-2xl p-3.5">
                      {selectedProduct.description || salesPitch}
                    </div>
                  )}

                  {/* Real Product Specifications Grid */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    {selectedProduct.material && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-smart-teal shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase text-slate-400">
                            Material
                          </p>
                          <p className="font-bold text-slate-800 truncate">
                            {selectedProduct.material}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedProduct.house_rooms && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-2">
                        <Home className="w-4 h-4 text-smart-teal shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase text-slate-400">
                            Room / Use
                          </p>
                          <p className="font-bold text-slate-800 truncate">
                            {selectedProduct.house_rooms}
                          </p>
                        </div>
                      </div>
                    )}

                    {hasDimensions && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-2 col-span-2">
                        <Ruler className="w-4 h-4 text-smart-teal shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">
                            Dimensions
                          </p>
                          <p className="font-bold text-slate-800">
                            {[
                              selectedProduct.length
                                ? `L: ${selectedProduct.length}cm`
                                : null,
                              selectedProduct.width
                                ? `W: ${selectedProduct.width}cm`
                                : null,
                              selectedProduct.thickness
                                ? `H: ${selectedProduct.thickness}cm`
                                : null,
                              selectedProduct.weight
                                ? `Weight: ${selectedProduct.weight}g`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Delivery & Payment Assurance Strip */}
                  <div className="rounded-2xl border border-slate-200/80 p-3.5 space-y-2.5 bg-white">
                    <div className="flex items-start gap-2.5">
                      <Truck className="w-4 h-4 text-smart-teal shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-extrabold text-slate-900">
                          Fast Delivery across {deliveryZones.length || 5} Regions in Lebanon
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          FREE Delivery on orders over{" "}
                          <strong className="text-smart-teal">
                            ${Number(appSettings.free_shipping_threshold).toFixed(2)}
                          </strong>{" "}
                          (Standard delivery from $
                          {Number(appSettings.default_delivery_fee).toFixed(2)}).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 pt-2 border-t border-slate-100">
                      <CreditCard className="w-4 h-4 text-smart-teal shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-extrabold text-slate-900">
                          Flexible Payment Options on Delivery
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {appSettings.enable_cod && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                              Cash on Delivery (COD)
                            </span>
                          )}
                          {appSettings.enable_whish && (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold">
                              Whish Money
                            </span>
                          )}
                          {appSettings.enable_omt && (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold">
                              OMT Pay
                            </span>
                          )}
                          {appSettings.enable_card_pos && (
                            <span className="px-2 py-0.5 rounded bg-smart-teal-light text-smart-teal text-[10px] font-bold">
                              Card on Delivery (POS)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Frequently Bought Together Strip (Powered by public.recosys_items) */}
            {frequentlyBought.length > 0 && (
              <section className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-smart-gold fill-smart-gold" />
                    <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                      Frequently Bought Together
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddBundleToBag}
                    className="px-3.5 py-1.5 rounded-xl bg-smart-teal hover:bg-smart-teal-hover text-white text-xs font-extrabold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-smart-gold" />
                    <span>
                      Add All {frequentlyBought.length + 1} to Bag ($
                      {bundleTotalPrice.toFixed(2)})
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {frequentlyBought.map((neighbor) => {
                    const nPrice = resolveRetailPrice(
                      neighbor.srp,
                      neighbor.discount
                    );
                    return (
                      <div
                        key={neighbor.item_id}
                        onClick={() => openProductDetail(neighbor)}
                        className="bg-white rounded-xl p-2.5 border border-slate-200/80 hover:border-smart-teal flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <img
                          src={getItemImageUrl(neighbor, "thumb")}
                          alt={neighbor.item_name}
                          className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {neighbor.item_name}
                          </p>
                          <p className="text-xs font-black text-smart-teal tabular-numbers mt-0.5">
                            ${nPrice.finalUnitPrice.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* You May Also Like Grid (Powered by public.recosys_items) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-smart-teal" />
                  <span>You May Also Like</span>
                </h3>
                {isLoadingRecs && (
                  <Loader2 className="w-4 h-4 animate-spin text-smart-teal" />
                )}
              </div>

              {youMayAlsoLike.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {youMayAlsoLike.slice(0, 5).map((recItem) => (
                    <SmartProductCard
                      key={recItem.item_id}
                      item={recItem}
                      compact
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Sticky Bottom Add-to-Bag Action Footer */}
          <div className="px-4 py-3 border-t border-slate-200/90 bg-white flex items-center justify-between gap-3 shrink-0 pb-safe">
            {/* Wishlist Toggle Button */}
            <button
              type="button"
              onClick={() => toggleWishlist(selectedProduct)}
              className={`h-11 px-3.5 rounded-2xl border font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                isWishlisted
                  ? "bg-rose-50 border-rose-200 text-rose-600"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Heart
                className={`w-4 h-4 ${
                  isWishlisted ? "fill-rose-500 text-rose-500" : ""
                }`}
              />
              <span className="hidden sm:inline">
                {isWishlisted ? "Saved" : "Wishlist"}
              </span>
            </button>

            {/* Single-Unit Quantity Stepper */}
            {stockStatus.isAvailable && (
              <div className="flex items-center bg-slate-100 rounded-2xl h-11 px-1.5 border border-slate-200/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setOrderQty((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-xl hover:bg-white flex items-center justify-center text-slate-700 cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="min-w-[32px] text-center text-sm font-black text-slate-900 tabular-numbers">
                  {orderQty}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setOrderQty((q) =>
                      Math.min(stockStatus.maxOrderableQty, q + 1)
                    )
                  }
                  disabled={orderQty >= stockStatus.maxOrderableQty}
                  className="w-8 h-8 rounded-xl hover:bg-white disabled:opacity-40 flex items-center justify-center text-slate-700 cursor-pointer"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Primary Add to Bag CTA */}
            <button
              type="button"
              disabled={!stockStatus.isAvailable}
              onClick={handleAddToBag}
              className={`flex-1 h-11 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                !stockStatus.isAvailable
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                  : addedFeedback
                  ? "bg-emerald-600 text-white"
                  : "bg-smart-teal hover:bg-smart-teal-hover text-white active:scale-[0.99]"
              }`}
            >
              {addedFeedback ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Added to Bag!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 text-smart-gold" />
                  <span>
                    Add to Bag • $
                    {(pricing.finalUnitPrice * orderQty).toFixed(2)}
                  </span>
                </>
              )}
            </button>

            {/* Quick Jump to Bag if items in Bag */}
            {lines.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  closeProductDetail();
                  setActiveTab("bag");
                }}
                className="h-11 px-4 rounded-2xl bg-smart-gold hover:bg-smart-gold-hover text-slate-950 font-black text-xs hidden sm:inline-flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
              >
                <span>View Bag</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* High-Res R2 Lightbox Zoom Overlay */}
      {isLightboxOpen && (
        <div
          onClick={() => {
            setIsLightboxOpen(false);
            setIsZoomedIn(false);
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4 overflow-hidden select-none touch-pan-y"
        >
          {/* Top Controls Bar: Slide Counter + Zoom Toggle + Close */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-2"
          >
            <div className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-xs text-white text-xs font-extrabold">
              {activeImageIndex + 1} / {gallery.length}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsZoomedIn((z) => !z)}
                className="px-3 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                aria-label={isZoomedIn ? "Zoom out" : "Zoom in"}
              >
                {isZoomedIn ? (
                  <>
                    <ZoomOut className="w-4 h-4" />
                    <span>1x</span>
                  </>
                ) : (
                  <>
                    <ZoomIn className="w-4 h-4" />
                    <span>2x Zoom</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsLightboxOpen(false);
                  setIsZoomedIn(false);
                }}
                aria-label="Close zoom overlay"
                className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Prev / Next Navigation Buttons in Lightbox */}
          {gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrevImage();
                }}
                aria-label="Previous image"
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-xs flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNextImage();
                }}
                aria-label="Next image"
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-xs flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <img
            src={currentRawUrl}
            alt={selectedProduct.item_name}
            draggable={false}
            onError={(e) => {
              if (e.currentTarget.src !== currentViewUrl) {
                e.currentTarget.src = currentViewUrl;
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (didSwipeRef.current) {
                didSwipeRef.current = false;
                return;
              }
              setIsZoomedIn((z) => !z);
            }}
            className={`max-w-full max-h-[82vh] object-contain rounded-lg transition-transform duration-200 select-none ${
              isZoomedIn
                ? "scale-175 sm:scale-200 cursor-zoom-out"
                : "scale-100 cursor-zoom-in"
            }`}
          />
        </div>
      )}
    </>
  );
}
