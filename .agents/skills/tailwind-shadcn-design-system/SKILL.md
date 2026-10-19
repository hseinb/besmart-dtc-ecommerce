---
name: tailwind-shadcn-design-system
description: Best practices for B's Mart brand tokens, CSS variables, dark/light/brand modes, and accessible Radix UI / Shadcn UI primitives for B2C retail shopping.
---

# Tailwind CSS & Shadcn UI Design System for B's Mart (B2C)

This skill defines UI design tokens, component anatomy, and accessibility standards for the **B's Mart** consumer shopping experience.

---

## 1. B's Mart Brand Tokens & CSS Variables
Define semantic brand tokens in `globals.css` using HSL/OKLCH variables to power B's Mart's distinct visual identity, mood, and color palette across light and dark modes:
```css
@layer base {
  :root {
    --background: 210 40% 98%;      /* Crisp Coastal Alabaster #F8FAFC */
    --foreground: 215 60% 11%;      /* Deep Ocean Ink #0B192C */
    --card: 0 0% 100%;
    --card-foreground: 215 60% 11%;
    --primary: 199 100% 26%;        /* B's Mart Teal-Sapphire Ocean Blue #005A87 */
    --primary-foreground: 0 0% 100%;
    --secondary: 203 90% 16%;       /* Deep Ocean Sapphire #04324E */
    --secondary-foreground: 0 0% 100%;
    --accent: 43 100% 50%;          /* Luminous Metallic Yellow-Gold #FFB800 */
    --accent-foreground: 215 60% 11%;
    --sale: 16 100% 56%;            /* High-Energy Retail Flash Coral-Orange #FF5A1F */
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --border: 214.3 31.8% 91.4%;
    --radius: 0.875rem;             /* Modern B2C rounded corners */
  }
}
```

---

## 2. B2C Storefront Component Standards
- **Retail Product Cards**:
  - Generous visual breathing room, rounded corners (`rounded-2xl`), subtle hover/press elevation, and crisp typography.
  - Price display hierarchy: prominent `finalUnitPrice`, muted `line-through` original `SRP`, and high-contrast savings pill (`Save 20%`).
- **Quick-Add & Quantity Stepper**:
  - Single-tap `"Add"` button that morphs smoothly into a `- 1 +` pill stepper once the item is in the cart.
- **Free-Shipping Progress Widget**:
  - Animated progress bar in the Cart Drawer and Checkout header showing how close the shopper is to unlocking free delivery.
- **Wishlist Heart Button**:
  - Floating top-right button on product cards with optimistic scale/fill micro-interaction.

---

## 3. Accessible Component Primitives (Radix UI / Shadcn)
- **Sheets & Mobile Drawers (`vaul` / `Sheet`)**: Use bottom sheets on mobile and slide-over drawers on desktop for the Cart, Filters, Address Selector, and Product Quick-View.
- **Dialogs & Zoom Lightboxes**: Use Radix `Dialog` for high-res product image zoom (`views/` & `raws/`) and review submission modals.
- **Search & Autocomplete**: Instant search bar with product thumbnail previews, recent searches, and trending category chips.

---

## 4. Mobile & Hybrid Touch Adaptation
- **Touch Targets**: All interactive buttons, heart icons, and quantity controls must maintain at least `44x44px` tap targets (`min-h-[44px] min-w-[44px]`).
- **Sticky Bottom Bars**: Product Detail Pages and Checkout screens use sticky bottom action bars padded with `pb-[max(env(safe-area-inset-bottom),16px)]`.
