"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Truck,
  MapPin,
  Phone,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  CheckCircle2,
  TicketPercent,
  ShieldCheck,
  Loader2,
  Share2,
  ShoppingBag,
  Sparkles,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  SmartAddress,
  SmartCoupon,
  SmartCustomer,
  SmartDeliveryZone,
  SmartOrder,
  SmartPaymentMethod,
} from "@/types/smart.types";
import { useSmartNavStore } from "@/store/useSmartNavStore";
import { useSmartAuthStore } from "@/store/useSmartAuthStore";
import {
  useSmartCartStore,
  computeBagTotals,
  SmartCartLine,
} from "@/store/useSmartCartStore";
import {
  submitSmartConsumerOrder,
  validateSmartCouponCode,
} from "@/lib/smartOrders";
import { getItemImageUrl } from "@/lib/media";
import { resolveRetailPrice } from "@/lib/pricing";

const SAVED_CHECKOUT_DRAFT_KEY = "bsmart_checkout_address_draft_v1";
const CUSTOMER_SESSION_KEY = "bsmart_customer_session_v1";

interface SavedCheckoutDraft {
  recipientName: string;
  recipientPhone: string;
  zoneId: number | null;
  cityArea: string;
  streetAddress: string;
  buildingFloor: string;
  landmark: string;
  paymentMethod: SmartPaymentMethod;
}

interface SmartCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryZones: SmartDeliveryZone[];
  availableCoupons: SmartCoupon[];
}

