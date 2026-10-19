import { create } from "zustand";
import { ItemWithImages } from "@/types/smart.types";
import { createClient } from "@/lib/supabase/client";

const WISHLIST_STORAGE_KEY = "bsmart_wishlist_v1";
const RECENTLY_VIEWED_STORAGE_KEY = "bsmart_recently_viewed_v1";
const DEVICE_ID_STORAGE_KEY = "bsmart_device_id_v1";

export function getOrCreateSmartDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "guest_device";
  }
}

function loadStoredItems(key: string): ItemWithImages[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ItemWithImages[]) : [];
  } catch {
    return [];
  }
}

function saveStoredItems(key: string, items: ItemWithImages[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

interface SmartWishlistState {
  wishlistItems: ItemWithImages[];
  recentlyViewedItems: ItemWithImages[];
  hydrated: boolean;
  hydrate: () => void;
  toggleWishlist: (item: ItemWithImages, customerId?: string | null) => Promise<boolean>;
  isInWishlist: (itemId: number) => boolean;
  addRecentlyViewed: (item: ItemWithImages) => void;
  clearRecentlyViewed: () => void;
}

export const useSmartWishlistStore = create<SmartWishlistState>((set, get) => ({
  wishlistItems: [],
  recentlyViewedItems: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const wish = loadStoredItems(WISHLIST_STORAGE_KEY);
    const recent = loadStoredItems(RECENTLY_VIEWED_STORAGE_KEY);
    set({
      wishlistItems: wish,
      recentlyViewedItems: recent,
      hydrated: true,
    });
  },

  isInWishlist: (itemId: number) => {
    return get().wishlistItems.some((i) => i.item_id === itemId);
  },

  toggleWishlist: async (item, customerId = null) => {
    const current = get().wishlistItems;
    const exists = current.some((i) => i.item_id === item.item_id);
    const updated = exists
      ? current.filter((i) => i.item_id !== item.item_id)
      : [item, ...current];

    saveStoredItems(WISHLIST_STORAGE_KEY, updated);
    set({ wishlistItems: updated });

    // Best-effort cloud sync to public.smart_wishlists
    try {
      const supabase = createClient();
      const deviceId = getOrCreateSmartDeviceId();
      if (exists) {
        let delQuery = supabase
          .from("smart_wishlists")
          .delete()
          .eq("item_id", item.item_id);
        if (customerId) {
          delQuery = delQuery.eq("customer_id", customerId);
        } else {
          delQuery = delQuery.eq("device_id", deviceId);
        }
        await delQuery;
      } else {
        await supabase.from("smart_wishlists").insert({
          customer_id: customerId || null,
          device_id: deviceId,
          item_id: item.item_id,
        });
      }
    } catch {
      // Offline resilient: local state is already updated
    }

    return !exists;
  },

  addRecentlyViewed: (item) => {
    const current = get().recentlyViewedItems.filter(
      (i) => i.item_id !== item.item_id
    );
    const updated = [item, ...current].slice(0, 24);
    saveStoredItems(RECENTLY_VIEWED_STORAGE_KEY, updated);
    set({ recentlyViewedItems: updated });
  },

  clearRecentlyViewed: () => {
    saveStoredItems(RECENTLY_VIEWED_STORAGE_KEY, []);
    set({ recentlyViewedItems: [] });
  },
}));
