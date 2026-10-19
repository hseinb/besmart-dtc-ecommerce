export interface RetailPriceBreakdown {
  originalPrice: number;
  finalUnitPrice: number;
  discountPercent: number;
  unitSavings: number;
  isOnSale: boolean;
}

/**
 * Calculates B2C consumer unit pricing from retail SRP and item discount percentage.
 * Strictly single-unit retail pricing (no wholesale carton multipliers).
 */
export function resolveRetailPrice(
  srp: number | string | null | undefined,
  discount: number | string | null | undefined
): RetailPriceBreakdown {
  const rawSrp = Math.max(0, Number(srp) || 0);
  const rawDiscount = Math.min(100, Math.max(0, Number(discount) || 0));

  const originalPrice = Number(rawSrp.toFixed(2));
  const isOnSale = rawDiscount > 0 && originalPrice > 0;

  const finalUnitPrice = isOnSale
    ? Number((originalPrice * (1 - rawDiscount / 100)).toFixed(2))
    : originalPrice;

  const unitSavings = Number(Math.max(0, originalPrice - finalUnitPrice).toFixed(2));
  const discountPercent = isOnSale ? Math.round(rawDiscount) : 0;

  return {
    originalPrice,
    finalUnitPrice,
    discountPercent,
    unitSavings,
    isOnSale,
  };
}

export interface ConsumerStockStatus {
  isAvailable: boolean;
  isLowStock: boolean;
  badgeLabel: string;
  maxOrderableQty: number;
}

/**
 * Resolves consumer-facing stock status while strictly honoring smart_app_settings.hide_stock_qty.
 * NEVER exposes raw stock integers in the label when hideStockQty is true.
 */
export function resolveConsumerStockStatus(
  qtty: number | string | null | undefined,
  hideStockQty: boolean = true
): ConsumerStockStatus {
  const numericQty = Math.max(0, Math.floor(Number(qtty) || 0));
  const isAvailable = numericQty > 0;
  const isLowStock = numericQty > 0 && numericQty <= 5;

  let badgeLabel = "Out of Stock";
  if (isAvailable) {
    if (hideStockQty) {
      badgeLabel = isLowStock ? "Low Stock • Order Soon" : "In Stock";
    } else {
      badgeLabel = isLowStock
        ? `Only ${numericQty} left in stock`
        : `In Stock (${numericQty})`;
    }
  }

  return {
    isAvailable,
    isLowStock,
    badgeLabel,
    maxOrderableQty: numericQty > 0 ? numericQty : 0,
  };
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const val = Number(amount) || 0;
  return `$${val.toFixed(2)}`;
}
