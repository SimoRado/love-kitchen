import React from "react";
import { OrderStatus } from "@/lib/types";
import { getStatusConfig } from "@/lib/formatters";

interface OrderStatusBadgeProps {
  status: OrderStatus | string;
  className?: string;
  size?: "sm" | "md";
}

export default function OrderStatusBadge({
  status,
  className = "",
  size = "md",
}: OrderStatusBadgeProps) {
  const config = getStatusConfig(status);

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[11px]"
      : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.bgClass} ${config.textClass} ${config.borderClass} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
      <span>{config.label}</span>
    </span>
  );
}
