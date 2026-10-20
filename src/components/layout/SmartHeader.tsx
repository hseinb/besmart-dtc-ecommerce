"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  Zap,
  Sparkles,
  ScanBarcode,
  X,
  Clock,
  ArrowUpRight,
  LayoutGrid,
  Home,
  Truck,
  Loader2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useSmartNavStore } from "@/store/useSmartNavStore";
import { useSmartAuthStore } from "@/store/useSmartAuthStore";
import { ItemClass, ItemWithImages } from "@/types/smart.types";
import { createClient } from "@/lib/supabase/client";
import { getItemImageUrl } from "@/lib/media";

interface SmartHeaderProps {
  categories: ItemClass[];
  bagCount?: number;
  wishlistCount?: number;
}

export function SmartHeader({
  categories,
  bagCount = 0,
  wishlistCount = 0,
}: SmartHeaderProps) {
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    selectedClassId,
    navigateToCategory,
    navigateToDeals,
    onSaleOnly,
    setOnSaleOnly,
    openProductDetail,
    appSettings,
  } = useSmartNavStore();
  const { customer, staffUser } = useSmartAuthStore();

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [liveResults, setLiveResults] = useState<ItemWithImages[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isBarcodeLookupOpen, setIsBarcodeLookupOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const pillScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const visibleCategories = React.useMemo(() => {
    const hidden = new Set((appSettings.hidden_categories || []).map(Number));
    return categories.filter((c) => !hidden.has(Number(c.item_class_id)));
  }, [categories, appSettings.hidden_categories]);

  const updatePillScrollState = React.useCallback(() => {
    const el = pillScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updatePillScrollState();
    const timer = setTimeout(updatePillScrollState, 100);
    window.addEventListener("resize", updatePillScrollState);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePillScrollState);
    };
  }, [visibleCategories, updatePillScrollState]);

  // Close autocomplete dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced live product autocomplete against real Supabase public.smart_items
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setLiveResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const supabase = createClient();
        const selectClause = appSettings.require_images
          ? "*, item_images!inner(*)"
          : "*, item_images(*)";

        let query = supabase
          .from("smart_items")
          .select(selectClause)
          .eq("is_active", true)
          .or(
            `item_name.ilike.%${trimmed}%,code.ilike.%${trimmed}%,upc.ilike.%${trimmed}%,tags.ilike.%${trimmed}%`
          );

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

        const { data } = await query
          .order("image_updated_at", { ascending: false, nullsFirst: false })
          .limit(6);

        setLiveResults((data as unknown as ItemWithImages[]) || []);
      } catch {
        setLiveResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [
    searchQuery,
    appSettings.require_images,
    appSettings.hide_out_of_stock,
    appSettings.hidden_categories,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      addRecentSearch(searchQuery.trim());
      setActiveTab("home");
      setIsSearchFocused(false);
    }
  };

  const handleBarcodeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeError(null);

    const supabase = createClient();
    const { data } = await supabase
      .from("smart_items")
      .select("*, item_images(*)")
      .eq("is_active", true)
      .or(`code.ilike.${code},upc.eq.${code}`)
      .limit(1);

    if (data && data.length > 0) {
      const found = data[0] as unknown as ItemWithImages;
      setIsBarcodeLookupOpen(false);
      setBarcodeInput("");
      openProductDetail(found);
    } else {
      setSearchQuery(code);
      setActiveTab("home");
      setIsBarcodeLookupOpen(false);
      setBarcodeInput("");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs pt-safe">
        {/* Top Promotional Free-Shipping Bar */}
        {appSettings.free_shipping_threshold > 0 && (
          <div className="bg-smart-teal-deep text-white text-[11px] sm:text-xs font-semibold py-1.5 px-3 flex items-center justify-center gap-2">
            <Truck className="w-3.5 h-3.5 text-smart-gold shrink-0" />
            <span>
              FREE Delivery across Lebanon on orders over{" "}
              <strong className="text-smart-gold font-extrabold">
                ${Number(appSettings.free_shipping_threshold).toFixed(2)}
              </strong>
            </span>
          </div>
        )}

        {/* Main Header Row: Brand Logo + Smart Search Bar + Desktop Actions */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2.5 sm:gap-5">
          {/* Left: Official B's Mart Logo */}
          <button
            onClick={() => {
              setOnSaleOnly(false);
              navigateToCategory(null);
            }}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer group text-left"
            title="B's Mart Home"
          >
            <img
              src="/logo.png"
              alt="B's Mart"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform shrink-0"
            />
            <div className="hidden xs:flex flex-col leading-none">
              <div className="flex items-center gap-1">
                <span className="font-black text-lg sm:text-xl tracking-tight text-smart-teal">
                  B&apos;s MART
                </span>
                <span className="w-2 h-2 rounded-full bg-smart-gold" />
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
                Smart Home &amp; Lifestyle
              </span>
            </div>
          </button>

          {/* Center: SHEIN-Style Smart Search Bar with Live Autocomplete */}
          <div
            ref={searchContainerRef}
            className="relative flex-1 max-w-2xl"
          >
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search kitchenware, appliances, home decor, SKU..."
                className="w-full h-10 sm:h-11 pl-10 pr-20 rounded-full bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-smart-teal text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-smart-teal/20 transition-all"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsBarcodeLookupOpen(true)}
                  className="p-1.5 text-slate-500 hover:text-smart-teal hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
                  title="Scan or Lookup Barcode / SKU"
                >
                  <ScanBarcode className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  className="h-7 sm:h-8 px-3 rounded-full bg-smart-teal hover:bg-smart-teal-hover text-white text-xs font-bold transition-colors cursor-pointer hidden sm:inline-flex items-center"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Live Autocomplete & Recent Searches Popover */}
            {isSearchFocused && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden z-50 max-h-[75vh] overflow-y-auto">
                {searchQuery.trim().length >= 2 ? (
                  <div className="p-3">
                    <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-100">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Matching Products
                      </span>
                      {isSearching && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-smart-teal" />
                      )}
                    </div>

                    {liveResults.length > 0 ? (
                      <div className="divide-y divide-slate-100 mt-1">
                        {liveResults.map((item) => {
                          const hasDiscount = Number(item.discount) > 0;
                          const finalPrice = hasDiscount
                            ? Number(
                                (
                                  Number(item.srp) *
                                  (1 - Number(item.discount) / 100)
                                ).toFixed(2)
                              )
                            : Number(item.srp);

                          return (
                            <button
                              key={item.item_id}
                              type="button"
                              onClick={() => {
                                addRecentSearch(item.item_name);
                                setIsSearchFocused(false);
                                openProductDetail(item);
                              }}
                              className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors text-left cursor-pointer"
                            >
                              <img
                                src={getItemImageUrl(item, "thumb")}
                                alt={item.item_name}
                                className="w-11 h-11 rounded-lg object-cover bg-slate-100 border border-slate-200/60 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                  {item.item_name}
                                </p>
                                <p className="text-[11px] text-slate-400 font-mono">
                                  SKU: {item.code}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs sm:text-sm font-black text-smart-teal tabular-numbers">
                                  ${finalPrice.toFixed(2)}
                                </p>
                                {hasDiscount && (
                                  <p className="text-[10px] text-slate-400 line-through tabular-numbers">
                                    ${Number(item.srp).toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      !isSearching && (
                        <p className="text-xs text-slate-500 py-6 text-center">
                          No matching products found for &ldquo;{searchQuery}&rdquo;
                        </p>
                      )
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 space-y-4">
                    {/* Recent Searches */}
                    {recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Recent Searches
                          </span>
                          <button
                            type="button"
                            onClick={clearRecentSearches}
                            className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {recentSearches.map((term) => (
                            <button
                              key={term}
                              type="button"
                              onClick={() => {
                                setSearchQuery(term);
                                setActiveTab("home");
                                setIsSearchFocused(false);
                              }}
                              className="px-3 py-1 rounded-full bg-slate-100 hover:bg-smart-teal-light hover:text-smart-teal text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Real Categories Discovery Chips */}
                    {visibleCategories.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-2">
                          <Sparkles className="w-3 h-3 text-smart-gold" /> Explore
                          Categories
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {visibleCategories.slice(0, 10).map((cat) => (
                            <button
                              key={cat.item_class_id}
                              type="button"
                              onClick={() => {
                                navigateToCategory(cat.item_class_id);
                                setIsSearchFocused(false);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-smart-teal-light/60 hover:bg-smart-teal text-smart-teal hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <span>{cat.item_class}</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Desktop Navigation Actions */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2 shrink-0">
            <button
              onClick={() => {
                setOnSaleOnly(false);
                setActiveTab("home");
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "home" && !onSaleOnly
                  ? "bg-smart-teal-light text-smart-teal"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Shop</span>
            </button>

            <button
              onClick={() => setActiveTab("categories")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "categories"
                  ? "bg-smart-teal-light text-smart-teal"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Categories</span>
            </button>

            <button
              onClick={navigateToDeals}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "deals" || onSaleOnly
                  ? "bg-smart-sale-light text-smart-sale"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Zap className="w-4 h-4 text-smart-sale fill-smart-sale" />
              <span>Flash Deals</span>
            </button>

            <button
              onClick={() => setActiveTab("me")}
              className={`relative p-2.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === "me"
                  ? "bg-smart-teal-light text-smart-teal"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
              title="Wishlist & Account"
            >
              <Heart className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-smart-sale text-white text-[10px] font-black flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("me")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "me"
                  ? "bg-smart-teal-light text-smart-teal"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
              title="My Account"
            >
              <User className="w-4 h-4" />
              <span>
                {customer
                  ? customer.full_name.split(" ")[0]
                  : staffUser
                  ? staffUser.full_name || staffUser.username
                  : "Sign In"}
              </span>
            </button>

            {staffUser && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "admin"
                    ? "bg-smart-teal-deep text-smart-gold shadow-xs"
                    : "bg-smart-gold/20 text-slate-900 hover:bg-smart-gold/30 border border-smart-gold/40"
                }`}
                title="Dashboard"
              >
                <ShieldCheck className="w-4 h-4 text-smart-teal" />
                <span>Dashboard</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab("bag")}
              className="relative flex items-center gap-2 px-3.5 py-2 rounded-full bg-smart-teal hover:bg-smart-teal-hover text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer"
              title="Shopping Bag"
            >
              <ShoppingBag className="w-4 h-4 text-smart-gold" />
              <span>Bag</span>
              <span className="px-1.5 py-0.5 rounded-full bg-smart-gold text-slate-950 text-[11px] font-black tabular-numbers">
                {bagCount}
              </span>
            </button>
          </nav>

          {/* Mobile Quick Dashboard Button (Only visible when staffUser is signed in) */}
          {staffUser && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`md:hidden p-2 rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                activeTab === "admin"
                  ? "bg-smart-teal-deep text-smart-gold"
                  : "bg-smart-gold/25 text-slate-900 border border-smart-gold/40"
              }`}
              title="Dashboard"
            >
              <ShieldCheck className="w-4 h-4 text-smart-teal" />
              <span className="text-[11px]">Dashboard</span>
            </button>
          )}
        </div>

        {/* SHEIN-Style Horizontal Category & Campaign Ribbon */}
        <div className="border-t border-slate-100 bg-white">
          <div className="relative max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center">
            {canScrollLeft && (
              <div className="absolute left-2 sm:left-5 lg:left-7 z-10 flex items-center pr-3 bg-gradient-to-r from-white via-white/95 to-transparent py-1">
                <button
                  type="button"
                  onClick={() =>
                    pillScrollRef.current?.scrollBy({
                      left: -320,
                      behavior: "smooth",
                    })
                  }
                  aria-label="Scroll categories left"
                  className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm hover:border-smart-teal hover:text-smart-teal text-slate-700 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}

            <div
              ref={pillScrollRef}
              onScroll={updatePillScrollState}
              className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-2 scroll-smooth w-full"
            >
              <button
                onClick={() => {
                  setOnSaleOnly(false);
                  navigateToCategory(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  selectedClassId === null && !onSaleOnly && activeTab === "home"
                    ? "bg-smart-teal text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200/70"
                }`}
              >
                All
              </button>

              <button
                onClick={navigateToDeals}
                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  activeTab === "deals" || onSaleOnly
                    ? "bg-smart-sale text-white shadow-xs"
                    : "bg-smart-sale-light text-smart-sale hover:bg-smart-sale/15"
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Flash Sale</span>
              </button>

              {visibleCategories.map((cat) => {
                const isSelected =
                  selectedClassId === cat.item_class_id && activeTab === "home";
                return (
                  <button
                    key={cat.item_class_id}
                    onClick={() => navigateToCategory(cat.item_class_id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? "bg-smart-teal text-white shadow-xs"
                        : "bg-slate-100/90 text-slate-700 hover:bg-smart-teal-light hover:text-smart-teal"
                    }`}
                  >
                    {cat.item_class}
                  </button>
                );
              })}
            </div>

            {canScrollRight && (
              <div className="absolute right-2 sm:right-5 lg:right-7 z-10 flex items-center pl-3 bg-gradient-to-l from-white via-white/95 to-transparent py-1">
                <button
                  type="button"
                  onClick={() =>
                    pillScrollRef.current?.scrollBy({
                      left: 320,
                      behavior: "smooth",
                    })
                  }
                  aria-label="Scroll categories right"
                  className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm hover:border-smart-teal hover:text-smart-teal text-slate-700 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Barcode / SKU Quick Lookup Modal */}
      {isBarcodeLookupOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-smart-teal-light text-smart-teal flex items-center justify-center">
                  <ScanBarcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Barcode / SKU Lookup
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Enter or scan a product barcode or SKU code
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBarcodeLookupOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBarcodeLookup} className="space-y-3">
              <input
                type="text"
                autoFocus
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="e.g. UPC barcode or item code..."
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
              />
              {barcodeError && (
                <p className="text-xs text-rose-600 font-semibold">
                  {barcodeError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBarcodeLookupOpen(false)}
                  className="px-4 h-10 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 h-10 rounded-xl bg-smart-teal text-white text-xs font-bold hover:bg-smart-teal-hover cursor-pointer"
                >
                  Find Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