export function SmartCheckoutModal({
  isOpen,
  onClose,
  deliveryZones,
  availableCoupons,
}: SmartCheckoutModalProps) {
  const { appSettings, setActiveTab } = useSmartNavStore();
  const { customer: authCustomer, addresses: savedAddresses } =
    useSmartAuthStore();
  const {
    lines,
    appliedCoupon,
    setAppliedCoupon,
    collectCoupon,
    clearSelectedLines,
  } = useSmartCartStore();

  const [customerSession, setCustomerSession] = useState<SmartCustomer | null>(
    null
  );
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(
    deliveryZones[0]?.zone_id ?? null
  );
  const [cityArea, setCityArea] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [buildingFloor, setBuildingFloor] = useState("");
  const [landmark, setLandmark] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<SmartPaymentMethod>("cod");
  const [rememberDetails, setRememberDetails] = useState(true);

  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<{
    order: SmartOrder;
    checkedOutLines: SmartCartLine[];
  } | null>(null);

  // Load saved customer session, saved address book, or device checkout draft on open
  useEffect(() => {
    if (!isOpen) return;
    setSubmitError(null);
    setPromoError(null);

    if (typeof window !== "undefined") {
      try {
        const rawDraft = window.localStorage.getItem(SAVED_CHECKOUT_DRAFT_KEY);
        if (rawDraft) {
          const draft = JSON.parse(rawDraft) as SavedCheckoutDraft;
          if (draft.recipientName) setRecipientName(draft.recipientName);
          if (draft.recipientPhone) setRecipientPhone(draft.recipientPhone);
          if (draft.zoneId) setSelectedZoneId(draft.zoneId);
          if (draft.cityArea) setCityArea(draft.cityArea);
          if (draft.streetAddress) setStreetAddress(draft.streetAddress);
          if (draft.buildingFloor) setBuildingFloor(draft.buildingFloor);
          if (draft.landmark) setLandmark(draft.landmark);
          if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
        }

        const rawCustomer = window.localStorage.getItem(CUSTOMER_SESSION_KEY);
        const activeCust =
          authCustomer ||
          (rawCustomer ? (JSON.parse(rawCustomer) as SmartCustomer) : null);
        if (activeCust) {
          setCustomerSession(activeCust);
          if (activeCust.full_name) setRecipientName(activeCust.full_name);
          if (activeCust.phone) setRecipientPhone(activeCust.phone);
        }

        if (savedAddresses.length > 0) {
          const defAddr =
            savedAddresses.find((a) => a.is_default) || savedAddresses[0];
          if (defAddr) {
            setRecipientName(defAddr.recipient_name);
            setRecipientPhone(defAddr.phone);
            if (defAddr.zone_id) setSelectedZoneId(defAddr.zone_id);
            setCityArea(defAddr.city_area);
            setStreetAddress(defAddr.street);
            setBuildingFloor(defAddr.building_floor || "");
            setLandmark(defAddr.landmark || "");
          }
        }
      } catch {}
    }

    if (!selectedZoneId && deliveryZones.length > 0) {
      setSelectedZoneId(deliveryZones[0].zone_id);
    }
  }, [isOpen, deliveryZones, selectedZoneId, authCustomer, savedAddresses]);

  const activeZone = useMemo(() => {
    if (!selectedZoneId) return deliveryZones[0] || null;
    return (
      deliveryZones.find((z) => z.zone_id === selectedZoneId) ||
      deliveryZones[0] ||
      null
    );
  }, [deliveryZones, selectedZoneId]);

  const zoneFee = activeZone
    ? Number(activeZone.delivery_fee)
    : Number(appSettings.default_delivery_fee || 3);

  const bagTotals = useMemo(
    () =>
      computeBagTotals(
        lines,
        appliedCoupon,
        appSettings.free_shipping_threshold,
        zoneFee
      ),
    [lines, appliedCoupon, appSettings.free_shipping_threshold, zoneFee]
  );

  if (!isOpen) return null;

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await validateSmartCouponCode(
        promoInput,
        bagTotals.subtotalAfterItemDiscounts
      );
      if (res.valid && res.coupon) {
        collectCoupon(res.coupon);
        setAppliedCoupon(res.coupon);
        setPromoInput("");
      } else {
        setPromoError(res.errorMessage || "Invalid promo code.");
      }
    } catch {
      setPromoError("Could not validate promo code right now.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (bagTotals.selectedLines.length === 0) {
      setSubmitError("Please select at least one item in your bag to check out.");
      return;
    }
    if (!recipientName.trim() || recipientName.trim().length < 2) {
      setSubmitError("Please enter your full name for delivery.");
      return;
    }
    if (!recipientPhone.trim() || recipientPhone.trim().length < 6) {
      setSubmitError("Please enter a valid mobile phone number.");
      return;
    }
    if (!cityArea.trim()) {
      setSubmitError("Please enter your City / Area.");
      return;
    }
    if (!streetAddress.trim()) {
      setSubmitError("Please enter your Street & Building details.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Save convenience draft locally if requested
      if (rememberDetails && typeof window !== "undefined") {
        const draft: SavedCheckoutDraft = {
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          zoneId: activeZone?.zone_id ?? null,
          cityArea: cityArea.trim(),
          streetAddress: streetAddress.trim(),
          buildingFloor: buildingFloor.trim(),
          landmark: landmark.trim(),
          paymentMethod,
        };
        try {
          window.localStorage.setItem(
            SAVED_CHECKOUT_DRAFT_KEY,
            JSON.stringify(draft)
          );
        } catch {}
      }

      const snapshotLines = [...bagTotals.selectedLines];
      const result = await submitSmartConsumerOrder({
        customerId: customerSession?.customer_id || null,
        isGuest: !customerSession?.customer_id,
        recipientName,
        recipientPhone,
        zoneId: activeZone?.zone_id ?? null,
        zoneName: activeZone?.zone_name ?? null,
        cityArea,
        streetAddress,
        buildingFloor,
        landmark,
        paymentMethod,
        note: orderNote,
        selectedLines: snapshotLines,
        subtotal: bagTotals.subtotalAfterItemDiscounts,
        itemDiscountTotal: bagTotals.itemDiscountSavings,
        couponCode: appliedCoupon?.code || null,
        couponDiscount: bagTotals.couponDiscount,
        deliveryFee: bagTotals.deliveryFee,
        total: bagTotals.grandTotal,
      });

      clearSelectedLines();
      setCompletedOrder({
        order: result.order,
        checkedOutLines: snapshotLines,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Could not submit your order. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendWhatsAppReceipt = () => {
    if (!completedOrder) return;
    const { order, checkedOutLines } = completedOrder;
    const itemsSummary = checkedOutLines
      .map((l) => {
        const p = resolveRetailPrice(l.item.srp, l.item.discount);
        return `• ${l.quantity}x ${l.item.item_name} (${l.item.code}) - $${(
          p.finalUnitPrice * l.quantity
        ).toFixed(2)}`;
      })
      .join("\n");

    const message = [
      `🛍️ *B's Mart Order Confirmation*`,
      `Order #: *${order.order_number}*`,
      `Name: ${order.recipient_name}`,
      `Phone: ${order.recipient_phone}`,
      `Region: ${order.zone_name || "Lebanon"} - ${order.city_area}`,
      `Address: ${order.street_address}${
        order.building_floor ? `, ${order.building_floor}` : ""
      }`,
      `Payment: ${order.payment_method.toUpperCase()}`,
      ``,
      `*Items:*`,
      itemsSummary,
      ``,
      `Subtotal: $${Number(order.subtotal).toFixed(2)}`,
      order.coupon_discount > 0
        ? `Coupon (${order.coupon_code}): -$${Number(
            order.coupon_discount
          ).toFixed(2)}`
        : null,
      `Delivery: ${
        Number(order.delivery_fee) === 0
          ? "FREE"
          : `$${Number(order.delivery_fee).toFixed(2)}`
      }`,
      `*Total Due: $${Number(order.total).toFixed(2)}*`,
    ]
      .filter(Boolean)
      .join("\n");

    const supportPhone = (appSettings.whatsapp_support_phone || "").replace(
      /[^0-9]/g,
      ""
    );
    const waUrl = supportPhone
      ? `https://wa.me/${supportPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const allPaymentOptions: {
    id: SmartPaymentMethod;
    enabled: boolean;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "cod",
      enabled: appSettings.enable_cod !== false,
      title: "Cash on Delivery (COD)",
      subtitle: "Pay in cash (USD or LBP) when your order arrives",
      icon: <Banknote className="w-5 h-5 text-emerald-600" />,
    },
    {
      id: "whish",
      enabled: appSettings.enable_whish !== false,
      title: "Whish Money",
      subtitle: "Fast digital wallet transfer via Whish Money",
      icon: <Smartphone className="w-5 h-5 text-rose-600" />,
    },
    {
      id: "omt",
      enabled: appSettings.enable_omt !== false,
      title: "OMT Pay / BOB Finance",
      subtitle: "Pay easily via OMT Pay or wallet transfer",
      icon: <Building2 className="w-5 h-5 text-amber-600" />,
    },
    {
      id: "card_pos",
      enabled: appSettings.enable_card_pos !== false,
      title: "Card on Delivery (POS)",
      subtitle: "Request a wireless POS card machine with the driver",
      icon: <CreditCard className="w-5 h-5 text-smart-teal" />,
    },
  ];
  const paymentOptions = allPaymentOptions.filter((p) => p.enabled);

  return (
    <div
      onClick={() => {
        if (!isSubmitting) {
          setCompletedOrder(null);
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-3xl max-h-[94vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-smart-teal-deep text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="B's Mart"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-1.5">
                <span>
                  {completedOrder
                    ? "Order Confirmed!"
                    : "B's Mart 1-Page Express Checkout"}
                </span>
              </h2>
              <p className="text-[11px] text-white/80">
                {completedOrder
                  ? `Order #${completedOrder.order.order_number}`
                  : customerSession
                  ? `Signed in as ${customerSession.full_name}`
                  : "Instant Guest Checkout • No password required"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCompletedOrder(null);
              onClose();
            }}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Either Completed Order Receipt OR 1-Page Checkout Form */}
        {completedOrder ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-smart-teal-light text-smart-teal text-xs font-black">
                Order #{completedOrder.order.order_number}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                Thank You, {completedOrder.order.recipient_name}!
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                Your order has been received and saved to your device so you can
                track its live delivery status anytime.
              </p>
            </div>

            {/* Order Summary Card */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 text-left max-w-lg mx-auto space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="font-bold text-slate-500">Order Status</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black">
                  {completedOrder.order.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Delivery Region</span>
                <span className="font-extrabold text-slate-900">
                  {completedOrder.order.zone_name} •{" "}
                  {completedOrder.order.city_area}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Address</span>
                <span className="font-bold text-slate-800 truncate max-w-[240px]">
                  {completedOrder.order.street_address}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Payment Method</span>
                <span className="font-extrabold text-smart-teal uppercase">
                  {completedOrder.order.payment_method}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-sm">
                <span className="font-black text-slate-900">Total Amount</span>
                <span className="font-black text-smart-teal tabular-numbers">
                  ${Number(completedOrder.order.total).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSendWhatsAppReceipt}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Send Confirmation via WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCompletedOrder(null);
                  onClose();
                  setActiveTab("me");
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover text-white text-xs sm:text-sm font-black shadow-md cursor-pointer"
              >
                Track My Order in Profile
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handlePlaceOrder}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
          >
            {submitError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Section 1: Recipient Contact Info */}
            <div className="space-y-3">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-smart-teal" />
                <span>1. Recipient Contact Details</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Full Name *
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Rami Haddad"
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Mobile Phone (WhatsApp / Call) *
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="e.g. 03 123 456 or +961 70..."
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Delivery Region & Address */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-smart-teal" />
                  <span>2. Delivery Region &amp; Address</span>
                </h3>
                {bagTotals.qualifiesForFreeShipping && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-black">
                    🎉 Free Delivery Unlocked
                  </span>
                )}
              </div>

              {/* Delivery Zone Pills */}
              {deliveryZones.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                    Select Delivery Region *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {deliveryZones.map((zone) => {
                      const isSelected = activeZone?.zone_id === zone.zone_id;
                      return (
                        <button
                          key={zone.zone_id}
                          type="button"
                          onClick={() => setSelectedZoneId(zone.zone_id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? "border-smart-teal bg-smart-teal-light/60 shadow-2xs"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 truncate">
                              {zone.zone_name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {zone.estimated_delivery}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-black shrink-0 tabular-numbers ${
                              bagTotals.qualifiesForFreeShipping
                                ? "text-emerald-600"
                                : "text-smart-teal"
                            }`}
                          >
                            {bagTotals.qualifiesForFreeShipping
                              ? "FREE"
                              : `$${Number(zone.delivery_fee).toFixed(2)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    City / Town / Area *
                  </label>
                  <input
                    type="text"
                    required
                    value={cityArea}
                    onChange={(e) => setCityArea(e.target.value)}
                    placeholder="e.g. Achrafieh, Hamra, Dbayeh..."
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Street &amp; Building Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="e.g. Independence Street, Al-Nour Bldg"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Floor / Apartment (Optional)
                  </label>
                  <input
                    type="text"
                    value={buildingFloor}
                    onChange={(e) => setBuildingFloor(e.target.value)}
                    placeholder="e.g. 4th Floor, Apt 12"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Nearby Landmark / Directions (Optional)
                  </label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Near ABC Mall pharmacy"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={rememberDetails}
                  onChange={(e) => setRememberDetails(e.target.checked)}
                  className="rounded border-slate-300 text-smart-teal focus:ring-smart-teal"
                />
                <span>
                  Save my contact &amp; delivery address on this device for 1-tap
                  future orders
                </span>
              </label>
            </div>

            {/* Section 3: Payment Method Selector */}
            <div className="space-y-3">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-smart-teal" />
                <span>3. Select Payment Method</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {paymentOptions.map((opt) => {
                  const isSelected = paymentMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPaymentMethod(opt.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                        isSelected
                          ? "border-smart-teal bg-smart-teal-light/50 shadow-2xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-white border border-slate-200/70 shrink-0">
                        {opt.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-black text-slate-900">
                            {opt.title}
                          </p>
                          {isSelected && (
                            <Check className="w-4 h-4 text-smart-teal shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {opt.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 4: Promo Code & Order Summary */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3.5">
              {/* Promo Code Input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <TicketPercent className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="Have a promo code?"
                    className="w-full h-9 pl-9 pr-3 rounded-xl bg-white border border-slate-200 text-xs font-mono uppercase focus:outline-none focus:border-smart-teal"
                  />
                </div>
                <button
                  type="button"
                  disabled={promoLoading || !promoInput.trim()}
                  onClick={handleApplyPromo}
                  className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-smart-gold text-xs font-black cursor-pointer"
                >
                  {promoLoading ? "Checking..." : "Apply"}
                </button>
              </div>

              {promoError && (
                <p className="text-[11px] font-bold text-rose-600">
                  {promoError}
                </p>
              )}

              {appliedCoupon && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs">
                  <span className="font-bold text-emerald-800">
                    🎟️ Coupon <strong>{appliedCoupon.code}</strong> applied
                  </span>
                  <button
                    type="button"
                    onClick={() => setAppliedCoupon(null)}
                    className="text-[11px] font-extrabold text-rose-600 hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Financial Breakdown */}
              <div className="space-y-1.5 text-xs pt-1 border-t border-slate-200/70">
                <div className="flex justify-between text-slate-600">
                  <span>
                    Selected Items ({bagTotals.selectedUnitCount} units)
                  </span>
                  <span className="font-bold tabular-numbers">
                    ${bagTotals.originalSrpTotal.toFixed(2)}
                  </span>
                </div>

                {bagTotals.itemDiscountSavings > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Flash Sale &amp; Item Discounts</span>
                    <span className="tabular-numbers">
                      -${bagTotals.itemDiscountSavings.toFixed(2)}
                    </span>
                  </div>
                )}

                {bagTotals.couponDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Promo Code ({appliedCoupon?.code})</span>
                    <span className="tabular-numbers">
                      -${bagTotals.couponDiscount.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <span>
                    Delivery Fee ({activeZone?.zone_name || "Lebanon"})
                  </span>
                  <span
                    className={`font-extrabold tabular-numbers ${
                      bagTotals.deliveryFee === 0
                        ? "text-emerald-600"
                        : "text-slate-900"
                    }`}
                  >
                    {bagTotals.deliveryFee === 0
                      ? "FREE"
                      : `$${bagTotals.deliveryFee.toFixed(2)}`}
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 text-sm sm:text-base font-black text-slate-900">
                  <span>Total to Pay</span>
                  <span className="text-lg sm:text-xl text-smart-teal tabular-numbers">
                    ${bagTotals.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={isSubmitting || bagTotals.selectedLines.length === 0}
              className="w-full h-12 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover disabled:opacity-50 text-white font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Placing Your Order...</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 text-smart-gold" />
                  <span>
                    Place Order • ${bagTotals.grandTotal.toFixed(2)}
                  </span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
