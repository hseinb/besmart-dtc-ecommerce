/**
 * B's Mart — Client-Side 3-Tier WebP Image Optimizer & Cloudflare R2 Uploader
 *
 * Optimizes a selected File/Blob on the client into 3 WebP tiers:
 *   - thumb: max 400px @ 0.82 quality (fast product grid cards)
 *   - view:  max 1200px @ 0.90 quality (product detail gallery & modal)
 *   - raw:   max 2048px @ 0.95 quality (pinch-to-zoom & Creator Studio master)
 *
 * Uploads all 3 tiers to the dedicated B's Mart Cloudflare Worker (`bsmart-r2-uploader`),
 * which authenticates the staff user via `smart_verify_staff_session` and writes to the
 * `catalog-images` R2 bucket under the isolated `bsmart/` prefix:
 *   - bsmart/thumb/{itemId}/{code}_{slotKey}_{ts}.webp
 *   - bsmart/view/{itemId}/{code}_{slotKey}_{ts}.webp
 *   - bsmart/raw/{itemId}/{code}_{slotKey}_{ts}.webp
 */

export type BsMartImageSlotKey =
  | 'hero1'
  | 'dim1'
  | 'angle1'
  | 'angle2'
  | 'angle3'
  | 'angle4'
  | 'angle5';

export type BsMartMediaSlotKey =
  | BsMartImageSlotKey
  | 'main'
  | 'angle'
  | 'lifestyle'
  | 'detail';

export interface UploadBsMartSlotParams {
  file: File | Blob;
  itemId: number | string;
  code: string;
  slotKey: BsMartMediaSlotKey;
  staffUserId: string;
}

export interface BsMartUploadedTierUrls {
  thumb: string;
  view: string;
  raw: string;
}

export type R2SlotJson = BsMartUploadedTierUrls;

const DEFAULT_WORKER_UPLOAD_URL = 'https://bsmart-r2-uploader.hussbash24.workers.dev/upload';

/**
 * Loads an image File/Blob into an HTMLImageElement for canvas resizing.
 */
function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode selected image file.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Resizes an HTMLImageElement proportionally so its longest edge is <= maxDimension,
 * and encodes the result as an `image/webp` Blob at the specified quality.
 */
function resizeToWebpBlob(
  img: HTMLImageElement,
  maxDimension: number,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;

    if (!srcW || !srcH) {
      reject(new Error('Image has invalid dimensions.'));
      return;
    }

    let targetW = srcW;
    let targetH = srcH;

    if (srcW > maxDimension || srcH > maxDimension) {
      if (srcW >= srcH) {
        targetW = maxDimension;
        targetH = Math.max(1, Math.round((srcH * maxDimension) / srcW));
      } else {
        targetH = maxDimension;
        targetW = Math.max(1, Math.round((srcW * maxDimension) / srcH));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Unable to initialize 2D canvas context for image optimization.'));
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode WebP tier from canvas.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Generates the 3 WebP tiers (thumb, view, raw) from a source File/Blob and uploads
 * them to the Cloudflare R2 bucket via `bsmart-r2-uploader`.
 */
export async function uploadBsMartSlotToR2({
  file,
  itemId,
  code,
  slotKey,
  staffUserId,
}: UploadBsMartSlotParams): Promise<BsMartUploadedTierUrls> {
  if (!staffUserId) {
    throw new Error('Staff authentication is required to upload product media.');
  }

  const img = await loadImageFromFile(file);

  const [thumbBlob, viewBlob, rawBlob] = await Promise.all([
    resizeToWebpBlob(img, 400, 0.82),
    resizeToWebpBlob(img, 1200, 0.90),
    resizeToWebpBlob(img, 2048, 0.95),
  ]);

  const formData = new FormData();
  formData.append('itemId', String(itemId));
  formData.append('code', code || 'ITEM');
  formData.append('slotKey', slotKey);
  formData.append('staffUserId', staffUserId);
  formData.append('thumb', thumbBlob, 'thumb.webp');
  formData.append('view', viewBlob, 'view.webp');
  formData.append('raw', rawBlob, 'raw.webp');

  const endpoint = process.env.NEXT_PUBLIC_R2_UPLOAD_WORKER_URL || DEFAULT_WORKER_UPLOAD_URL;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-Staff-User-Id': staffUserId,
    },
    body: formData,
  });

  let payload: {
    success?: boolean;
    error?: string;
    urls?: BsMartUploadedTierUrls;
  } | null = null;

  try {
    payload = await response.json();
  } catch {
    throw new Error(`R2 upload failed with HTTP ${response.status}.`);
  }

  if (!response.ok || !payload?.success || !payload.urls) {
    throw new Error(payload?.error || `R2 upload failed (HTTP ${response.status}).`);
  }

  return payload.urls;
}
