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

export interface SmartNavSnapshot {
  activeTab: SmartMainTab;
  selectedClassId: number | null;
  selectedRoom: string | null;
  selectedMaterial: string | null;
  selectedTag: string | null;
  onSaleOnly: boolean;
  searchQuery: string;
}

interface BackHandlerEntry {
  id: string;
  handler: () => void;
}

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
  productHistory: ItemWithImages[];
  navHistory: SmartNavSnapshot[];
  backHandlers: BackHandlerEntry[];
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
  stepBackProductDetail: () => void;
  closeProductDetail: () => void;
  setBagDrawerOpen: (open: boolean) => void;
  setBarcodeModalOpen: (open: boolean) => void;
  setAppSettings: (settings: SmartAppSettings) => void;
  navigateToCategory: (classId: number | null) => void;
  navigateToDeals: () => void;
  resetFilters: () => void;
  registerBackHandler: (id: string, handler: () => void) => () => void;
  handleBackNavigation: () => boolean;
}

const RECENT_SEARCHES_KEY = "bsmart_recent_searches";
const MAX_NAV_HISTORY = 35;
const MAX_PRODUCT_HISTORY = 20;

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function pushBrowserHistoryGuard(): void {
  if (typeof window === "undefined") return;
  try {
    window.history.pushState(
      { bsmartNav: true, ts: Date.now() },
      "",
      window.location.href
    );
  } catch {}
}

function clearProductQueryParamFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("product")) {
      url.searchParams.delete("product");
      window.history.replaceState(
        window.history.state ?? { bsmartGuard: true },
        "",
        url.toString()
      );
    }
  } catch {}
}

function extractSnapshot(state: SmartNavState): SmartNavSnapshot {
  return {
    activeTab: state.activeTab,
    selectedClassId: state.selectedClassId,
    selectedRoom: state.selectedRoom,
    selectedMaterial: state.selectedMaterial,
    selectedTag: state.selectedTag,
    onSaleOnly: state.onSaleOnly,
    searchQuery: state.searchQuery,
  };
}

function isSameSnapshot(a: SmartNavSnapshot, b: SmartNavSnapshot): boolean {
  return (
    a.activeTab === b.activeTab &&
    a.selectedClassId === b.selectedClassId &&
    a.selectedRoom === b.selectedRoom &&
    a.selectedMaterial === b.selectedMaterial &&
    a.selectedTag === b.selectedTag &&
    a.onSaleOnly === b.onSaleOnly &&
    a.searchQuery.trim() === b.searchQuery.trim()
  );
}

