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
import { useSmartCartStore } from "@/store/useSmartCartStore";
import { useSmartWishlistStore } from "@/store/useSmartWishlistStore";
import { useSmartAuthStore } from "@/store/useSmartAuthStore";
import { SmartHeader } from "@/components/layout/SmartHeader";
import { SmartBottomNav } from "@/components/layout/SmartBottomNav";
import { SmartHomeView } from "@/components/home/SmartHomeView";
import { SplitCategoryExplorer } from "@/components/category/SplitCategoryExplorer";
import { SmartDealsView } from "@/components/deals/SmartDealsView";
import { SmartBagView } from "@/components/bag/SmartBagView";
import { SmartBagDrawer } from "@/components/bag/SmartBagDrawer";
import { SmartMeView } from "@/components/profile/SmartMeView";
import { SmartAdminDashboard } from "@/components/admin/SmartAdminDashboard";
import { SmartProductDetailModal } from "@/components/product/SmartProductDetailModal";
import { fetchSmartAppSettings } from "@/lib/smartSettings";
import { createClient } from "@/lib/supabase/client";

interface SmartAppShellProps {
  initialCategories: ItemClass[];
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
    </div>
  );
}
