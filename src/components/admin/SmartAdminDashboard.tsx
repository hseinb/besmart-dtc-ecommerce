"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Package,
  TicketPercent,
  Truck,
  Image as ImageIcon,
  Users,
  Settings,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Check,
  Share2,
  ShieldCheck,
  ArrowLeft,
  Save,
  DollarSign,
  Tag,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  LogOut,
  KeyRound,
  UserPlus,
  Loader2,
  Printer,
  FileText,
  PackageCheck,
  Sparkles,
  Download,
} from "lucide-react";
import {
  ItemClass,
  ItemWithImages,
  SmartAppSettings,
  SmartBanner,
  SmartCoupon,
  SmartCustomer,
  SmartDeliveryZone,
  SmartOrder,
  SmartOrderStatus,
  SmartPriceRoundingMode,
  SmartPricingRule,
  SmartStaffRole,
  SmartStaffUser,
} from "@/types/smart.types";
import { createClient } from "@/lib/supabase/client";
import { useSmartNavStore } from "@/store/useSmartNavStore";
import { useSmartAuthStore } from "@/store/useSmartAuthStore";
import { SmartOrderTrackerModal } from "@/components/orders/SmartOrderTrackerModal";
import {
  SmartOrderPrintModal,
  PrintDocMode,
} from "@/components/admin/SmartOrderPrintModal";
import { SmartCreatorShareModal } from "@/components/product/SmartCreatorShareModal";
import { getItemImageUrl, getItemCreatorGallerySlots } from "@/lib/media";

type AdminSubTab =
  | "orders"
  | "pricing"
  | "catalog"
  | "coupons"
  | "banners"
  | "zones"
  | "customers"
  | "staff"
  | "settings";

interface SmartAdminDashboardProps {
  categories: ItemClass[];
  onRefreshStoreSettings?: (updated: SmartAppSettings) => void;
}

