---
name: brand-logo-studio
description: Brand identity, logo geometry, app icon design, typography pairing, and "Upscale Teal-Sapphire & Luminous Yellow-Gold" color system for B's Mart.
---

# B's Mart Brand & Logo Design Studio (Sarah's Skill)

This skill governs the finalized visual identity, logo mark construction, color psychology, and typography system for **B's Mart**.

---

## 1. Official Signature Logo Anatomy (`B's MART` — Variation 6)

The official logo lives at `public/logo.png` and `public/icon-1024.png`:

1. **The Sweeping Calligraphic `B`**:
   - Preserves the forward-leaning, fluid white ribbon curves of the original `B HOME` letter `B`.
2. **The Bottom-Aligned `'s` Companion**:
   - Clean geometric white **`'s`** positioned at the bottom-right edge of the `B` so that the bottom of the `'s` and the bottom tip of the `B` share the exact same horizontal baseline border right above `MART`.
3. **The 3D-Angled Luminous Yellow-Gold Shopping Bag**:
   - Tucked into the lower-left stem of the `B` (where the house motif previously sat), rendered as a 3D-angled luxury retail shopping bag with double arched handles in **Luminous Metallic Yellow-Gold (`#FFD000` / `#F59E0B` $\rightarrow$ `#D97706`)**.
4. **The Vibrant `MART` Wordmark & Underline**:
   - Bold geometric **`MART`** and a rounded underline bar beneath `B's`, styled in a smooth **Yellow-Gold to Crisp White** horizontal gradient.
5. **The Rich Teal-Sapphire Ocean Blue Canvas**:
   - Set against a deep, upscale **Teal-Sapphire Ocean Blue** gradient (`#053C5E` $\rightarrow$ `#006494`).

---

## 2. Official Color System: "Upscale Teal-Sapphire & Luminous Yellow-Gold"

| Token Role | Name | Hex | HSL | Storefront Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Brand (`--primary`)** | Teal-Sapphire Ocean Blue | `#005A87` | `199 100% 26%` | Brand badge background, primary CTAs, active navigation, trust pills |
| **Deep Luxury Surface (`--secondary`)** | Deep Ocean Sapphire | `#04324E` | `203 90% 16%` | Hero banner gradients, VIP dark cards, footer surface |
| **Signature Accent (`--accent`)** | Luminous Yellow-Gold | `#FFB800` / `#F59E0B` | `43 100% 50%` | Shopping bag emblem, Free-Shipping progress bar, star ratings, deal highlights |
| **High-Energy Sale (`--sale`)** | Warm Amber-Coral / Flash Red | `#FF5A1F` / `#E11D48` | `16 100% 56%` | Flash-sale discount badges (`-25%`), strikethrough savings pills |
| **Storefront Surface (`--background`)** | Crisp Coastal Alabaster | `#F8FAFC` | `210 40% 98%` | Clean, high-contrast background making product photography pop |
| **Primary Ink (`--foreground`)** | Deep Ocean Ink | `#0B192C` | `215 60% 11%` | High-legibility headings, product titles, and prices |

---

## 3. Typography Pairing

- **Display / Brand Headings (`Plus Jakarta Sans` or `Outfit` ExtraBold/Black)**:
  - Energetic, geometric, modern retail punch matching the **`MART`** wordmark.
- **UI & Product Body (`Inter`)**:
  - Clean, effortless readability across mobile and desktop product cards and checkout forms.
- **Prices & Discounts (`JetBrains Mono` / Tabular Sans)**:
  - Crisp, aligned numerals for retail prices, strikethrough compare-at prices, and cart totals.

---

## 4. App Icon & Store Asset Rules
- **Master App Icon (`public/icon-1024.png` — `1024 × 1024 px` 24-bit RGB PNG)**:
  - Strict 24-bit RGB (`Format24bppRgb`, zero alpha transparency) for Apple App Store Connect compliance.
  - Safe margin around the `B's MART` lockup so iOS squircle and Android adaptive circle masks never clip the `'s` or the underline bar.
