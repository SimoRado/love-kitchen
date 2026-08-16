"use client";

import React, { useState } from "react";
import {
  X,
  User,
  Phone,
  MapPin,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Truck,
  ShoppingBag,
} from "lucide-react";
import { Order, OrderStatus } from "@/lib/types";
import {
  formatCurrency,
  formatDateTime,
  getOrderTypeConfig,
} from "@/lib/formatters";
import OrderStatusBadge from "./OrderStatusBadge";
import { useToast } from "./ToastContext";

interface OrderDetailsModalProps {
  isOpen: boolean;
  order: Order | null;
  currency?: string;
  onClose: () => void;
  onStatusUpdated: (updatedOrder: Order) => void;
}

const STATUS_FLOW: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

export default function OrderDetailsModal({
  isOpen,
  order,
  currency = "MAD",
  onClose,
  onStatusUpdated,
}: OrderDetailsModalProps) {
  const { showToast } = useToast();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  if (!isOpen || !order) return null;

  const currentStatusIndex = STATUS_FLOW.indexOf(order.status as OrderStatus);
  const nextStatus =
    currentStatusIndex >= 0 && currentStatusIndex < STATUS_FLOW.length - 1
      ? STATUS_FLOW[currentStatusIndex + 1]
      : null;

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (isUpdatingStatus) return;

    try {
      setIsUpdatingStatus(true);
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (data.success && data.data) {
        showToast(`Order marked as ${newStatus}`, "success");
        onStatusUpdated(data.data);
      } else {
        showToast(data.error || "Could not update order status.", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const orderTypeBadge = getOrderTypeConfig(order.orderType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-surface rounded-2xl border border-border shadow-2xl max-w-2xl w-full my-8 z-10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-subtle/50">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-text-main">
                  {order.orderNumber}
                </h2>
                <OrderStatusBadge status={order.status} size="sm" />
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${orderTypeBadge.bgClass}`}
                >
                  {orderTypeBadge.label}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Placed on {formatDateTime(order.createdAt)}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Status Progression Bar */}
          <div className="bg-surface-subtle border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Order Workflow Status
              </span>
              <div className="flex items-center gap-2">
                {nextStatus && order.status !== "CANCELLED" && (
                  <button
                    onClick={() => handleUpdateStatus(nextStatus)}
                    disabled={isUpdatingStatus}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isUpdatingStatus ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Move to {nextStatus}</span>
                  </button>
                )}

                {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
                  <button
                    onClick={() => handleUpdateStatus("CANCELLED")}
                    disabled={isUpdatingStatus}
                    className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>

            {/* Quick Status Select */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
              <span className="text-xs text-text-muted font-medium">
                Set status manually:
              </span>
              <select
                value={order.status}
                onChange={(e) => handleUpdateStatus(e.target.value as OrderStatus)}
                disabled={isUpdatingStatus}
                className="text-xs font-semibold px-2.5 py-1 rounded-md border border-border bg-surface text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="PREPARING">PREPARING</option>
                <option value="READY">READY</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>

          {/* Customer Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface rounded-xl border border-border p-4 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                Customer Details
              </h3>
              <div>
                <p className="text-sm font-bold text-text-main">
                  {order.customerName}
                </p>
                <p className="text-xs text-text-muted flex items-center gap-1.5 mt-1">
                  <Phone className="w-3.5 h-3.5 text-text-muted" />
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="hover:text-primary underline font-medium"
                  >
                    {order.customerPhone}
                  </a>
                </p>
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-border p-4 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                {order.orderType === "DELIVERY" ? (
                  <Truck className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                )}
                Fulfillment & Location
              </h3>
              <div>
                <p className="text-sm font-semibold text-text-main">
                  {order.orderType === "DELIVERY" ? "Delivery Order" : "Store Pickup"}
                </p>
                {order.customerAddress ? (
                  <p className="text-xs text-text-muted flex items-start gap-1.5 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
                    <span>{order.customerAddress}</span>
                  </p>
                ) : (
                  <p className="text-xs text-text-muted mt-1 italic">
                    Customer will collect from counter.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Notes if present */}
          {order.notes && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-amber-900 block mb-0.5">
                  Customer Notes:
                </span>
                <p className="text-amber-800 leading-relaxed">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Order Items Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2.5">
              Ordered Items ({order.items.length})
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-subtle border-b border-border font-semibold text-text-muted">
                  <tr>
                    <th className="py-2.5 px-4">Item</th>
                    <th className="py-2.5 px-4 text-center">Qty</th>
                    <th className="py-2.5 px-4 text-right">Unit Price</th>
                    <th className="py-2.5 px-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-hover/50">
                      <td className="py-3 px-4 font-semibold text-text-main">
                        {item.productName}
                      </td>
                      <td className="py-3 px-4 text-center text-text-muted font-medium">
                        {item.quantity}×
                      </td>
                      <td className="py-3 px-4 text-right text-text-muted">
                        {formatCurrency(item.price, currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-text-main">
                        {formatCurrency(item.price * item.quantity, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Price Summary Breakdown */}
              <div className="bg-surface-subtle/70 p-4 border-t border-border space-y-1.5 text-xs">
                <div className="flex justify-between text-text-muted">
                  <span>Subtotal</span>
                  <span className="font-medium text-text-main">
                    {formatCurrency(order.subtotal, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Delivery Fee</span>
                  <span className="font-medium text-text-main">
                    {order.deliveryFee > 0
                      ? formatCurrency(order.deliveryFee, currency)
                      : "Free (0.00)"}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-text-main pt-2 border-t border-border">
                  <span>Total Amount</span>
                  <span className="text-primary font-extrabold text-base">
                    {formatCurrency(order.total, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-subtle/50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