export function SmartAdminDashboard({
  categories,
  onRefreshStoreSettings,
}: SmartAdminDashboardProps) {
  const { appSettings, setAppSettings, setActiveTab } = useSmartNavStore();
  const {
    staffUser,
    isLoadingAuth,
    signInUnified,
    signInStaff,
    signOutStaff,
  } = useSmartAuthStore();

  // Staff Login Gate Form State
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [subTab, setSubTab] = useState<AdminSubTab>("orders");
  const [isLoading, setIsLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 1. Orders State
  const [orders, setOrders] = useState<SmartOrder[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    SmartOrderStatus | "ALL"
  >("ALL");
  const [selectedOrderModal, setSelectedOrderModal] =
    useState<SmartOrder | null>(null);
  const [printOrderModal, setPrintOrderModal] = useState<{
    order: SmartOrder;
    mode: PrintDocMode;
  } | null>(null);

  // 2. Pricing & Markup Rules State
  const [pricingRules, setPricingRules] = useState<Record<number, SmartPricingRule>>({});
  const [ruleSearch, setRuleSearch] = useState("");
  const [globalMarkupDraft, setGlobalMarkupDraft] = useState<string>(
    String(appSettings.default_markup_percent ?? 0)
  );
  const [roundingModeDraft, setRoundingModeDraft] = useState<SmartPriceRoundingMode>(
    appSettings.price_rounding_mode ?? "none"
  );
  const [isRecalculatingGlobal, setIsRecalculatingGlobal] = useState(false);
  const [savingRuleClassId, setSavingRuleClassId] = useState<number | null>(null);

  // 3. B2C Catalog & Item Overrides State (public.smart_items)
  const [catalogItems, setCatalogItems] = useState<ItemWithImages[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<
    "ALL" | "CUSTOM_PRICE" | "HIDDEN" | "ON_SALE"
  >("ALL");
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [itemEdits, setItemEdits] = useState<
    Record<number, { srp: string; discount: string }>
  >({});
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [creatorShareItem, setCreatorShareItem] =
    useState<ItemWithImages | null>(null);

  // 4. Coupons State
  const [coupons, setCoupons] = useState<SmartCoupon[]>([]);
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponTitle, setNewCouponTitle] = useState("");
  const [newCouponType, setNewCouponType] = useState<
    "percentage" | "fixed" | "free_shipping"
  >("percentage");
  const [newCouponValue, setNewCouponValue] = useState("10");
  const [newCouponMinOrder, setNewCouponMinOrder] = useState("25");
  const [newCouponPublic, setNewCouponPublic] = useState(true);

  // 5. Delivery Zones State
  const [zones, setZones] = useState<SmartDeliveryZone[]>([]);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneFee, setNewZoneFee] = useState("3");
  const [newZoneEta, setNewZoneEta] = useState("24 - 48 Hours");

  // 6. Banners State
  const [banners, setBanners] = useState<SmartBanner[]>([]);
  const [newBannerTitle, setNewBannerTitle] = useState("");
  const [newBannerSubtitle, setNewBannerSubtitle] = useState("");
  const [newBannerImage, setNewBannerImage] = useState("");
  const [newBannerBadge, setNewBannerBadge] = useState("");

  // 7. Customers State
  const [customers, setCustomers] = useState<SmartCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");

  // 8. Staff RBAC State (public.smart_users)
  const [staffList, setStaffList] = useState<SmartStaffUser[]>([]);
  const [newStaffUsername, setNewStaffUsername] = useState("");
  const [newStaffFullName, setNewStaffFullName] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<SmartStaffRole>("merchandising");
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [isSavingStaff, setIsSavingStaff] = useState(false);

  // 9. Storefront Settings Draft
  const [settingsDraft, setSettingsDraft] =
    useState<SmartAppSettings>(appSettings);

  const isAdminRole = staffUser?.role === "admin";
  const isContentCreatorRole = staffUser?.role === "content_creator";
  const canManageCatalog =
    isAdminRole || staffUser?.role === "merchandising";
  const canViewCatalog =
    canManageCatalog || isContentCreatorRole;

  useEffect(() => {
    setSettingsDraft(appSettings);
    setGlobalMarkupDraft(String(appSettings.default_markup_percent ?? 0));
    setRoundingModeDraft(appSettings.price_rounding_mode ?? "none");
  }, [appSettings]);

  // Ensure default subTab matches the signed-in staff member's RBAC permissions
  useEffect(() => {
    if (!staffUser) return;
    if (staffUser.role === "merchandising" && subTab === "orders") {
      setSubTab("pricing");
    } else if (staffUser.role === "fulfillment" && subTab !== "orders") {
      setSubTab("orders");
    } else if (staffUser.role === "content_creator" && subTab !== "catalog") {
      setSubTab("catalog");
    }
  }, [staffUser, subTab]);

  const showToast = (msg: string) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const canAccessTab = useCallback(
    (tabId: AdminSubTab): boolean => {
      if (!staffUser) return false;
      if (staffUser.role === "admin") return true;
      if (staffUser.role === "merchandising") {
        return ["pricing", "catalog", "coupons", "banners"].includes(tabId);
      }
      if (staffUser.role === "content_creator") {
        return tabId === "catalog";
      }
      if (staffUser.role === "fulfillment") {
        return tabId === "orders";
      }
      return false;
    },
    [staffUser]
  );

  const loadCatalogOverrides = useCallback(async () => {
    setIsLoadingCatalog(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from("smart_items")
        .select("*, item_images(*)");

      const q = catalogSearch.trim();
      if (q) {
        query = query.or(
          `item_name.ilike.%${q}%,code.ilike.%${q}%,upc.ilike.%${q}%`
        );
      }
      if (catalogFilter === "CUSTOM_PRICE") {
        query = query.eq("is_custom_price", true);
      } else if (catalogFilter === "HIDDEN") {
        query = query.eq("is_b2c_hidden", true);
      } else if (catalogFilter === "ON_SALE") {
        query = query.gt("discount", 0);
      }

      const { data } = await query
        .order("image_updated_at", { ascending: false, nullsFirst: false })
        .limit(60);

      const rows = (data as unknown as ItemWithImages[]) || [];
      setCatalogItems(rows);

      const edits: Record<number, { srp: string; discount: string }> = {};
      for (const r of rows) {
        edits[r.item_id] = {
          srp: Number(r.srp || 0).toFixed(2),
          discount: Number(r.discount || 0).toFixed(1),
        };
      }
      setItemEdits(edits);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [catalogSearch, catalogFilter]);

  const loadStaffAccounts = useCallback(async () => {
    if (!staffUser || staffUser.role !== "admin") return;
    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "smart_admin_list_staff_users",
      {
        p_staff_user_id: staffUser.user_id,
      }
    );
    if (!error && data) {
      const res = data as {
        success?: boolean;
        users?: SmartStaffUser[];
        staff?: SmartStaffUser[];
      };
      if (Array.isArray(data)) {
        setStaffList(data as SmartStaffUser[]);
        return;
      }
      if (res.users) {
        setStaffList(res.users);
        return;
      }
      if (res.staff) {
        setStaffList(res.staff);
        return;
      }
    }

    const fallback = await supabase.rpc("smart_list_staff", {
      p_admin_user_id: staffUser.user_id,
    });
    const fallbackRes = fallback.data as {
      success: boolean;
      staff?: SmartStaffUser[];
    } | null;
    if (fallbackRes?.success && fallbackRes.staff) {
      setStaffList(fallbackRes.staff);
    }
  }, [staffUser]);

  const loadAdminData = useCallback(async () => {
    if (!staffUser) return;
    setIsLoading(true);
    try {
      const supabase = createClient();
      const [
        ordersRes,
        couponsRes,
        zonesRes,
        bannersRes,
        custRes,
        rulesRes,
      ] = await Promise.all([
        supabase
          .from("smart_orders")
          .select("*")
          .order("created_date", { ascending: false })
          .limit(100),
        supabase
          .from("smart_coupons")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("smart_delivery_zones")
          .select("*")
          .order("display_order", { ascending: true }),
        supabase
          .from("smart_banners")
          .select("*")
          .order("display_order", { ascending: true }),
        supabase
          .from("smart_customers")
          .select(
            "customer_id, phone, full_name, email, role, is_verified, is_active, created_at, last_login_at"
          )
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("smart_pricing_rules").select("*"),
      ]);

      if (ordersRes.data) setOrders(ordersRes.data as SmartOrder[]);
      if (couponsRes.data) setCoupons(couponsRes.data as SmartCoupon[]);
      if (zonesRes.data) setZones(zonesRes.data as SmartDeliveryZone[]);
      if (bannersRes.data) setBanners(bannersRes.data as SmartBanner[]);
      if (custRes.data) setCustomers(custRes.data as SmartCustomer[]);
      if (rulesRes.data) {
        const map: Record<number, SmartPricingRule> = {};
        for (const r of rulesRes.data as SmartPricingRule[]) {
          map[r.class_id] = r;
        }
        setPricingRules(map);
      }

      await Promise.all([loadCatalogOverrides(), loadStaffAccounts()]);
    } finally {
      setIsLoading(false);
    }
  }, [staffUser, loadCatalogOverrides, loadStaffAccounts]);

  useEffect(() => {
    if (staffUser) {
      loadAdminData();
    }
  }, [staffUser, loadAdminData]);

  useEffect(() => {
    if (staffUser && subTab === "catalog") {
      loadCatalogOverrides();
    }
  }, [staffUser, subTab, catalogSearch, catalogFilter, loadCatalogOverrides]);

  // --- Unified Sign-In Handler ---
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const res = await signInUnified(loginUsername, loginPassword);
    if (!res.success) {
      setLoginError(res.errorMessage || "Invalid credentials.");
    } else {
      setLoginPassword("");
      if (res.accountType === "customer") {
        setActiveTab("me");
      }
    }
  };

  // --- Orders Actions (Strictly updates smart_orders ONLY — never touches public.orders) ---
  const handleUpdateOrderStatus = async (
    orderId: number,
    nextStatus: SmartOrderStatus
  ) => {
    if (!staffUser) return;
    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "smart_admin_update_order_status",
      {
        p_staff_user_id: staffUser.user_id,
        p_order_id: orderId,
        p_status: nextStatus,
      }
    );

    const res = data as {
      success: boolean;
      order?: SmartOrder;
      error?: string;
    } | null;

    if (!error && res?.success && res.order) {
      const updated = res.order;
      setOrders((prev) =>
        prev.map((o) => (o.order_id === orderId ? updated : o))
      );
      setPrintOrderModal((prev) =>
        prev && prev.order.order_id === orderId
          ? { ...prev, order: updated }
          : prev
      );
      showToast(`B's Mart order status updated to ${nextStatus}`);
    } else {
      showToast(
        res?.error || error?.message || "Failed to update order status"
      );
    }
  };

  // --- Global & Category B2C Pricing Rules Actions ---
  const handleSaveGlobalPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffUser) return;
    setIsRecalculatingGlobal(true);
    try {
      const supabase = createClient();
      const markupVal = Number(globalMarkupDraft) || 0;

      const { data, error } = await supabase.rpc(
        "smart_admin_update_global_pricing",
        {
          p_staff_user_id: staffUser.user_id,
          p_default_markup_percent: markupVal,
          p_price_rounding_mode: roundingModeDraft,
        }
      );

      const res = data as {
        success: boolean;
        settings?: Partial<SmartAppSettings>;
        error?: string;
      } | null;

      if (!error && res?.success) {
        const updated: SmartAppSettings = {
          ...appSettings,
          ...(res.settings || {}),
          default_markup_percent: markupVal,
          price_rounding_mode: roundingModeDraft,
        };
        setAppSettings(updated);
        onRefreshStoreSettings?.(updated);
        await loadCatalogOverrides();
        showToast(
          `Global markup (${markupVal}%) & rounding applied to smart_items!`
        );
      } else {
        showToast(
          res?.error || error?.message || "Failed to save global pricing"
        );
      }
    } finally {
      setIsRecalculatingGlobal(false);
    }
  };

  const handleSaveCategoryRule = async (
    classId: number,
    ruleDraft: SmartPricingRule
  ) => {
    if (!staffUser) return;
    setSavingRuleClassId(classId);
    try {
      const supabase = createClient();
      const markupPercent =
        ruleDraft.markup_percent === null ||
        Number.isNaN(Number(ruleDraft.markup_percent))
          ? null
          : Number(ruleDraft.markup_percent);
      const fixedMarkupAddon = Number(ruleDraft.fixed_markup_addon) || 0;
      const defaultB2cDiscount = Number(ruleDraft.default_b2c_discount) || 0;
      const isB2cEnabled =
        ruleDraft.is_b2c_enabled !== undefined
          ? Boolean(ruleDraft.is_b2c_enabled)
          : true;

      const { data, error } = await supabase.rpc(
        "smart_admin_upsert_pricing_rule",
        {
          p_staff_user_id: staffUser.user_id,
          p_class_id: classId,
          p_markup_percent: markupPercent,
          p_fixed_markup_addon: fixedMarkupAddon,
          p_default_b2c_discount: defaultB2cDiscount,
          p_is_b2c_enabled: isB2cEnabled,
        }
      );

      const res = data as {
        success: boolean;
        rule?: SmartPricingRule;
        error?: string;
      } | null;

      if (!error && res?.success) {
        const updatedRule: SmartPricingRule = res.rule || {
          class_id: classId,
          markup_percent: markupPercent,
          fixed_markup_addon: fixedMarkupAddon,
          default_b2c_discount: defaultB2cDiscount,
          is_b2c_enabled: isB2cEnabled,
        };
        setPricingRules((prev) => ({
          ...prev,
          [classId]: updatedRule,
        }));
        showToast("Category pricing rule saved & items recalculated!");
      } else {
        showToast(
          res?.error || error?.message || "Failed to save category rule"
        );
      }
    } finally {
      setSavingRuleClassId(null);
    }
  };

  // --- B2C Catalog Item Override Actions ---
  const handleSaveItemOverride = async (item: ItemWithImages) => {
    if (!staffUser) return;
    const draft = itemEdits[item.item_id];
    if (!draft) return;

    setSavingItemId(item.item_id);
    try {
      const supabase = createClient();
      const newSrp = Math.max(0, Number(draft.srp) || 0);
      const newDiscount = Math.min(95, Math.max(0, Number(draft.discount) || 0));

      const priceChanged = Math.abs(newSrp - Number(item.srp)) > 0.005;
      const discountChanged =
        Math.abs(newDiscount - Number(item.discount)) > 0.05;

      const { data, error } = await supabase.rpc(
        "smart_admin_update_item_override",
        {
          p_staff_user_id: staffUser.user_id,
          p_item_id: item.item_id,
          p_srp: newSrp,
          p_discount: newDiscount,
          p_is_custom_price: priceChanged
            ? true
            : Boolean(item.is_custom_price),
          p_is_custom_discount: discountChanged
            ? true
            : Boolean(item.is_custom_discount),
          p_is_b2c_hidden: Boolean(item.is_b2c_hidden),
        }
      );

      const res = data as {
        success: boolean;
        item?: ItemWithImages;
        error?: string;
      } | null;

      if (!error && res?.success && res.item) {
        const updated: ItemWithImages = {
          ...item,
          ...res.item,
          item_images: res.item.item_images ?? item.item_images,
        };
        setCatalogItems((prev) =>
          prev.map((i) => (i.item_id === item.item_id ? updated : i))
        );
        setItemEdits((prev) => ({
          ...prev,
          [item.item_id]: {
            srp: Number(updated.srp).toFixed(2),
            discount: Number(updated.discount).toFixed(1),
          },
        }));
        showToast(`Saved B2C override for SKU ${item.code}`);
      } else {
        showToast(
          res?.error || error?.message || "Failed to save item override"
        );
      }
    } finally {
      setSavingItemId(null);
    }
  };

  const handleUnlockItemAutoPricing = async (item: ItemWithImages) => {
    if (!staffUser) return;
    setSavingItemId(item.item_id);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "smart_admin_update_item_override",
        {
          p_staff_user_id: staffUser.user_id,
          p_item_id: item.item_id,
          p_srp: Number(item.srp) || 0,
          p_discount: Number(item.discount) || 0,
          p_is_custom_price: false,
          p_is_custom_discount: false,
          p_is_b2c_hidden: Boolean(item.is_b2c_hidden),
        }
      );

      const res = data as {
        success: boolean;
        item?: ItemWithImages;
        error?: string;
      } | null;

      if (!error && res?.success && res.item) {
        const updated: ItemWithImages = {
          ...item,
          ...res.item,
          item_images: res.item.item_images ?? item.item_images,
        };
        setCatalogItems((prev) =>
          prev.map((i) => (i.item_id === item.item_id ? updated : i))
        );
        setItemEdits((prev) => ({
          ...prev,
          [item.item_id]: {
            srp: Number(updated.srp).toFixed(2),
            discount: Number(updated.discount).toFixed(1),
          },
        }));
        showToast(`Restored automatic markup formula for SKU ${item.code}`);
      } else {
        showToast(
          res?.error || error?.message || "Failed to unlock auto-pricing"
        );
      }
    } finally {
      setSavingItemId(null);
    }
  };

  const handleToggleItemB2CHidden = async (item: ItemWithImages) => {
    if (!staffUser) return;
    setSavingItemId(item.item_id);
    try {
      const supabase = createClient();
      const nextHidden = !item.is_b2c_hidden;
      const { data, error } = await supabase.rpc(
        "smart_admin_update_item_override",
        {
          p_staff_user_id: staffUser.user_id,
          p_item_id: item.item_id,
          p_srp: Number(item.srp) || 0,
          p_discount: Number(item.discount) || 0,
          p_is_custom_price: Boolean(item.is_custom_price),
          p_is_custom_discount: Boolean(item.is_custom_discount),
          p_is_b2c_hidden: nextHidden,
        }
      );

      const res = data as {
        success: boolean;
        item?: ItemWithImages;
        error?: string;
      } | null;

      if (!error && res?.success && res.item) {
        const updated: ItemWithImages = {
          ...item,
          ...res.item,
          item_images: res.item.item_images ?? item.item_images,
        };
        setCatalogItems((prev) =>
          prev.map((i) => (i.item_id === item.item_id ? updated : i))
        );
        showToast(
          nextHidden
            ? `Hidden ${item.code} from B's Mart B2C storefront`
            : `Restored ${item.code} to B's Mart B2C storefront`
        );
      } else {
        showToast(
          res?.error || error?.message || "Failed to update visibility"
        );
      }
    } finally {
      setSavingItemId(null);
    }
  };

  // --- Coupons Actions ---
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCouponCode.trim().toUpperCase();
    if (!code || !newCouponTitle.trim()) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("smart_coupons")
      .insert({
        code,
        title: newCouponTitle.trim(),
        discount_type: newCouponType,
        discount_value:
          newCouponType === "free_shipping" ? 0 : Number(newCouponValue) || 0,
        min_order_amount: Number(newCouponMinOrder) || 0,
        is_public_collectible: newCouponPublic,
        is_active: true,
      })
      .select("*")
      .single();

    if (!error && data) {
      setCoupons((prev) => [data as SmartCoupon, ...prev]);
      setNewCouponCode("");
      setNewCouponTitle("");
      showToast(`Created promo code ${code}`);
    }
  };

  const handleToggleCouponActive = async (coupon: SmartCoupon) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("smart_coupons")
      .update({ is_active: !coupon.is_active })
      .eq("coupon_id", coupon.coupon_id)
      .select("*")
      .single();

    if (data) {
      setCoupons((prev) =>
        prev.map((c) =>
          c.coupon_id === coupon.coupon_id ? (data as SmartCoupon) : c
        )
      );
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    const supabase = createClient();
    await supabase.from("smart_coupons").delete().eq("coupon_id", couponId);
    setCoupons((prev) => prev.filter((c) => c.coupon_id !== couponId));
    showToast("Coupon deleted");
  };

  // --- Delivery Zones Actions ---
  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("smart_delivery_zones")
      .insert({
        zone_name: newZoneName.trim(),
        delivery_fee: Number(newZoneFee) || 0,
        estimated_delivery: newZoneEta.trim() || "24 - 48 Hours",
        is_active: true,
        display_order: zones.length + 1,
      })
      .select("*")
      .single();

    if (data) {
      setZones((prev) => [...prev, data as SmartDeliveryZone]);
      setNewZoneName("");
      showToast("Delivery zone added");
    }
  };

  const handleUpdateZoneFee = async (
    zone: SmartDeliveryZone,
    newFee: number,
    newActive: boolean
  ) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("smart_delivery_zones")
      .update({
        delivery_fee: Math.max(0, newFee),
        is_active: newActive,
      })
      .eq("zone_id", zone.zone_id)
      .select("*")
      .single();

    if (data) {
      setZones((prev) =>
        prev.map((z) =>
          z.zone_id === zone.zone_id ? (data as SmartDeliveryZone) : z
        )
      );
      showToast(`Updated ${zone.zone_name}`);
    }
  };

  // --- Banners Actions ---
  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBannerTitle.trim() || !newBannerImage.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("smart_banners")
      .insert({
        title: newBannerTitle.trim(),
        subtitle: newBannerSubtitle.trim() || null,
        image_url: newBannerImage.trim(),
        badge_text: newBannerBadge.trim() || null,
        action_type: "deals",
        display_order: banners.length + 1,
        is_active: true,
      })
      .select("*")
      .single();

    if (data) {
      setBanners((prev) => [...prev, data as SmartBanner]);
      setNewBannerTitle("");
      setNewBannerSubtitle("");
      setNewBannerImage("");
      setNewBannerBadge("");
      showToast("Hero banner added");
    }
  };

  const handleDeleteBanner = async (id: string) => {
    const supabase = createClient();
    await supabase.from("smart_banners").delete().eq("id", id);
    setBanners((prev) => prev.filter((b) => b.id !== id));
    showToast("Banner removed");
  };

  // --- Staff RBAC Management Actions ---
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffUser) return;
    setStaffFormError(null);
    setIsSavingStaff(true);

    try {
      const supabase = createClient();
      let { data, error } = await supabase.rpc(
        "smart_admin_upsert_staff_user",
        {
          p_staff_user_id: staffUser.user_id,
          p_username: newStaffUsername.trim(),
          p_full_name: newStaffFullName.trim(),
          p_role: newStaffRole,
          p_password: newStaffPassword,
          p_is_active: true,
        }
      );

      if (error) {
        const fallback = await supabase.rpc("smart_admin_upsert_staff", {
          p_admin_user_id: staffUser.user_id,
          p_target_user_id: null,
          p_username: newStaffUsername.trim(),
          p_password: newStaffPassword,
          p_full_name: newStaffFullName.trim(),
          p_role: newStaffRole,
          p_is_active: true,
        });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        setStaffFormError(error.message);
        return;
      }

      const res = data as {
        success: boolean;
        error?: string;
        user?: SmartStaffUser;
      } | null;

      if (!res?.success) {
        setStaffFormError(res?.error || "Could not create staff user.");
        return;
      }

      const createdUsername = res.user?.username || newStaffUsername.trim();
      const createdRole = res.user?.role || newStaffRole;
      setNewStaffUsername("");
      setNewStaffFullName("");
      setNewStaffPassword("");
      await loadStaffAccounts();
      showToast(`Created staff account @${createdUsername} (${createdRole})`);
    } finally {
      setIsSavingStaff(false);
    }
  };

  const handleUpdateStaffMember = async (
    member: SmartStaffUser,
    nextRole: SmartStaffRole,
    nextActive: boolean
  ) => {
    if (!staffUser) return;
    const supabase = createClient();
    let { data, error } = await supabase.rpc("smart_admin_upsert_staff_user", {
      p_staff_user_id: staffUser.user_id,
      p_username: member.username,
      p_full_name: member.full_name,
      p_role: nextRole,
      p_password: null,
      p_is_active: nextActive,
    });

    if (error) {
      const fallback = await supabase.rpc("smart_admin_upsert_staff", {
        p_admin_user_id: staffUser.user_id,
        p_target_user_id: member.user_id,
        p_username: member.username,
        p_password: null,
        p_full_name: member.full_name,
        p_role: nextRole,
        p_is_active: nextActive,
      });
      data = fallback.data;
    }

    const res = data as { success: boolean; error?: string } | null;
    if (res?.success) {
      await loadStaffAccounts();
      showToast(`Updated @${member.username}`);
    }
  };

  // --- Storefront Settings Actions ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffUser) return;
    const supabase = createClient();
    const payload = {
      hide_out_of_stock: settingsDraft.hide_out_of_stock,
      hide_stock_qty: settingsDraft.hide_stock_qty,
      require_images: settingsDraft.require_images,
      default_sort: settingsDraft.default_sort,
      hidden_categories: settingsDraft.hidden_categories,
      free_shipping_threshold:
        Number(settingsDraft.free_shipping_threshold) || 0,
      default_delivery_fee: Number(settingsDraft.default_delivery_fee) || 0,
      flash_sale_title: settingsDraft.flash_sale_title || "FLASH SALE",
      flash_sale_ends_at: settingsDraft.flash_sale_ends_at || null,
      enable_cod: settingsDraft.enable_cod,
      enable_whish: settingsDraft.enable_whish,
      enable_omt: settingsDraft.enable_omt,
      enable_card_pos: settingsDraft.enable_card_pos,
      whatsapp_support_phone: settingsDraft.whatsapp_support_phone || "",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.rpc(
      "smart_admin_update_app_settings",
      {
        p_staff_user_id: staffUser.user_id,
        p_payload: payload,
      }
    );

    const res = data as {
      success: boolean;
      settings?: Partial<SmartAppSettings>;
      error?: string;
    } | null;

    if (!error && res?.success) {
      const updated = {
        ...settingsDraft,
        ...payload,
        ...(res.settings || {}),
      };
      setAppSettings(updated);
      onRefreshStoreSettings?.(updated);
      showToast("B's Mart Storefront Settings saved!");
    } else {
      showToast(res?.error || error?.message || "Failed to save settings");
    }
  };

  const toggleHiddenCategory = (classId: number) => {
    const current = new Set(settingsDraft.hidden_categories || []);
    if (current.has(classId)) {
      current.delete(classId);
    } else {
      current.add(classId);
    }
    setSettingsDraft({
      ...settingsDraft,
      hidden_categories: Array.from(current),
    });
  };

  // ==========================================================================
  // UNAUTHENTICATED FALLBACK GATE
  // ==========================================================================
  if (!staffUser) {
    return (
      <div className="max-w-md mx-auto my-8 sm:my-14">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-smart-teal-deep via-smart-teal to-[#0077A8] p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-smart-gold text-slate-950 text-[10px] font-black uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                B&apos;s Mart Account
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("home")}
                className="text-xs font-bold text-white/80 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Storefront</span>
              </button>
            </div>
            <h1 className="text-xl font-black tracking-tight">Sign In</h1>
            <p className="text-xs text-white/80 mt-1">
              Sign in with your phone number or username to access your account.
            </p>
          </div>

          <form onSubmit={handleStaffLogin} className="p-6 space-y-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                Phone Number or Username
              </label>
              <input
                type="text"
                required
                autoFocus
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter phone number or username"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
              />
            </div>

            <button
              type="submit"
              disabled={isLoadingAuth}
              className="w-full h-11 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover text-white font-black text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoadingAuth ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 text-smart-gold" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) => {
    if (orderStatusFilter !== "ALL" && o.status !== orderStatusFilter) {
      return false;
    }
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.recipient_name.toLowerCase().includes(q) ||
        o.recipient_phone.toLowerCase().includes(q) ||
        o.city_area.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  });

  const filteredCategoriesForRules = categories.filter((cat) => {
    if (!ruleSearch.trim()) return true;
    return cat.item_class
      .toLowerCase()
      .includes(ruleSearch.trim().toLowerCase());
  });

  const allTabs: { id: AdminSubTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "orders",
      label: `Orders (${orders.length})`,
      icon: <Package className="w-4 h-4" />,
    },
    {
      id: "pricing",
      label: "Pricing & Markup Rules",
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      id: "catalog",
      label: isContentCreatorRole
        ? "Product Images & Captions Studio"
        : "B2C Catalog Overrides",
      icon: isContentCreatorRole ? (
        <Sparkles className="w-4 h-4 text-smart-gold" />
      ) : (
        <Tag className="w-4 h-4" />
      ),
    },
    {
      id: "coupons",
      label: `Coupons (${coupons.length})`,
      icon: <TicketPercent className="w-4 h-4" />,
    },
    {
      id: "banners",
      label: "Banners & Flash Sale",
      icon: <ImageIcon className="w-4 h-4" />,
    },
    {
      id: "zones",
      label: `Delivery Zones (${zones.length})`,
      icon: <Truck className="w-4 h-4" />,
    },
    {
      id: "customers",
      label: `Customers (${customers.length})`,
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "staff",
      label: `Team & Roles (${staffList.length})`,
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: "settings",
      label: "Store & Privacy Settings",
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const allowedTabs = allTabs.filter((t) => canAccessTab(t.id));

  return (
    <div className="space-y-6">
      {/* Top Admin Command Header */}
      <section className="rounded-3xl bg-smart-teal-deep text-white p-5 sm:p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            title="Back to Storefront"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-smart-gold text-slate-950 text-[10px] font-black uppercase tracking-wider">
                {isContentCreatorRole
                  ? "Content Creator / Digital Marketer"
                  : "B's Mart B2C Admin"}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white text-[10px] font-extrabold uppercase">
                {staffUser.full_name} (@{staffUser.username} • {staffUser.role})
              </span>
              {saveMessage && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {saveMessage}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black mt-1">
              {isContentCreatorRole
                ? "Product Image Downloader (Thumb / View / Raw) & Social Caption Studio"
                : "B2C Pricing, Catalog, Orders & Access Control Center"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {isContentCreatorRole && (
            <button
              type="button"
              onClick={() => setActiveTab("home")}
              className="px-3.5 py-2.5 rounded-xl bg-smart-gold hover:bg-smart-gold-hover text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Browse Storefront</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadAdminData}
            className="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              signOutStaff();
              setActiveTab("home");
            }}
            className="px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-300/30 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Staff</span>
          </button>
        </div>
      </section>

      {/* Admin Sub-Navigation Pills (Filtered by Staff Role) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {allowedTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              subTab === tab.id
                ? "bg-smart-teal text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ==================================================================== */}
      {/* TAB: B2C Orders Manager                                              */}
      {/* ==================================================================== */}
      {subTab === "orders" && canAccessTab("orders") && (
        <section className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search by Order #, customer name, phone, city..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-smart-teal"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  "ALL",
                  "Pending",
                  "Confirmed",
                  "Out for Delivery",
                  "Delivered",
                  "Cancelled",
                ] as const
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setOrderStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap cursor-pointer ${
                    orderStatusFilter === st
                      ? "bg-smart-teal text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {filteredOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase text-slate-400">
                    <th className="py-3 px-2">Order # &amp; Warehouse Ref</th>
                    <th className="py-3 px-2">Recipient &amp; Phone</th>
                    <th className="py-3 px-2">Zone &amp; Address</th>
                    <th className="py-3 px-2">Payment</th>
                    <th className="py-3 px-2">B2C Total</th>
                    <th className="py-3 px-2">B&apos;s Mart Status</th>
                    <th className="py-3 px-2 text-right">
                      Operations &amp; Print Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((ord) => (
                    <tr key={ord.order_id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-2 font-mono font-black text-slate-900">
                        <div>{ord.order_number}</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {new Date(ord.created_date).toLocaleString()}
                        </div>
                        {ord.b2b_order_id ? (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                            <span>Acct #3899 • B2B #{ord.b2b_order_id}</span>
                            {ord.trx_id && (
                              <span className="text-emerald-700">
                                • TRX #{ord.trx_id}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] font-sans text-slate-400">
                            Acct #3899 (Bs Mart)
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-bold text-slate-900">
                          {ord.recipient_name}
                        </div>
                        <div className="font-mono text-slate-500">
                          {ord.recipient_phone}
                        </div>
                      </td>
                      <td className="py-3 px-2 max-w-[220px]">
                        <div className="font-bold text-smart-teal">
                          {ord.zone_name || "Lebanon"} • {ord.city_area}
                        </div>
                        <div className="text-slate-500 truncate">
                          {ord.street_address}
                          {ord.building_floor ? `, ${ord.building_floor}` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-extrabold uppercase text-[10px]">
                          {ord.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-black text-smart-teal tabular-numbers">
                        ${Number(ord.total).toFixed(2)}
                      </td>
                      <td className="py-3 px-2">
                        <select
                          value={ord.status}
                          onChange={(e) =>
                            handleUpdateOrderStatus(
                              ord.order_id,
                              e.target.value as SmartOrderStatus
                            )
                          }
                          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white font-bold text-xs focus:outline-none focus:border-smart-teal cursor-pointer"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Confirmed">Confirmed (Prepped)</option>
                          <option value="Out for Delivery">
                            Ready for Dispatch / Out for Delivery
                          </option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Print Customer Bill */}
                          <button
                            type="button"
                            onClick={() =>
                              setPrintOrderModal({ order: ord, mode: "bill" })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Print Customer Retail Bill"
                          >
                            <FileText className="w-3.5 h-3.5 text-smart-gold" />
                            <span>Print Bill</span>
                          </button>

                          {/* Print Delivery Note for Courier */}
                          <button
                            type="button"
                            onClick={() =>
                              setPrintOrderModal({
                                order: ord,
                                mode: "delivery_note",
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-slate-950 border border-amber-300 font-extrabold hover:bg-amber-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Print Delivery Note / Waybill for Delivery Company"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Delivery Note</span>
                          </button>

                          {/* Quick Mark Ready for Dispatch (updates smart_orders ONLY) */}
                          {(ord.status === "Pending" ||
                            ord.status === "Confirmed") && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateOrderStatus(
                                  ord.order_id,
                                  "Out for Delivery"
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Mark Ready for Dispatch in B's Mart (updates smart_orders only)"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Ready for Dispatch</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedOrderModal(ord)}
                            className="px-2.5 py-1.5 rounded-lg bg-smart-teal-light text-smart-teal font-bold hover:bg-smart-teal hover:text-white transition-colors cursor-pointer"
                          >
                            View Items
                          </button>
                          <a
                            href={`https://wa.me/${ord.recipient_phone.replace(
                              /[^0-9]/g,
                              ""
                            )}?text=${encodeURIComponent(
                              `Hello ${ord.recipient_name}, your B's Mart order #${ord.order_number} ($${Number(
                                ord.total
                              ).toFixed(2)}) is now ${ord.status}!`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            title="WhatsApp Customer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-8 text-center">
              No matching B2C orders found.
            </p>
          )}
        </section>
      )}

      {/* ==================================================================== */}
      {/* TAB: B2C Pricing & Markup Rules (smart_pricing_rules)                */}
      {/* ==================================================================== */}
      {subTab === "pricing" && canAccessTab("pricing") && (
        <div className="space-y-6">
          {/* Global Markup & Rounding Card */}
          <form
            onSubmit={handleSaveGlobalPricing}
            className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4 text-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-smart-teal" />
                  <span>
                    Global B2C Markup &amp; Psychological Price Rounding
                  </span>
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Automatically calculates `public.smart_items.srp` from
                  warehouse `public.items.srp` via PostgreSQL triggers whenever
                  ERP syncs or rules change.
                </p>
              </div>
              <button
                type="submit"
                disabled={isRecalculatingGlobal}
                className="px-5 py-2.5 rounded-xl bg-smart-teal hover:bg-smart-teal-hover text-white font-black flex items-center gap-2 shadow-sm cursor-pointer shrink-0"
              >
                {isRecalculatingGlobal ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 text-smart-gold" />
                )}
                <span>Save Global Markup &amp; Recalculate Catalog</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <label className="block font-black text-slate-800 mb-1">
                  Default Storewide B2C Markup (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    value={globalMarkupDraft}
                    onChange={(e) => setGlobalMarkupDraft(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 font-black text-sm text-smart-teal"
                  />
                  <span className="font-black text-slate-500 text-sm">%</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Applied to all categories that do not specify a custom
                  category markup override below.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <label className="block font-black text-slate-800 mb-1">
                  B2C Retail Price Rounding Rule
                </label>
                <select
                  value={roundingModeDraft}
                  onChange={(e) =>
                    setRoundingModeDraft(
                      e.target.value as SmartPriceRoundingMode
                    )
                  }
                  className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 font-bold text-slate-900"
                >
                  <option value="none">Exact Cent ($12.34)</option>
                  <option value="nearest_0_25">
                    Nearest Quarter ($12.25 / $12.50)
                  </option>
                  <option value="nearest_0_50">
                    Nearest Half Dollar ($12.50 / $13.00)
                  </option>
                  <option value="ending_99">
                    Psychological .99 Ending ($12.99)
                  </option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Shapes computed B2C prices into clean consumer price tags.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-smart-teal-light/40 border border-smart-teal/20 flex flex-col justify-center">
                <p className="font-black text-smart-teal text-xs">
                  Live Auto-Sync Formula (`trg_sync_items_to_smart_items`):
                </p>
                <p className="font-mono text-[11px] text-slate-700 mt-1">
                  B2C SRP = Round( Base_B2B_SRP × (1 + Markup%) + Fixed_Addon )
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Items with a locked custom price (`🔒 Custom Price`) are
                  protected and never overwritten by bulk rule changes.
                </p>
              </div>
            </div>
          </form>

          {/* Per-Category Markup & Discount Table */}
          <section className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Category-Level Markup, Add-On &amp; Visibility Rules (
                  {categories.length} Categories)
                </h3>
                <p className="text-slate-500">
                  Leave Category Markup % blank to inherit the Global Default (
                  {globalMarkupDraft}%).
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ruleSearch}
                  onChange={(e) => setRuleSearch(e.target.value)}
                  placeholder="Filter categories..."
                  className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[540px] overflow-y-auto border border-slate-200/80 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 z-10">
                  <tr>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Custom Markup %</th>
                    <th className="py-3 px-3">Fixed Add-On ($)</th>
                    <th className="py-3 px-3">B2C Sale Discount %</th>
                    <th className="py-3 px-3">B2C Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCategoriesForRules.map((cat) => {
                    const rule: SmartPricingRule = pricingRules[
                      cat.item_class_id
                    ] || {
                      class_id: cat.item_class_id,
                      markup_percent: null,
                      fixed_markup_addon: 0,
                      default_b2c_discount: 0,
                      is_b2c_enabled: true,
                    };

                    return (
                      <tr
                        key={cat.item_class_id}
                        className="hover:bg-slate-50/80"
                      >
                        <td className="py-2.5 px-3 font-black text-slate-900">
                          {cat.item_class}
                          <span className="ml-1.5 text-[10px] font-mono text-slate-400">
                            #{cat.item_class_id}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            step="0.5"
                            placeholder={`Global (${globalMarkupDraft}%)`}
                            value={
                              rule.markup_percent === null
                                ? ""
                                : rule.markup_percent
                            }
                            onChange={(e) => {
                              const val =
                                e.target.value.trim() === ""
                                  ? null
                                  : Number(e.target.value);
                              setPricingRules((prev) => ({
                                ...prev,
                                [cat.item_class_id]: {
                                  ...rule,
                                  markup_percent: val,
                                },
                              }));
                            }}
                            className="w-32 h-8 px-2.5 rounded-lg border border-slate-200 bg-white font-bold"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            step="0.25"
                            value={rule.fixed_markup_addon}
                            onChange={(e) => {
                              setPricingRules((prev) => ({
                                ...prev,
                                [cat.item_class_id]: {
                                  ...rule,
                                  fixed_markup_addon:
                                    Number(e.target.value) || 0,
                                },
                              }));
                            }}
                            className="w-24 h-8 px-2.5 rounded-lg border border-slate-200 bg-white font-bold"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="90"
                            value={rule.default_b2c_discount}
                            onChange={(e) => {
                              setPricingRules((prev) => ({
                                ...prev,
                                [cat.item_class_id]: {
                                  ...rule,
                                  default_b2c_discount:
                                    Number(e.target.value) || 0,
                                },
                              }));
                            }}
                            className="w-24 h-8 px-2.5 rounded-lg border border-slate-200 bg-white font-bold text-smart-sale"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => {
                              const updatedRule = {
                                ...rule,
                                is_b2c_enabled: !rule.is_b2c_enabled,
                              };
                              setPricingRules((prev) => ({
                                ...prev,
                                [cat.item_class_id]: updatedRule,
                              }));
                              handleSaveCategoryRule(
                                cat.item_class_id,
                                updatedRule
                              );
                            }}
                            className={`px-2.5 py-1 rounded-lg font-extrabold cursor-pointer ${
                              rule.is_b2c_enabled
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {rule.is_b2c_enabled
                              ? "Visible in B2C"
                              : "Hidden in B2C"}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            disabled={savingRuleClassId === cat.item_class_id}
                            onClick={() =>
                              handleSaveCategoryRule(cat.item_class_id, rule)
                            }
                            className="px-3 py-1.5 rounded-lg bg-smart-teal hover:bg-smart-teal-hover text-white font-black cursor-pointer"
                          >
                            {savingRuleClassId === cat.item_class_id
                              ? "Saving..."
                              : "Apply Rule"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB: B2C Catalog & Item Overrides (public.smart_items)               */}
      {/* ==================================================================== */}
      {subTab === "catalog" && canAccessTab("catalog") && (
        <section className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search B2C catalog by SKU code, product name, or barcode..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-smart-teal"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                isContentCreatorRole
                  ? ([
                      { id: "ALL", label: "All Products" },
                      { id: "ON_SALE", label: "🔥 On Sale / Deals" },
                    ] as const)
                  : ([
                      { id: "ALL", label: "All B2C Items" },
                      { id: "CUSTOM_PRICE", label: "🔒 Custom Price Locked" },
                      { id: "ON_SALE", label: "🔥 On B2C Sale" },
                      { id: "HIDDEN", label: "🚫 Hidden in B2C" },
                    ] as const)
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCatalogFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap cursor-pointer ${
                    catalogFilter === f.id
                      ? "bg-smart-teal text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {isLoadingCatalog ? (
            <div className="py-10 flex items-center justify-center gap-2 text-smart-teal font-bold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading `public.smart_items` catalog...</span>
            </div>
          ) : catalogItems.length > 0 ? (
            <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                  {isContentCreatorRole ? (
                    <tr>
                      <th className="py-3 px-3">Product &amp; SKU</th>
                      <th className="py-3 px-3">Available Image Angles</th>
                      <th className="py-3 px-3">B2C Shopper Price</th>
                      <th className="py-3 px-3 text-right">
                        Download &amp; Share (Thumb / View / Raw)
                      </th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="py-3 px-3">Product</th>
                      <th className="py-3 px-3">B2B Base SRP</th>
                      <th className="py-3 px-3">B2C Retail Price ($)</th>
                      <th className="py-3 px-3">B2C Discount (%)</th>
                      <th className="py-3 px-3">Final Shopper Price</th>
                      <th className="py-3 px-3">B2C Visibility</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {catalogItems.map((item) => {
                    const draft = itemEdits[item.item_id] || {
                      srp: Number(item.srp).toFixed(2),
                      discount: Number(item.discount).toFixed(1),
                    };
                    const draftSrp = Number(draft.srp) || 0;
                    const draftDisc = Number(draft.discount) || 0;
                    const finalConsumerPrice =
                      draftDisc > 0
                        ? draftSrp * (1 - draftDisc / 100)
                        : draftSrp;

                    if (isContentCreatorRole) {
                      const creatorSlots = getItemCreatorGallerySlots(item);
                      return (
                        <tr
                          key={item.item_id}
                          onClick={() => setCreatorShareItem(item)}
                          className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={getItemImageUrl(item, "thumb")}
                                alt={item.item_name}
                                className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                              />
                              <div className="max-w-[280px]">
                                <p className="font-black text-slate-900 hover:text-smart-teal truncate">
                                  {item.item_name}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                                  <span>SKU: {item.code}</span>
                                  {item.material && (
                                    <span>• {item.material}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {creatorSlots.length > 0 ? (
                                creatorSlots.map((slot) => (
                                  <span
                                    key={slot.slotKey}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200/80 text-[10px] font-bold text-slate-700"
                                  >
                                    <img
                                      src={slot.thumbUrl}
                                      alt={slot.label}
                                      className="w-4 h-4 rounded object-cover"
                                    />
                                    <span>{slot.label}</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  1 Default Image
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-smart-teal text-sm tabular-numbers">
                                ${finalConsumerPrice.toFixed(2)}
                              </span>
                              {draftDisc > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-smart-sale/10 text-smart-sale text-[10px] font-black">
                                  -{draftDisc.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCreatorShareItem(item);
                              }}
                              className="px-3.5 py-2 rounded-xl bg-smart-teal-deep hover:bg-smart-teal text-white font-black inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-smart-gold" />
                              <span>
                                Download / Share Images (Thumb • View • Raw)
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={item.item_id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => setCreatorShareItem(item)}
                            title="Click to open Creator Image & Caption Studio"
                            className="flex items-center gap-2.5 text-left group cursor-pointer"
                          >
                            <img
                              src={getItemImageUrl(item, "thumb")}
                              alt={item.item_name}
                              className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200 group-hover:border-smart-teal shrink-0"
                            />
                            <div className="max-w-[230px]">
                              <p className="font-black text-slate-900 group-hover:text-smart-teal truncate">
                                {item.item_name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                                <span>SKU: {item.code}</span>
                                <span>• Stock: {Number(item.qtty)}</span>
                              </div>
                            </div>
                          </button>
                        </td>

                        <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                          ${Number(item.base_b2b_srp ?? item.srp).toFixed(2)}
                          <div className="text-[10px] text-slate-400">
                            {item.is_custom_price
                              ? "Custom Override"
                              : `+${Number(
                                  item.markup_percent_applied ?? 0
                                ).toFixed(0)}% rule`}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.01"
                              disabled={!canManageCatalog}
                              value={draft.srp}
                              onChange={(e) =>
                                setItemEdits((prev) => ({
                                  ...prev,
                                  [item.item_id]: {
                                    ...draft,
                                    srp: e.target.value,
                                  },
                                }))
                              }
                              className={`w-24 h-8 px-2 rounded-lg border font-black tabular-numbers disabled:opacity-60 disabled:cursor-not-allowed ${
                                item.is_custom_price
                                  ? "border-amber-400 bg-amber-50/60 text-amber-950"
                                  : "border-slate-200 bg-white text-slate-900"
                              }`}
                            />
                            {item.is_custom_price && (
                              <span
                                title="Locked Custom B2C Price (Protected from auto-markup)"
                                className="p-1 rounded bg-amber-100 text-amber-800"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="95"
                            disabled={!canManageCatalog}
                            value={draft.discount}
                            onChange={(e) =>
                              setItemEdits((prev) => ({
                                ...prev,
                                [item.item_id]: {
                                  ...draft,
                                  discount: e.target.value,
                                },
                              }))
                            }
                            className="w-20 h-8 px-2 rounded-lg border border-slate-200 bg-white font-bold text-smart-sale tabular-numbers disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </td>

                        <td className="py-2.5 px-3 font-black text-smart-teal text-sm tabular-numbers">
                          ${finalConsumerPrice.toFixed(2)}
                        </td>

                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            disabled={!canManageCatalog}
                            onClick={() => handleToggleItemB2CHidden(item)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-extrabold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                              item.is_b2c_hidden
                                ? "bg-rose-100 text-rose-700"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {item.is_b2c_hidden ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Hidden</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Visible</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {canViewCatalog && (
                              <button
                                type="button"
                                onClick={() => setCreatorShareItem(item)}
                                title="Open Creator Asset & Share Studio (Thumb / View / Raw)"
                                className="px-2.5 py-1.5 rounded-lg bg-smart-teal-deep hover:bg-smart-teal text-white font-black inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5 text-smart-gold" />
                                <span>Images</span>
                              </button>
                            )}
                            {canManageCatalog && (
                              <>
                                <button
                                  type="button"
                                  disabled={savingItemId === item.item_id}
                                  onClick={() => handleSaveItemOverride(item)}
                                  className="px-3 py-1.5 rounded-lg bg-smart-teal hover:bg-smart-teal-hover text-white font-black cursor-pointer"
                                >
                                  {savingItemId === item.item_id
                                    ? "Saving..."
                                    : "Save"}
                                </button>
                                {(item.is_custom_price ||
                                  item.is_custom_discount) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUnlockItemAutoPricing(item)
                                    }
                                    title="Unlock custom price & revert to automatic category markup rule"
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                  >
                                    <Unlock className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-8 text-center">
              No matching B2C catalog items found.
            </p>
          )}
        </section>
      )}

      {/* ==================================================================== */}
      {/* TAB: Coupons Manager                                                 */}
      {/* ==================================================================== */}
      {subTab === "coupons" && canAccessTab("coupons") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateCoupon}
            className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-3.5"
          >
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-smart-teal" />
              <span>Create New Promo Voucher</span>
            </h3>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  Promo Code *
                </label>
                <input
                  type="text"
                  required
                  value={newCouponCode}
                  onChange={(e) =>
                    setNewCouponCode(e.target.value.toUpperCase())
                  }
                  placeholder="e.g. WELCOME10"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  Discount Type
                </label>
                <select
                  value={newCouponType}
                  onChange={(e) =>
                    setNewCouponType(
                      e.target.value as
                        | "percentage"
                        | "fixed"
                        | "free_shipping"
                    )
                  }
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="percentage">Percentage (% Off)</option>
                  <option value="fixed">Fixed Amount ($ Off)</option>
                  <option value="free_shipping">Free Shipping</option>
                </select>
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-600 mb-1">
                Display Title *
              </label>
              <input
                type="text"
                required
                value={newCouponTitle}
                onChange={(e) => setNewCouponTitle(e.target.value)}
                placeholder="e.g. 10% Off Your First Order"
                className="w-full h-9 px-3 rounded-xl border border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  Discount Value
                </label>
                <input
                  type="number"
                  step="0.01"
                  disabled={newCouponType === "free_shipping"}
                  value={newCouponValue}
                  onChange={(e) => setNewCouponValue(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  Min. Order ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newCouponMinOrder}
                  onChange={(e) => setNewCouponMinOrder(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newCouponPublic}
                onChange={(e) => setNewCouponPublic(e.target.checked)}
                className="rounded border-slate-300 text-smart-teal"
              />
              <span>Show on Storefront Collectible Coupon Strip</span>
            </label>

            <button
              type="submit"
              className="w-full h-10 rounded-xl bg-smart-teal hover:bg-smart-teal-hover text-white text-xs font-black cursor-pointer"
            >
              Create Promo Code
            </button>
          </form>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-black text-slate-900">
              Configured Coupons ({coupons.length})
            </h3>
            {coupons.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {coupons.map((c) => (
                  <div
                    key={c.coupon_id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-smart-teal">
                          {c.code}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                          {c.discount_type === "percentage"
                            ? `${c.discount_value}% OFF`
                            : c.discount_type === "fixed"
                            ? `$${c.discount_value} OFF`
                            : "FREE SHIPPING"}
                        </span>
                        <span className="text-slate-400">
                          Used: {c.used_count}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-0.5">
                        {c.title} • Min. Order $
                        {Number(c.min_order_amount).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCouponActive(c)}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                          c.is_active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {c.is_active ? "Active" : "Paused"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCoupon(c.coupon_id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-6">
                No coupons created yet. Use the form on the left to launch a
                collectible voucher.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB: Delivery Zones Manager                                          */}
      {/* ==================================================================== */}
      {subTab === "zones" && canAccessTab("zones") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateZone}
            className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-3.5 text-xs"
          >
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-smart-teal" />
              <span>Add Delivery Region</span>
            </h3>
            <div>
              <label className="block font-bold text-slate-600 mb-1">
                Region Name *
              </label>
              <input
                type="text"
                required
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="e.g. Metn & Keserwan"
                className="w-full h-9 px-3 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 mb-1">
                Delivery Fee ($)
              </label>
              <input
                type="number"
                step="0.5"
                value={newZoneFee}
                onChange={(e) => setNewZoneFee(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 mb-1">
                Estimated Delivery Window
              </label>
              <input
                type="text"
                value={newZoneEta}
                onChange={(e) => setNewZoneEta(e.target.value)}
                placeholder="24 - 48 Hours"
                className="w-full h-9 px-3 rounded-xl border border-slate-200"
              />
            </div>
            <button
              type="submit"
              className="w-full h-10 rounded-xl bg-smart-teal text-white font-black cursor-pointer"
            >
              Add Region
            </button>
          </form>

          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-black text-slate-900">
              Active Lebanon Delivery Regions ({zones.length})
            </h3>
            <div className="divide-y divide-slate-100">
              {zones.map((zone) => (
                <div
                  key={zone.zone_id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-black text-slate-900">
                      {zone.zone_name}
                    </p>
                    <p className="text-slate-500">{zone.estimated_delivery}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold">Fee ($):</span>
                    <input
                      type="number"
                      step="0.5"
                      defaultValue={zone.delivery_fee}
                      onBlur={(e) =>
                        handleUpdateZoneFee(
                          zone,
                          Number(e.target.value),
                          zone.is_active
                        )
                      }
                      className="w-20 h-8 px-2 rounded-lg border border-slate-200 font-bold text-right"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateZoneFee(
                          zone,
                          zone.delivery_fee,
                          !zone.is_active
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                        zone.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {zone.is_active ? "Active" : "Disabled"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB: Hero Banners & Flash Sale Countdown                             */}
      {/* ==================================================================== */}
      {subTab === "banners" && canAccessTab("banners") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateBanner}
            className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-3.5 text-xs"
          >
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-smart-teal" />
              <span>Add Homepage Hero Slide</span>
            </h3>
            <div>
              <label className="block font-bold text-slate-600 mb-1">
                Headline Title *
              </label>
              <input
                type="text"
                required
                value={newBannerTitle}
                onChange={(e) => setNewBannerTitle(e.target.value)}
                placeholder="e.g. Big Kitchen & Home Sale"
                className="w-full h-9 px-3 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 mb-1">
                Subtitle
              </label>
              <input
                type="text"
                value={newBannerSubtitle}
                onChange={(e) => setNewBannerSubtitle(e.target.value)}
                placeholder="Up to 50% off top essentials"
                className="w-full h-9 px-3 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 mb-1">
                Image URL *
              </label>
              <input
                type="url"
                required
                value={newBannerImage}
                onChange={(e) => setNewBannerImage(e.target.value)}
                placeholder="https://..."
                className="w-full h-9 px-3 rounded-xl border border-slate-200"
              />
            </div>
            <button
              type="submit"
              className="w-full h-10 rounded-xl bg-smart-teal text-white font-black cursor-pointer"
            >
              Publish Banner
            </button>
          </form>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-black text-slate-900">
              Active Hero Slides ({banners.length})
            </h3>
            {banners.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {banners.map((b) => (
                  <div
                    key={b.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-black text-slate-900">{b.title}</p>
                      <p className="text-slate-500">{b.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBanner(b.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4">
                Using default B&apos;s Mart Brand Hero + real `public.item_tags`
                campaign spotlights.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB: Customers Directory                                             */}
      {/* ==================================================================== */}
      {subTab === "customers" && canAccessTab("customers") && (
        <section className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Registered B&apos;s Mart Shoppers ({filteredCustomers.length})
              </h3>
              <p className="text-xs text-slate-500">
                Customer registrations are strictly locked to `role =
                &apos;customer&apos;` via database trigger
                `trg_smart_customers_enforce_role`.
              </p>
            </div>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search name or phone..."
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          {filteredCustomers.length > 0 ? (
            <div className="divide-y divide-slate-100 text-xs">
              {filteredCustomers.map((c) => (
                <div
                  key={c.customer_id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">
                        {c.full_name}
                      </span>
                      <span className="font-mono text-slate-500">
                        {c.phone}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                        Shopper
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Last active: {new Date(c.last_login_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">
              No registered customer accounts yet.
            </p>
          )}
        </section>
      )}

      {/* ==================================================================== */}
      {/* TAB: Staff & Role-Based Access Control (public.smart_users)          */}
      {/* ==================================================================== */}
      {subTab === "staff" && canAccessTab("staff") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateStaff}
            className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-3.5 text-xs"
          >
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-smart-teal" />
              <span>Add Authorized Staff Member</span>
            </h3>
            <p className="text-slate-500">
              Staff accounts are stored in `public.smart_users` with `pgcrypto`
              bcrypt password hashes. Public shoppers can never self-register
              here.
            </p>

            {staffFormError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                {staffFormError}
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                required
                value={newStaffUsername}
                onChange={(e) =>
                  setNewStaffUsername(e.target.value.toLowerCase())
                }
                placeholder="e.g. sara_merch"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={newStaffFullName}
                onChange={(e) => setNewStaffFullName(e.target.value)}
                placeholder="e.g. Sara Mansour"
                className="w-full h-9 px-3 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Initial Password (min. 6 characters) *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newStaffPassword}
                onChange={(e) => setNewStaffPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-9 px-3 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Assigned Access Role (RBAC)
              </label>
              <select
                value={newStaffRole}
                onChange={(e) =>
                  setNewStaffRole(e.target.value as SmartStaffRole)
                }
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white font-bold"
              >
                <option value="merchandising">
                  Merchandising &amp; Pricing (Catalog, Markups, Deals, Banners)
                </option>
                <option value="content_creator">
                  Content Creator / Digital Marketer (Asset Studio &amp; Catalog)
                </option>
                <option value="fulfillment">
                  Order Fulfillment (Orders &amp; Dispatch Only)
                </option>
                <option value="admin">
                  Super Admin (Full Store, Pricing &amp; Staff Control)
                </option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSavingStaff}
              className="w-full h-10 rounded-xl bg-smart-teal hover:bg-smart-teal-hover text-white font-black cursor-pointer"
            >
              {isSavingStaff ? "Creating Staff Account..." : "Create Staff User"}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4 text-xs">
            <h3 className="text-sm font-black text-slate-900">
              Authorized Staff Accounts ({staffList.length})
            </h3>

            <div className="divide-y divide-slate-100">
              {staffList.map((member) => (
                <div
                  key={member.user_id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">
                        {member.full_name}
                      </span>
                      <span className="font-mono text-smart-teal font-bold">
                        @{member.username}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Last login:{" "}
                      {member.last_login_at
                        ? new Date(member.last_login_at).toLocaleString()
                        : "Never"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleUpdateStaffMember(
                          member,
                          e.target.value as SmartStaffRole,
                          member.is_active
                        )
                      }
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white font-bold"
                    >
                      <option value="admin">Super Admin</option>
                      <option value="merchandising">Merchandising</option>
                      <option value="content_creator">
                        Content Creator / Digital Marketer
                      </option>
                      <option value="fulfillment">Fulfillment</option>
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateStaffMember(
                          member,
                          member.role,
                          !member.is_active
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg font-extrabold cursor-pointer ${
                        member.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {member.is_active ? "Active" : "Suspended"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB: Storefront & Privacy Settings (smart_app_settings)              */}
      {/* ==================================================================== */}
      {subTab === "settings" && canAccessTab("settings") && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-6 text-xs"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                Global Storefront, Privacy &amp; Checkout Settings
              </h3>
              <p className="text-slate-500 mt-0.5">
                Stored in `public.smart_app_settings` (`id = &apos;global&apos;`)
              </p>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-smart-teal hover:bg-smart-teal-hover text-white font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4 text-smart-gold" />
              <span>Save All Settings</span>
            </button>
          </div>

          {/* Catalog Privacy Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="p-3.5 rounded-2xl border border-slate-200 flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsDraft.hide_stock_qty}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    hide_stock_qty: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-slate-300 text-smart-teal"
              />
              <div>
                <p className="font-black text-slate-900">
                  Hide Exact Stock Quantities
                </p>
                <p className="text-[11px] text-slate-500">
                  Shows &ldquo;In Stock&rdquo; without leaking exact warehouse
                  integers.
                </p>
              </div>
            </label>

            <label className="p-3.5 rounded-2xl border border-slate-200 flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsDraft.hide_out_of_stock}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    hide_out_of_stock: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-slate-300 text-smart-teal"
              />
              <div>
                <p className="font-black text-slate-900">
                  Hide Out-of-Stock Products
                </p>
                <p className="text-[11px] text-slate-500">
                  Automatically filters out 0-quantity SKUs across all feeds.
                </p>
              </div>
            </label>

            <label className="p-3.5 rounded-2xl border border-slate-200 flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsDraft.require_images}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    require_images: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-slate-300 text-smart-teal"
              />
              <div>
                <p className="font-black text-slate-900">
                  Require Product Images
                </p>
                <p className="text-[11px] text-slate-500">
                  Only displays items that have uploaded Cloudflare R2 photos.
                </p>
              </div>
            </label>
          </div>

          {/* Shipping & Flash Sale Thresholds */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Free Shipping Threshold ($)
              </label>
              <input
                type="number"
                step="1"
                value={settingsDraft.free_shipping_threshold}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    free_shipping_threshold: Number(e.target.value),
                  })
                }
                className="w-full h-10 px-3 rounded-xl border border-slate-200 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Default Delivery Fee ($)
              </label>
              <input
                type="number"
                step="0.5"
                value={settingsDraft.default_delivery_fee}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    default_delivery_fee: Number(e.target.value),
                  })
                }
                className="w-full h-10 px-3 rounded-xl border border-slate-200 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                WhatsApp Support Phone
              </label>
              <input
                type="text"
                value={settingsDraft.whatsapp_support_phone}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    whatsapp_support_phone: e.target.value,
                  })
                }
                placeholder="e.g. 9613123456"
                className="w-full h-10 px-3 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Flash Sale Title
              </label>
              <input
                type="text"
                value={settingsDraft.flash_sale_title}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    flash_sale_title: e.target.value,
                  })
                }
                className="w-full h-10 px-3 rounded-xl border border-slate-200 font-bold"
              />
            </div>
          </div>

          {/* Payment Methods Toggles */}
          <div className="space-y-2">
            <p className="font-black text-slate-900">
              Enabled Checkout Payment Methods
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(
                [
                  { key: "enable_cod", label: "Cash on Delivery (COD)" },
                  { key: "enable_whish", label: "Whish Money" },
                  { key: "enable_omt", label: "OMT Pay / BOB" },
                  { key: "enable_card_pos", label: "Card POS on Delivery" },
                ] as const
              ).map((pm) => (
                <label
                  key={pm.key}
                  className="p-3 rounded-xl border border-slate-200 flex items-center gap-2 font-bold cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(settingsDraft[pm.key])}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        [pm.key]: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300 text-smart-teal"
                  />
                  <span>{pm.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Hidden Categories Selector */}
          <div className="space-y-2">
            <p className="font-black text-slate-900">
              Category Visibility (Click to Hide/Unhide from Storefront)
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
              {categories.map((cat) => {
                const isHidden = (
                  settingsDraft.hidden_categories || []
                ).includes(cat.item_class_id);
                return (
                  <button
                    key={cat.item_class_id}
                    type="button"
                    onClick={() => toggleHiddenCategory(cat.item_class_id)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                      isHidden
                        ? "bg-rose-100 text-rose-700 line-through"
                        : "bg-white border border-slate-200 text-slate-700 hover:border-smart-teal"
                    }`}
                  >
                    {cat.item_class}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      )}

      {/* Order Details Modal */}
      <SmartOrderTrackerModal
        order={selectedOrderModal}
        onClose={() => setSelectedOrderModal(null)}
      />

      {/* Operations Print Customer Bill & Delivery Note Modal */}
      <SmartOrderPrintModal
        order={printOrderModal?.order || null}
        initialMode={printOrderModal?.mode || "both"}
        onClose={() => setPrintOrderModal(null)}
        onUpdateSmartStatus={handleUpdateOrderStatus}
      />

      {/* Creator Asset & Share Studio Modal */}
      <SmartCreatorShareModal
        item={creatorShareItem}
        isOpen={Boolean(creatorShareItem)}
        onClose={() => setCreatorShareItem(null)}
      />
    </div>
  );
}
