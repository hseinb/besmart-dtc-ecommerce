"use client";

import React, { useEffect } from "react";
import {
  ItemClass,
  ItemTag,
  ItemWithImages,
  SmartAppSettings,
  SmartBanner,
  SmartCoupon,
  SmartDeliveryZone,
} from "@/types/smart.types";
import { useSmartNavStore } from "@/store/useSmartNavStore";
import {
  useSmartCartStore,
  decodeCartShareParam,
} from "@/store/useSmartCartStore";
import { useSmartWishlistStore } from "@/store/useSmartWishlistStore";
import { useSmartAuthStore } from "@/store/useSmartAuthStore";
import { SmartHeader } from "@/components/layout/SmartHeader";
import { SmartBottomNav } from "@/components/layout/SmartBottomNav";
import { SmartHomeView } from "@/components/home/SmartHomeView";
import { SplitCategoryExplorer } from "@/components/category/SplitCategoryExplorer";
import { SmartDealsView } from "@/components/deals/SmartDealsView";
import { SmartBagView } from "@/components/bag/SmartBagView";
import { SmartBagDrawer } from "@/components/bag/SmartBagDrawer";
import {
  SmartSharedBagModal,
  SharedBagEntry,
} from "@/components/bag/SmartSharedBagModal";
import { SmartMeView } from "@/components/profile/SmartMeView";
import { SmartAdminDashboard } from "@/components/admin/SmartAdminDashboard";
import { SmartProductDetailModal } from "@/components/product/SmartProductDetailModal";
import { fetchSmartAppSettings } from "@/lib/smartSettings";
import { createClient } from "@/lib/supabase/client";

interface SmartAppShellProps {
  initialCategories: ItemClass[];
  categoryThumbs?: Record<number, string>;
  initialItems: ItemWithImages[];
  totalCatalogCount: number;
  initialFlashDeals: ItemWithImages[];
  campaignTags: ItemTag[];
  banners: SmartBanner[];
  collectibleCoupons: SmartCoupon[];
  initialSettings: SmartAppSettings;
  deliveryZones: SmartDeliveryZone[];
}

export function SmartAppShell({
  initialCategories,
  categoryThumbs,
  initialItems,
  totalCatalogCount,
  initialFlashDeals,
  campaignTags,
  banners,
  collectibleCoupons,
  initialSettings,
  deliveryZones,
}: SmartAppShellProps) {
  const {
    activeTab,
    openProductDetail,
    setAppSettings,
    appSettings,
  } = useSmartNavStore();

  const {
    hydrate: hydrateCart,
    getTotalUnitCount,
  } = useSmartCartStore();

  const {
    wishlistItems,
    hydrate: hydrateWishlist,
  } = useSmartWishlistStore();

  const { hydrate: hydrateAuth } = useSmartAuthStore();

  const [sharedBagEntries, setSharedBagEntries] = React.useState<
    SharedBagEntry[] | null
  >(null);

  // Hydrate persisted consumer Bag, Wishlist, Auth stores + live smart_app_settings
  useEffect(() => {
    hydrateCart();
    hydrateWishlist();
    hydrateAuth();
    setAppSettings(initialSettings);
    fetchSmartAppSettings().then((liveSettings) => {
      setAppSettings(liveSettings);
    });
  }, [
    initialSettings,
    setAppSettings,
    hydrateCart,
    hydrateWishlist,
    hydrateAuth,
  ]);

  // Handle WhatsApp / Social Product Deep-Link (?product=ITEM_ID)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const productIdParam = params.get("product");
    if (!productIdParam) return;

    const numId = Number(productIdParam);
    if (Number.isNaN(numId) || numId <= 0) return;

    const existing = initialItems.find((i) => i.item_id === numId);
    if (existing) {
      openProductDetail(existing);
      return;
    }

    const supabase = createClient();
    supabase
      .from("smart_items")
      .select("*, item_images(*)")
      .eq("item_id", numId)
      .eq("is_active", true)
      .single()
      .then(({ data }) => {
        if (data) {
          openProductDetail(data as unknown as ItemWithImages);
        }
      });
  }, [initialItems, openProductDetail]);

  // Handle Shareable Bag Deep-Link (?cart=itemId.qty_itemId.qty)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cartParam = params.get("cart");
    if (!cartParam) return;

    const decodedEntries = decodeCartShareParam(cartParam);
    // Clean ?cart= from the address bar immediately so refresh doesn't re-open modal
    try {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("cart");
      window.history.replaceState({}, "", cleanUrl.toString());
    } catch {}

    if (decodedEntries.length === 0) return;

    const itemIds = decodedEntries.map((d) => d.itemId);
    const supabase = createClient();
    const selectClause = appSettings.require_images
      ? "*, item_images!inner(*)"
      : "*, item_images(*)";

    let query = supabase
      .from("smart_items")
      .select(selectClause)
      .in("item_id", itemIds)
      .eq("is_active", true);

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

    query.then(({ data }) => {
      if (!data || !Array.isArray(data) || data.length === 0) return;
      const itemMap = new Map<number, ItemWithImages>();
      for (const row of data as unknown as ItemWithImages[]) {
        itemMap.set(Number(row.item_id), row);
      }

      const resolved: SharedBagEntry[] = [];
      for (const entry of decodedEntries) {
        const matched = itemMap.get(entry.itemId);
        if (matched) {
          resolved.push({
            item: matched,
            quantity: entry.quantity,
          });
        }
      }

      if (resolved.length > 0) {
        setSharedBagEntries(resolved);
      }
    });
  }, [appSettings.require_images, appSettings.hidden_categories]);

  const bagCount = getTotalUnitCount();
  const wishlistCount = wishlistItems.length;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-10">
      <SmartHeader
        categories={initialCategories}
        bagCount={bagCount}
        wishlistCount={wishlistCount}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {activeTab === "home" ? (
          <SmartHomeView
            categories={initialCategories}
            categoryThumbs={categoryThumbs}
            initialItems={initialItems}
            totalCatalogCount={totalCatalogCount}
            initialFlashDeals={initialFlashDeals}
            campaignTags={campaignTags}
            banners={banners}
            collectibleCoupons={collectibleCoupons}
          />
        ) : activeTab === "categories" ? (
          <SplitCategoryExplorer
            categories={initialCategories}
            initialItems={initialItems}
          />
        ) : activeTab === "deals" ? (
          <SmartDealsView initialFlashDeals={initialFlashDeals} />
        ) : activeTab === "bag" ? (
          <SmartBagView
            deliveryZones={deliveryZones}
            collectibleCoupons={collectibleCoupons}
            fallbackItems={initialItems}
          />
        ) : activeTab === "admin" ? (
          <SmartAdminDashboard
            categories={initialCategories}
            onRefreshStoreSettings={(updated) => setAppSettings(updated)}
          />
        ) : (
          <SmartMeView
            deliveryZones={deliveryZones}
            collectibleCoupons={collectibleCoupons}
          />
        )}
      </main>

      <SmartBottomNav bagCount={bagCount} />

      {/* Slide-Over Bag Drawer */}
      <SmartBagDrawer
        deliveryZones={deliveryZones}
        collectibleCoupons={collectibleCoupons}
      />

      {/* Global Product Detail Modal (PDP) */}
      <SmartProductDetailModal
        categories={initialCategories}
        deliveryZones={deliveryZones}
      />

      {/* Incoming Shared Bag Preview Modal (?cart=...) */}
      <SmartSharedBagModal
        entries={sharedBagEntries}
        onClose={() => setSharedBagEntries(null)}
      />
    </div>
  );
}
