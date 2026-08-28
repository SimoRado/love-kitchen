"use client";

import React from "react";
import { Check, X, Loader2, AlertCircle, Clock, Truck, ShoppingBag, Eye } from "lucide-react";
import { Order } from "@/lib/types";
import { formatCurrency, formatRelativeTime, formatTime } from "@/lib/formatters";

interface PosOrderCardProps {
  order: Order;
  currency?: string;
  isUpdating: boolean;
  onUpdateStatus: (order: Order, newStatus: string) => void;
  onViewDetails?: (order: Order) => void;
}

const ACTION_BY_STATUS: Record<
  string,
  { label: string; nextStatus: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: {
    label: "Accept Order",
    nextStatus: "CONFIRMED",
    className: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs",
    icon: Check,
  },
  CONFIRMED: {
    label: "Start Preparing",
    nextStatus: "PREPARING",
    className: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs",
    icon: Check,
  },
  PREPARING: {
    label: "Mark Ready",
    nextStatus: "READY",
    className: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 shadow-xs",
    icon: Check,
  },
  READY: {
    label: "Complete Order",
    nextStatus: "COMPLETED",
    className: "bg-slate-900 hover:bg-black active:bg-slate-950 text-white shadow-xs",
    icon: Check,
  },
};

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-red-600 text-white border-red-700";
    case "CONFIRMED":
      return "bg-blue-600 text-white border-blue-700";
    case "PREPARING":
      return "bg-amber-500 text-slate-950 border-amber-600";
    case "READY":
      return "bg-emerald-600 text-white border-emerald-700";
    case "COMPLETED":
      return "bg-slate-700 text-white border-slate-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-slate-700 text-white border-slate-800";
  }
}

export default function PosOrderCard({
  order,
  currency = "MAD",
  isUpdating,
  onUpdateStatus,
  onViewDetails,
}: PosOrderCardProps) {
  const action = ACTION_BY_STATUS[order.status];
  const orderNumDisplay = order.orderNumber.replace(/^ORD-/, "");
  const isDelivery = String(order.orderType).toUpperCase() === "DELIVERY";

  return (
    <article className="bg-white text-slate-950 rounded-lg border border-slate-200 shadow-xs p-3 flex flex-col justify-between gap-2.5 transition-all hover:border-slate-300">
      {/* 1. Ultra-Compact Single-Line Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 h-8 min-h-[32px]">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <div className="flex items-center gap-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-mono leading-none">
              #{orderNumDisplay}
            </h2>
            {onViewDetails && (
              <button
                type="button"
                onClick={() => onViewDetails(order)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="View full order details"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <span className="text-slate-300 text-xs">•</span>

          <span className="flex items-center gap-0.5 text-xs font-semibold text-slate-500">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{formatRelativeTime(order.createdAt)}</span>
          </span>

          <span className="text-slate-300 text-xs">•</span>

          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
              isDelivery ? "bg-purple-100 text-purple-800" : "bg-teal-100 text-teal-800"
            }`}
          >
            {isDelivery ? <Truck className="w-2.5 h-2.5" /> : <ShoppingBag className="w-2.5 h-2.5" />}
            <span>{order.orderType}</span>
          </span>

          {order.estimatedReadyAt && (
            <>
              <span className="text-slate-300 text-xs">•</span>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-orange-100 text-orange-900 font-mono">
                <Clock className="w-2.5 h-2.5 text-orange-600" />
                <span>Ready ~{formatTime(order.estimatedReadyAt)}</span>
              </span>
            </>
          )}

          {order.customerName && order.customerName !== "POS Walk-in" && (
            <>
              <span className="text-slate-300 text-xs">•</span>
              <span className="text-xs font-bold text-slate-700 truncate max-w-[110px]">
                {order.customerName}
              </span>
            </>
          )}
        </div>

        {/* Status Badge */}
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border shrink-0 leading-tight ${getStatusBadgeStyle(
            order.status
          )}`}
        >
          {order.status}
        </span>
      </div>

      {/* 2. Compact Line Items & Modifiers */}
      <div className="space-y-1 py-0.5 flex-1 min-w-0">
        {order.items.map((item) => (
          <div key={item.id} className="text-xs leading-tight">
            <div className="flex items-baseline justify-between font-bold text-slate-900 gap-2">
              <span className="truncate min-w-0">
                <span className="text-primary font-black mr-1">{item.quantity} ×</span>
                {item.productName}
              </span>
              {item.configuredUnitPrice !== undefined && item.configuredUnitPrice !== null && (
                <span className="text-xs font-semibold text-slate-400 shrink-0 font-mono ml-2">
                  {formatCurrency(item.configuredUnitPrice * item.quantity, currency)}
                </span>
              )}
            </div>

            {/* Modifiers List */}
            {item.modifiers && item.modifiers.length > 0 && (
              <div className="ml-4 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500 font-medium">
                {item.modifiers.map((modifier) => (
                  <span key={modifier.id} className="inline-flex items-center gap-0.5">
                    <span className="text-slate-300">•</span>
                    <span>{modifier.modifierOptionName}</span>
                    {modifier.priceDelta > 0 && (
                      <span className="text-slate-400">
                        (+{formatCurrency(modifier.priceDelta, currency)})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 3. High-Visibility Inline Allergy & Note Banners */}
      {(order.allergies || order.notes) && (
        <div className="space-y-1 text-xs">
          {order.allergies && (
            <div className="bg-amber-50 border-l-4 border-amber-500 px-2.5 py-1 text-xs font-medium text-amber-900 rounded-sm flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong className="uppercase font-bold text-amber-950">Allergies: </strong>
                {order.allergies}
              </span>
            </div>
          )}
          {order.notes && (
            <div className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200 flex items-start gap-1.5">
              <span>
                <strong className="font-semibold text-slate-900">Note: </strong>
                {order.notes}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 4. Unified Bottom Action Bar */}
      <div className="border-t border-slate-100 pt-2 flex items-center justify-between gap-2 min-h-[38px]">
        {/* Left: Total Amount */}
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 shrink-0">
            Total:
          </span>
          <span className="text-sm sm:text-base font-black text-slate-950 font-mono tracking-tight">
            {formatCurrency(order.total, currency)}
          </span>
        </div>

        {/* Right: Primary Action & Reject Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Secondary Reject Action */}
          {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
            <button
              type="button"
              onClick={() => onUpdateStatus(order, "CANCELLED")}
              disabled={isUpdating}
              className="h-9 px-2.5 rounded-lg text-xs font-bold bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 border border-red-200 flex items-center gap-1 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
              title="Reject / Cancel Order"
            >
              {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>Reject</span>
            </button>
          )}

          {/* Primary Next Action */}
          {action && (
            <button
              type="button"
              onClick={() => onUpdateStatus(order, action.nextStatus)}
              disabled={isUpdating}
              className={`h-9 px-3.5 rounded-lg text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 ${action.className}`}
            >
              {isUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <action.icon className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              <span>{action.label}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
