import { createClient } from "@/lib/supabase/client";
import { SmartAppSettings } from "@/types/smart.types";

export const DEFAULT_SMART_SETTINGS: SmartAppSettings = {
  id: "global",
  hide_out_of_stock: false,
  hide_stock_qty: true,
  require_images: true,
  default_sort: "image_desc",
  hidden_categories: [],
  free_shipping_threshold: 50,
  default_delivery_fee: 3,
  default_markup_percent: 0,
  price_rounding_mode: "none",
  flash_sale_title: "Flash Sale",
  flash_sale_ends_at: null,
  enable_cod: true,
  enable_whish: true,
  enable_omt: true,
  enable_card_pos: true,
  whatsapp_support_phone: "",
  latest_version: "1.0.0",
  latest_build: 1,
  update_url_android: "",
  update_url_ios: "",
  update_message:
    "A new version of B's Mart is available with exciting new deals and faster shopping!",
  force_update: false,
};

export async function fetchSmartAppSettings(): Promise<SmartAppSettings> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("smart_app_settings")
      .select("*")
      .eq("id", "global")
      .single();

    if (error || !data) {
      return DEFAULT_SMART_SETTINGS;
    }

    return {
      ...DEFAULT_SMART_SETTINGS,
      ...data,
      hidden_categories: Array.isArray(data.hidden_categories)
        ? data.hidden_categories.map(Number)
        : [],
      free_shipping_threshold: Number(data.free_shipping_threshold ?? 50),
      default_delivery_fee: Number(data.default_delivery_fee ?? 3),
      default_markup_percent: Number(data.default_markup_percent ?? 0),
      price_rounding_mode: data.price_rounding_mode || "none",
    };
  } catch {
    return DEFAULT_SMART_SETTINGS;
  }
}

export async function updateSmartAppSettings(
  partial: Partial<SmartAppSettings>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("smart_app_settings")
      .upsert({
        id: "global",
        ...partial,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
