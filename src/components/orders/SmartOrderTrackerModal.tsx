"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  ShoppingBag,
  Share2,
  MapPin,
  CreditCard,
  Loader2,
  RotateCcw,
  Check,
} from "lucide-react";
import {
  ItemWithImages,
  SmartOrder,
  SmartOrderDetail,
  SmartOrderStatus,
} from "@/types/smart.types";
import { createClient } from "@/lib/supabase/client";
import { getItemImageUrl } from "@/lib/media";
import { useSmartCartStore } from "@/store/useSmartCartStore";
import { useSmartNavStore } from "@/store/useSmartNavStore";

interface OrderDetailWithItem extends SmartOrderDetail {
  items?: ItemWithImages;
}

interface SmartOrderTrackerModalProps {
  order: SmartOrder | null;
  onClose: () => void;
}

const ORDER_STEPS: {
  status: SmartOrderStatus;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    status: "Pending",
    label: "Order Placed",
    subtitle: "Received & queued for warehouse confirmation",
    icon: <Clock className="w-4 h-4" />,
  },
  {
    status: "Confirmed",
    label: "Confirmed & Packing",
    subtitle: "Verified by B's Mart warehouse team",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  {
    status: "Out for Delivery",
    label: "Out for Delivery",
    subtitle: "With our courier on the way to your address",
    icon: <Truck className="w-4 h-4" />,
  },
  {
    status: "Delivered",
    label: "Delivered",
    subtitle: "Handed over to recipient",
    icon: <PackageCheck className="w-4 h-4" />,
  },
];

