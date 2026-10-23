"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  User,
  Phone,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  Heart,
  Eye,
  TicketPercent,
  MapPin,
  Search,
  Plus,
  Trash2,
  LogOut,
  AlertTriangle,
  Loader2,
  Sparkles,
  Check,
  ChevronRight,
  MessageSquare,
  Smartphone,
  Settings,
} from "lucide-react";
import {
  SmartCoupon,
  SmartDeliveryZone,
  SmartOrder,
  SmartOrderStatus,
} from "@/types/smart.types";
import { useSmartNavStore } from "@/store/useSmartNavStore";
import { useSmartAuthStore } from "@/store/useSmartAuthStore";
import { useSmartCartStore } from "@/store/useSmartCartStore";
import { useSmartWishlistStore } from "@/store/useSmartWishlistStore";
import { loadLocalSavedOrders } from "@/lib/smartOrders";
import { SmartProductCard } from "@/components/product/SmartProductCard";
import { SmartOrderTrackerModal } from "@/components/orders/SmartOrderTrackerModal";
import { createClient } from "@/lib/supabase/client";

interface SmartMeViewProps {
  deliveryZones: SmartDeliveryZone[];
  collectibleCoupons: SmartCoupon[];
}

export function SmartMeView({
  deliveryZones,
  collectibleCoupons,
}: SmartMeViewProps) {
  const { setActiveTab } = useSmartNavStore();
  const {
    customer,
    staffUser,
    addresses,
    customerOrders,
    isLoadingAuth,
    isLoadingOrders,
    hydrate: hydrateAuth,
    signInUnified,
    sendPhoneOtp,
    verifySmsOtpAndAuth,
    addAddress,
    deleteAddress,
    setDefaultAddress,
    fetchCustomerOrders,
    lookupGuestOrder,
    signOut,
    deleteMyAccount,
  } = useSmartAuthStore();

  const { collectedCoupons, appliedCoupon, setAppliedCoupon, collectCoupon } =
    useSmartCartStore();
  const { wishlistItems, recentlyViewedItems, clearRecentlyViewed } =
    useSmartWishlistStore();

  const [localDeviceOrders, setLocalDeviceOrders] = useState<SmartOrder[]>([]);
  const [selectedOrderStatusFilter, setSelectedOrderStatusFilter] = useState<
    SmartOrderStatus | "ALL"
  >("ALL");
  const [activeTrackedOrder, setActiveTrackedOrder] =
    useState<SmartOrder | null>(null);

  // Customer Auth Modal State (Sign In | Create Account + RetailSMS OTP)
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [signInSubMode, setSignInSubMode] = useState<
    "password" | "otp_login" | "reset_password"
  >("password");
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [authPhone, setAuthPhone] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [otpCodeInput, setOtpCodeInput] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  // Guest Order Lookup State
  const [lookupOrderNo, setLookupOrderNo] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Address Form State
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [addrLabel, setAddrLabel] = useState("Home");
  const [addrRecipient, setAddrRecipient] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrZoneId, setAddrZoneId] = useState<number | null>(
    deliveryZones[0]?.zone_id ?? null
  );
  const [addrCity, setAddrCity] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrBuilding, setAddrBuilding] = useState("");
  const [addrLandmark, setAddrLandmark] = useState("");

  // Account Deletion Confirmation State (Apple Guideline 5.1.1(v))
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    hydrateAuth();
    setLocalDeviceOrders(loadLocalSavedOrders());
  }, [hydrateAuth]);

  // 1-second countdown timer for SMS OTP resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  // Realtime subscription to update orders list live when smartBridge.js updates status
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("smart_me_orders_realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "smart_orders",
        },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as SmartOrder;
            setLocalDeviceOrders((prev) =>
              prev.map((o) =>
                o.order_id === updated.order_id ? updated : o
              )
            );
            if (customer?.customer_id) {
              fetchCustomerOrders();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customer?.customer_id, fetchCustomerOrders]);

  // Combine cloud customerOrders + local device orders without duplicates
  const allMyOrders = useMemo(() => {
    const map = new Map<number, SmartOrder>();
    for (const o of [...customerOrders, ...localDeviceOrders]) {
      map.set(o.order_id, o);
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
    );
  }, [customerOrders, localDeviceOrders]);

  const statusCounts = useMemo(() => {
    const counts = {
      Pending: 0,
      Confirmed: 0,
      "Out for Delivery": 0,
      Delivered: 0,
    };
    for (const o of allMyOrders) {
      if (o.status === "Pending") counts.Pending++;
      else if (o.status === "Confirmed") counts.Confirmed++;
      else if (o.status === "Out for Delivery") counts["Out for Delivery"]++;
      else if (o.status === "Delivered") counts.Delivered++;
    }
    return counts;
  }, [allMyOrders]);

  const filteredOrders = useMemo(() => {
    if (selectedOrderStatusFilter === "ALL") return allMyOrders;
    return allMyOrders.filter((o) => o.status === selectedOrderStatusFilter);
  }, [allMyOrders, selectedOrderStatusFilter]);

  const allAvailableCoupons = useMemo(() => {
    const map = new Map<string, SmartCoupon>();
    for (const c of [...collectibleCoupons, ...collectedCoupons]) {
      map.set(c.code.toUpperCase(), c);
    }
    return Array.from(map.values());
  }, [collectibleCoupons, collectedCoupons]);

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res = await signInUnified(authPhone, authPassword);
    if (!res.success) {
      setAuthError(res.errorMessage || "Invalid credentials.");
      return;
    }
    setIsOtpModalOpen(false);
    setAuthPassword("");
    if (res.accountType === "staff") {
      setActiveTab("admin");
    }
  };

  const handleRequestSmsOtp = async (
    purpose: "signup" | "login" | "reset_password",
    e?: React.FormEvent
  ) => {
    if (e) e.preventDefault();
    setAuthError(null);

    if (purpose === "signup") {
      if (!authName.trim()) {
        setAuthError("Please enter your full name.");
        return;
      }
      if (!authPhone.trim()) {
        setAuthError("Please enter your Lebanon mobile phone number.");
        return;
      }
      if (!authPassword || authPassword.length < 6) {
        setAuthError("Password must be at least 6 characters.");
        return;
      }
    } else {
      if (!authPhone.trim()) {
        setAuthError("Please enter your Lebanon mobile phone number.");
        return;
      }
    }

    const res = await sendPhoneOtp(authPhone, purpose);
    if (!res.success) {
      if (res.retryAfterSeconds && res.retryAfterSeconds > 0) {
        setResendCooldown(res.retryAfterSeconds);
      }
      setAuthError(res.error || "Could not send SMS verification code.");
      return;
    }

    setResendCooldown(res.cooldownSeconds || 60);
    setOtpCodeInput("");
    setOtpStep("verify");
  };

  const handleVerifySmsOtp = async (
    purpose: "signup" | "login" | "reset_password",
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setAuthError(null);

    const cleanCode = otpCodeInput.replace(/[^0-9]/g, "");
    if (cleanCode.length !== 6) {
      setAuthError("Please enter the 6-digit SMS verification code.");
      return;
    }

    if (purpose === "reset_password" && (!authPassword || authPassword.length < 6)) {
      setAuthError("New password must be at least 6 characters.");
      return;
    }

    const res = await verifySmsOtpAndAuth({
      phone: authPhone,
      code: cleanCode,
      purpose,
      fullName: purpose === "signup" ? authName : undefined,
      password:
        purpose === "signup" || purpose === "reset_password"
          ? authPassword
          : undefined,
      email: purpose === "signup" ? authEmail : undefined,
    });

    if (!res.success) {
      setAuthError(res.error || "Invalid or expired verification code.");
      return;
    }

    setIsOtpModalOpen(false);
    setOtpStep("request");
    setSignInSubMode("password");
    setOtpCodeInput("");
    setAuthPassword("");
  };

  const handleGuestLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupLoading(true);
    try {
      const found = await lookupGuestOrder(lookupOrderNo, lookupPhone);
      if (found) {
        setActiveTrackedOrder(found);
      } else {
        setLookupError(
          "No matching order found. Please check your Order # (e.g. BSM-...) and Phone Number."
        );
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrCity.trim() || !addrStreet.trim()) return;
    await addAddress({
      label: addrLabel,
      recipient_name: addrRecipient || customer?.full_name || "Recipient",
      phone: addrPhone || customer?.phone || "",
      zone_id: addrZoneId,
      city_area: addrCity,
      street: addrStreet,
      building_floor: addrBuilding,
      landmark: addrLandmark,
      is_default: addresses.length === 0,
    });
    setIsAddingAddress(false);
    setAddrCity("");
    setAddrStreet("");
    setAddrBuilding("");
    setAddrLandmark("");
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    const res = await deleteMyAccount();
    setIsDeletingAccount(false);
    if (res.success) {
      setIsDeleteConfirmOpen(false);
    }
  };

  const getAuthCardHeading = () => {
    if (authMode === "signup") {
      return otpStep === "verify"
        ? "Verify Mobile Number"
        : "Create Account";
    }
    if (signInSubMode === "otp_login") {
      return otpStep === "verify"
        ? "Enter SMS Code"
        : "Sign In with SMS Code";
    }
    if (signInSubMode === "reset_password") {
      return otpStep === "verify"
        ? "Reset Your Password"
        : "Forgot Password";
    }
    return "Sign In";
  };

  const renderAuthCard = (isModal: boolean) => (
    <div
      onClick={isModal ? (e) => e.stopPropagation() : undefined}
      className={
        isModal
          ? "bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200"
          : "bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-5 max-w-xl mx-auto"
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="B's Mart"
            className="w-10 h-10 rounded-xl object-cover"
          />
          <div>
            <h3 className="text-base font-black text-slate-900">
              {getAuthCardHeading()}
            </h3>
            <p className="text-xs text-slate-500">
              Sync your orders, wishlist &amp; delivery addresses
            </p>
          </div>
        </div>
        {isModal && (
          <button
            type="button"
            onClick={() => setIsOtpModalOpen(false)}
            className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Clean 2-Tab Auth Switcher (Sign In | Create Account) */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 text-xs font-extrabold">
        <button
          type="button"
          onClick={() => {
            setAuthError(null);
            setAuthMode("signin");
            setSignInSubMode("password");
            setOtpStep("request");
            setOtpCodeInput("");
          }}
          className={`py-2 rounded-xl transition-all cursor-pointer ${
            authMode === "signin"
              ? "bg-white text-smart-teal shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthError(null);
            setAuthMode("signup");
            setOtpStep("request");
            setOtpCodeInput("");
          }}
          className={`py-2 rounded-xl transition-all cursor-pointer ${
            authMode === "signup"
              ? "bg-white text-smart-teal shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Create Account
        </button>
      </div>

      {authError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
          {authError}
        </div>
      )}

      {authMode === "signin" ? (
        signInSubMode === "password" ? (
          <form onSubmit={handlePasswordSignIn} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone Number or Username
              </label>
              <input
                type="text"
                required
                value={authPhone}
                onChange={(e) => setAuthPhone(e.target.value)}
                placeholder="Enter phone number or username"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setSignInSubMode("reset_password");
                    setOtpStep("request");
                    setOtpCodeInput("");
                    setAuthPassword("");
                  }}
                  className="text-xs font-bold text-smart-teal hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
              />
            </div>

            <button
              type="submit"
              disabled={isLoadingAuth}
              className="w-full h-11 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoadingAuth ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>

            <div className="pt-1 flex items-center justify-between text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setSignInSubMode("otp_login");
                  setOtpStep("request");
                  setOtpCodeInput("");
                }}
                className="inline-flex items-center gap-1.5 text-smart-teal hover:underline cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Sign in with SMS Code</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setSignInSubMode("reset_password");
                  setOtpStep("request");
                  setOtpCodeInput("");
                  setAuthPassword("");
                }}
                className="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        ) : signInSubMode === "otp_login" ? (
          otpStep === "request" ? (
            <form
              onSubmit={(e) => handleRequestSmsOtp("login", e)}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Phone Number (Lebanon)
                </label>
                <input
                  type="tel"
                  required
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                  placeholder="e.g. 03 123 456 or +961 70..."
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
                />
              </div>

              <button
                type="submit"
                disabled={isLoadingAuth}
                className="w-full h-11 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoadingAuth ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending SMS Code...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>Send SMS Code</span>
                  </>
                )}
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setSignInSubMode("password");
                    setOtpStep("request");
                    setOtpCodeInput("");
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
                >
                  Back to Password Sign In
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={(e) => handleVerifySmsOtp("login", e)}
              className="space-y-4"
            >
              <div className="p-3 rounded-2xl bg-smart-teal-light/60 border border-smart-teal/20 text-xs text-slate-700">
                We sent a 6-digit SMS verification code to{" "}
                <span className="font-mono font-black text-slate-900">
                  {authPhone}
                </span>
                . Enter it below to sign in.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  6-Digit SMS Verification Code
                </label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCodeInput}
                  onChange={(e) =>
                    setOtpCodeInput(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="123456"
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 text-center font-mono text-lg font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-smart-teal"
                />
              </div>

              <button
                type="submit"
                disabled={isLoadingAuth}
                className="w-full h-11 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoadingAuth ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify &amp; Sign In</span>
                )}
              </button>

              <div className="flex items-center justify-between text-xs font-bold pt-1">
                <button
                  type="button"
                  disabled={resendCooldown > 0 || isLoadingAuth}
                  onClick={() => handleRequestSmsOtp("login")}
                  className={`cursor-pointer ${
                    resendCooldown > 0
                      ? "text-slate-400 cursor-not-allowed"
                      : "text-smart-teal hover:underline"
                  }`}
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Resend SMS Code"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setSignInSubMode("password");
                    setOtpStep("request");
                    setOtpCodeInput("");
                  }}
                  className="text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
                >
                  Back to Password Sign In
                </button>
              </div>
            </form>
          )
        ) : otpStep === "request" ? (
          <form
            onSubmit={(e) => handleRequestSmsOtp("reset_password", e)}
            className="space-y-3.5"
          >
            <p className="text-xs text-slate-600">
              Enter your registered Lebanon mobile phone number and we&apos;ll
              send you a 6-digit SMS code to reset your password.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mobile Phone Number (Lebanon)
              </label>
              <input
                type="tel"
                required
                value={authPhone}
                onChange={(e) => setAuthPhone(e.target.value)}
                placeholder="e.g. 03 123 456 or +961 70..."
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
              />
            </div>

            <button
              type="submit"
              disabled={isLoadingAuth}
              className="w-full h-11 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoadingAuth ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Reset Code...</span>
                </>
              ) : (
                <span>Send Password Reset Code</span>
              )}
            </button>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setSignInSubMode("password");
                  setOtpStep("request");
                  setOtpCodeInput("");
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
              >
                Back to Password Sign In
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => handleVerifySmsOtp("reset_password", e)}
            className="space-y-3.5"
          >
            <div className="p-3 rounded-2xl bg-smart-teal-light/60 border border-smart-teal/20 text-xs text-slate-700">
              We sent a 6-digit password reset code to{" "}
              <span className="font-mono font-black text-slate-900">
                {authPhone}
              </span>
              .
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                6-Digit SMS Verification Code
              </label>
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCodeInput}
                onChange={(e) =>
                  setOtpCodeInput(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="123456"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 text-center font-mono text-lg font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-smart-teal"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                New Password (min. 6 characters) *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
              />
            </div>

            <button
              type="submit"
              disabled={isLoadingAuth}
              className="w-full h-11 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoadingAuth ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Verify &amp; Update Password</span>
              )}
            </button>

            <div className="flex items-center justify-between text-xs font-bold pt-1">
              <button
                type="button"
                disabled={resendCooldown > 0 || isLoadingAuth}
                onClick={() => handleRequestSmsOtp("reset_password")}
                className={`cursor-pointer ${
                  resendCooldown > 0
                    ? "text-slate-400 cursor-not-allowed"
                    : "text-smart-teal hover:underline"
                }`}
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Resend SMS Code"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setSignInSubMode("password");
                  setOtpStep("request");
                  setOtpCodeInput("");
                }}
                className="text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
              >
                Back to Password Sign In
              </button>
            </div>
          </form>
        )
      ) : otpStep === "request" ? (
        <form
          onSubmit={(e) => handleRequestSmsOtp("signup", e)}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={authName}
              onChange={(e) => setAuthName(e.target.value)}
              placeholder="e.g. Nadine Karam"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mobile Phone Number (Lebanon) *
            </label>
            <input
              type="tel"
              required
              value={authPhone}
              onChange={(e) => setAuthPhone(e.target.value)}
              placeholder="e.g. 03 123 456 or +961 70..."
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Create Password (min. 6 characters) *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Address (Optional)
            </label>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="nadine@example.com"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-smart-teal"
            />
          </div>

          <button
            type="submit"
            disabled={isLoadingAuth}
            className="w-full h-11 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoadingAuth ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending Verification Code...</span>
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4" />
                <span>Send SMS Verification Code</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => handleVerifySmsOtp("signup", e)}
          className="space-y-4"
        >
          <div className="p-3 rounded-2xl bg-smart-teal-light/60 border border-smart-teal/20 text-xs text-slate-700">
            We sent a 6-digit SMS verification code to{" "}
            <span className="font-mono font-black text-slate-900">
              {authPhone}
            </span>
            . Enter it below to complete your account.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              6-Digit SMS Code
            </label>
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otpCodeInput}
              onChange={(e) =>
                setOtpCodeInput(e.target.value.replace(/[^0-9]/g, ""))
              }
              placeholder="123456"
              className="w-full h-12 px-4 rounded-xl border border-slate-200 text-center font-mono text-lg font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-smart-teal"
            />
          </div>

          <button
            type="submit"
            disabled={isLoadingAuth}
            className="w-full h-11 rounded-2xl bg-smart-teal hover:bg-smart-teal-hover text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoadingAuth ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Verify &amp; Create Account</span>
            )}
          </button>

          <div className="flex items-center justify-between text-xs font-bold pt-1">
            <button
              type="button"
              disabled={resendCooldown > 0 || isLoadingAuth}
              onClick={() => handleRequestSmsOtp("signup")}
              className={`cursor-pointer ${
                resendCooldown > 0
                  ? "text-slate-400 cursor-not-allowed"
                  : "text-smart-teal hover:underline"
              }`}
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Resend SMS Code"}
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthError(null);
                setOtpStep("request");
                setOtpCodeInput("");
              }}
              className="text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
            >
              Edit Account Details
            </button>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 1. Top SHEIN-Style Customer Profile Header */}
      <section className="rounded-3xl bg-gradient-to-r from-smart-teal-deep via-smart-teal to-[#0077A8] text-white p-5 sm:p-7 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-xs border border-white/25 flex items-center justify-center shrink-0 shadow-sm">
              <User className="w-8 h-8 text-smart-gold" />
            </div>

            <div>
              {customer ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                      {customer.full_name}
                    </h1>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 text-[11px] font-extrabold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified Member
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-white/80 font-mono mt-0.5">
                    {customer.phone}
                  </p>
                </>
              ) : staffUser ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                      {staffUser.full_name || staffUser.username}
                    </h1>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 text-[11px] font-extrabold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Signed In
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-white/80 font-mono mt-0.5">
                    @{staffUser.username}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                    Welcome to B&apos;s Mart
                  </h1>
                  <p className="text-xs sm:text-sm text-white/85 mt-0.5 max-w-md">
                    Sign in or create an account to sync your Wishlist, Saved
                    Addresses, and Orders across all your devices.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {staffUser && (
              <button
                type="button"
                onClick={() => setActiveTab("admin")}
                className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/25 text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-4 h-4 text-smart-gold" />
                <span>Open Dashboard</span>
              </button>
            )}

            {customer || staffUser ? (
              <button
                type="button"
                onClick={() => {
                  signOut();
                }}
                className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthMode("signin");
                  setSignInSubMode("password");
                  setOtpStep("request");
                  setOtpCodeInput("");
                  setIsOtpModalOpen(true);
                }}
                className="px-5 py-2.5 rounded-2xl bg-smart-gold hover:bg-smart-gold-hover text-slate-950 text-xs sm:text-sm font-black shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="relative z-10 grid grid-cols-4 gap-2 pt-5 mt-5 border-t border-white/15 text-center">
          <div>
            <p className="text-lg sm:text-xl font-black text-smart-gold tabular-numbers">
              {allMyOrders.length}
            </p>
            <p className="text-[11px] font-bold text-white/80">Orders</p>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-black text-smart-gold tabular-numbers">
              {wishlistItems.length}
            </p>
            <p className="text-[11px] font-bold text-white/80">Wishlist</p>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-black text-smart-gold tabular-numbers">
              {allAvailableCoupons.length}
            </p>
            <p className="text-[11px] font-bold text-white/80">Coupons</p>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-black text-smart-gold tabular-numbers">
              {recentlyViewedItems.length}
            </p>
            <p className="text-[11px] font-bold text-white/80">Viewed</p>
          </div>
        </div>
      </section>

      {/* Inline Persistent Sign In / Create Account Card when Signed Out */}
      {!customer && !staffUser && renderAuthCard(false)}

      {/* 2. SHEIN-Style "My Orders" Status Icon Row & Live Order History */}
      <section className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-smart-teal" />
            <span>My Orders &amp; Live Delivery Tracker</span>
          </h2>
          {selectedOrderStatusFilter !== "ALL" && (
            <button
              type="button"
              onClick={() => setSelectedOrderStatusFilter("ALL")}
              className="text-xs font-extrabold text-smart-teal hover:underline cursor-pointer"
            >
              Show All ({allMyOrders.length})
            </button>
          )}
        </div>

        {/* 4 Status Icon Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              {
                status: "Pending" as SmartOrderStatus,
                label: "Pending",
                count: statusCounts.Pending,
                icon: <Clock className="w-5 h-5" />,
              },
              {
                status: "Confirmed" as SmartOrderStatus,
                label: "Confirmed",
                count: statusCounts.Confirmed,
                icon: <CheckCircle2 className="w-5 h-5" />,
              },
              {
                status: "Out for Delivery" as SmartOrderStatus,
                label: "Out for Delivery",
                count: statusCounts["Out for Delivery"],
                icon: <Truck className="w-5 h-5" />,
              },
              {
                status: "Delivered" as SmartOrderStatus,
                label: "Delivered",
                count: statusCounts.Delivered,
                icon: <PackageCheck className="w-5 h-5" />,
              },
            ] as const
          ).map((tile) => {
            const isActive = selectedOrderStatusFilter === tile.status;
            return (
              <button
                key={tile.status}
                type="button"
                onClick={() =>
                  setSelectedOrderStatusFilter(
                    isActive ? "ALL" : tile.status
                  )
                }
                className={`relative p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                  isActive
                    ? "border-smart-teal bg-smart-teal-light/60 shadow-2xs"
                    : "border-slate-200/80 hover:border-smart-teal/40 bg-slate-50/60"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isActive
                      ? "bg-smart-teal text-smart-gold"
                      : "bg-white text-smart-teal border border-slate-200/70"
                  }`}
                >
                  {tile.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate">
                    {tile.label}
                  </p>
                  <p className="text-[11px] font-bold text-slate-500">
                    {tile.count} {tile.count === 1 ? "order" : "orders"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Orders List */}
        {isLoadingOrders ? (
          <div className="py-6 flex items-center justify-center gap-2 text-xs font-bold text-smart-teal">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading your orders...</span>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 overflow-hidden">
            {filteredOrders.map((ord) => (
              <div
                key={ord.order_id}
                onClick={() => setActiveTrackedOrder(ord)}
                className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-black text-slate-900">
                      Order #{ord.order_number}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        ord.status === "Delivered"
                          ? "bg-emerald-100 text-emerald-800"
                          : ord.status === "Out for Delivery"
                          ? "bg-smart-teal-light text-smart-teal"
                          : ord.status === "Confirmed"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {new Date(ord.created_date).toLocaleDateString()} •{" "}
                    {ord.zone_name || "Lebanon"} ({ord.city_area}) •{" "}
                    <span className="uppercase font-bold">
                      {ord.payment_method}
                    </span>
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <span className="text-sm sm:text-base font-black text-smart-teal tabular-numbers">
                    ${Number(ord.total).toFixed(2)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-smart-teal-light text-smart-teal text-xs font-extrabold">
                    <span>Track Live</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-2">
            No orders in this status yet. Any order you place (even as a Guest)
            will appear here automatically for live tracking.
          </p>
        )}

        {/* Guest Order Lookup Box */}
        <form
          onSubmit={handleGuestLookup}
          className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <span className="text-xs font-extrabold text-slate-700 shrink-0 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-smart-teal" />
            <span>Lookup Order by #:</span>
          </span>
          <input
            type="text"
            value={lookupOrderNo}
            onChange={(e) => setLookupOrderNo(e.target.value.toUpperCase())}
            placeholder="Order # (e.g. BSM-20261016-1234)"
            className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-mono uppercase flex-1 focus:outline-none focus:border-smart-teal"
          />
          <input
            type="tel"
            value={lookupPhone}
            onChange={(e) => setLookupPhone(e.target.value)}
            placeholder="Recipient Phone Number"
            className="h-9 px-3 rounded-xl border border-slate-200 text-xs flex-1 focus:outline-none focus:border-smart-teal"
          />
          <button
            type="submit"
            disabled={lookupLoading || !lookupOrderNo.trim() || !lookupPhone.trim()}
            className="h-9 px-4 rounded-xl bg-smart-teal hover:bg-smart-teal-hover disabled:opacity-40 text-white text-xs font-black cursor-pointer shrink-0"
          >
            {lookupLoading ? "Searching..." : "Track Order"}
          </button>
        </form>
        {lookupError && (
          <p className="text-xs font-bold text-rose-600">{lookupError}</p>
        )}
      </section>

      {/* 3. Saved Address Book (For Signed-In Customers) & My Coupons Wallet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Saved Address Book */}
        <section className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-smart-teal" />
              <span>Saved Address Book ({addresses.length})</span>
            </h2>
            {customer && (
              <button
                type="button"
                onClick={() => {
                  setAddrRecipient(customer.full_name);
                  setAddrPhone(customer.phone);
                  setIsAddingAddress(!isAddingAddress);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-smart-teal-light text-smart-teal text-xs font-extrabold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Address</span>
              </button>
            )}
          </div>

          {!customer ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                Sign in with your phone number to save multiple delivery
                addresses (`Home`, `Work`, `Family`) across devices.
              </p>
              <button
                type="button"
                onClick={() => setIsOtpModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-smart-teal text-white text-xs font-bold shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            </div>
          ) : (
            <>
              {isAddingAddress && (
                <form
                  onSubmit={handleCreateAddress}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      value={addrLabel}
                      onChange={(e) => setAddrLabel(e.target.value)}
                      placeholder="Label (Home, Work)"
                      className="h-9 px-3 rounded-xl bg-white border border-slate-200"
                    />
                    <input
                      type="text"
                      value={addrRecipient}
                      onChange={(e) => setAddrRecipient(e.target.value)}
                      placeholder="Recipient Name"
                      className="h-9 px-3 rounded-xl bg-white border border-slate-200"
                    />
                    <input
                      type="tel"
                      value={addrPhone}
                      onChange={(e) => setAddrPhone(e.target.value)}
                      placeholder="Phone"
                      className="h-9 px-3 rounded-xl bg-white border border-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <select
                      value={addrZoneId ?? ""}
                      onChange={(e) => setAddrZoneId(Number(e.target.value))}
                      className="h-9 px-3 rounded-xl bg-white border border-slate-200"
                    >
                      {deliveryZones.map((z) => (
                        <option key={z.zone_id} value={z.zone_id}>
                          {z.zone_name} (${Number(z.delivery_fee).toFixed(2)})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      value={addrCity}
                      onChange={(e) => setAddrCity(e.target.value)}
                      placeholder="City / Area *"
                      className="h-9 px-3 rounded-xl bg-white border border-slate-200"
                    />
                    <input
                      type="text"
                      required
                      value={addrStreet}
                      onChange={(e) => setAddrStreet(e.target.value)}
                      placeholder="Street & Building *"
                      className="h-9 px-3 rounded-xl bg-white border border-slate-200"
                    />
                    <input
                      type="text"
                      value={addrBuilding}
                      onChange={(e) => setAddrBuilding(e.target.value)}
                      placeholder="Floor / Apartment"
                      className="h-9 px-3 rounded-xl bg-white border border-slate-200"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingAddress(false)}
                      className="px-3 py-1.5 rounded-lg text-slate-600 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-smart-teal text-white font-black cursor-pointer"
                    >
                      Save Address
                    </button>
                  </div>
                </form>
              )}

              {addresses.length > 0 ? (
                <div className="space-y-2.5">
                  {addresses.map((addr) => (
                    <div
                      key={addr.address_id}
                      className="p-3.5 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">
                            {addr.label}
                          </span>
                          {addr.is_default && (
                            <span className="px-2 py-0.5 rounded-full bg-smart-teal-light text-smart-teal text-[10px] font-black">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600">
                          {addr.recipient_name} ({addr.phone}) —{" "}
                          {addr.city_area}, {addr.street}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!addr.is_default && (
                          <button
                            type="button"
                            onClick={() => setDefaultAddress(addr.address_id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteAddress(addr.address_id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No saved addresses yet. Add your delivery address above.
                </p>
              )}
            </>
          )}
        </section>

        {/* My Coupons Wallet */}
        <section className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <TicketPercent className="w-4 h-4 text-amber-600" />
              <span>My Coupons Wallet ({allAvailableCoupons.length})</span>
            </h2>
          </div>

          {allAvailableCoupons.length > 0 ? (
            <div className="space-y-2.5">
              {allAvailableCoupons.map((coupon) => {
                const isApplied =
                  appliedCoupon?.code.toUpperCase() ===
                  coupon.code.toUpperCase();
                return (
                  <div
                    key={coupon.coupon_id}
                    className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-smart-sale">
                          {coupon.discount_type === "percentage"
                            ? `${coupon.discount_value}% OFF`
                            : coupon.discount_type === "fixed"
                            ? `$${coupon.discount_value} OFF`
                            : "FREE DELIVERY"}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white border border-amber-300 font-mono text-[11px] font-black text-slate-900">
                          {coupon.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {coupon.title}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        collectCoupon(coupon);
                        setAppliedCoupon(coupon);
                        setActiveTab("bag");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-smart-teal hover:bg-smart-teal-hover text-white text-xs font-black shrink-0 cursor-pointer"
                    >
                      {isApplied ? "Active in Bag" : "Use in Bag"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              No active promo vouchers at the moment. When new storewide
              promotions launch, they will appear right here.
            </p>
          )}
        </section>
      </div>

      {/* 4. Saved Wishlist Section */}
      <section className="bg-white rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span>My Wishlist ({wishlistItems.length})</span>
          </h2>
        </div>

        {wishlistItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {wishlistItems.map((item) => (
              <SmartProductCard key={item.item_id} item={item} compact />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-4">
            Tap the heart icon on any product to save it to your wishlist.
          </p>
        )}
      </section>

      {/* 5. Recently Viewed Footprints */}
      {recentlyViewedItems.length > 0 && (
        <section className="bg-white rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-smart-teal" />
              <span>Recently Viewed ({recentlyViewedItems.length})</span>
            </h2>
            <button
              type="button"
              onClick={clearRecentlyViewed}
              className="text-xs font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
            >
              Clear History
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {recentlyViewedItems.slice(0, 12).map((item) => (
              <SmartProductCard key={item.item_id} item={item} compact />
            ))}
          </div>
        </section>
      )}

      {/* 6. Privacy & In-App Account Deletion (Apple App Store Guideline 5.1.1(v)) */}
      {customer && (
        <section className="bg-white rounded-3xl border border-slate-200/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3 className="text-xs sm:text-sm font-black text-slate-900">
              Account Privacy &amp; Data Control
            </h3>
            <p className="text-xs text-slate-500">
              You can permanently delete your B&apos;s Mart account, saved
              addresses, and cloud wishlist at any time.
            </p>
          </div>

          {!isDeleteConfirmOpen ? (
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold shrink-0 cursor-pointer self-start sm:self-auto"
            >
              Delete My Account
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-rose-600">
                Permanently delete your account?
              </span>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={handleDeleteAccount}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
              >
                {isDeletingAccount ? "Deleting..." : "Yes, Delete Permanently"}
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      )}

      {/* Customer Sign In / Create Account / OTP Modal (Only closes via explicit ✕ button or successful auth) */}
      {isOtpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          {renderAuthCard(true)}
        </div>
      )}

      {/* Realtime Order Tracker Modal */}
      <SmartOrderTrackerModal
        order={activeTrackedOrder}
        onClose={() => setActiveTrackedOrder(null)}
      />
    </div>
  );
}
