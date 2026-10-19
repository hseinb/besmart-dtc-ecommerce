import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import {
  ItemWithImages,
  SmartAddress,
  SmartCustomer,
  SmartOrder,
  SmartStaffUser,
} from "@/types/smart.types";
import { useSmartCartStore } from "@/store/useSmartCartStore";
import {
  useSmartWishlistStore,
  getOrCreateSmartDeviceId,
} from "@/store/useSmartWishlistStore";

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
  requestPhoneOtp: (
    phone: string,
    fullName: string,
    channel: "whatsapp" | "sms"
  ) => Promise<RequestOtpResult>;
  verifyPhoneOtp: (
    phone: string,
    code: string,
    fullName?: string
  ) => Promise<{ success: boolean; errorMessage?: string }>;
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
  deleteMyAccount: () => Promise<{ success: boolean; errorMessage?: string }>;
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
        // Account was deactivated or deleted
        get().signOut();
      }
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
          window.localStorage.setItem(
            STAFF_SESSION_KEY,
            JSON.stringify(res.user)
          );
        } catch {}
      }

      set({ staffUser: res.user });
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
              window.localStorage.setItem(
                STAFF_SESSION_KEY,
                JSON.stringify(res.user)
              );
            } catch {}
          }
          set({ staffUser: res.user, isLoadingAuth: false });
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
          window.localStorage.setItem(
            CUSTOMER_SESSION_KEY,
            JSON.stringify(customer)
          );
        } catch {}
      }
      set({ customer });

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
    const normalizedPhone = normalizeSmartPhone(phone);
    if (normalizedPhone.length < 8) {
      return {
        success: false,
        errorMessage: "Please enter a valid mobile phone number.",
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
        p_phone: normalizedPhone,
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
          window.localStorage.setItem(
            CUSTOMER_SESSION_KEY,
            JSON.stringify(customer)
          );
        } catch {}
      }
      set({ customer });

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

  requestPhoneOtp: async (phone, fullName, channel) => {
    const normalizedPhone = normalizeSmartPhone(phone);
    if (normalizedPhone.length < 8) {
      return {
        success: false,
        normalizedPhone,
        bridgeDispatched: false,
        errorMessage: "Please enter a valid mobile phone number.",
      };
    }

    set({ isLoadingAuth: true });
    try {
      const supabase = createClient();
      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // 1. Insert real OTP record into public.smart_otp_codes
      const { error: otpError } = await supabase
        .from("smart_otp_codes")
        .insert({
          phone: normalizedPhone,
          code: otpCode,
          channel,
          expires_at: expiresAt,
          is_used: false,
          attempts: 0,
        });

      if (otpError) {
        return {
          success: false,
          normalizedPhone,
          bridgeDispatched: false,
          errorMessage: otpError.message,
        };
      }

      // 2. Enqueue outbound OTP delivery task in public.smart_task_queue for smartBridge.js
      const { data: taskRow } = await supabase
        .from("smart_task_queue")
        .insert({
          procedure_name: "send_otp",
          params: {
            phone: normalizedPhone,
            code: otpCode,
            channel,
            full_name: fullName.trim() || "Valued Shopper",
          },
          status: "Pending",
        })
        .select("id, status")
        .single();

      // Check briefly if smartBridge.js picked up the task within 1.5s
      let bridgeDispatched = false;
      if (taskRow?.id) {
        await new Promise((r) => setTimeout(r, 1200));
        const { data: checkTask } = await supabase
          .from("smart_task_queue")
          .select("status")
          .eq("id", taskRow.id)
          .single();
        if (checkTask && checkTask.status === "Completed") {
          bridgeDispatched = true;
        }
      }

      return {
        success: true,
        normalizedPhone,
        bridgeDispatched,
        fallbackCode: bridgeDispatched ? undefined : otpCode,
      };
    } catch (err) {
      return {
        success: false,
        normalizedPhone,
        bridgeDispatched: false,
        errorMessage:
          err instanceof Error ? err.message : "Failed to generate OTP.",
      };
    } finally {
      set({ isLoadingAuth: false });
    }
  },

  verifyPhoneOtp: async (phone, code, fullName) => {
    const normalizedPhone = normalizeSmartPhone(phone);
    const trimmedCode = code.trim();
    if (!trimmedCode || trimmedCode.length < 4) {
      return {
        success: false,
        errorMessage: "Please enter the 6-digit verification code.",
      };
    }

    set({ isLoadingAuth: true });
    try {
      const supabase = createClient();

      // 1. Verify OTP in public.smart_otp_codes
      const { data: otpRows, error: otpErr } = await supabase
        .from("smart_otp_codes")
        .select("*")
        .eq("phone", normalizedPhone)
        .eq("code", trimmedCode)
        .eq("is_used", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (otpErr || !otpRows || otpRows.length === 0) {
        return {
          success: false,
          errorMessage:
            "Invalid or expired verification code. Please request a new code.",
        };
      }

      // Mark OTP as used
      await supabase
        .from("smart_otp_codes")
        .update({ is_used: true })
        .eq("id", otpRows[0].id);

      // 2. Find or create customer in public.smart_customers
      const { data: existingCustomers } = await supabase
        .from("smart_customers")
        .select(SAFE_CUSTOMER_COLUMNS)
        .eq("phone", normalizedPhone)
        .limit(1);

      let customer: SmartCustomer;
      if (existingCustomers && existingCustomers.length > 0) {
        const existing = existingCustomers[0] as SmartCustomer;
        const updatedName =
          fullName && fullName.trim().length > 1
            ? fullName.trim()
            : existing.full_name;

        const { data: updatedRow, error: updErr } = await supabase
          .from("smart_customers")
          .update({
            full_name: updatedName,
            is_verified: true,
            is_active: true,
            last_login_at: new Date().toISOString(),
          })
          .eq("customer_id", existing.customer_id)
          .select(SAFE_CUSTOMER_COLUMNS)
          .single();

        if (updErr || !updatedRow) {
          throw new Error(updErr?.message || "Failed to update customer profile.");
        }
        customer = updatedRow as SmartCustomer;
      } else {
        const { data: insertedRow, error: insErr } = await supabase
          .from("smart_customers")
          .insert({
            phone: normalizedPhone,
            full_name:
              fullName && fullName.trim().length > 1
                ? fullName.trim()
                : "B's Mart Member",
            role: "customer",
            is_verified: true,
            is_active: true,
            last_login_at: new Date().toISOString(),
          })
          .select(SAFE_CUSTOMER_COLUMNS)
          .single();

        if (insErr || !insertedRow) {
          throw new Error(insErr?.message || "Failed to create customer profile.");
        }
        customer = insertedRow as SmartCustomer;
      }

      // Save customer session locally
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            CUSTOMER_SESSION_KEY,
            JSON.stringify(customer)
          );
        } catch {}
      }
      set({ customer });

      // 3. Automatic Guest-to-Customer Merge:
      // 3a. Link any previous Guest Orders matching phone number
      try {
        const rawDigits = phone.replace(/[^0-9]/g, "");
        await supabase
          .from("smart_orders")
          .update({ customer_id: customer.customer_id })
          .is("customer_id", null)
          .or(
            `recipient_phone.eq.${normalizedPhone},recipient_phone.ilike.%${rawDigits.slice(
              -7
            )}%`
          );
      } catch {}

      // 3b. Merge Guest Wishlist items into public.smart_wishlists
      try {
        const deviceId = getOrCreateSmartDeviceId();
        await supabase
          .from("smart_wishlists")
          .update({ customer_id: customer.customer_id })
          .eq("device_id", deviceId)
          .is("customer_id", null);

        // Also pull any cloud wishlist items for this customer
        const { data: cloudWish } = await supabase
          .from("smart_wishlists")
          .select("item_id")
          .eq("customer_id", customer.customer_id);

        if (cloudWish && cloudWish.length > 0) {
          const localWish = useSmartWishlistStore.getState().wishlistItems;
          const localIds = new Set(localWish.map((i) => i.item_id));
          const missingIds = cloudWish
            .map((w) => Number(w.item_id))
            .filter((id) => !localIds.has(id));

          if (missingIds.length > 0) {
            const { data: fetchedItems } = await supabase
              .from("smart_items")
              .select("*, item_images(*)")
              .in("item_id", missingIds)
              .eq("is_active", true);

            if (fetchedItems && fetchedItems.length > 0) {
              const mergedWish = [
                ...localWish,
                ...(fetchedItems as unknown as ItemWithImages[]),
              ];
              useSmartWishlistStore.setState({ wishlistItems: mergedWish });
            }
          }
        }
      } catch {}

      // 3c. Sync Guest Cart with public.smart_carts
      try {
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
          err instanceof Error ? err.message : "OTP verification failed.",
      };
    } finally {
      set({ isLoadingAuth: false });
    }
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
    const customer = get().customer;
    if (!customer?.customer_id) {
      return { success: false, errorMessage: "Not signed in." };
    }

    try {
      const supabase = createClient();
      // 1. Delete customer's saved addresses, wishlists, and cloud cart
      await Promise.all([
        supabase
          .from("smart_addresses")
          .delete()
          .eq("customer_id", customer.customer_id),
        supabase
          .from("smart_wishlists")
          .delete()
          .eq("customer_id", customer.customer_id),
        supabase
          .from("smart_carts")
          .delete()
          .eq("customer_id", customer.customer_id),
      ]);

      // 2. Anonymize customer_id on past orders so accounting history remains intact while PII link is removed
      await supabase
        .from("smart_orders")
        .update({ customer_id: null, is_guest: true })
        .eq("customer_id", customer.customer_id);

      // 3. Delete customer record from smart_customers
      const { error } = await supabase
        .from("smart_customers")
        .delete()
        .eq("customer_id", customer.customer_id);

      if (error) {
        throw new Error(error.message);
      }

      get().signOut();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        errorMessage:
          err instanceof Error
            ? err.message
            : "Could not delete account right now.",
      };
    }
  },
}));