export function SmartOrderTrackerModal({
  order,
  onClose,
}: SmartOrderTrackerModalProps) {
  const { appSettings, openProductDetail, setActiveTab } = useSmartNavStore();
  const { addItem } = useSmartCartStore();

  const [liveOrder, setLiveOrder] = useState<SmartOrder | null>(order);
  const [orderDetails, setOrderDetails] = useState<OrderDetailWithItem[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [reorderedFeedback, setReorderedFeedback] = useState(false);

  // Sync liveOrder prop & subscribe to Supabase Realtime postgres_changes on smart_orders
  useEffect(() => {
    setLiveOrder(order);
    if (!order) return;

    let cancelled = false;
    const supabase = createClient();

    async function loadOrderDetails() {
      if (!order) return;
      setIsLoadingDetails(true);
      try {
        const { data } = await supabase
          .from("smart_order_details")
          .select("*, items(*, item_images(*))")
          .eq("order_id", order.order_id)
          .order("order_detail_id", { ascending: true });

        if (!cancelled && data) {
          setOrderDetails(data as unknown as OrderDetailWithItem[]);
        }
      } finally {
        if (!cancelled) setIsLoadingDetails(false);
      }
    }

    loadOrderDetails();

    // Realtime subscription for live order status updates from smartBridge.js / Admin
    const channel = supabase
      .channel(`smart_order_tracker_${order.order_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "smart_orders",
          filter: `order_id=eq.${order.order_id}`,
        },
        (payload) => {
          if (payload.new) {
            setLiveOrder(payload.new as SmartOrder);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [order]);

  if (!liveOrder) return null;

  const currentStepIndex = ORDER_STEPS.findIndex(
    (s) => s.status.toLowerCase() === (liveOrder.status || "").toLowerCase()
  );
  const isCancelled =
    (liveOrder.status || "").toLowerCase() === "cancelled";

  const handleReorderAll = () => {
    let addedCount = 0;
    for (const d of orderDetails) {
      if (d.items && d.items.is_active) {
        addItem(d.items, Math.max(1, Number(d.quantity) || 1));
        addedCount++;
      }
    }
    if (addedCount > 0) {
      setReorderedFeedback(true);
      setTimeout(() => {
        setReorderedFeedback(false);
        onClose();
        setActiveTab("bag");
      }, 900);
    }
  };

  const handleWhatsAppSupport = () => {
    const text = `Hello B's Mart Support, I am inquiring about my Order *#${liveOrder.order_number}* (Status: ${liveOrder.status}, Recipient: ${liveOrder.recipient_name}).`;
    const supportPhone = (appSettings.whatsapp_support_phone || "").replace(
      /[^0-9]/g,
      ""
    );
    const waUrl = supportPhone
      ? `https://wa.me/${supportPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top Bar */}
        <div className="px-5 py-3.5 bg-smart-teal-deep text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-black">
                Order #{liveOrder.order_number}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Tracking
              </span>
            </div>
            <p className="text-[11px] text-white/75">
              Placed on{" "}
              {new Date(liveOrder.created_date).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Live Status Stepper */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 sm:p-5">
            {isCancelled ? (
              <div className="flex items-center gap-3 text-rose-600">
                <XCircle className="w-7 h-7 shrink-0" />
                <div>
                  <p className="text-sm font-black">Order Cancelled</p>
                  <p className="text-xs text-slate-500">
                    This order was cancelled. Contact support if you need assistance.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {ORDER_STEPS.map((step, idx) => {
                  const isCompleted =
                    currentStepIndex >= 0 && idx <= currentStepIndex;
                  const isCurrent = idx === currentStepIndex;

                  return (
                    <div
                      key={step.status}
                      className={`p-3 rounded-xl border transition-all flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2 ${
                        isCurrent
                          ? "bg-white border-smart-teal shadow-xs"
                          : isCompleted
                          ? "bg-emerald-50/60 border-emerald-200"
                          : "bg-white/60 border-slate-200/60 opacity-55"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isCurrent
                            ? "bg-smart-teal text-smart-gold"
                            : isCompleted
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {step.icon}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900">
                          {step.label}
                        </p>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                          {step.subtitle}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Delivery & Payment Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl border border-slate-200/80 space-y-1">
              <div className="flex items-center gap-1.5 font-black text-slate-900">
                <MapPin className="w-4 h-4 text-smart-teal" />
                <span>Delivery Address</span>
              </div>
              <p className="font-bold text-slate-800">
                {liveOrder.recipient_name} • {liveOrder.recipient_phone}
              </p>
              <p className="text-slate-600">
                {liveOrder.zone_name ? `${liveOrder.zone_name} — ` : ""}
                {liveOrder.city_area}, {liveOrder.street_address}
                {liveOrder.building_floor ? `, ${liveOrder.building_floor}` : ""}
              </p>
              {liveOrder.landmark && (
                <p className="text-[11px] text-slate-400">
                  Landmark: {liveOrder.landmark}
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-1.5 font-black text-slate-900">
                <CreditCard className="w-4 h-4 text-smart-teal" />
                <span>Payment &amp; Totals</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Method</span>
                <span className="font-black text-smart-teal uppercase">
                  {liveOrder.payment_method}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-bold tabular-numbers">
                  ${Number(liveOrder.subtotal).toFixed(2)}
                </span>
              </div>
              {Number(liveOrder.coupon_discount) > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Coupon ({liveOrder.coupon_code})</span>
                  <span className="tabular-numbers">
                    -${Number(liveOrder.coupon_discount).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Delivery Fee</span>
                <span className="font-bold tabular-numbers">
                  {Number(liveOrder.delivery_fee) === 0
                    ? "FREE"
                    : `$${Number(liveOrder.delivery_fee).toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-100 text-sm font-black text-slate-900">
                <span>Total</span>
                <span className="text-smart-teal tabular-numbers">
                  ${Number(liveOrder.total).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Ordered Line Items */}
          <div className="space-y-2.5">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
              Order Items ({orderDetails.length})
            </h3>

            {isLoadingDetails ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs font-bold text-smart-teal">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading order items...</span>
              </div>
            ) : orderDetails.length > 0 ? (
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 overflow-hidden">
                {orderDetails.map((detail) => {
                  const prod = detail.items;
                  return (
                    <div
                      key={detail.order_detail_id}
                      onClick={() => {
                        if (prod) {
                          onClose();
                          openProductDetail(prod);
                        }
                      }}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {prod && (
                          <img
                            src={getItemImageUrl(prod, "thumb")}
                            alt={prod.item_name}
                            className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-200/70 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {prod?.item_name || `Item #${detail.item_id}`}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {prod?.code ? `SKU: ${prod.code} • ` : ""}Qty:{" "}
                            {detail.quantity} × $
                            {Number(detail.unit_price).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs sm:text-sm font-black text-smart-teal tabular-numbers shrink-0">
                        ${Number(detail.total).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Order line details recorded in warehouse system.
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions: Reorder All & WhatsApp Support */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleWhatsAppSupport}
            className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp Support</span>
          </button>

          {orderDetails.length > 0 && (
            <button
              type="button"
              onClick={handleReorderAll}
              className="px-5 py-2.5 rounded-xl bg-smart-teal hover:bg-smart-teal-hover text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {reorderedFeedback ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Added to Bag!</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5 text-smart-gold" />
                  <span>Buy Again (Add All to Bag)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
