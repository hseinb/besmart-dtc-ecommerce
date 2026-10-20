"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Zap,
  Sparkles,
  TicketPercent,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  RotateCcw,
  SlidersHorizontal,
  Loader2,
  Flame,
  Clock,
  Tag,
} from "lucide-react";
import {
  ItemClass,
  ItemTag,
  ItemWithImages,
  SmartBanner,
  SmartCoupon,
} from "@/types/smart.types";
import { useSmartNavStore, SmartSortOption } from "@/store/useSmartNavStore";
import { useSmartCartStore } from "@/store/useSmartCartStore";
import { SmartProductCard } from "@/components/product/SmartProductCard";
import { createClient } from "@/lib/supabase/client";
import { getItemImageUrl } from "@/lib/media";

const PAGE_SIZE = 40;

interface SmartHomeViewProps {
  categories: ItemClass[];
  categoryThumbs?: Record<number, string>;
  initialItems: ItemWithImages[];
  totalCatalogCount: number;
  initialFlashDeals: ItemWithImages[];
  campaignTags: ItemTag[];
  banners: SmartBanner[];
  collectibleCoupons: SmartCoupon[];
}

export function SmartHomeView({
  categories,
  categoryThumbs,
  initialItems,
  totalCatalogCount,
  initialFlashDeals,
  campaignTags,
  banners,
  collectibleCoupons,
}: SmartHomeViewProps) {
  const {
    selectedClassId,
    selectedRoom,
    selectedMaterial,
    selectedTag,
    setSelectedTag,
    searchQuery,
    onSaleOnly,
    setOnSaleOnly,
    sortBy,
    setSortBy,
    navigateToCategory,
    navigateToDeals,
    setActiveTab,
    resetFilters,
    appSettings,
  } = useSmartNavStore();

  const { collectCoupon, isCouponCollected, setAppliedCoupon } =
    useSmartCartStore();

  const [items, setItems] = useState<ItemWithImages[]>(initialItems);
  const [totalMatching, setTotalMatching] = useState<number>(totalCatalogCount);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(
    initialItems.length < totalCatalogCount
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [flashDeals, setFlashDeals] =
    useState<ItemWithImages[]>(initialFlashDeals);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [clientCategoryThumbs, setClientCategoryThumbs] = useState<
    Record<number, string>
  >(categoryThumbs || {});
  const [activeClassIdSet, setActiveClassIdSet] = useState<Set<number>>(
    new Set()
  );

  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const catScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollCatLeft, setCanScrollCatLeft] = useState(false);
  const [canScrollCatRight, setCanScrollCatRight] = useState(false);

  // Unified full-width hero carousel slides: Slide 1 = Main B's Mart Hero (+ any smart_banners), followed by all campaignTags
  const heroSlides = React.useMemo(() => {
    type HeroSlide =
      | {
          id: string;
          kind: "main";
          banner?: SmartBanner;
        }
      | {
          id: string;
          kind: "tag";
          tag: ItemTag;
        };

    const slides: HeroSlide[] = [];
    if (banners.length > 0) {
      for (const b of banners) {
        slides.push({ id: `banner-${b.id}`, kind: "main", banner: b });
      }
    } else {
      slides.push({ id: "main-bsmart-hero", kind: "main" });
    }

    for (const tag of campaignTags) {
      slides.push({ id: `tag-${tag.id}`, kind: "tag", tag });
    }

    return slides;
  }, [banners, campaignTags]);

  // Auto-rotate Hero Carousel every 5000ms (pauses on hover)
  useEffect(() => {
    if (heroSlides.length <= 1 || isHeroPaused) return;
    const timer = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroSlides.length, isHeroPaused]);

  // Hydrate category thumbnails & active category counts on client via RPC if needed
  useEffect(() => {
    let cancelled = false;
    async function loadLiveCategoryThumbs() {
      const supabase = createClient();
      const { data } = await supabase.rpc("smart_get_category_thumbnails");
      if (cancelled || !Array.isArray(data)) return;

      const nextActive = new Set<number>();
      const nextThumbs: Record<number, string> = {};
      for (const row of data as {
        class_id: number;
        item_count: number;
        item_id: number | null;
        item_code: string | null;
        image_updated_at: string | null;
        hero1: string | null;
      }[]) {
        const classId = Number(row.class_id);
        if (Number(row.item_count) > 0) {
          nextActive.add(classId);
        }
        if (row.hero1) {
          const thumbUrl = row.hero1.startsWith("http")
            ? row.hero1
            : getItemImageUrl(
                {
                  code: row.item_code ?? "",
                  item_images: { hero1: row.hero1 },
                },
                "thumb"
              );
          if (thumbUrl && !thumbUrl.startsWith("data:image/svg+xml")) {
            nextThumbs[classId] = thumbUrl;
          }
        }
      }
      if (nextActive.size > 0) {
        setActiveClassIdSet(nextActive);
      }
      if (Object.keys(nextThumbs).length > 0) {
        setClientCategoryThumbs((prev) => ({ ...prev, ...nextThumbs }));
      }
    }
    loadLiveCategoryThumbs();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCategories = React.useMemo(() => {
    const hidden = new Set((appSettings.hidden_categories || []).map(Number));
    const nonHidden = categories.filter(
      (c) => !hidden.has(Number(c.item_class_id))
    );
    if (activeClassIdSet.size > 0) {
      return nonHidden.filter((c) =>
        activeClassIdSet.has(Number(c.item_class_id))
      );
    }
    return nonHidden;
  }, [categories, appSettings.hidden_categories, activeClassIdSet]);

  const updateCatScrollState = useCallback(() => {
    const el = catScrollRef.current;
    if (!el) return;
    setCanScrollCatLeft(el.scrollLeft > 4);
    setCanScrollCatRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateCatScrollState();
    const timer = setTimeout(updateCatScrollState, 120);
    window.addEventListener("resize", updateCatScrollState);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateCatScrollState);
    };
  }, [visibleCategories, updateCatScrollState]);

  // Map a representative thumbnail per category (seeded from smart_get_category_thumbnails RPC + fallback to loaded items)
  const categoryThumbMap = React.useMemo(() => {
    const map = new Map<number, string>();
    const mergedRecord = { ...(categoryThumbs || {}), ...clientCategoryThumbs };
    for (const [k, url] of Object.entries(mergedRecord)) {
      const classId = Number(k);
      if (classId && url && !url.startsWith("data:image/svg+xml")) {
        map.set(classId, url);
      }
    }
    for (const item of [...initialItems, ...flashDeals, ...items]) {
      if (item.class_id && !map.has(item.class_id)) {
        const url = getItemImageUrl(item, "thumb");
        if (url && !url.startsWith("data:image/svg+xml")) {
          map.set(item.class_id, url);
        }
      }
    }
    return map;
  }, [categoryThumbs, clientCategoryThumbs, initialItems, flashDeals, items]);

  // Live Flash Sale Countdown Timer (if smart_app_settings.flash_sale_ends_at is set)
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

    const updateTimer = () => {
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        setCountdownText(null);
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdownText(
        `${String(hours).padStart(2, "0")}:${String(mins).padStart(
          2,
          "0"
        )}:${String(secs).padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [appSettings.flash_sale_ends_at]);

  // Fetch Flash Deals dynamically if initialFlashDeals was empty or settings changed
  useEffect(() => {
    if (initialFlashDeals.length > 0) return;
    let cancelled = false;
    async function loadFlashDeals() {
      const supabase = createClient();
      const selectClause = appSettings.require_images
        ? "*, item_images!inner(*)"
        : "*, item_images(*)";
      let q = supabase
        .from("smart_items")
        .select(selectClause)
        .eq("is_active", true)
        .gt("discount", 0);

      if (appSettings.hide_out_of_stock) {
        q = q.gt("qtty", 0);
      }
      if (
        appSettings.hidden_categories &&
        appSettings.hidden_categories.length > 0
      ) {
        q = q.not(
          "class_id",
          "in",
          `(${appSettings.hidden_categories.join(",")})`
        );
      }

      const { data } = await q
        .order("discount", { ascending: false })
        .limit(12);

      if (!cancelled && data) {
        setFlashDeals(data as unknown as ItemWithImages[]);
      }
    }
    loadFlashDeals();
    return () => {
      cancelled = true;
    };
  }, [
    initialFlashDeals.length,
    appSettings.require_images,
    appSettings.hide_out_of_stock,
    appSettings.hidden_categories,
  ]);

  const isDefaultUnfilteredView =
    selectedClassId === null &&
    !selectedRoom &&
    !selectedMaterial &&
    !selectedTag &&
    !onSaleOnly &&
    !searchQuery.trim() &&
    sortBy === "image_desc";

  // Build & execute paginated PostgREST query against public.smart_items
  const fetchCatalogPage = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (replace) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

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

        if (selectedClassId !== null) {
          query = query.eq("class_id", selectedClassId);
        }

        if (selectedRoom) {
          query = query.ilike("house_rooms", `%${selectedRoom}%`);
        }

        if (selectedMaterial) {
          query = query.ilike("material", `%${selectedMaterial}%`);
        }

        if (selectedTag) {
          if (selectedTag.toLowerCase() === "on sale") {
            query = query.gt("discount", 0);
          } else {
            query = query.ilike("tags", `%${selectedTag}%`);
          }
        }

        if (onSaleOnly) {
          query = query.gt("discount", 0);
        }

        const trimmedSearch = searchQuery.trim();
        if (trimmedSearch) {
          query = query.or(
            `item_name.ilike.%${trimmedSearch}%,code.ilike.%${trimmedSearch}%,upc.ilike.%${trimmedSearch}%,tags.ilike.%${trimmedSearch}%,description.ilike.%${trimmedSearch}%`
          );
        }

        // Apply sort order
        switch (sortBy) {
          case "discount_desc":
            query = query
              .order("discount", { ascending: false })
              .order("item_id", { ascending: false });
            break;
          case "price_asc":
            query = query
              .order("srp", { ascending: true })
              .order("item_id", { ascending: false });
            break;
          case "price_desc":
            query = query
              .order("srp", { ascending: false })
              .order("item_id", { ascending: false });
            break;
          case "name_asc":
            query = query.order("item_name", { ascending: true });
            break;
          case "name_desc":
            query = query.order("item_name", { ascending: false });
            break;
          case "image_desc":
          default:
            query = query
              .order("image_updated_at", { ascending: false, nullsFirst: false })
              .order("item_id", { ascending: false });
            break;
        }

        const from = targetPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, count } = await query.range(from, to);
        const fetched = (data as unknown as ItemWithImages[]) || [];
        const total = count ?? fetched.length;

        setTotalMatching(total);
        setPage(targetPage);

        if (replace) {
          setItems(fetched);
          setHasMore(fetched.length < total);
        } else {
          setItems((prev) => {
            const seen = new Set(prev.map((i) => i.item_id));
            const merged = [
              ...prev,
              ...fetched.filter((i) => !seen.has(i.item_id)),
            ];
            setHasMore(merged.length < total && fetched.length > 0);
            return merged;
          });
        }
      } catch (err) {
        console.error("Failed to fetch catalog page:", err);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [
      appSettings.require_images,
      appSettings.hide_out_of_stock,
      appSettings.hidden_categories,
      selectedClassId,
      selectedRoom,
      selectedMaterial,
      selectedTag,
      onSaleOnly,
      searchQuery,
      sortBy,
    ]
  );

  // Trigger fresh query whenever filters or sort change
  useEffect(() => {
    if (isDefaultUnfilteredView && initialItems.length > 0) {
      setItems(initialItems);
      setTotalMatching(totalCatalogCount);
      setPage(0);
      setHasMore(initialItems.length < totalCatalogCount);
      return;
    }
    const timer = setTimeout(() => {
      fetchCatalogPage(0, true);
    }, 120);
    return () => clearTimeout(timer);
  }, [
    isDefaultUnfilteredView,
    initialItems,
    totalCatalogCount,
    fetchCatalogPage,
  ]);

  // Infinite scroll observer
  useEffect(() => {
    const node = loadMoreTriggerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          fetchCatalogPage(page + 1, false);
        }
      },
      { rootMargin: "450px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, page, fetchCatalogPage]);

  const activeCategoryName = React.useMemo(() => {
    if (selectedClassId === null) return null;
    return (
      categories.find((c) => c.item_class_id === selectedClassId)?.item_class ||
      null
    );
  }, [categories, selectedClassId]);

  const hasActiveFilters =
    selectedClassId !== null ||
    Boolean(selectedRoom) ||
    Boolean(selectedMaterial) ||
    Boolean(selectedTag) ||
    onSaleOnly ||
    Boolean(searchQuery.trim());

  return (
    <div className="space-y-6">
      {/* 1. Collectible Coupons Strip (Only rendered when real active coupons exist in smart_coupons) */}
      {!hasActiveFilters && collectibleCoupons.length > 0 && (
        <section className="bg-gradient-to-r from-amber-50 via-yellow-50/90 to-amber-50 border border-amber-300/70 rounded-2xl p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <TicketPercent className="w-4 h-4 text-amber-600" />
              <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                Collectible Vouchers &amp; Promo Codes
              </span>
            </div>
            <span className="text-[11px] font-bold text-amber-700">
              Tap to claim for checkout
            </span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-0.5">
            {collectibleCoupons.map((coupon) => {
              const collected = isCouponCollected(coupon.code);
              return (
                <div
                  key={coupon.coupon_id}
                  className="flex items-center justify-between gap-3 bg-white rounded-xl border border-amber-300/80 px-3.5 py-2.5 shadow-2xs shrink-0 min-w-[230px] sm:min-w-[260px]"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-black text-smart-sale">
                        {coupon.discount_type === "percentage"
                          ? `${coupon.discount_value}% OFF`
                          : coupon.discount_type === "fixed"
                          ? `$${coupon.discount_value} OFF`
                          : "FREE SHIPPING"}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-extrabold">
                        {coupon.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[160px]">
                      {coupon.min_order_amount > 0
                        ? `Orders over $${Number(coupon.min_order_amount).toFixed(0)}`
                        : coupon.title}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      collectCoupon(coupon);
                      setAppliedCoupon(coupon);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                      collected
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-smart-teal hover:bg-smart-teal-hover text-white shadow-2xs"
                    }`}
                  >
                    {collected ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Claimed</span>
                      </>
                    ) : (
                      <span>Collect</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. Unified Single Full-Width Hero Banner Carousel (Main B's Mart Hero + All Campaign Tags) */}
      {!hasActiveFilters && heroSlides.length > 0 && (
        <section
          onMouseEnter={() => setIsHeroPaused(true)}
          onMouseLeave={() => setIsHeroPaused(false)}
          className="rounded-3xl overflow-hidden shadow-lg relative min-h-[210px] sm:min-h-[250px] bg-gradient-to-br from-smart-teal-deep via-smart-teal to-[#0077A8] text-white"
        >
          {(() => {
            const safeIdx = activeSlideIndex % heroSlides.length;
            const currentSlide = heroSlides[safeIdx] || heroSlides[0];

            if (currentSlide.kind === "main") {
              const b = currentSlide.banner;
              return (
                <div
                  key={currentSlide.id}
                  className="relative w-full min-h-[210px] sm:min-h-[250px] p-5 sm:p-8 flex flex-col justify-between overflow-hidden"
                >
                  {b?.image_url && (
                    <>
                      <img
                        src={b.image_url}
                        alt={b.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-35 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-smart-teal-deep/95 via-smart-teal-deep/75 to-transparent" />
                    </>
                  )}

                  <div className="relative z-10 space-y-2.5 max-w-2xl">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-smart-gold text-[11px] font-extrabold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {b?.badge_text ||
                          "B's Mart • Smart Home & Lifestyle"}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                      {b?.title || (
                        <>
                          Everyday Smart Finds,{" "}
                          <span className="text-smart-gold">
                            Unbeatable Retail Prices.
                          </span>
                        </>
                      )}
                    </h1>
                    <p className="text-xs sm:text-sm text-white/85 font-medium leading-relaxed max-w-xl">
                      {b?.subtitle ||
                        `Shop ${totalCatalogCount.toLocaleString()} real in-stock home, kitchen, cleaning, and lifestyle essentials with fast delivery across Lebanon.`}
                    </p>
                  </div>

                  <div className="relative z-10 flex flex-wrap items-center gap-2.5 pt-4 pb-3 sm:pb-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab("categories")}
                      className="px-4 py-2.5 rounded-2xl bg-smart-gold hover:bg-smart-gold-hover text-slate-950 text-xs sm:text-sm font-black shadow-md transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span>Browse All Categories</span>
                    </button>
                    {flashDeals.length > 0 && (
                      <button
                        type="button"
                        onClick={navigateToDeals}
                        className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Zap className="w-4 h-4 text-smart-gold fill-smart-gold" />
                        <span>Shop Flash Sale ({flashDeals.length}+ Deals)</span>
                      </button>
                    )}
                  </div>

                  {/* Subtle Decorative Brand Ring */}
                  <div className="absolute -right-12 -bottom-12 w-56 h-56 rounded-full bg-smart-gold/15 blur-2xl pointer-events-none" />
                </div>
              );
            }

            const tag = currentSlide.tag;
            return (
              <div
                key={currentSlide.id}
                className="relative w-full min-h-[210px] sm:min-h-[250px] p-5 sm:p-8 flex flex-col justify-between overflow-hidden bg-slate-950"
              >
                {tag.image_url && (
                  <img
                    src={tag.image_url}
                    alt={tag.title || tag.tag_name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-smart-teal-deep/80 to-slate-950/35" />

                <div className="relative z-10 space-y-2.5 max-w-2xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-smart-gold text-slate-950 text-[11px] font-black uppercase tracking-wider shadow-xs">
                    <Tag className="w-3.5 h-3.5" />
                    <span>{tag.tag_name}</span>
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight text-white">
                    {tag.title || tag.tag_name}
                  </h2>
                  {tag.description && (
                    <p className="text-xs sm:text-sm text-white/85 font-medium leading-relaxed max-w-xl line-clamp-2">
                      {tag.description}
                    </p>
                  )}
                </div>

                <div className="relative z-10 flex flex-wrap items-center gap-2.5 pt-4 pb-3 sm:pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (tag.tag_name.toLowerCase() === "on sale") {
                        navigateToDeals();
                      } else {
                        setSelectedTag(tag.tag_name);
                      }
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-smart-gold hover:bg-smart-gold-hover text-slate-950 text-xs sm:text-sm font-black shadow-md transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Explore {tag.title || tag.tag_name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("categories")}
                    className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span>Browse All Categories</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Left / Right Carousel Navigation Arrows */}
          {heroSlides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setActiveSlideIndex(
                    (prev) => (prev - 1 + heroSlides.length) % heroSlides.length
                  )
                }
                aria-label="Previous slide"
                className="
                  absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20
                  w-8 h-8 sm:w-9 sm:h-9 rounded-full
                  bg-slate-950/45 hover:bg-slate-950/75 text-white border border-white/25
                  backdrop-blur-xs shadow-md flex items-center justify-center
                  transition-all cursor-pointer active:scale-95
                "
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveSlideIndex((prev) => (prev + 1) % heroSlides.length)
                }
                aria-label="Next slide"
                className="
                  absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20
                  w-8 h-8 sm:w-9 sm:h-9 rounded-full
                  bg-slate-950/45 hover:bg-slate-950/75 text-white border border-white/25
                  backdrop-blur-xs shadow-md flex items-center justify-center
                  transition-all cursor-pointer active:scale-95
                "
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Clickable Slide Indicator Dots */}
              <div className="absolute bottom-3 right-4 sm:right-7 z-20 flex items-center gap-1.5 bg-slate-950/35 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/15">
                {heroSlides.map((slide, idx) => {
                  const isCurrent =
                    idx === activeSlideIndex % heroSlides.length;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setActiveSlideIndex(idx)}
                      aria-label={`Go to slide ${idx + 1}`}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        isCurrent
                          ? "w-6 bg-smart-gold"
                          : "w-2 bg-white/55 hover:bg-white/90"
                      }`}
                    />
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* 3. Single-Row Circular Category Bubbles with Left/Right Scroll Arrows */}
      {!hasActiveFilters && visibleCategories.length > 0 && (
        <section className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-smart-teal" />
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Shop by Category
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("categories")}
              className="inline-flex items-center gap-0.5 text-xs font-extrabold text-smart-teal hover:underline cursor-pointer"
            >
              <span>View All ({visibleCategories.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative flex items-center">
            {canScrollCatLeft && (
              <div className="absolute left-0 z-10 flex items-center pr-3 bg-gradient-to-r from-white via-white/95 to-transparent py-2">
                <button
                  type="button"
                  onClick={() =>
                    catScrollRef.current?.scrollBy({
                      left: -360,
                      behavior: "smooth",
                    })
                  }
                  aria-label="Scroll categories left"
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-md hover:border-smart-teal hover:text-smart-teal text-slate-700 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}

            <div
              ref={catScrollRef}
              onScroll={updateCatScrollState}
              className="flex flex-nowrap items-start gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar py-1.5 scroll-smooth w-full"
            >
              {visibleCategories.map((cat) => {
                const thumbUrl = categoryThumbMap.get(cat.item_class_id);
                const initials = cat.item_class
                  .split(/[\s&-]+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join("");

                return (
                  <button
                    key={cat.item_class_id}
                    type="button"
                    onClick={() => navigateToCategory(cat.item_class_id)}
                    className="group flex flex-col items-center text-center gap-1.5 cursor-pointer shrink-0 w-[78px] sm:w-[92px]"
                  >
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-slate-100 border-2 border-slate-200/90 group-hover:border-smart-teal overflow-hidden shadow-2xs flex items-center justify-center transition-all group-hover:scale-105">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={cat.item_class}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs sm:text-sm font-black text-smart-teal">
                          {initials || "BM"}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-smart-teal line-clamp-2 leading-tight">
                      {cat.item_class}
                    </span>
                  </button>
                );
              })}
            </div>

            {canScrollCatRight && (
              <div className="absolute right-0 z-10 flex items-center pl-3 bg-gradient-to-l from-white via-white/95 to-transparent py-2">
                <button
                  type="button"
                  onClick={() =>
                    catScrollRef.current?.scrollBy({
                      left: 360,
                      behavior: "smooth",
                    })
                  }
                  aria-label="Scroll categories right"
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-md hover:border-smart-teal hover:text-smart-teal text-slate-700 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. ⚡ Flash Sale Shelf with Live Countdown (Only rendered when real discounted items exist) */}
      {!hasActiveFilters && flashDeals.length > 0 && (
        <section className="rounded-3xl bg-gradient-to-r from-[#FFF5F2] via-white to-[#FFF8EB] border border-smart-sale/25 p-4 sm:p-5 shadow-2xs space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-smart-sale text-white text-xs sm:text-sm font-black shadow-xs">
                <Zap className="w-4 h-4 fill-current" />
                <span>{appSettings.flash_sale_title || "FLASH SALE"}</span>
              </div>

              {countdownText && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 text-smart-gold text-xs font-mono font-black">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{countdownText}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={navigateToDeals}
              className="inline-flex items-center gap-1 text-xs font-black text-smart-sale hover:underline cursor-pointer"
            >
              <span>See All Deals</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar pb-1">
            {flashDeals.slice(0, 10).map((dealItem) => (
              <div
                key={dealItem.item_id}
                className="w-[155px] sm:w-[185px] shrink-0"
              >
                <SmartProductCard item={dealItem} compact />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Active Filter & Sort Bar */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:px-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
              {onSaleOnly ? (
                <>
                  <Flame className="w-4 h-4 text-smart-sale fill-smart-sale" />
                  <span>On Sale &amp; Clearance</span>
                </>
              ) : activeCategoryName ? (
                <>
                  <Sparkles className="w-4 h-4 text-smart-teal" />
                  <span>{activeCategoryName}</span>
                </>
              ) : selectedTag ? (
                <>
                  <Tag className="w-4 h-4 text-smart-teal" />
                  <span>Campaign: {selectedTag}</span>
                </>
              ) : searchQuery.trim() ? (
                <span>Search Results for &ldquo;{searchQuery}&rdquo;</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-smart-teal" />
                  <span>Recommended For You</span>
                </>
              )}
            </h2>

            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-extrabold tabular-numbers">
              {totalMatching.toLocaleString()} items
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 text-[11px] font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>

          {/* Sort Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
            {(
              [
                { id: "image_desc", label: "Recommended" },
                { id: "discount_desc", label: "Biggest Savings" },
                { id: "price_asc", label: "Price: Low to High" },
                { id: "price_desc", label: "Price: High to Low" },
                { id: "name_asc", label: "Name: A–Z" },
              ] as { id: SmartSortOption; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSortBy(opt.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  sortBy === opt.id
                    ? "bg-smart-teal text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active Campaign Tag Chip */}
        {selectedTag && (
          <div className="flex items-center gap-2 flex-wrap px-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
              Tag: {selectedTag}
            </span>
          </div>
        )}

        {/* 6. 2-Column Mobile / 5-Column Desktop Infinite Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden animate-pulse"
              >
                <div className="aspect-square bg-slate-200/70" />
                <div className="p-3 space-y-2">
                  <div className="h-3.5 bg-slate-200 rounded w-4/5" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-5 bg-slate-200 rounded w-1/3 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {items.map((item, idx) => (
                <SmartProductCard
                  key={item.item_id}
                  item={item}
                  priority={idx < 6}
                />
              ))}
            </div>

            {/* Infinite Scroll Trigger & Load More Button */}
            <div
              ref={loadMoreTriggerRef}
              className="py-6 flex flex-col items-center justify-center gap-2"
            >
              {isLoadingMore ? (
                <div className="inline-flex items-center gap-2 text-xs font-bold text-smart-teal">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading more products...</span>
                </div>
              ) : hasMore ? (
                <button
                  type="button"
                  onClick={() => fetchCatalogPage(page + 1, false)}
                  className="px-6 py-2.5 rounded-full bg-white hover:bg-smart-teal-light border border-slate-200 text-xs font-extrabold text-smart-teal shadow-2xs transition-colors cursor-pointer"
                >
                  Load More Products ({items.length} of{" "}
                  {totalMatching.toLocaleString()})
                </button>
              ) : (
                <p className="text-xs font-semibold text-slate-400">
                  You&apos;ve reached the end of the catalog ({items.length}{" "}
                  products shown)
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center space-y-3">
            <p className="text-sm sm:text-base font-black text-slate-800">
              No matching products found
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try clearing your active search or category filters to explore all
              available products in B&apos;s Mart.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="px-5 py-2.5 rounded-xl bg-smart-teal text-white text-xs font-bold cursor-pointer"
            >
              Show All Products
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
