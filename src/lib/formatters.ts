import { OrderStatus, OrderType } from "./types";

export function formatCurrency(amount: number, currency: string = "MAD"): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return `0.00 ${currency}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";
  return `${formatDate(date)} at ${formatTime(date)}`;
}

export function formatRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return formatDate(date);
}

export interface StatusBadgeConfig {
  label: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
  borderClass: string;
}

export function getStatusConfig(status: OrderStatus | string): StatusBadgeConfig {
  switch (status.toUpperCase()) {
    case "PENDING":
      return {
        label: "Pending",
        bgClass: "bg-amber-50",
        textClass: "text-amber-800",
        dotClass: "bg-amber-500",
        borderClass: "border-amber-200",
      };
    case "CONFIRMED":
      return {
        label: "Confirmed",
        bgClass: "bg-blue-50",
        textClass: "text-blue-800",
        dotClass: "bg-blue-500",
        borderClass: "border-blue-200",
      };
    case "PREPARING":
      return {
        label: "Preparing",
        bgClass: "bg-orange-50",
        textClass: "text-orange-800",
        dotClass: "bg-orange-500",
        borderClass: "border-orange-200",
      };
    case "READY":
      return {
        label: "Ready",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-800",
        dotClass: "bg-emerald-500",
        borderClass: "border-emerald-200",
      };
    case "COMPLETED":
      return {
        label: "Completed",
        bgClass: "bg-slate-100",
        textClass: "text-slate-800",
        dotClass: "bg-slate-500",
        borderClass: "border-slate-300",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        bgClass: "bg-red-50",
        textClass: "text-red-800",
        dotClass: "bg-red-500",
        borderClass: "border-red-200",
      };
    default:
      return {
        label: status,
        bgClass: "bg-gray-100",
        textClass: "text-gray-700",
        dotClass: "bg-gray-400",
        borderClass: "border-gray-200",
      };
  }
}

export function getOrderTypeConfig(type: OrderType | string) {
  switch (type.toUpperCase()) {
    case "DELIVERY":
      return { label: "Delivery", bgClass: "bg-purple-50 text-purple-700 border-purple-200" };
    case "PICKUP":
      return { label: "Pickup", bgClass: "bg-teal-50 text-teal-700 border-teal-200" };
    default:
      return { label: type, bgClass: "bg-gray-50 text-gray-700 border-gray-200" };
  }
}

/**
 * Formats user-facing selection constraints for modifier groups.
 */
export function formatModifierSelectionRule(
  min: number,
  max: number,
  required: boolean
): string {
  const effectiveMin = required ? Math.max(1, min) : min;
  if (effectiveMin === 0 && max === 1) return "Optional (up to 1)";
  if (effectiveMin === 1 && max === 1) return "Choose 1";
  if (effectiveMin === max) return `Choose exactly ${max}`;
  if (effectiveMin === 0) return `Choose up to ${max}`;
  return `Choose ${effectiveMin}–${max}`;
}

