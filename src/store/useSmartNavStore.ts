import { create } from "zustand";
import { ItemWithImages, SmartAppSettings } from "@/types/smart.types";
import { DEFAULT_SMART_SETTINGS } from "@/lib/smartSettings";

export type SmartMainTab = "home" | "categories" | "deals" | "bag" | "me" | "admin";

export type SmartSortOption =
  | "image_desc"
  | "discount_desc"
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc";

interface SmartNavState {
  activeTab: SmartMainTab;
  searchQuery: string;
  selectedClassId: number | null;
  selectedRoom: string | null;
  selectedMaterial: string | null;
  selectedTag: string | null;
  onSaleOnly: boolean;
  sortBy: SmartSortOption;
  selectedProduct: ItemWithImages | null;
  isBagDrawerOpen: boolean;
  isBarcodeModalOpen: boolean;
  appSettings: SmartAppSettings;
  recentSearches: string[];
  setActiveTab: (tab: SmartMainTab) => void;
  setSearchQuery: (q: string) => void;
  addRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
  setSelectedClassId: (classId: number | null) => void;
  setSelectedRoom: (room: string | null) => void;
  setSelectedMaterial: (material: string | null) => void;
  setSelectedTag: (tag: string | null) => void;
  setOnSaleOnly: (onSale: boolean) => void;
  setSortBy: (sort: SmartSortOption) => void;
  openProductDetail: (item: ItemWithImages) => void;
  closeProductDetail: () => void;
  setBagDrawerOpen: (open: boolean) => void;
  setBarcodeModalOpen: (open: boolean) => void;
  setAppSettings: (settings: SmartAppSettings) => void;
  navigateToCategory: (classId: number | null) => void;
  navigateToDeals: () => void;
  resetFilters: () => void;
}

const RECENT_SEARCHES_KEY = "bsmart_recent_searches";

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const useSmartNavStore = create<SmartNavState>((set, get) => ({
  activeTab: "home",
  searchQuery: "",
  selectedClassId: null,
  selectedRoom: null,
  selectedMaterial: null,
  selectedTag: null,
  onSaleOnly: false,
  sortBy: "image_desc",
  selectedProduct: null,
  isBagDrawerOpen: false,
  isBarcodeModalOpen: false,
  appSettings: DEFAULT_SMART_SETTINGS,
  recentSearches: loadRecentSearches(),

  setActiveTab: (tab) => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    set({ activeTab: tab });
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  addRecentSearch: (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const current = get().recentSearches.filter(
      (item) => item.toLowerCase() !== trimmed.toLowerCase()
    );
    const updated = [trimmed, ...current].slice(0, 8);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {}
    }
    set({ recentSearches: updated });
  },

  clearRecentSearches: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(RECENT_SEARCHES_KEY);
      } catch {}
    }
    set({ recentSearches: [] });
  },

  setSelectedClassId: (classId) =>
    set({
      selectedClassId: classId,
      selectedTag: null,
      selectedRoom: null,
      selectedMaterial: null,
    }),

  setSelectedRoom: (room) => set({ selectedRoom: room }),
  setSelectedMaterial: (material) => set({ selectedMaterial: material }),
  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setOnSaleOnly: (onSale) => set({ onSaleOnly: onSale }),
  setSortBy: (sort) => set({ sortBy: sort }),

  openProductDetail: (item) => set({ selectedProduct: item }),
  closeProductDetail: () => set({ selectedProduct: null }),

  setBagDrawerOpen: (open) => set({ isBagDrawerOpen: open }),
  setBarcodeModalOpen: (open) => set({ isBarcodeModalOpen: open }),
  setAppSettings: (settings) => set({ appSettings: settings }),

  navigateToCategory: (classId) => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    set({
      activeTab: "home",
      selectedClassId: classId,
      selectedTag: null,
      selectedRoom: null,
      selectedMaterial: null,
      onSaleOnly: false,
    });
  },

  navigateToDeals: () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    set({
      activeTab: "deals",
      onSaleOnly: true,
      selectedClassId: null,
    });
  },

  resetFilters: () =>
    set({
      searchQuery: "",
      selectedClassId: null,
      selectedRoom: null,
      selectedMaterial: null,
      selectedTag: null,
      onSaleOnly: false,
    }),
}));
