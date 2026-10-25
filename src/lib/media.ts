import { Json, ItemImages, ItemWithImages } from "@/types/smart.types";

export interface ImageTierUrls {
  thumb?: string;
  view?: string;
  raw?: string;
}

export type CreatorImageQuality = "thumb" | "view" | "raw";

export interface CreatorImageSlot {
  slotKey:
    | "hero1"
    | "dim1"
    | "angle1"
    | "angle2"
    | "angle3"
    | "angle4"
    | "angle5";
  label: string;
  thumbUrl: string;
  viewUrl: string;
  rawUrl: string;
  proxiedRawUrl: string;
  isRawGoogleDrive: boolean;
}

const R2_PUBLIC_BASE =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-bhome.r2.dev";
const SUPABASE_BASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://nhellhapzcylcukdxcwo.supabase.co";

export function canAccessCreatorStudio(
  staffUser: { role?: string; is_active?: boolean } | null | undefined
): boolean {
  if (!staffUser || staffUser.is_active === false) return false;
  const role = String(staffUser.role || "")
    .trim()
    .toLowerCase();
  return [
    "content_creator",
    "merchandising",
    "admin",
    "marketing",
    "creator",
  ].includes(role);
}

export function getProxiedMediaBlobUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (
      host.endsWith(".r2.dev") ||
      host === "drive.google.com" ||
      host.endsWith(".googleusercontent.com")
    ) {
      return `${SUPABASE_BASE_URL.replace(
        /\/$/,
        ""
      )}/functions/v1/r2-image-proxy?url=${encodeURIComponent(trimmed)}`;
    }
  } catch {
    // Fall back to original URL if parsing fails
  }
  return trimmed;
}

export function parseImageSlot(slot: Json | null | undefined): ImageTierUrls | null {
  if (!slot) return null;
  if (typeof slot === "string") {
    const trimmed = slot.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return parseImageSlot(JSON.parse(trimmed) as Json);
      } catch {
        // Fall through to plain string URL resolution
      }
    }
    return {
      thumb: resolveMediaUrl(slot),
      view: resolveMediaUrl(slot),
      raw: resolveMediaUrl(slot),
    };
  }
  if (Array.isArray(slot) && slot.length > 0) {
    const first = slot[0];
    if (typeof first === "string") {
      return {
        thumb: resolveMediaUrl(first),
        view: resolveMediaUrl(first),
        raw: resolveMediaUrl(first),
      };
    }
    if (typeof first === "object" && first !== null) {
      return parseImageSlot(first as Json);
    }
  }
  if (typeof slot === "object" && !Array.isArray(slot)) {
    const obj = slot as Record<string, unknown>;
    const thumb = typeof obj.thumb === "string" ? obj.thumb : undefined;
    const view = typeof obj.view === "string" ? obj.view : undefined;
    const rawStr = typeof obj.raw === "string" ? obj.raw : undefined;
    const safeRaw =
      rawStr && !rawStr.includes("drive.google.com") ? rawStr : undefined;

    const resolvedThumb = resolveMediaUrl(thumb);
    const resolvedView = resolveMediaUrl(view);
    const resolvedRaw =
      resolveMediaUrl(safeRaw) || resolvedView || resolvedThumb;

    return {
      thumb: resolvedThumb,
      view: resolvedView,
      raw: resolvedRaw,
    };
  }
  return null;
}

export function resolveMediaUrl(pathOrUrl?: string): string | undefined {
  if (!pathOrUrl) return undefined;
  if (
    pathOrUrl.startsWith("http://") ||
    pathOrUrl.startsWith("https://") ||
    pathOrUrl.startsWith("/")
  ) {
    return pathOrUrl;
  }
  return `${R2_PUBLIC_BASE.replace(/\/$/, "")}/${pathOrUrl.replace(/^\//, "")}`;
}

