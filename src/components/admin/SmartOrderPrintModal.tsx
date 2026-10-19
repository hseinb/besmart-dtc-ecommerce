"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Printer,
  FileText,
  Truck,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  User,
  PackageCheck,
} from "lucide-react";
import { SmartOrder, SmartOrderDetail, SmartOrderStatus } from "@/types/smart.types";
import { createClient } from "@/lib/supabase/client";

export type PrintDocMode = "bill" | "delivery_note" | "both";

interface SmartOrderPrintModalProps {
  order: SmartOrder | null;
  initialMode?: PrintDocMode;
  onClose: () => void;
  onUpdateSmartStatus?: (orderId: number, nextStatus: SmartOrderStatus) => Promise<void>;
}

export function SmartOrderPrintModal({
  order,
  initialMode = "both",
  onClose,
  onUpdateSmartStatus,
}: SmartOrderPrintModalProps) {
  const [mode, setMode] = useState<PrintDocMode>(initialMode);
  const [details, setDetails] = useState<SmartOrderDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, order?.order_id]);

  useEffect(() => {
    if (!order) return;
    let isMounted = true;

    async function loadOrderLines(orderId: number) {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("smart_order_details")
          .select("*, items(item_id, code, item_name, upc)")
          .eq("order_id", orderId)
          .order("order_detail_id", { ascending: true });

        if (!error && data && isMounted) {
          setDetails(data as unknown as SmartOrderDetail[]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadOrderLines(order.order_id);

    return () => {
      isMounted = false;
    };
  }, [order]);

  if (!order) return null;

  const totalPieces = details.reduce(
    (sum, line) => sum + Number(line.quantity || 0),
    0
  );

  const handlePrint = () => {
    window.print();
  };

  const handleMarkReadyForDispatch = async () => {
    if (!onUpdateSmartStatus) return;
    setIsUpdatingStatus(true);
    try {
      await onUpdateSmartStatus(order.order_id, "Out for Delivery");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:static print:bg-white print:p-0 print:block">
      {/* Print-Specific Global Rules */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #smart-order-printable-root,
          #smart-order-printable-root * {
            visibility: visible;
          }
          #smart-order-printable-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
          }
          .print-page-break {
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>

      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col print:max-h-none print:rounded-none print:border-none print:shadow-none">
        {/* Top Toolbar (Hidden when printing) */}
        <div className="bg-smart-teal-deep text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Printer className="w-5 h-5 text-smart-gold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-smart-gold">
                  #{order.order_number}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-black uppercase">
                  B&apos;s Mart Status: {order.status}
                </span>
                {order.b2b_order_id && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-300/30 text-[10px] font-mono font-bold">
                    Warehouse #3899 • Order #{order.b2b_order_id}
                    {order.trx_id ? ` (TRX #${order.trx_id})` : ""}
                  </span>
                )}
              </div>
              <h2 className="text-base font-black">
                Operations Print Center — Customer Bill &amp; Delivery Note
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Document Mode Selector */}
            <div className="inline-flex rounded-xl bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setMode("bill")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  mode === "bill"
                    ? "bg-smart-gold text-slate-950"
                    : "text-white hover:bg-white/10"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Customer Bill</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("delivery_note")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  mode === "delivery_note"
                    ? "bg-smart-gold text-slate-950"
                    : "text-white hover:bg-white/10"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Delivery Note</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("both")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  mode === "both"
                    ? "bg-smart-gold text-slate-950"
                    : "text-white hover:bg-white/10"
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Both (2 Pages)</span>
              </button>
            </div>

            {/* One-Click Mark Ready for Dispatch (Updates smart_orders ONLY) */}
            {onUpdateSmartStatus &&
              order.status !== "Out for Delivery" &&
              order.status !== "Delivered" && (
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={handleMarkReadyForDispatch}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Marks B's Mart order as Ready for Dispatch / Out for Delivery (does not touch B2B public.orders)"
                >
                  {isUpdatingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PackageCheck className="w-4 h-4" />
                  )}
                  <span>Mark Ready for Dispatch</span>
                </button>
              )}

            {/* Print Trigger */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-smart-gold hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Now</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Preview & Printable Root */}
        <div
          id="smart-order-printable-root"
          className="p-6 sm:p-8 overflow-y-auto space-y-8 bg-slate-50 print:bg-white print:p-0 print:space-y-0"
        >
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-smart-teal" />
              <p className="text-xs font-bold">
                Loading order items for printing...
              </p>
            </div>
          ) : (
            <>
              {/* ============================================================ */}
              {/* DOCUMENT 1: CUSTOMER RETAIL BILL / INVOICE                   */}
              {/* ============================================================ */}
              {(mode === "bill" || mode === "both") && (
                <div
                  className={`bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-slate-900 shadow-xs print:shadow-none print:border-none print:rounded-none print:p-6 ${
                    mode === "both" ? "print-page-break" : ""
                  }`}
                >
                  {/* Bill Header */}
                  <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-5">
                    <div className="flex items-center gap-3">
                      <img
                        src="/logo.png"
                        alt="B's Mart"
                        className="w-14 h-14 object-contain rounded-xl border border-slate-200"
                      />
                      <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">
                          B&apos;s MART
                        </h1>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Customer Retail Invoice / Bill
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs space-y-0.5">
                      <div className="text-sm font-black font-mono text-slate-900">
                        ORDER #{order.order_number}
                      </div>
                      <div className="text-slate-600 font-semibold">
                        Date:{" "}
                        {new Date(order.created_date).toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                      <div className="font-bold uppercase text-slate-800">
                        Payment:{" "}
                        {order.payment_method === "cod"
                          ? "Cash on Delivery (COD)"
                          : order.payment_method.toUpperCase()}
                      </div>
                      {order.b2b_order_id && (
                        <div className="text-[11px] font-mono text-slate-500">
                          Ref #3899-{order.b2b_order_id}
                          {order.trx_id ? ` • TRX #${order.trx_id}` : ""}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer & Delivery Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Billed To Customer
                      </div>
                      <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{order.recipient_name}</span>
                      </div>
                      <div className="font-mono font-bold text-slate-700 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{order.recipient_phone}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Delivery Destination
                      </div>
                      <div className="font-black text-slate-900 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>
                          {order.zone_name || "Lebanon"} — {order.city_area}
                        </span>
                      </div>
                      <div className="text-slate-700 font-medium">
                        {order.street_address}
                        {order.building_floor
                          ? `, ${order.building_floor}`
                          : ""}
                      </div>
                      {order.landmark && (
                        <div className="text-slate-500">
                          Landmark: {order.landmark}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Itemized Retail Bill Table */}
                  <table className="w-full text-left border-collapse text-xs mb-6">
                    <thead>
                      <tr className="border-y-2 border-slate-900 text-[11px] font-black uppercase text-slate-700 bg-slate-100/70">
                        <th className="py-2.5 px-2 w-10">#</th>
                        <th className="py-2.5 px-2">Code / SKU</th>
                        <th className="py-2.5 px-2">Item Description</th>
                        <th className="py-2.5 px-2 text-center">Qty</th>
                        <th className="py-2.5 px-2 text-right">Price</th>
                        <th className="py-2.5 px-2 text-right">Disc</th>
                        <th className="py-2.5 px-2 text-right">Net Unit</th>
                        <th className="py-2.5 px-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {details.map((line, idx) => {
                        const rawItem = Array.isArray(line.items)
                          ? line.items[0]
                          : line.items;
                        const code = rawItem?.code || `#${line.item_id}`;
                        const name =
                          rawItem?.item_name || `Item #${line.item_id}`;
                        const hasDisc = Number(line.discount || 0) > 0;
                        return (
                          <tr key={line.order_detail_id}>
                            <td className="py-2.5 px-2 font-mono text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-2 font-mono font-bold text-slate-900">
                              {code}
                            </td>
                            <td className="py-2.5 px-2 font-semibold text-slate-900">
                              {name}
                            </td>
                            <td className="py-2.5 px-2 text-center font-black text-slate-900">
                              {Number(line.quantity)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                              ${Number(line.srp || line.unit_price).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                              {hasDisc
                                ? `${Number(line.discount).toFixed(0)}%`
                                : "—"}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                              ${Number(line.unit_price).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-black text-slate-900">
                              ${Number(line.total).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Bill Totals Breakdown */}
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-6 pt-4 border-t-2 border-slate-900">
                    <div className="text-xs text-slate-600 space-y-1 max-w-sm">
                      <div className="font-bold text-slate-900">
                        Total Items: {details.length} SKUs ({totalPieces} pcs)
                      </div>
                      {order.note && (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-slate-800">
                          <span className="font-black">Customer Note: </span>
                          {order.note}
                        </div>
                      )}
                      <p className="text-[11px] text-slate-500 pt-2">
                        Thank you for shopping with B&apos;s Mart!
                      </p>
                    </div>

                    <div className="w-full sm:w-72 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Items Subtotal:</span>
                        <span className="font-mono font-bold text-slate-900">
                          ${Number(order.subtotal).toFixed(2)}
                        </span>
                      </div>

                      {Number(order.coupon_discount || 0) > 0 && (
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>
                            Promo Discount{" "}
                            {order.coupon_code ? `(${order.coupon_code})` : ""}:
                          </span>
                          <span className="font-mono">
                            -${Number(order.coupon_discount).toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-slate-600">
                        <span>
                          Delivery Fee ({order.zone_name || "Standard"}):
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {Number(order.delivery_fee) === 0
                            ? "FREE"
                            : `$${Number(order.delivery_fee).toFixed(2)}`}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-2.5 border-t border-slate-300 text-base font-black text-slate-950">
                        <span>TOTAL DUE (USD):</span>
                        <span className="font-mono text-lg">
                          ${Number(order.total).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* DOCUMENT 2: DELIVERY NOTE / COURIER WAYBILL                  */}
              {/* ============================================================ */}
              {(mode === "delivery_note" || mode === "both") && (
                <div className="bg-white rounded-2xl border-2 border-slate-900 p-6 sm:p-8 text-slate-900 shadow-xs print:shadow-none print:rounded-none print:p-6">
                  {/* Delivery Note Header */}
                  <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-5">
                    <div className="flex items-center gap-3">
                      <img
                        src="/logo.png"
                        alt="B's Mart"
                        className="w-14 h-14 object-contain rounded-xl border border-slate-200"
                      />
                      <div>
                        <div className="inline-block px-2.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest mb-1">
                          Courier Waybill
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">
                          DELIVERY NOTE
                        </h1>
                        <p className="text-xs font-bold text-slate-600">
                          For Delivery Company &amp; Driver Handover
                        </p>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="text-lg font-black font-mono text-slate-950 border-2 border-slate-900 px-3 py-1 rounded-lg">
                        #{order.order_number}
                      </div>
                      <div className="text-xs font-bold text-slate-600">
                        Dispatch Date:{" "}
                        {new Date().toLocaleDateString("en-GB", {
                          dateStyle: "medium",
                        })}
                      </div>
                      {order.b2b_order_id && (
                        <div className="text-[11px] font-mono text-slate-500">
                          Warehouse Ref: #3899-{order.b2b_order_id}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Driver Destination & COD Collection Banner */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {/* Deliver To Box (2 columns wide) */}
                    <div className="sm:col-span-2 p-4 rounded-xl border-2 border-slate-900 bg-slate-50 space-y-2">
                      <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                        DELIVER TO RECIPIENT:
                      </div>
                      <div className="text-lg font-black text-slate-950">
                        {order.recipient_name}
                      </div>
                      <div className="text-base font-mono font-black text-slate-900">
                        Tel: {order.recipient_phone}
                      </div>
                      <div className="pt-1 border-t border-slate-300 text-xs space-y-1">
                        <div>
                          <span className="font-black uppercase text-slate-700">
                            Zone / Area:{" "}
                          </span>
                          <span className="font-extrabold text-slate-950 text-sm">
                            {order.zone_name || "Lebanon"} — {order.city_area}
                          </span>
                        </div>
                        <div>
                          <span className="font-black uppercase text-slate-700">
                            Street &amp; Building:{" "}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {order.street_address}
                            {order.building_floor
                              ? ` • ${order.building_floor}`
                              : ""}
                          </span>
                        </div>
                        {order.landmark && (
                          <div>
                            <span className="font-black uppercase text-slate-700">
                              Landmark:{" "}
                            </span>
                            <span className="font-bold text-slate-900">
                              {order.landmark}
                            </span>
                          </div>
                        )}
                        {order.note && (
                          <div className="mt-1.5 p-2 rounded bg-amber-100/80 border border-amber-300 text-slate-950 font-bold">
                            Driver Note: {order.note}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* COD Collection Box (1 column wide) */}
                    <div className="p-4 rounded-xl border-2 border-slate-900 flex flex-col justify-between bg-slate-100">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                          PAYMENT COLLECTION
                        </div>
                        <div className="mt-1 inline-block px-2 py-0.5 rounded bg-slate-900 text-white text-xs font-black uppercase">
                          {order.payment_method === "cod"
                            ? "CASH ON DELIVERY (COD)"
                            : order.payment_method.toUpperCase()}
                        </div>
                      </div>

                      <div className="my-3">
                        <div className="text-[11px] font-bold text-slate-600">
                          Amount to Collect from Customer:
                        </div>
                        <div className="text-3xl font-black font-mono text-slate-950">
                          ${Number(order.total).toFixed(2)}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500">
                          (Includes Items + Delivery Fee)
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-xs font-black">
                        <span>Total Pieces:</span>
                        <span className="text-sm font-mono">
                          {totalPieces} pcs ({details.length} SKUs)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Package Contents Checklist */}
                  <div className="mb-6">
                    <div className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                      Package Contents Checklist
                    </div>
                    <table className="w-full text-left border-collapse text-xs border border-slate-300">
                      <thead>
                        <tr className="border-b-2 border-slate-900 bg-slate-100 text-[11px] font-black uppercase text-slate-700">
                          <th className="py-2 px-2.5 w-12 text-center">Check</th>
                          <th className="py-2 px-2.5 w-32">Code / SKU</th>
                          <th className="py-2 px-2.5">Item Description</th>
                          <th className="py-2 px-2.5 w-24 text-center">
                            Quantity
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {details.map((line) => {
                          const rawItem = Array.isArray(line.items)
                            ? line.items[0]
                            : line.items;
                          const code = rawItem?.code || `#${line.item_id}`;
                          const name =
                            rawItem?.item_name || `Item #${line.item_id}`;
                          return (
                            <tr key={line.order_detail_id}>
                              <td className="py-2 px-2.5 text-center font-mono text-sm">
                                ☐
                              </td>
                              <td className="py-2 px-2.5 font-mono font-bold text-slate-900">
                                {code}
                              </td>
                              <td className="py-2 px-2.5 font-semibold text-slate-900">
                                {name}
                              </td>
                              <td className="py-2 px-2.5 text-center font-mono font-black text-sm text-slate-950">
                                {Number(line.quantity)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Handover & Signatures Block */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t-2 border-slate-900 text-xs">
                    <div className="border border-slate-300 rounded-xl p-3 h-24 flex flex-col justify-between">
                      <div className="font-black uppercase text-[10px] text-slate-500">
                        1. Prepared By (Operations)
                      </div>
                      <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] text-slate-500">
                        Name &amp; Signature
                      </div>
                    </div>

                    <div className="border border-slate-300 rounded-xl p-3 h-24 flex flex-col justify-between">
                      <div className="font-black uppercase text-[10px] text-slate-500">
                        2. Courier / Driver Handover
                      </div>
                      <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] text-slate-500">
                        Driver Name &amp; Signature
                      </div>
                    </div>

                    <div className="border border-slate-300 rounded-xl p-3 h-24 flex flex-col justify-between">
                      <div className="font-black uppercase text-[10px] text-slate-500">
                        3. Customer Received In Good Order
                      </div>
                      <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] text-slate-500">
                        Customer Signature &amp; Date/Time
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
