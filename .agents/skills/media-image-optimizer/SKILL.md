---
name: media-image-optimizer
description: Browser Canvas image optimization, WebP 3-tier generation (thumbs, views, raws), SKU regex/fuzzy matching, and Google Drive asset ingestion.
---

# Media & Image Optimization Studio

This skill details the client-side media pipeline, image compression mechanics, and SKU matching algorithms used in **Product Specialist Web Studio**.

---

## 1. Multi-Tier WebP Pipeline Architecture

To optimize mobile bandwidth and ensure instantaneous UI rendering, every product image is processed into three discrete resolution tiers:

| Tier | Target Dimensions | WebP Quality | Intended Client Surface |
| :--- | :--- | :--- | :--- |
| **`thumbs`** | Max 300 × 300 px | `0.70` (70%) | Grid cards, Matrix preview rows, cart mini-thumbnails |
| **`views`** | Max 1200 × 1200 px | `0.85` (85%) | Product Detail Page carousel, Mobile Simulator preview |
| **`raws`** | Original Dimensions / Max 2400 × 2400 px | `0.92` (92%) | High-resolution pinch-to-zoom, master archive |

---

## 2. Browser Canvas Image Processing

Client-side image resizing and encoding is implemented in `src/utils/imageOptimizer.ts`:

- **Aspect Ratio Preservation**:
  ```typescript
  function calculateDimensions(width: number, height: number, maxDim: number) {
    if (width <= maxDim && height <= maxDim) return { width, height };
    if (width > height) {
      return { width: maxDim, height: Math.round((height * maxDim) / width) };
    } else {
      return { width: Math.round((width * maxDim) / height), height: maxDim };
    }
  }
  ```
- **Canvas Rendering & WebP Export**:
  - Load the source image into an `HTMLImageElement` via an `Image` object or `createImageBitmap`.
  - Draw to an offscreen `<canvas>` with `imageSmoothingQuality = 'high'`.
  - Export using `canvas.toDataURL('image/webp', quality)` or `canvas.toBlob(callback, 'image/webp', quality)`.
  - Provide fallback to JPEG data URLs if WebP is unsupported in legacy environments.

---

## 3. SKU & File Name Matching Engine

The SKU matcher (`src/utils/skuMatcher.ts`) automates linking uploaded files or Google Drive assets to catalog items:

### A. Matching Strategies
1. **Direct Item Code Match**: Exact match of product code (e.g. `ABC-102.jpg` matches item code `ABC-102`).
2. **Item ID Match**: Exact numeric match of primary key ID (e.g. `4502_1.webp` matches `item_id: 4502`).
3. **Normalized Token Extraction**: Strips punctuation, suffixes (`_thumb`, `_view`, `_raw`, `_main`, `_copy`), and compares uppercase tokens.
4. **Fuzzy String Distance**: Uses Levenshtein distance or substring containment for names that include descriptive suffixes (e.g. `CHAIR-DELUXE-OAK-front.jpg`).

### B. Drive Asset Processing
- Reads Google Drive asset folder manifests.
- Flags matched catalog items with confidence score (`High`, `Medium`, `None`).
- Allows single-click batch assignment into the `imagesMap` state and database.

---

## 4. Media Sequence & Video Integration

- **Sequence Ordering**: Reorder thumbnails via drag-and-drop or rank shifting in `SplitStudioView.tsx`. The first thumbnail in `thumbs[0]` / `views[0]` serves as the primary catalog cover image.
- **Video URLs**: Store direct MP4 links or YouTube/Vimeo embed links in `video_url` with corresponding `video_thumbnail_url`.
- **Media Completeness Metrics**:
  - `Complete` (Green): 2 or more images assigned.
  - `Partial` (Amber): Exactly 1 image assigned.
  - `Missing` (Red): 0 images assigned.
