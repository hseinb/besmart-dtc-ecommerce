import { createClient } from "@supabase/supabase-js";
import { SmartAppShell } from "@/components/layout/SmartAppShell";
import {
  ItemClass,
  ItemTag,
  ItemWithImages,
  SmartAppSettings,
  SmartBanner,
  SmartCoupon,
  SmartDeliveryZone,
} from "@/types/smart.types";
import { DEFAULT_SMART_SETTINGS } from "@/lib/smartSettings";
import { getItemImageUrl } from "@/lib/media";

interface CategoryThumbnailRow {
  class_id: number;
  item_count: number;
  item_id: number | null;
  item_code: string | null;
  image_updated_at: string | null;
  hero1: string | null;
}

export default async function HomePage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Load live B's Mart settings from public.smart_app_settings
  let appSettings: SmartAppSettings = DEFAULT_SMART_SETTINGS;
  try {
    const { data: settingsData } = await supabase
      .from("smart_app_settings")
      .select("*")
      .eq("id", "global")
      .single();

    if (settingsData) {
      appSettings = {
        ...DEFAULT_SMART_SETTINGS,
        ...(settingsData as unknown as SmartAppSettings),
        hidden_categories: Array.isArray(settingsData.hidden_categories)
          ? settingsData.hidden_categories.map(Number)
          : [],
        free_shipping_threshold: Number(
          settingsData.free_shipping_threshold ?? 50
        ),
        default_delivery_fee: Number(settingsData.default_delivery_fee ?? 3),
      };
    }
  } catch (err) {
    console.error("Failed to fetch smart_app_settings:", err);
  }

  // 2. Load real categories from public.item_class + representative category thumbnails via RPC
  const [{ data: categoriesData }, { data: catThumbsData }] = await Promise.all([
    supabase
      .from("item_class")
      .select("*")
      .order("item_class", { ascending: true }),
    supabase.rpc("smart_get_category_thumbnails"),
  ]);

  const activeClassIds = new Set<number>();
  const categoryThumbs: Record<number, string> = {};

  if (Array.isArray(catThumbsData)) {
    for (const row of catThumbsData as CategoryThumbnailRow[]) {
      const classId = Number(row.class_id);
      if (Number(row.item_count) > 0) {
        activeClassIds.add(classId);
      }
      if (row.hero1) {
        const thumbUrl = row.hero1.startsWith("http")
          ? row.hero1
          : getItemImageUrl(
              {
                code: row.item_code ?? "",
                item_images: { hero1: row.hero1 },
              },
              "thumb"
            );
        if (thumbUrl && !thumbUrl.startsWith("data:image/svg+xml")) {
          categoryThumbs[classId] = thumbUrl;
        }
      }
    }
  }

  const rawCategories = (categoriesData as ItemClass[]) || [];
  const hiddenSet = new Set(appSettings.hidden_categories.map(Number));
  const visibleCats = rawCategories.filter(
    (c) => !hiddenSet.has(Number(c.item_class_id))
  );
  const categories =
    activeClassIds.size > 0
      ? visibleCats.filter((c) => activeClassIds.has(Number(c.item_class_id)))
      : visibleCats;

  // 3. Load real delivery zones from public.smart_delivery_zones
  const { data: zonesData } = await supabase
    .from("smart_delivery_zones")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const deliveryZones = (zonesData as SmartDeliveryZone[]) || [];

  // 4. Load real campaign tags, smart_banners, and public collectible smart_coupons
  const [tagsRes, bannersRes, couponsRes] = await Promise.all([
    supabase
      .from("item_tags")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("smart_banners")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("smart_coupons")
      .select("*")
      .eq("is_active", true)
      .eq("is_public_collectible", true)
      .order("created_at", { ascending: false }),
  ]);

  const campaignTags = (tagsRes.data as ItemTag[]) || [];
  const banners = (bannersRes.data as SmartBanner[]) || [];
  const collectibleCoupons = (couponsRes.data as SmartCoupon[]) || [];

  // 5. Load initial batch of real B2C catalog items from public.smart_items + item_images
  const selectClause = appSettings.require_images
    ? "*, item_images!inner(*)"
    : "*, item_images(*)";

  let itemsQuery = supabase
    .from("smart_items")
    .select(selectClause, { count: "exact" })
    .eq("is_active", true);

  let flashQuery = supabase
    .from("smart_items")
    .select(selectClause)
    .eq("is_active", true)
    .gt("discount", 0);

  if (appSettings.hide_out_of_stock) {
    itemsQuery = itemsQuery.gt("qtty", 0);
    flashQuery = flashQuery.gt("qtty", 0);
  }
  if (appSettings.hidden_categories.length > 0) {
    const hiddenList = `(${appSettings.hidden_categories.join(",")})`;
    itemsQuery = itemsQuery.not("class_id", "in", hiddenList);
    flashQuery = flashQuery.not("class_id", "in", hiddenList);
  }

  itemsQuery = itemsQuery
    .order("image_updated_at", { ascending: false, nullsFirst: false })
    .order("item_id", { ascending: false });

  flashQuery = flashQuery
    .order("discount", { ascending: false })
    .order("image_updated_at", { ascending: false, nullsFirst: false })
    .limit(12);

  const [{ data: itemsData, count: totalCount }, { data: flashData }] =
    await Promise.all([itemsQuery.range(0, 39), flashQuery]);

  const initialItems = (itemsData as unknown as ItemWithImages[]) || [];
  const initialFlashDeals = (flashData as unknown as ItemWithImages[]) || [];

  return (
    <SmartAppShell
      initialCategories={categories}
      categoryThumbs={categoryThumbs}
      initialItems={initialItems}
      totalCatalogCount={totalCount || initialItems.length}
      initialFlashDeals={initialFlashDeals}
      campaignTags={campaignTags}
      banners={banners}
      collectibleCoupons={collectibleCoupons}
      initialSettings={appSettings}
      deliveryZones={deliveryZones}
    />
  );
}