function appendSnapshotIfChanged(
  currentState: SmartNavState,
  nextPartial: Partial<SmartNavSnapshot>
): SmartNavSnapshot[] {
  const currentSnap = extractSnapshot(currentState);
  const nextSnap: SmartNavSnapshot = {
    ...currentSnap,
    ...nextPartial,
  };

  if (isSameSnapshot(currentSnap, nextSnap)) {
    return currentState.navHistory;
  }

  pushBrowserHistoryGuard();

  const existing = currentState.navHistory;
  const last = existing[existing.length - 1];
  if (last && isSameSnapshot(last, currentSnap)) {
    return existing;
  }

  return [...existing.slice(-(MAX_NAV_HISTORY - 1)), currentSnap];
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
  productHistory: [],
  navHistory: [],
  backHandlers: [],
  isBagDrawerOpen: false,
  isBarcodeModalOpen: false,
  appSettings: DEFAULT_SMART_SETTINGS,
  recentSearches: loadRecentSearches(),

  setActiveTab: (tab) => {
    const state = get();
    const nextHistory = appendSnapshotIfChanged(state, { activeTab: tab });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    set({ activeTab: tab, navHistory: nextHistory });
  },

  setSearchQuery: (q) => {
    const state = get();
    const prevTrimmed = state.searchQuery.trim();
    const nextTrimmed = q.trim();
    // Push snapshot when transitioning from empty search to a non-empty search or clearing search
    if ((!prevTrimmed && nextTrimmed) || (prevTrimmed && !nextTrimmed)) {
      const nextHistory = appendSnapshotIfChanged(state, { searchQuery: q });
      set({ searchQuery: q, navHistory: nextHistory });
    } else {
      set({ searchQuery: q });
    }
  },

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

  setSelectedClassId: (classId) => {
    const state = get();
    const nextHistory = appendSnapshotIfChanged(state, {
      selectedClassId: classId,
      selectedTag: null,
      selectedRoom: null,
      selectedMaterial: null,
    });
    set({
      selectedClassId: classId,
      selectedTag: null,
      selectedRoom: null,
      selectedMaterial: null,
      navHistory: nextHistory,
    });
  },

  setSelectedRoom: (room) => {
    const state = get();
    const nextHistory = appendSnapshotIfChanged(state, { selectedRoom: room });
    set({ selectedRoom: room, navHistory: nextHistory });
  },

  setSelectedMaterial: (material) => {
    const state = get();
    const nextHistory = appendSnapshotIfChanged(state, {
      selectedMaterial: material,
    });
    set({ selectedMaterial: material, navHistory: nextHistory });
  },

  setSelectedTag: (tag) => {
    const state = get();
    const nextHistory = appendSnapshotIfChanged(state, { selectedTag: tag });
    set({ selectedTag: tag, navHistory: nextHistory });
  },

  setOnSaleOnly: (onSale) => {
    const state = get();
    const nextHistory = appendSnapshotIfChanged(state, { onSaleOnly: onSale });
    set({ onSaleOnly: onSale, navHistory: nextHistory });
  },

  setSortBy: (sort) => set({ sortBy: sort }),

  openProductDetail: (item) => {
    const state = get();
    if (state.selectedProduct?.item_id === item.item_id) return;
    pushBrowserHistoryGuard();
    const nextProductHistory = state.selectedProduct
      ? [
          ...state.productHistory.slice(-(MAX_PRODUCT_HISTORY - 1)),
          state.selectedProduct,
        ]
      : state.productHistory;
    set({
      selectedProduct: item,
      productHistory: nextProductHistory,
    });
  },

  stepBackProductDetail: () => {
    const state = get();
    if (state.productHistory.length > 0) {
      const prevProduct = state.productHistory[state.productHistory.length - 1];
      set({
        selectedProduct: prevProduct,
        productHistory: state.productHistory.slice(0, -1),
      });
    } else {
      clearProductQueryParamFromUrl();
      set({
        selectedProduct: null,
        productHistory: [],
      });
    }
  },

  closeProductDetail: () => {
    clearProductQueryParamFromUrl();
    set({
      selectedProduct: null,
      productHistory: [],
    });
  },

  setBagDrawerOpen: (open) => {
    if (open && !get().isBagDrawerOpen) {
      pushBrowserHistoryGuard();
    }
    set({ isBagDrawerOpen: open });
  },

  setBarcodeModalOpen: (open) => {
    if (open && !get().isBarcodeModalOpen) {
      pushBrowserHistoryGuard();
    }
    set({ isBarcodeModalOpen: open });
  },

  setAppSettings: (settings) => set({ appSettings: settings }),

  navigateToCategory: (classId) => {
    const state = get();
    const nextHistory = appendSnapshotIfChanged(state, {
      activeTab: "home",
      selectedClassId: classId,
      selectedTag: null,
      selectedRoom: null,
      selectedMaterial: null,
      onSaleOnly: false,
    });
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
      navHistory: nextHistory,
    });
  },

  navigateToDeals: () => {
    const state = get();
    const nextHistory = appendSnapshotIfChanged(state, {
      activeTab: "deals",
      onSaleOnly: true,
      selectedClassId: null,
    });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    set({
      activeTab: "deals",
      onSaleOnly: true,
      selectedClassId: null,
      navHistory: nextHistory,
    });
  },

  resetFilters: () => {
    const state = get();
    const nextHistory = appendSnapshotIfChanged(state, {
      searchQuery: "",
      selectedClassId: null,
      selectedRoom: null,
      selectedMaterial: null,
      selectedTag: null,
      onSaleOnly: false,
    });
    set({
      searchQuery: "",
      selectedClassId: null,
      selectedRoom: null,
      selectedMaterial: null,
      selectedTag: null,
      onSaleOnly: false,
      navHistory: nextHistory,
    });
  },

  registerBackHandler: (id, handler) => {
    set((state) => ({
      backHandlers: [
        ...state.backHandlers.filter((entry) => entry.id !== id),
        { id, handler },
      ],
    }));
    return () => {
      set((state) => ({
        backHandlers: state.backHandlers.filter((entry) => entry.id !== id),
      }));
    };
  },

  handleBackNavigation: () => {
    const state = get();

    // 1. Dismiss top-most component modal/overlay registered via useSmartBackGuard
    if (state.backHandlers.length > 0) {
      const topEntry = state.backHandlers[state.backHandlers.length - 1];
      topEntry.handler();
      return true;
    }

    // 2. Step back or close Product Detail Modal (PDP)
    if (state.selectedProduct) {
      if (state.productHistory.length > 0) {
        const prevProduct =
          state.productHistory[state.productHistory.length - 1];
        set({
          selectedProduct: prevProduct,
          productHistory: state.productHistory.slice(0, -1),
        });
      } else {
        clearProductQueryParamFromUrl();
        set({
          selectedProduct: null,
          productHistory: [],
        });
      }
      return true;
    }

    // 3. Close Slide-Over Bag Drawer
    if (state.isBagDrawerOpen) {
      set({ isBagDrawerOpen: false });
      return true;
    }

    // 4. Close Barcode Modal
    if (state.isBarcodeModalOpen) {
      set({ isBarcodeModalOpen: false });
      return true;
    }

    // 5. Pop previous Tab / Category / Filter snapshot from navHistory
    if (state.navHistory.length > 0) {
      const prevSnap = state.navHistory[state.navHistory.length - 1];
      if (
        typeof window !== "undefined" &&
        (prevSnap.activeTab !== state.activeTab ||
          prevSnap.selectedClassId !== state.selectedClassId)
      ) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
      set({
        activeTab: prevSnap.activeTab,
        selectedClassId: prevSnap.selectedClassId,
        selectedRoom: prevSnap.selectedRoom,
        selectedMaterial: prevSnap.selectedMaterial,
        selectedTag: prevSnap.selectedTag,
        onSaleOnly: prevSnap.onSaleOnly,
        searchQuery: prevSnap.searchQuery,
        navHistory: state.navHistory.slice(0, -1),
      });
      return true;
    }

    // 6. Fallback: if on any non-Home tab or any filter is active, return to unfiltered Home tab
    const hasFilters =
      state.selectedClassId !== null ||
      Boolean(state.selectedRoom) ||
      Boolean(state.selectedMaterial) ||
      Boolean(state.selectedTag) ||
      state.onSaleOnly ||
      Boolean(state.searchQuery.trim());

    if (state.activeTab !== "home" || hasFilters) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
      set({
        activeTab: "home",
        selectedClassId: null,
        selectedRoom: null,
        selectedMaterial: null,
        selectedTag: null,
        onSaleOnly: false,
        searchQuery: "",
      });
      return true;
    }

    return false;
  },
}));
