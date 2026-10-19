import { createClient } from "@/lib/supabase/client";
import {
  ItemWithImages,
  RecosysNeighbor,
  SmartAppSettings,
} from "@/types/smart.types";

export interface ProductRecommendationsResult {
  frequentlyBoughtTogether: ItemWithImages[];
  youMayAlsoLike: ItemWithImages[];
  salesPitch: string | null;
}

/**
 * Queries real ML neighbor recommendations from public.recosys_items
 * and resolves them against live public.items + public.item_images,
 * strictly enforcing smart_app_settings (hide_out_of_stock, require_images, hidden_categories).
 */
export async function fetchProductRecommendations(
  item: ItemWithImages,
  settings: SmartAppSettings,
  maxTotal = 12
): Promise<ProductRecommendationsResult> {
  const supabase = createClient();
  const selectClause = settings.require_images
    ? "*, item_images!inner(*)"
    : "*, item_images(*)";
  const hiddenSet = new Set((settings.hidden_categories || []).map(Number));

  let salesPitch: string | null = null;
  const neighborIds: number[] = [];
  const neighborCodes: string[] = [];

  try {
    const { data: recoRows } = await supabase
      .from("recosys_items")
      .select("item_id, code, neighbors, sales_pitch")
      .or(`item_id.eq.${item.item_id},code.eq.${item.code}`)
      .limit(1);

    if (recoRows && recoRows.length > 0) {
      const row = recoRows[0];
      if (typeof row.sales_pitch === "string" && row.sales_pitch.trim()) {
        salesPitch = row.sales_pitch.trim();
      }
      if (Array.isArray(row.neighbors)) {
        const sorted = [...(row.neighbors as Array<RecosysNeighbor & { id?: string | number }>)].sort(
          (a, b) => Number(b.similarity || 0) - Number(a.similarity || 0)
        );
        for (const n of sorted) {
          const rawId = n.id ?? n.item_id;
          const numId = Number(rawId);
          if (!Number.isNaN(numId) && numId > 0 && numId !== item.item_id) {
            neighborIds.push(numId);
          }
          if (typeof n.code === "string" && n.code.trim() && n.code !== item.code) {
            neighborCodes.push(n.code.trim());
          }
        }
      }
    }
  } catch {
    // Non-blocking fallback to category neighbors below
  }

  const resolvedMap = new Map<number, ItemWithImages>();

  // 1. Fetch ML neighbor items by item_id or code
  if (neighborIds.length > 0 || neighborCodes.length > 0) {
    try {
      let query = supabase
        .from("smart_items")
        .select(selectClause)
        .eq("is_active", true)
        .neq("item_id", item.item_id);

      if (neighborIds.length > 0) {
        query = query.in("item_id", neighborIds.slice(0, 20));
      } else if (neighborCodes.length > 0) {
        query = query.in("code", neighborCodes.slice(0, 20));
      }

      if (settings.hide_out_of_stock) {
        query = query.gt("qtty", 0);
      }
      if (hiddenSet.size > 0) {
        query = query.not(
          "class_id",
          "in",
          `(${Array.from(hiddenSet).join(",")})`
        );
      }

      const { data: neighborItems } = await query.limit(maxTotal);
      if (neighborItems) {
        const typed = neighborItems as unknown as ItemWithImages[];
        // Preserve ML similarity ordering
        for (const id of neighborIds) {
          const match = typed.find((t) => t.item_id === id);
          if (match && !hiddenSet.has(Number(match.class_id))) {
            resolvedMap.set(match.item_id, match);
          }
        }
        for (const t of typed) {
          if (!hiddenSet.has(Number(t.class_id))) {
            resolvedMap.set(t.item_id, t);
          }
        }
      }
    } catch {}
  }

  // 2. Supplement with real items from the same category if needed
  if (resolvedMap.size < maxTotal && item.class_id && !hiddenSet.has(Number(item.class_id))) {
    try {
      let catQuery = supabase
        .from("smart_items")
        .select(selectClause)
        .eq("is_active", true)
        .eq("class_id", item.class_id)
        .neq("item_id", item.item_id);

      if (settings.hide_out_of_stock) {
        catQuery = catQuery.gt("qtty", 0);
      }

      const { data: catItems } = await catQuery
        .order("image_updated_at", { ascending: false, nullsFirst: false })
        .limit(maxTotal);

      if (catItems) {
        for (const cItem of catItems as unknown as ItemWithImages[]) {
          if (resolvedMap.size >= maxTotal) break;
          if (!hiddenSet.has(Number(cItem.class_id))) {
            resolvedMap.set(cItem.item_id, cItem);
          }
        }
      }
    } catch {}
  }

  const allResolved = Array.from(resolvedMap.values());
  const frequentlyBoughtTogether = allResolved.slice(0, 3);
  const youMayAlsoLike = allResolved.slice(0, maxTotal);

  return {
    frequentlyBoughtTogether,
    youMayAlsoLike,
    salesPitch,
  };
}
