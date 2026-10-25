import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import {
  SmartAddress,
  SmartCustomer,
  SmartOrder,
  SmartStaffUser,
} from "@/types/smart.types";
import { useSmartCartStore } from "@/store/useSmartCartStore";
import { getOrCreateSmartDeviceId } from "@/store/useSmartWishlistStore";

const CUSTOMER_SESSION_KEY = "bsmart_customer_session_v1";
const STAFF_SESSION_KEY = "bsmart_staff_session_v1";
const SAFE_CUSTOMER_COLUMNS =
  "customer_id, phone, full_name, email, role, is_verified, is_active, created_at, last_login_at";

/**
 * Normalizes Lebanon & international phone numbers to a clean comparable string.
 */
export function normalizeSmartPhone(raw: string): string {
  const digits = raw.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+961")) {
    const rest = digits.slice(4).replace(/^0+/, "");
    return `+961${rest}`;
  }
  if (digits.startsWith("961") && digits.length >= 10) {
    const rest = digits.slice(3).replace(/^0+/, "");
    return `+961${rest}`;
  }
  if (digits.startsWith("0") && digits.length >= 7 && digits.length <= 9) {
    return `+961${digits.slice(1)}`;
  }
  if (!digits.startsWith("+") && digits.length >= 7 && digits.length <= 8) {
    return `+961${digits}`;
  }
  return digits;
}

export interface RequestOtpResult {
  success: boolean;
  normalizedPhone: string;
  bridgeDispatched: boolean;
  fallbackCode?: string;
  errorMessage?: string;
}

export interface CreateAddressInput {
  label: string;
  recipient_name: string;
  phone: string;
  zone_id: number | null;
  city_area: string;
  street: string;
  building_floor?: string | null;
  landmark?: string | null;
  is_default?: boolean;
}

