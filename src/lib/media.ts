import { Json, ItemImages } from "@/types/smart.types";

export interface ImageTierUrls {
  thumb?: string;
  view?: string;
  raw?: string;
}

const R2_PUBLIC_BASE =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-bhome.r2.dev";

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
    const raw = typeof obj.raw === "string" ? obj.raw : undefined;

    return {
      thumb: resolveMediaUrl(thumb),
      view: resolveMediaUrl(view),
      raw: resolveMediaUrl(raw),
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
