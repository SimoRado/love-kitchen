"use client";

import React from "react";
import { Check, X, Loader2, AlertCircle, Clock, Truck, ShoppingBag, Eye } from "lucide-react";
import { Order } from "@/lib/types";
import { formatCurrency, formatRelativeTime } from "@/lib/formatters";

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
    className: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm",
    icon: Check,
  },
  CONFIRMED: {
    label: "Start Preparing",
    nextStatus: "PREPARING",
    className: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm",
    icon: Check,
  },
  PREPARING: {
    label: "Mark Ready",
    nextStatus: "READY",
    className: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 shadow-sm",
    icon: Check,
  },
  READY: {
    label: "Complete Order",
    nextStatus: "COMPLETED",
    className: "bg-slate-900 hover:bg-black active:bg-slate-950 text-white shadow-sm",
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
    <article className="bg-white text-slate-950 rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all hover:border-slate-300">
      {/* 1. Header: Order #, Relative Time, Type, Status */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              #{orderNumDisplay}
            </h2>
            {onViewDetails && (
              <button
                type="button"
                onClick={() => onViewDetails(order)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="View full order details"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {formatRelativeTime(order.createdAt)}
            </span>
            <span>•</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[11px] ${
                isDelivery ? "bg-purple-100 text-purple-800" : "bg-teal-100 text-teal-800"
              }`}
            >
              {isDelivery ? <Truck className="w-3 h-3" /> : <ShoppingBag className="w-3 h-3" />}
              {order.orderType}
            </span>
            {order.customerName && order.customerName !== "POS Walk-in" && (
              <>
                <span>•</span>
                <span className="text-slate-700 font-bold truncate max-w-[140px]">
                  {order.customerName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase border shrink-0 ${getStatusBadgeStyle(
            order.status
          )}`}
        >
          {order.status}
        </span>
      </div>

      {/* 2. Items List with Modifiers */}
      <div className="space-y-3 py-1 flex-1">
        {order.items.map((item) => (
          <div key={item.id} className="text-sm sm:text-base">
            <div className="flex items-baseline justify-between font-extrabold text-slate-900">
              <span className="leading-snug">
                <span className="text-primary font-black mr-1">{item.quantity} ×</span>
                {item.productName}
              </span>
              {item.configuredUnitPrice !== undefined && item.configuredUnitPrice !== null && (
                <span className="text-xs font-bold text-slate-400 shrink-0 ml-2 font-mono">
                  {formatCurrency(item.configuredUnitPrice * item.quantity, currency)}
                </span>
              )}
            </div>

            {/* Modifiers List */}
            {item.modifiers && item.modifiers.length > 0 && (
              <ul className="mt-1 ml-5 space-y-0.5">
                {item.modifiers.map((modifier) => (
                  <li
                    key={modifier.id}
                    className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"
                  >
                    <span className="text-slate-400">•</span>
                    <span>{modifier.modifierOptionName}</span>
                    {modifier.priceDelta > 0 && (
                      <span className="text-slate-400 font-normal">
                        (+{formatCurrency(modifier.priceDelta, currency)})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* 3. Allergies & Notes Callout */}
      {(order.allergies || order.notes) && (
        <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-3 text-xs space-y-1 text-amber-950 font-bold">
          {order.allergies && (
            <div className="flex items-start gap-1.5 text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong className="text-red-900 uppercase">Allergies: </strong>
                {order.allergies}
              </span>
            </div>
          )}
          {order.notes && (
            <div className="flex items-start gap-1.5 text-amber-900 font-medium">
              <span>
                <strong className="text-amber-950 font-bold">Note: </strong>
                {order.notes}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 4. Total and Action Buttons */}
      <div className="border-t border-slate-100 pt-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
            Total Amount
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-950 font-mono">
            {formatCurrency(order.total, currency)}
          </span>
        </div>

        {/* Big Touch-friendly Actions */}
        <div className="grid grid-cols-2 gap-2.5">
          {action ? (
            <button
              type="button"
              onClick={() => onUpdateStatus(order, action.nextStatus)}
              disabled={isUpdating}
              className={`h-14 sm:h-16 rounded-xl text-base sm:text-lg font-black flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 ${action.className}`}
            >
              {isUpdating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <action.icon className="w-5 h-5 stroke-[2.5]" />
              )}
              <span>{action.label}</span>
            </button>
          ) : (
            <div className="h-14 sm:h-16 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-400">
              No Pending Action
            </div>
          )}

          {/* Destructive / Cancel Action */}
          <button
            type="button"
            onClick={() => onUpdateStatus(order, "CANCELLED")}
            disabled={isUpdating}
            className="h-14 sm:h-16 rounded-xl text-sm sm:text-base font-bold bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 border border-red-200 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isUpdating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <X className="w-5 h-5 stroke-[2.5]" />
            )}
            <span>Reject</span>
          </button>
        </div>
      </div>
    </article>
  );
}