interface SmartAuthState {
  customer: SmartCustomer | null;
  staffUser: SmartStaffUser | null;
  addresses: SmartAddress[];
  customerOrders: SmartOrder[];
  hydrated: boolean;
  isLoadingAuth: boolean;
  isLoadingOrders: boolean;
  hydrate: () => Promise<void>;
  signInStaff: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; errorMessage?: string; user?: SmartStaffUser }>;
  signInUnified: (
    identifier: string,
    password: string
  ) => Promise<{
    success: boolean;
    accountType?: "staff" | "customer";
    staffUser?: SmartStaffUser;
    customer?: SmartCustomer;
    errorMessage?: string;
  }>;
  signOutStaff: () => void;
  registerCustomerWithPassword: (
    phone: string,
    fullName: string,
    password: string,
    email?: string
  ) => Promise<{ success: boolean; errorMessage?: string }>;
  signInCustomerWithPassword: (
    phone: string,
    password: string
  ) => Promise<{ success: boolean; errorMessage?: string; customer?: SmartCustomer }>;
  sendPhoneOtp: (
    phone: string,
    purpose?: "signup" | "login" | "reset_password"
  ) => Promise<{
    success: boolean;
    error?: string;
    cooldownSeconds?: number;
    retryAfterSeconds?: number;
  }>;
  verifySmsOtpAndAuth: (params: {
    phone: string;
    code: string;
    purpose: "signup" | "login" | "reset_password";
    fullName?: string;
    password?: string;
    email?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  requestPhoneOtp: (
    phone: string,
    fullName?: string,
    channel?: "whatsapp" | "sms"
  ) => Promise<RequestOtpResult>;
  verifyPhoneOtp: (
    phone: string,
    code: string,
    fullName?: string
  ) => Promise<{ success: boolean; errorMessage?: string; error?: string }>;
  fetchAddresses: () => Promise<void>;
  addAddress: (input: CreateAddressInput) => Promise<SmartAddress | null>;
  deleteAddress: (addressId: string) => Promise<void>;
  setDefaultAddress: (addressId: string) => Promise<void>;
  fetchCustomerOrders: () => Promise<void>;
  lookupGuestOrder: (
    orderNumber: string,
    phone: string
  ) => Promise<SmartOrder | null>;
  signOut: () => void;
  deleteMyAccount: () => Promise<{
    success: boolean;
    error?: string;
    errorMessage?: string;
  }>;
}

export const useSmartAuthStore = create<SmartAuthState>((set, get) => ({
  customer: null,
  staffUser: null,
  addresses: [],
  customerOrders: [],
  hydrated: false,
  isLoadingAuth: false,
  isLoadingOrders: false,

  hydrate: async () => {
    if (get().hydrated) return;
    if (typeof window === "undefined") return;

    let savedCustomer: SmartCustomer | null = null;
    let savedStaff: SmartStaffUser | null = null;
    try {
      const raw = window.localStorage.getItem(CUSTOMER_SESSION_KEY);
      if (raw) {
        savedCustomer = JSON.parse(raw) as SmartCustomer;
      }
      const rawStaff = window.localStorage.getItem(STAFF_SESSION_KEY);
      if (rawStaff) {
        savedStaff = JSON.parse(rawStaff) as SmartStaffUser;
      }
    } catch {}

    set({ customer: savedCustomer, staffUser: savedStaff, hydrated: true });

    if (savedCustomer?.customer_id) {
      // Refresh customer record from Supabase
      const supabase = createClient();
      const { data } = await supabase
        .from("smart_customers")
        .select(SAFE_CUSTOMER_COLUMNS)
        .eq("customer_id", savedCustomer.customer_id)
        .eq("is_active", true)
        .single();

      if (data) {
        const liveCustomer = data as SmartCustomer;
        try {
          window.localStorage.setItem(
            CUSTOMER_SESSION_KEY,
            JSON.stringify(liveCustomer)
          );
        } catch {}
        set({ customer: liveCustomer });
        await Promise.all([
          get().fetchAddresses(),
          get().fetchCustomerOrders(),
        ]);
      } else {
        // Account was deactivated or deleted — clear ONLY customer session, never staffUser
        try {
          window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
        } catch {}
        set({ customer: null, addresses: [], customerOrders: [] });
      }
    }

    if (savedStaff?.user_id) {
      try {
        const supabase = createClient();
        const { data: staffData, error: staffError } = await supabase.rpc(
          "smart_verify_staff_session",
          {
            p_user_id: savedStaff.user_id,
          }
        );

        if (!staffError && staffData) {
          const res = staffData as {
            success?: boolean;
            user?: SmartStaffUser;
          };
          if (res.success && res.user) {
            try {
              window.localStorage.setItem(
                STAFF_SESSION_KEY,
                JSON.stringify(res.user)
              );
            } catch {}
            set({ staffUser: res.user });
          } else if (res.success === false) {
            try {
              window.localStorage.removeItem(STAFF_SESSION_KEY);
            } catch {}
            set({ staffUser: null });
          }
        }
      } catch {}
    }
  },

  signInStaff: async (username, password) => {
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      return {
        success: false,
        errorMessage: "Please enter both your staff username and password.",
      };
    }

    set({ isLoadingAuth: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("smart_authenticate_staff", {
        p_username: cleanUser,
        p_password: password,
      });

      if (error) {
        return { success: false, errorMessage: error.message };
      }

      const res = data as {
        success: boolean;
        error?: string;
        user?: SmartStaffUser;
      } | null;

      if (!res?.success || !res.user) {
        return {
          success: false,
          errorMessage: res?.error || "Invalid staff username or password.",
        };
      }

      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
          window.localStorage.setItem(
            STAFF_SESSION_KEY,
            JSON.stringify(res.user)
          );
        } catch {}
      }

      set({
        staffUser: res.user,
        customer: null,
        addresses: [],
        customerOrders: [],
      });
      return { success: true, user: res.user };
    } catch (err) {
      return {
        success: false,
        errorMessage:
          err instanceof Error ? err.message : "Staff authentication failed.",
      };
    } finally {
      set({ isLoadingAuth: false });
    }
  },

  signInUnified: async (identifier, password) => {
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      return {
        success: false,
        errorMessage: "Please enter your phone/username and password.",
      };
    }

    set({ isLoadingAuth: true });
    try {
      const supabase = createClient();

      // 1. Silently check if identifier matches an active staff account
      const { data: staffData, error: staffError } = await supabase.rpc(
        "smart_authenticate_staff",
        {
          p_username: cleanId,
          p_password: password,
        }
      );

      if (!staffError && staffData) {
        const res = staffData as {
          success: boolean;
          error?: string;
          user?: SmartStaffUser;
        };
        if (res?.success && res.user) {
          if (typeof window !== "undefined") {
            try {
              window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
              window.localStorage.setItem(
                STAFF_SESSION_KEY,
                JSON.stringify(res.user)
              );
            } catch {}
          }
          set({
            staffUser: res.user,
            customer: null,
            addresses: [],
            customerOrders: [],
            isLoadingAuth: false,
          });
          return {
            success: true,
            accountType: "staff",
            staffUser: res.user,
          };
        }
      }

      // 2. Otherwise fall back to customer password sign-in
      const custRes = await get().signInCustomerWithPassword(cleanId, password);
      if (custRes.success && custRes.customer) {
        return {
          success: true,
          accountType: "customer",
          customer: custRes.customer,
        };
      }

      // 3. Generic neutral error message (no mention of staff or admin)
      return {
        success: false,
        errorMessage: "Invalid phone number, username, or password.",
      };
    } catch {
      return {
        success: false,
        errorMessage: "Invalid phone number, username, or password.",
      };
    } finally {
      set({ isLoadingAuth: false });
    }
  },

  signOutStaff: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STAFF_SESSION_KEY);
      } catch {}
    }
    set({ staffUser: null });
  },

  registerCustomerWithPassword: async (phone, fullName, password, email) => {
    const normalizedPhone = normalizeSmartPhone(phone);
    if (normalizedPhone.length < 8) {
      return {
        success: false,
        errorMessage: "Please enter a valid mobile phone number.",
      };
    }
    if (!fullName || fullName.trim().length < 2) {
      return {
        success: false,
        errorMessage: "Please enter your full name.",
      };
    }
    if (!password || password.length < 6) {
      return {
        success: false,
        errorMessage: "Password must be at least 6 characters.",
      };
    }

    set({ isLoadingAuth: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("smart_register_customer", {
        p_phone: normalizedPhone,
        p_full_name: fullName.trim(),
        p_password: password,
        p_email: email?.trim() || null,
      });

      if (error) {
        return { success: false, errorMessage: error.message };
      }

      const res = data as {
        success: boolean;
        error?: string;
        customer?: SmartCustomer;
      } | null;

      if (!res?.success || !res.customer) {
        return {
          success: false,
          errorMessage: res?.error || "Could not create customer account.",
        };
      }

      const customer = res.customer;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(STAFF_SESSION_KEY);
          window.localStorage.setItem(
            CUSTOMER_SESSION_KEY,
            JSON.stringify(customer)
          );
        } catch {}
      }
      set({ customer, staffUser: null });

      // Merge guest wishlist and cart
      try {
        const deviceId = getOrCreateSmartDeviceId();
        await supabase
          .from("smart_wishlists")
          .update({ customer_id: customer.customer_id })
          .eq("device_id", deviceId)
          .is("customer_id", null);

        const cartState = useSmartCartStore.getState();
        await supabase.from("smart_carts").upsert(
          {
            customer_id: customer.customer_id,
            items: cartState.lines.map((l) => ({
              item_id: l.item.item_id,
              quantity: l.quantity,
              selected: l.selected,
            })),
            collected_coupons: cartState.collectedCoupons.map((c) => c.code),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "customer_id" }
        );
      } catch {}

      await Promise.all([
        get().fetchAddresses(),
        get().fetchCustomerOrders(),
      ]);

      return { success: true };
    } catch (err) {
      return {
        success: false,
        errorMessage:
          err instanceof Error ? err.message : "Registration failed.",
      };
    } finally {
      set({ isLoadingAuth: false });
    }
  },

  signInCustomerWithPassword: async (phone, password) => {
    const rawTrimmed = phone.trim();
    const hasLetters = /[a-zA-Z]/.test(rawTrimmed);
    const identifierToSend = hasLetters
      ? rawTrimmed
      : normalizeSmartPhone(rawTrimmed);

    if (!hasLetters && identifierToSend.length < 8) {
      return {
        success: false,
        errorMessage: "Please enter a valid mobile phone number or username.",
      };
    }
    if (!password) {
      return {
        success: false,
        errorMessage: "Please enter your password.",
      };
    }

    set({ isLoadingAuth: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("smart_authenticate_customer", {
        p_phone: identifierToSend,
        p_password: password,
      });

      if (error) {
        return { success: false, errorMessage: error.message };
      }

      const res = data as {
        success: boolean;
        error?: string;
        customer?: SmartCustomer;
      } | null;

      if (!res?.success || !res.customer) {
        return {
          success: false,
          errorMessage: res?.error || "Incorrect phone number or password.",
        };
      }

      const customer = res.customer;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(STAFF_SESSION_KEY);
          window.localStorage.setItem(
            CUSTOMER_SESSION_KEY,
            JSON.stringify(customer)
          );
        } catch {}
      }
      set({ customer, staffUser: null });

      // Merge guest wishlist and cart
      try {
        const deviceId = getOrCreateSmartDeviceId();
        await supabase
          .from("smart_wishlists")
          .update({ customer_id: customer.customer_id })
          .eq("device_id", deviceId)
          .is("customer_id", null);

        const cartState = useSmartCartStore.getState();
        await supabase.from("smart_carts").upsert(
          {
            customer_id: customer.customer_id,
            items: cartState.lines.map((l) => ({
              item_id: l.item.item_id,
              quantity: l.quantity,
              selected: l.selected,
            })),
            collected_coupons: cartState.collectedCoupons.map((c) => c.code),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "customer_id" }
        );
      } catch {}

      await Promise.all([
        get().fetchAddresses(),
        get().fetchCustomerOrders(),
      ]);

      return { success: true, customer };
    } catch (err) {
      return {
        success: false,
        errorMessage:
          err instanceof Error ? err.message : "Sign-in failed.",
      };
    } finally {
      set({ isLoadingAuth: false });
    }
  },

  sendPhoneOtp: async (phone, purpose = "signup") => {
    const normalizedPhone = normalizeSmartPhone(phone);
    if (normalizedPhone.length < 8) {
      return {
        success: false,
        error: "Please enter a valid mobile phone number.",
      };
    }

    set({ isLoadingAuth: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("smart-otp", {
        body: {
          action: "send",
          phone: normalizedPhone,
          purpose: purpose || "signup",
          lang: "en",
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Could not send verification SMS.",
        };
      }

      const parsed = (typeof data === "string" ? JSON.parse(data) : data) as {
        success?: boolean;
        error?: string;
        cooldownSeconds?: number;
        retryAfterSeconds?: number;
      } | null;

      if (!parsed?.success) {
        return {
          success: false,
          error: parsed?.error || "Could not send verification SMS.",
          cooldownSeconds: parsed?.cooldownSeconds,
          retryAfterSeconds: parsed?.retryAfterSeconds,
        };
      }

      return {
        success: true,
        cooldownSeconds: parsed.cooldownSeconds ?? 60,
        retryAfterSeconds: parsed.retryAfterSeconds,
      };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not send verification SMS.",
      };
    } finally {
      set({ isLoadingAuth: false });
    }
  },

  verifySmsOtpAndAuth: async (params) => {
    const normalizedPhone = normalizeSmartPhone(params.phone);
    const cleanCode = params.code.trim();
    if (!cleanCode || cleanCode.length < 4) {
      return {
        success: false,
        error: "Please enter the 6-digit verification code.",
      };
    }

    set({ isLoadingAuth: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "smart_verify_sms_otp_and_auth",
        {
          p_phone: normalizedPhone,
          p_code: cleanCode,
          p_purpose: params.purpose,
          p_full_name: params.fullName?.trim() || null,
          p_password: params.password || null,
          p_email: params.email?.trim() || null,
        }
      );

      if (error) {
        return {
          success: false,
          error: error.message || "Verification failed.",
        };
      }

      const res = data as {
        success: boolean;
        error?: string;
        customer?: SmartCustomer;
      } | null;

      if (!res?.success || !res.customer) {
        return {
          success: false,
          error: res?.error || "Verification failed.",
        };
      }

      const customer = res.customer;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(STAFF_SESSION_KEY);
          window.localStorage.setItem(
            CUSTOMER_SESSION_KEY,
            JSON.stringify(customer)
          );
        } catch {}
      }
      set({ customer, staffUser: null, isLoadingAuth: false });

      // Merge guest wishlist and cart
      try {
        const deviceId = getOrCreateSmartDeviceId();
        await supabase
          .from("smart_wishlists")
          .update({ customer_id: customer.customer_id })
          .eq("device_id", deviceId)
          .is("customer_id", null);

        const cartState = useSmartCartStore.getState();
        await supabase.from("smart_carts").upsert(
          {
            customer_id: customer.customer_id,
            items: cartState.lines.map((l) => ({
              item_id: l.item.item_id,
              quantity: l.quantity,
              selected: l.selected,
            })),
            collected_coupons: cartState.collectedCoupons.map((c) => c.code),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "customer_id" }
        );
      } catch {}

      await Promise.all([
        get().fetchAddresses(),
        get().fetchCustomerOrders(),
      ]);

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : "Verification failed.",
      };
    } finally {
      set({ isLoadingAuth: false });
    }
  },

  requestPhoneOtp: async (phone) => {
    const normalizedPhone = normalizeSmartPhone(phone);
    const res = await get().sendPhoneOtp(phone, "login");
    return {
      success: res.success,
      normalizedPhone,
      bridgeDispatched: res.success,
      errorMessage: res.error,
    };
  },

  verifyPhoneOtp: async (phone, code, fullName) => {
    const res = await get().verifySmsOtpAndAuth({
      phone,
      code,
      purpose: "login",
      fullName,
    });
    return {
      success: res.success,
      error: res.error,
      errorMessage: res.error,
    };
  },

  fetchAddresses: async () => {
    const customer = get().customer;
    if (!customer?.customer_id) {
      set({ addresses: [] });
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("smart_addresses")
      .select("*")
      .eq("customer_id", customer.customer_id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    set({ addresses: (data as SmartAddress[]) || [] });
  },

  addAddress: async (input) => {
    const customer = get().customer;
    if (!customer?.customer_id) return null;

    const supabase = createClient();
    const isFirst = get().addresses.length === 0;
    const shouldBeDefault = Boolean(input.is_default || isFirst);

    if (shouldBeDefault) {
      await supabase
        .from("smart_addresses")
        .update({ is_default: false })
        .eq("customer_id", customer.customer_id);
    }

    const { data, error } = await supabase
      .from("smart_addresses")
      .insert({
        customer_id: customer.customer_id,
        label: input.label.trim() || "Home",
        recipient_name: input.recipient_name.trim(),
        phone: input.phone.trim(),
        zone_id: input.zone_id,
        city_area: input.city_area.trim(),
        street: input.street.trim(),
        building_floor: input.building_floor?.trim() || null,
        landmark: input.landmark?.trim() || null,
        is_default: shouldBeDefault,
      })
      .select("*")
      .single();

    if (error || !data) return null;
    await get().fetchAddresses();
    return data as SmartAddress;
  },

  deleteAddress: async (addressId) => {
    const supabase = createClient();
    await supabase
      .from("smart_addresses")
      .delete()
      .eq("address_id", addressId);
    await get().fetchAddresses();
  },

  setDefaultAddress: async (addressId) => {
    const customer = get().customer;
    if (!customer?.customer_id) return;
    const supabase = createClient();
    await supabase
      .from("smart_addresses")
      .update({ is_default: false })
      .eq("customer_id", customer.customer_id);
    await supabase
      .from("smart_addresses")
      .update({ is_default: true })
      .eq("address_id", addressId);
    await get().fetchAddresses();
  },

  fetchCustomerOrders: async () => {
    const customer = get().customer;
    if (!customer?.customer_id) {
      set({ customerOrders: [] });
      return;
    }

    set({ isLoadingOrders: true });
    try {
      const supabase = createClient();
      const rawDigits = customer.phone.replace(/[^0-9]/g, "");
      const { data } = await supabase
        .from("smart_orders")
        .select("*")
        .or(
          `customer_id.eq.${customer.customer_id},recipient_phone.eq.${
            customer.phone
          },recipient_phone.ilike.%${rawDigits.slice(-7)}%`
        )
        .order("created_date", { ascending: false })
        .limit(40);

      set({ customerOrders: (data as SmartOrder[]) || [] });
    } catch {
      set({ customerOrders: [] });
    } finally {
      set({ isLoadingOrders: false });
    }
  },

  lookupGuestOrder: async (orderNumber, phone) => {
    const cleanNumber = orderNumber.trim().toUpperCase();
    const cleanDigits = phone.replace(/[^0-9]/g, "");
    if (!cleanNumber || cleanDigits.length < 6) return null;

    const supabase = createClient();
    const { data } = await supabase
      .from("smart_orders")
      .select("*")
      .ilike("order_number", cleanNumber)
      .ilike("recipient_phone", `%${cleanDigits.slice(-6)}%`)
      .limit(1);

    if (data && data.length > 0) {
      return data[0] as SmartOrder;
    }
    return null;
  },

  signOut: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
        window.localStorage.removeItem(STAFF_SESSION_KEY);
      } catch {}
    }
    set({
      customer: null,
      staffUser: null,
      addresses: [],
      customerOrders: [],
    });
  },

  deleteMyAccount: async () => {
    const currentCustomer = get().customer;
    if (!currentCustomer?.customer_id) {
      return {
        success: false,
        error: "Not signed in.",
        errorMessage: "Not signed in.",
      };
    }

    set({ isLoadingAuth: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "smart_delete_customer_account",
        {
          p_customer_id: currentCustomer.customer_id,
          p_phone: currentCustomer.phone,
        }
      );

      const res = data as {
        success?: boolean;
        error?: string;
      } | null;

      if (error || !res?.success) {
        const msg =
          res?.error || error?.message || "Failed to delete account.";
        return {
          success: false,
          error: msg,
          errorMessage: msg,
        };
      }

      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
        } catch {}
      }

      set({
        customer: null,
        addresses: [],
        customerOrders: [],
        isLoadingAuth: false,
      });
      return { success: true };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not delete account right now.";
      return {
        success: false,
        error: msg,
        errorMessage: msg,
      };
    } finally {
      set({ isLoadingAuth: false });
    }
  },
}));
