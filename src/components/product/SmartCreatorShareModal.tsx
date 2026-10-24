"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Download,
  Share2,
  Copy,
  Check,
  Sparkles,
  Layers,
  Image as ImageIcon,
  MessageCircle,
  Loader2,
  FileText,
} from "lucide-react";
import { ItemWithImages } from "@/types/smart.types";
import {
  CreatorImageQuality,
  CreatorImageSlot,
  getItemCreatorGallerySlots,
  getProxiedMediaBlobUrl,
  getProductPlaceholderUrl,
} from "@/lib/media";
import { resolveRetailPrice } from "@/lib/pricing";

interface SmartCreatorShareModalProps {
  item: ItemWithImages | null;
  isOpen: boolean;
  onClose: () => void;
  initialSlotIndex?: number;
}

function resolveBlobExtension(mimeType: string, fallbackUrl: string): string {
  const mime = (mimeType || "").toLowerCase();
  if (mime.includes("webp")) return "webp";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("gif")) return "gif";
  const lowerUrl = fallbackUrl.toLowerCase();
  if (lowerUrl.includes(".png")) return "png";
  if (lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg")) return "jpg";
  return "webp";
}

export function SmartCreatorShareModal({
  item,
  isOpen,
  onClose,
  initialSlotIndex = 0,
}: SmartCreatorShareModalProps) {
  const [selectedSlotIdx, setSelectedSlotIdx] = useState(0);
  const [quality, setQuality] = useState<CreatorImageQuality>("view");

  // Caption field toggles (all default true)
  const [includeName, setIncludeName] = useState(true);
  const [includePrice, setIncludePrice] = useState(true);
  const [includeDescription, setIncludeDescription] = useState(true);
  const [includeCode, setIncludeCode] = useState(true);
  const [includeLink, setIncludeLink] = useState(true);

  const [captionText, setCaptionText] = useState("");
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [isDownloadingSingle, setIsDownloadingSingle] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isSharingNative, setIsSharingNative] = useState(false);

  const slots = useMemo<CreatorImageSlot[]>(() => {
    if (!item) return [];
    const list = getItemCreatorGallerySlots(item);
    if (list.length > 0) return list;
    const fallback = getProductPlaceholderUrl(item.code);
    return [
      {
        slotKey: "hero1",
        label: "Main Hero",
        thumbUrl: fallback,
        viewUrl: fallback,
        rawUrl: fallback,
        proxiedRawUrl: fallback,
        isRawGoogleDrive: false,
      },
    ];
  }, [item]);

  useEffect(() => {
    if (!isOpen || !item) return;
    const safeIdx =
      initialSlotIndex >= 0 && initialSlotIndex < slots.length
        ? initialSlotIndex
        : 0;
    setSelectedSlotIdx(safeIdx);
    setStatusHint(null);
    setCopiedCaption(false);
  }, [isOpen, item, initialSlotIndex, slots.length]);

  const pricing = useMemo(
    () =>
      item
        ? resolveRetailPrice(item.srp, item.discount)
        : resolveRetailPrice(0, 0),
    [item]
  );

  // Recompute accompanying marketing caption whenever toggles or item change
  useEffect(() => {
    if (!item) return;
    const lines: string[] = [];

    if (includeName) {
      lines.push(`✨ *${item.item_name}*`);
    }

    if (includePrice) {
      if (pricing.isOnSale) {
        lines.push(
          `🔥 Price: *$${pricing.finalUnitPrice.toFixed(
            2
          )}* (Was $${pricing.originalPrice.toFixed(2)} — Save ${
            pricing.discountPercent
          }%)`
        );
      } else {
        lines.push(`🏷️ Price: *$${pricing.finalUnitPrice.toFixed(2)}*`);
      }
    }

    if (includeDescription) {
      const specs: string[] = [];
      if (item.description && item.description.trim()) {
        specs.push(item.description.trim());
      }
      const dims = [
        item.length ? `${item.length}` : null,
        item.width ? `${item.width}` : null,
        item.thickness ? `${item.thickness}` : null,
      ].filter(Boolean);
      if (dims.length > 0) {
        specs.push(`📏 Dimensions: ${dims.join(" × ")} cm`);
      }
      if (item.material && item.material.trim()) {
        specs.push(`🪨 Material: ${item.material.trim()}`);
      }
      if (specs.length > 0) {
        lines.push(specs.join("\n"));
      }
    }

    if (includeCode) {
      lines.push(`📦 Code: ${item.code}`);
    }

    if (includeLink) {
      lines.push(`🛒 Order Online: https://bsmartlb.com/?product=${item.item_id}`);
    }

    setCaptionText(lines.join("\n\n"));
  }, [
    item,
    pricing,
    includeName,
    includePrice,
    includeDescription,
    includeCode,
    includeLink,
  ]);

  if (!isOpen || !item) return null;

  const activeSlot = slots[selectedSlotIdx] || slots[0];

  const getTargetSlotUrl = (
    slot: CreatorImageSlot,
    tier: CreatorImageQuality
  ): string => {
    if (tier === "thumb") return slot.thumbUrl || slot.viewUrl || slot.rawUrl;
    if (tier === "view") return slot.viewUrl || slot.thumbUrl || slot.rawUrl;
    return slot.rawUrl || slot.viewUrl || slot.thumbUrl;
  };

  const previewImgSrc =
    quality === "thumb"
      ? activeSlot.thumbUrl
      : quality === "view"
      ? activeSlot.viewUrl
      : activeSlot.isRawGoogleDrive
      ? activeSlot.proxiedRawUrl || activeSlot.viewUrl
      : activeSlot.rawUrl || activeSlot.viewUrl;

  const showTempHint = (msg: string) => {
    setStatusHint(msg);
    window.setTimeout(() => {
      setStatusHint((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleCopyCaption = async () => {
    if (!captionText) return;
    try {
      await navigator.clipboard.writeText(captionText);
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    } catch {}
  };

  const downloadSingleSlot = async (
    slot: CreatorImageSlot,
    tier: CreatorImageQuality
  ) => {
    const rawTargetUrl = getTargetSlotUrl(slot, tier);
    const proxiedUrl = getProxiedMediaBlobUrl(rawTargetUrl);
    const safeCode = (item.code || "ITEM").replace(/[^a-zA-Z0-9-_]/g, "_");

    try {
      const response = await fetch(proxiedUrl, { mode: "cors" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const ext = resolveBlobExtension(blob.type, rawTargetUrl);
      const filename = `${safeCode}_${slot.slotKey}_${tier}.${ext}`;

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
      return filename;
    } catch {
      const link = document.createElement("a");
      link.href = rawTargetUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = `${safeCode}_${slot.slotKey}_${tier}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return `${safeCode}_${slot.slotKey}_${tier}`;
    }
  };

  const handleSaveCurrentImage = async () => {
    if (!activeSlot) return;
    setIsDownloadingSingle(true);
    try {
      const savedName = await downloadSingleSlot(activeSlot, quality);
      showTempHint(`Saved ${savedName} to your device.`);
    } finally {
      setIsDownloadingSingle(false);
    }
  };

  const handleSaveAllAngles = async () => {
    if (slots.length === 0) return;
    setIsDownloadingAll(true);
    try {
      for (const slot of slots) {
        await downloadSingleSlot(slot, quality);
        await new Promise((r) => setTimeout(r, 250));
      }
      showTempHint(
        `Saved all ${slots.length} angles (${quality.toUpperCase()}) to your device.`
      );
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleShareImageAndCaption = async () => {
    if (!activeSlot) return;
    setIsSharingNative(true);

    // 1. Always copy caption to clipboard so marketer can paste it anywhere (e.g. Instagram / WhatsApp)
    try {
      if (navigator.clipboard && captionText) {
        await navigator.clipboard.writeText(captionText);
        showTempHint("Caption also copied to clipboard for easy pasting.");
      }
    } catch {}

    const rawTargetUrl = getTargetSlotUrl(activeSlot, quality);
    const proxiedUrl = getProxiedMediaBlobUrl(rawTargetUrl);
    const safeCode = (item.code || "ITEM").replace(/[^a-zA-Z0-9-_]/g, "_");

    try {
      const response = await fetch(proxiedUrl, { mode: "cors" });
      if (response.ok) {
        const blob = await response.blob();
        const ext = resolveBlobExtension(blob.type, rawTargetUrl);
        const filename = `${safeCode}_${activeSlot.slotKey}_${quality}.${ext}`;
        const file = new File([blob], filename, {
          type: blob.type || "image/webp",
        });

        if (
          typeof navigator !== "undefined" &&
          navigator.canShare &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({
            files: [file],
            title: item.item_name,
            text: captionText,
          });
          return;
        }
      }

      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: item.item_name,
          text: captionText,
        });
        return;
      }

      const waUrl = `https://wa.me/?text=${encodeURIComponent(captionText)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const waUrl = `https://wa.me/?text=${encodeURIComponent(captionText)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
    } finally {
      setIsSharingNative(false);
    }
  };

  const handleWhatsAppTextShare = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(captionText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-4xl max-h-[94vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-smart-teal-deep via-smart-teal to-[#0077A8] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-smart-gold" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight truncate">
                  Creator Asset &amp; Share Studio
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-smart-gold text-slate-950 text-[10px] font-black uppercase">
                  {quality.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-white/80 font-mono truncate">
                {item.item_name} • SKU: {item.code}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Creator Studio"
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Image Quality Tier Selector + Angle Preview + Save Buttons */}
          <div className="lg:col-span-6 space-y-4">
            {/* Quality Tier Segmented Selector (Thumb | View | Raw) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-smart-teal" />
                  <span>1. Select Image Quality Tier</span>
                </span>
                <span className="text-smart-teal font-mono">
                  {activeSlot.label} ({selectedSlotIdx + 1}/{slots.length})
                </span>
              </label>

              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200/80">
                {(
                  [
                    {
                      id: "thumb" as CreatorImageQuality,
                      title: "Thumb",
                      sub: "Fast Compact WebP",
                    },
                    {
                      id: "view" as CreatorImageQuality,
                      title: "View",
                      sub: "HD Studio WebP",
                    },
                    {
                      id: "raw" as CreatorImageQuality,
                      title: "Raw",
                      sub: "Original Master",
                    },
                  ] as const
                ).map((tierOption) => {
                  const isActive = quality === tierOption.id;
                  return (
                    <button
                      key={tierOption.id}
                      type="button"
                      onClick={() => setQuality(tierOption.id)}
                      className={`py-2 px-2 rounded-xl text-center transition-all cursor-pointer ${
                        isActive
                          ? "bg-smart-teal text-white shadow-xs"
                          : "text-slate-700 hover:bg-white/70"
                      }`}
                    >
                      <div className="text-xs font-black">
                        {tierOption.title}
                      </div>
                      <div
                        className={`text-[10px] font-semibold truncate ${
                          isActive ? "text-smart-gold" : "text-slate-400"
                        }`}
                      >
                        {tierOption.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Image Preview Stage */}
            <div className="relative aspect-square w-full rounded-2xl bg-slate-100 border border-slate-200/80 overflow-hidden flex items-center justify-center">
              <img
                src={previewImgSrc}
                alt={`${item.item_name} - ${activeSlot.label}`}
                onError={(e) => {
                  if (
                    activeSlot.viewUrl &&
                    e.currentTarget.src !== activeSlot.viewUrl
                  ) {
                    e.currentTarget.src = activeSlot.viewUrl;
                  }
                }}
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
                <span className="px-2.5 py-1 rounded-full bg-slate-950/75 text-white text-[10px] font-bold backdrop-blur-xs">
                  {activeSlot.label} • {quality.toUpperCase()}
                </span>
                {quality === "raw" && activeSlot.isRawGoogleDrive && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/90 text-slate-950 text-[10px] font-black">
                    Studio Master (Cloud Proxy)
                  </span>
                )}
              </div>
            </div>

            {/* Angle / Slot Thumbnail Selector */}
            {slots.length > 1 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-smart-teal" />
                  <span>Select Product Angle ({slots.length} available)</span>
                </span>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {slots.map((slot, idx) => {
                    const isSelected = idx === selectedSlotIdx;
                    return (
                      <button
                        key={slot.slotKey}
                        type="button"
                        onClick={() => setSelectedSlotIdx(idx)}
                        className={`group flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? "border-smart-teal bg-smart-teal-light/50 ring-2 ring-smart-teal/20"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <img
                          src={slot.thumbUrl || slot.viewUrl}
                          alt={slot.label}
                          className="w-10 h-10 rounded-lg object-cover bg-slate-100"
                        />
                        <div className="text-left">
                          <p
                            className={`text-[11px] font-black leading-tight ${
                              isSelected ? "text-smart-teal" : "text-slate-700"
                            }`}
                          >
                            {slot.label}
                          </p>
                          <p className="text-[9px] font-mono text-slate-400 uppercase">
                            {slot.slotKey}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save to Device Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={isDownloadingSingle}
                onClick={handleSaveCurrentImage}
                className="h-11 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {isDownloadingSingle ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-smart-gold" />
                    <span>Saving Image...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-smart-gold" />
                    <span>
                      Save {activeSlot.label} ({quality.toUpperCase()})
                    </span>
                  </>
                )}
              </button>

              {slots.length > 1 && (
                <button
                  type="button"
                  disabled={isDownloadingAll}
                  onClick={handleSaveAllAngles}
                  className="h-11 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-900 border border-slate-200 text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isDownloadingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-smart-teal" />
                      <span>Saving All {slots.length}...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-smart-teal" />
                      <span>
                        Save All {slots.length} Angles ({quality.toUpperCase()})
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Accompanying Text Builder + Native Share */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-smart-teal" />
                  <span>2. Accompanying Marketing Caption</span>
                </label>

                <button
                  type="button"
                  onClick={handleCopyCaption}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-smart-teal-light text-smart-teal hover:bg-smart-teal hover:text-white text-xs font-black transition-colors cursor-pointer"
                >
                  {copiedCaption ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>

              {/* Field Toggles */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    {
                      label: "Item Name",
                      checked: includeName,
                      toggle: () => setIncludeName((v) => !v),
                    },
                    {
                      label: "Price & Discount",
                      checked: includePrice,
                      toggle: () => setIncludePrice((v) => !v),
                    },
                    {
                      label: "Description & Specs",
                      checked: includeDescription,
                      toggle: () => setIncludeDescription((v) => !v),
                    },
                    {
                      label: "SKU Code",
                      checked: includeCode,
                      toggle: () => setIncludeCode((v) => !v),
                    },
                    {
                      label: "Product Link",
                      checked: includeLink,
                      toggle: () => setIncludeLink((v) => !v),
                    },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={f.toggle}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                      f.checked
                        ? "bg-smart-teal text-white border-smart-teal"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {f.checked && <Check className="w-3 h-3 text-smart-gold" />}
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>

              {/* Editable Caption Textarea */}
              <div>
                <textarea
                  rows={8}
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Customize your product post caption..."
                  className="w-full p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs sm:text-sm text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-smart-teal resize-y"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Toggle fields above or freely edit the caption before sharing.
                </p>
              </div>
            </div>

            {/* Status Toast / Hint */}
            {statusHint && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusHint}</span>
              </div>
            )}

            {/* Primary Share Actions */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSharingNative}
                onClick={handleShareImageAndCaption}
                className="w-full h-12 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSharingNative ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-smart-gold" />
                    <span>Preparing {quality.toUpperCase()} Image...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-smart-gold" />
                    <span>
                      Share {quality.toUpperCase()} Image + Caption
                    </span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleWhatsAppTextShare}
                  className="h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Caption</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyCaption}
                  className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedCaption ? "Caption Copied!" : "Copy Caption"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