export function getProductPlaceholderUrl(code: string): string {
  const safeCode = (code || "ITEM").replace(/[^a-zA-Z0-9-_]/g, "");
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300" fill="%23f8fafc"><rect width="300" height="300" fill="%23f1f5f9"/><rect x="105" y="105" width="90" height="75" rx="12" fill="%23005A87" fill-opacity="0.12"/><text x="150" y="210" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23005A87" text-anchor="middle">${safeCode}</text></svg>`;
}

export function normalizeItemImages(
  itemImages?: Partial<ItemImages> | Partial<ItemImages>[] | null
): Partial<ItemImages> | null {
  if (!itemImages) return null;
  if (Array.isArray(itemImages)) {
    return itemImages.length > 0 ? itemImages[0] : null;
  }
  return itemImages;
}

export function getItemImageUrl(
  item: {
    code: string;
    item_images?: Partial<ItemImages> | Partial<ItemImages>[] | null;
  },
  tier: keyof ImageTierUrls = "thumb"
): string {
  const imgRecord = normalizeItemImages(item.item_images);
  if (imgRecord?.hero1) {
    const parsed = parseImageSlot(imgRecord.hero1);
    if (parsed) {
      const url = parsed[tier] || parsed.thumb || parsed.view || parsed.raw;
      if (url) return url;
    }
  }
  return getProductPlaceholderUrl(item.code);
}

export function getItemGalleryUrls(item: {
  code: string;
  item_images?: Partial<ItemImages> | Partial<ItemImages>[] | null;
}): ImageTierUrls[] {
  const imgRecord = normalizeItemImages(item.item_images);
  if (!imgRecord) {
    const fallback = getProductPlaceholderUrl(item.code);
    return [{ thumb: fallback, view: fallback, raw: fallback }];
  }

  const slots: (Json | null | undefined)[] = [
    imgRecord.hero1,
    imgRecord.dim1,
    imgRecord.angle1,
    imgRecord.angle2,
    imgRecord.angle3,
    imgRecord.angle4,
    imgRecord.angle5,
  ];

  const gallery: ImageTierUrls[] = [];
  for (const slot of slots) {
    const parsed = parseImageSlot(slot);
    if (parsed && (parsed.view || parsed.thumb || parsed.raw)) {
      gallery.push(parsed);
    }
  }

  if (gallery.length === 0) {
    const fallback = getProductPlaceholderUrl(item.code);
    return [{ thumb: fallback, view: fallback, raw: fallback }];
  }

  return gallery;
}

function parseRawCreatorSlot(
  slot: Json | null | undefined
): { thumb?: string; view?: string; raw?: string } | null {
  if (!slot) return null;
  if (typeof slot === "string") {
    const trimmed = slot.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return parseRawCreatorSlot(JSON.parse(trimmed) as Json);
      } catch {
        // Fall through
      }
    }
    const resolved = resolveMediaUrl(trimmed);
    return resolved ? { thumb: resolved, view: resolved, raw: resolved } : null;
  }
  if (Array.isArray(slot) && slot.length > 0) {
    return parseRawCreatorSlot(slot[0] as Json);
  }
  if (typeof slot === "object" && !Array.isArray(slot)) {
    const obj = slot as Record<string, unknown>;
    const thumb =
      typeof obj.thumb === "string" ? resolveMediaUrl(obj.thumb) : undefined;
    const view =
      typeof obj.view === "string" ? resolveMediaUrl(obj.view) : undefined;
    const raw =
      typeof obj.raw === "string" ? resolveMediaUrl(obj.raw) : undefined;
    if (!thumb && !view && !raw) return null;
    return {
      thumb: thumb || view || raw,
      view: view || thumb || raw,
      raw: raw || view || thumb,
    };
  }
  return null;
}

export function getItemCreatorGallerySlots(
  item: ItemWithImages | null | undefined
): CreatorImageSlot[] {
  if (!item) return [];
  const imgRecord = normalizeItemImages(item.item_images);
  if (!imgRecord) return [];

  const definitions: {
    slotKey: CreatorImageSlot["slotKey"];
    label: string;
    value: Json | null | undefined;
  }[] = [
    { slotKey: "hero1", label: "Main Hero", value: imgRecord.hero1 },
    { slotKey: "dim1", label: "Dimensions", value: imgRecord.dim1 },
    { slotKey: "angle1", label: "Angle 1", value: imgRecord.angle1 },
    { slotKey: "angle2", label: "Angle 2", value: imgRecord.angle2 },
    { slotKey: "angle3", label: "Angle 3", value: imgRecord.angle3 },
    { slotKey: "angle4", label: "Angle 4", value: imgRecord.angle4 },
    { slotKey: "angle5", label: "Angle 5", value: imgRecord.angle5 },
  ];

  const results: CreatorImageSlot[] = [];
  for (const def of definitions) {
    const parsed = parseRawCreatorSlot(def.value);
    if (!parsed) continue;
    const thumbUrl = parsed.thumb || parsed.view || parsed.raw || "";
    const viewUrl = parsed.view || parsed.thumb || parsed.raw || "";
    const rawUrl = parsed.raw || viewUrl || thumbUrl;
    if (!thumbUrl && !viewUrl && !rawUrl) continue;

    results.push({
      slotKey: def.slotKey,
      label: def.label,
      thumbUrl,
      viewUrl,
      rawUrl,
      proxiedRawUrl: getProxiedMediaBlobUrl(rawUrl || viewUrl || thumbUrl),
      isRawGoogleDrive: rawUrl.includes("drive.google.com"),
    });
  }

  return results;
}
