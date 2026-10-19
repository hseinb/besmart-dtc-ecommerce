"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutGrid,
  Zap,
  ArrowUpRight,
  Sparkles,
  Loader2,
  Search,
} from "lucide-react";
import { ItemClass, ItemWithImages } from "@/types/smart.types";
import { useSmartNavStore } from "@/store/useSmartNavStore";
import { SmartProductCard } from "@/components/product/SmartProductCard";
import { createClient } from "@/lib/supabase/client";

interface SplitCategoryExplorerProps {
  categories: ItemClass[];
  initialItems: ItemWithImages[];
}

export function SplitCategoryExplorer({
  categories,
  initialItems,
}: SplitCategoryExplorerProps) {
  const {
    selectedClassId,
    navigateToCategory,
    navigateToDeals,
    appSettings,
  } = useSmartNavStore();

  const visibleCategories = useMemo(() => {
    const hidden = new Set((appSettings.hidden_categories || []).map(Number));
    return categories.filter((c) => !hidden.has(Number(c.item_class_id)));
  }, [categories, appSettings.hidden_categories]);

  // Active sidebar selection: 'all', 'sale', or a numeric item_class_id
  const [activeSidebarId, setActiveSidebarId] = useState<
    "all" | "sale" | number
  >(() => {
    if (selectedClassId !== null) return selectedClassId;
    return visibleCategories[0]?.item_class_id ?? "all";
  });

  const [categoryItems, setCategoryItems] = useState<ItemWithImages[]>([]);
  const [totalCategoryCount, setTotalCategoryCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeSubRoom, setActiveSubRoom] = useState<string | null>(null);
  const [activeSubMaterial, setActiveSubMaterial] = useState<string | null>(
    null
  );
  const [categoryFilterText, setCategoryFilterText] = useState("");

  const filteredSidebarCategories = useMemo(() => {
    const q = categoryFilterText.trim().toLowerCase();
    if (!q) return visibleCategories;
    return visibleCategories.filter((c) =>
      c.item_class.toLowerCase().includes(q)
    );
  }, [visibleCategories, categoryFilterText]);

  const activeCategoryObj = useMemo(() => {
    if (typeof activeSidebarId !== "number") return null;
    return (
      visibleCategories.find((c) => c.item_class_id === activeSidebarId) || null
    );
  }, [visibleCategories, activeSidebarId]);

  // Fetch real items for the selected sidebar category
  useEffect(() => {
    let cancelled = false;
    setActiveSubRoom(null);
    setActiveSubMaterial(null);

    async function fetchCategoryItems() {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const selectClause = appSettings.require_images
          ? "*, item_images!inner(*)"
          : "*, item_images(*)";

        let query = supabase
          .from("smart_items")
          .select(selectClause, { count: "exact" })
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

        if (activeSidebarId === "sale") {
          query = query.gt("discount", 0);
        } else if (typeof activeSidebarId === "number") {
          query = query.eq("class_id", activeSidebarId);
        }

        const { data, count } = await query
          .order("image_updated_at", { ascending: false, nullsFirst: false })
          .order("item_id", { ascending: false })
          .range(0, 47);

        if (!cancelled) {
          const rows = (data as unknown as ItemWithImages[]) || [];
          setCategoryItems(rows);
          setTotalCategoryCount(count ?? rows.length);
        }
      } catch {
        if (!cancelled) {
          setCategoryItems(initialItems);
          setTotalCategoryCount(initialItems.length);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchCategoryItems();
    return () => {
      cancelled = true;
    };
  }, [
    activeSidebarId,
    appSettings.require_images,
    appSettings.hide_out_of_stock,
    appSettings.hidden_categories,
    initialItems,
  ]);

  // Extract real Room & Material sub-chips from the loaded category items
  const { roomChips, materialChips } = useMemo(() => {
    const rooms = new Set<string>();
    const materials = new Set<string>();

    for (const item of categoryItems) {
      if (item.house_rooms) {
        item.house_rooms
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((r) => rooms.add(r));
      }
      if (item.material) {
        item.material
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((m) => materials.add(m));
      }
    }

    return {
      roomChips: Array.from(rooms).slice(0, 10),
      materialChips: Array.from(materials).slice(0, 10),
    };
  }, [categoryItems]);

  const displayedItems = useMemo(() => {
    return categoryItems.filter((item) => {
      if (
        activeSubRoom &&
        !(item.house_rooms || "")
          .toLowerCase()
          .includes(activeSubRoom.toLowerCase())
      ) {
        return false;
      }
      if (
        activeSubMaterial &&
        !(item.material || "")
          .toLowerCase()
          .includes(activeSubMaterial.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [categoryItems, activeSubRoom, activeSubMaterial]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col md:flex-row min-h-[72vh]">
      {/* Left Vertical SHEIN-Style Category Rail */}
      <aside className="w-full md:w-64 lg:w-72 bg-slate-50/90 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col shrink-0">
        {/* Category Quick Filter Input */}
        <div className="p-3 border-b border-slate-200/70">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={categoryFilterText}
              onChange={(e) => setCategoryFilterText(e.target.value)}
              placeholder="Filter categories..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-smart-teal"
            />
          </div>
        </div>

        {/* Horizontal scroll on mobile / Vertical scroll on tablet+ OR classic split-screen on mobile too */}
        <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto max-h-[65vh] no-scrollbar divide-x md:divide-x-0 md:divide-y divide-slate-200/50">
          <button
            type="button"
            onClick={() => setActiveSidebarId("all")}
            className={`relative px-3.5 py-3 text-left text-xs font-extrabold transition-colors flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSidebarId === "all"
                ? "bg-white text-smart-teal"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            {activeSidebarId === "all" && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-smart-teal hidden md:block" />
            )}
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
            <span>All Categories</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSidebarId("sale")}
            className={`relative px-3.5 py-3 text-left text-xs font-extrabold transition-colors flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSidebarId === "sale"
                ? "bg-white text-smart-sale"
                : "text-smart-sale/80 hover:bg-white/60"
            }`}
          >
            {activeSidebarId === "sale" && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-smart-sale hidden md:block" />
            )}
            <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>⚡ On Sale Deals</span>
          </button>

          {filteredSidebarCategories.map((cat) => {
            const isSelected = activeSidebarId === cat.item_class_id;
            return (
              <button
                key={cat.item_class_id}
                type="button"
                onClick={() => setActiveSidebarId(cat.item_class_id)}
                className={`relative px-3.5 py-3 text-left text-xs font-bold transition-colors shrink-0 md:shrink cursor-pointer ${
                  isSelected
                    ? "bg-white text-smart-teal font-black"
                    : "text-slate-700 hover:bg-white/60"
                }`}
              >
                {isSelected && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-smart-teal hidden md:block" />
                )}
                <span className="line-clamp-1">{cat.item_class}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Right Visual Content Pane */}
      <div className="flex-1 p-4 sm:p-6 space-y-5 overflow-y-auto">
        {/* Category Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-smart-teal" />
              <h2 className="text-base sm:text-xl font-black text-slate-900">
                {activeSidebarId === "all"
                  ? "All Store Categories"
                  : activeSidebarId === "sale"
                  ? "⚡ Flash Sale & Discounted Finds"
                  : activeCategoryObj?.item_class || "Category"}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-smart-teal-light text-smart-teal text-xs font-black tabular-numbers">
                {totalCategoryCount.toLocaleString()} items
              </span>
            </div>
            {activeCategoryObj?.item_class_description && (
              <p className="text-xs text-slate-500 mt-1">
                {activeCategoryObj.item_class_description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (activeSidebarId === "sale") {
                navigateToDeals();
              } else if (typeof activeSidebarId === "number") {
                navigateToCategory(activeSidebarId);
              } else {
                navigateToCategory(null);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-smart-teal hover:bg-smart-teal-hover text-white text-xs font-extrabold shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span>Open Full Feed</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Real Room & Material Sub-Filter Chips extracted from real category items */}
        {(roomChips.length > 0 || materialChips.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setActiveSubRoom(null);
                  setActiveSubMaterial(null);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                  !activeSubRoom && !activeSubMaterial
                    ? "bg-smart-teal text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({categoryItems.length})
              </button>

              {roomChips.map((room) => (
                <button
                  key={`room-${room}`}
                  type="button"
                  onClick={() =>
                    setActiveSubRoom(activeSubRoom === room ? null : room)
                  }
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                    activeSubRoom === room
                      ? "bg-smart-teal text-white"
                      : "bg-smart-teal-light/60 text-smart-teal hover:bg-smart-teal-light"
                  }`}
                >
                  {room}
                </button>
              ))}

              {materialChips.map((mat) => (
                <button
                  key={`mat-${mat}`}
                  type="button"
                  onClick={() =>
                    setActiveSubMaterial(
                      activeSubMaterial === mat ? null : mat
                    )
                  }
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                    activeSubMaterial === mat
                      ? "bg-slate-900 text-smart-gold"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {mat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Right Pane Visual Product Grid */}
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-smart-teal">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs font-bold">
              Loading category products...
            </span>
          </div>
        ) : displayedItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {displayedItems.map((item) => (
              <SmartProductCard key={item.item_id} item={item} compact />
            ))}
          </div>
        ) : (
          <div className="py-14 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">
              No in-stock products match this filter right now.
            </p>
            {(activeSubRoom || activeSubMaterial) && (
              <button
                type="button"
                onClick={() => {
                  setActiveSubRoom(null);
                  setActiveSubMaterial(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-smart-teal text-white text-xs font-bold cursor-pointer"
              >
                Reset Sub-Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
