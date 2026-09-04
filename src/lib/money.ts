/**
 * Precision-safe monetary calculation helpers
 * Avoids floating point representation artifacts (e.g. 0.1 + 0.2 = 0.30000000000000004)
 */

export function roundMoney(amount: number): number {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 0;
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculateItemTotal(unitPrice: number, quantity: number): number {
  const qty = Math.max(1, Math.floor(quantity) || 1);
  return roundMoney(roundMoney(unitPrice) * qty);
}

export interface CalculatedOrderTotals {
  subtotal: number;
  deliveryFee: number;
  total: number;
}

export function calculateOrderTotals(
  items: Array<{ price?: number; configuredUnitPrice?: number; quantity: number }>,
  orderType: "DELIVERY" | "PICKUP" | string,
  settingsDeliveryFee: number
): CalculatedOrderTotals {
  let subtotal = 0;
  for (const item of items) {
    const itemUnitPrice = Number(item.configuredUnitPrice ?? item.price ?? 0);
    subtotal = roundMoney(subtotal + calculateItemTotal(itemUnitPrice, item.quantity));
  }

  const isDelivery = String(orderType).toUpperCase() === "DELIVERY";
  const deliveryFee = isDelivery ? roundMoney(Math.max(0, settingsDeliveryFee)) : 0;
  const total = roundMoney(subtotal + deliveryFee);

  return {
    subtotal,
    deliveryFee,
    total,
  };
}

/**
 * Checks whether a product has an active discount.
 * Active if discountPercent is a finite number strictly greater than 0 and up to 100.
 */
export function hasActiveDiscount(discountPercent?: number | null): boolean {
  if (discountPercent === null || discountPercent === undefined) {
    return false;
  }
  const pct = Number(discountPercent);
  return Number.isFinite(pct) && pct > 0 && pct <= 100;
}

/**
 * Calculates the effective unit price of a product, accounting for any active discount.
 * Original base price is returned when no discount is active.
 * Precision-safe via roundMoney.
 */
export function getEffectiveProductPrice(price: number, discountPercent?: number | null): number {
  const basePrice = roundMoney(price);
  if (!hasActiveDiscount(discountPercent)) {
    return basePrice;
  }
  const pct = Math.floor(Number(discountPercent));
  if (pct >= 100) {
    return 0;
  }
  return roundMoney(basePrice * (1 - pct / 100));
}

/**
 * Calculates the monetary discount savings (original - effective).
 */
export function calculateDiscountSavings(price: number, discountPercent?: number | null): number {
  const basePrice = roundMoney(price);
  const effectivePrice = getEffectiveProductPrice(price, discountPercent);
  return roundMoney(Math.max(0, basePrice - effectivePrice));
}

