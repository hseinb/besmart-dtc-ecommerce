"use client";

import React, { useState, useEffect } from "react";
import { Zap, Flame, Clock, Sparkles, Loader2, Tag } from "lucide-react";
import { ItemWithImages } from "@/types/smart.types";
import { useSmartNavStore } from "@/store/useSmartNavStore";
import { SmartProductCard } from "@/components/product/SmartProductCard";
import { createClient } from "@/lib/supabase/client";
import { resolveRetailPrice } from "@/lib/pricing";

type DealBracket =
  | "all_deals"
  | "off_15"
  | "off_30"
  | "off_50"
  | "under_5"
  | "under_10"
  | "under_25";

interface SmartDealsViewProps {
  initialFlashDeals: ItemWithImages[];
}

export function SmartDealsView({ initialFlashDeals }: SmartDealsViewProps) {
  const { appSettings } = useSmartNavStore();
  const [activeBracket, setActiveBracket] =
    useState<DealBracket>("all_deals");
  const [dealItems, setDealItems] =
    useState<ItemWithImages[]>(initialFlashDeals);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [countdownText, setCountdownText] = useState<string | null>(null);

  // Live Flash Sale Countdown
  useEffect(() => {
    if (!appSettings.flash_sale_ends_at) {
      setCountdownText(null);
      return;
    }
    const targetMs = new Date(appSettings.flash_sale_ends_at).getTime();
    if (Number.isNaN(targetMs)) {
      setCountdownText(null);
      return;
    }

    const tick = () => {
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        setCountdownText(null);
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdownText(
        `${String(h).padStart(2, "0")}:${String(m).padStart(
          2,
          "0"
        )}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [appSettings.flash_sale_ends_at]);

  useEffect(() => {
    let cancelled = false;
    async function loadBracketDeals() {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const selectClause = appSettings.require_images
          ? "*, item_images!inner(*)"
          : "*, item_images(*)";

        let query = supabase
          .from("smart_items")
          .select(selectClause)
          .eq("is_active", true);

        if (appSettings.hide_out_of_stock) {
          query = query.gt("qtty", 0);
        }
        if (
          appSettings.hidden_categories &&
          appSettings.hidden_categories.length > 0
        ) {
          query = query.not(
            "class_id",
            "in",
            `(${appSettings.hidden_categories.join(",")})`
          );
        }

        if (activeBracket === "all_deals") {
          query = query
            .gt("discount", 0)
            .order("discount", { ascending: false });
        } else if (activeBracket === "off_15") {
          query = query
            .gte("discount", 15)
            .order("discount", { ascending: false });
        } else if (activeBracket === "off_30") {
          query = query
            .gte("discount", 30)
            .order("discount", { ascending: false });
        } else if (activeBracket === "off_50") {
          query = query
            .gte("discount", 50)
            .order("discount", { ascending: false });
        } else if (activeBracket === "under_5") {
          query = query
            .gt("srp", 0)
            .lte("srp", 5)
            .order("discount", { ascending: false })
            .order("srp", { ascending: true });
        } else if (activeBracket === "under_10") {
          query = query
            .gt("srp", 0)
            .lte("srp", 10)
            .order("discount", { ascending: false })
            .order("srp", { ascending: true });
        } else if (activeBracket === "under_25") {
          query = query
            .gt("srp", 0)
            .lte("srp", 25)
            .order("discount", { ascending: false })
            .order("srp", { ascending: true });
        }

        const { data } = await query.limit(60);
        if (!cancelled) {
          const rows = (data as unknown as ItemWithImages[]) || [];
          // If 'all_deals' returned 0 discounted items in DB, auto-switch to 'under_10' value finds
          if (activeBracket === "all_deals" && rows.length === 0) {
            setActiveBracket("under_10");
          } else {
            setDealItems(rows);
          }
        }
      } catch {
        if (!cancelled) {
          setDealItems(initialFlashDeals);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadBracketDeals();
    return () => {
      cancelled = true;
    };
  }, [
    activeBracket,
    appSettings.require_images,
    appSettings.hide_out_of_stock,
    appSettings.hidden_categories,
    initialFlashDeals,
  ]);

  const filteredItems = React.useMemo(() => {
    if (activeBracket === "under_5") {
      return dealItems.filter(
        (i) => resolveRetailPrice(i.srp, i.discount).finalUnitPrice <= 5
      );
    }
    if (activeBracket === "under_10") {
      return dealItems.filter(
        (i) => resolveRetailPrice(i.srp, i.discount).finalUnitPrice <= 10
      );
    }
    if (activeBracket === "under_25") {
      return dealItems.filter(
        (i) => resolveRetailPrice(i.srp, i.discount).finalUnitPrice <= 25
      );
    }
    return dealItems;
  }, [dealItems, activeBracket]);

  const brackets: { id: DealBracket; label: string; highlight?: boolean }[] = [
    { id: "all_deals", label: "⚡ All Flash Deals", highlight: true },
    { id: "off_15", label: "15%+ Off" },
    { id: "off_30", label: "30%+ Off" },
    { id: "off_50", label: "50%+ Off" },
    { id: "under_5", label: "Under $5" },
    { id: "under_10", label: "Under $10" },
    { id: "under_25", label: "Under $25" },
  ];

  return (
    <div className="space-y-5">
      {/* High-Energy Flash Sale Header Banner */}
      <section className="rounded-3xl bg-gradient-to-r from-[#C82800] via-smart-sale to-[#FF8000] text-white p-5 sm:p-7 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 backdrop-blur-xs text-smart-gold text-xs font-black uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{appSettings.flash_sale_title || "FLASH DEALS & VALUE ZONE"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Super Savings &amp; Smart Value Picks
            </h1>
            <p className="text-xs sm:text-sm text-white/90 font-medium">
              Real-time markdowns and budget-friendly essentials ready for immediate delivery.
            </p>
          </div>

          {countdownText && (
            <div className="bg-slate-950/85 backdrop-blur-xs border border-white/15 rounded-2xl px-4 py-3 text-center shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/75 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-smart-gold" /> Ends In
              </p>
              <p className="text-xl sm:text-2xl font-mono font-black text-smart-gold mt-0.5">
                {countdownText}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Discount & Value Bracket Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {brackets.map((b) => {
          const isSelected = activeBracket === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveBracket(b.id)}
              className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                isSelected
                  ? "bg-smart-sale text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-700 hover:border-smart-sale/50"
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {/* Deals Product Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-smart-sale">
          <Loader2 className="w-7 h-7 animate-spin" />
          <span className="text-xs font-bold">Loading deals...</span>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filteredItems.map((item) => (
            <SmartProductCard key={item.item_id} item={item} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center space-y-3">
          <Flame className="w-8 h-8 text-smart-sale mx-auto" />
          <p className="text-sm sm:text-base font-black text-slate-800">
            No products in this specific deal bracket right now
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Switch to another savings bracket or browse our Under $10 &amp; Under $25 value picks.
          </p>
          <div className="flex justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveBracket("under_10")}
              className="px-4 py-2 rounded-xl bg-smart-teal text-white text-xs font-bold cursor-pointer"
            >
              Browse Under $10 Picks
            </button>
            <button
              type="button"
              onClick={() => setActiveBracket("under_25")}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Browse Under $25 Picks
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
