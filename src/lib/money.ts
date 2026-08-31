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
