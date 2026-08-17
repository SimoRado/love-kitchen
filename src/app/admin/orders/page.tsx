"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Filter,
  ShoppingBag,
  Clock,
  Phone,
  MapPin,
  Eye,
  RefreshCw,
  Truck,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import OrderDetailsModal from "@/components/OrderDetailsModal";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { Order, OrderStatus } from "@/lib/types";
import {
  formatCurrency,
  formatRelativeTime,
  getOrderTypeConfig,
} from "@/lib/formatters";
import { useToast } from "@/components/ToastContext";

const STATUS_FILTERS = [
  { id: "ALL", label: "All Orders" },
  { id: "PENDING", label: "Pending" },
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "PREPARING", label: "Preparing" },
  { id: "READY", label: "Ready" },
  { id: "COMPLETED", label: "Completed" },
  { id: "CANCELLED", label: "Cancelled" },
];

export default function OrdersPage() {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [activeStatusTab, setActiveStatusTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState("ALL");

  // Selected order for details view
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.success) {
        setOrders(data.data || []);
      } else {
        showToast(data.error || "Failed to load orders", "error");
      }
    } catch {
      showToast("Network error loading orders", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
  };

  // Status Counts
  const statusCounts = useMemo(() => {
    const counts: { [key: string]: number } = { ALL: orders.length };
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return counts;
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (activeStatusTab !== "ALL" && order.status !== activeStatusTab) {
        return false;
      }
      // Type filter
      if (orderTypeFilter !== "ALL" && order.orderType !== orderTypeFilter) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = order.orderNumber.toLowerCase().includes(q);
        const matchesName = order.customerName.toLowerCase().includes(q);
        const matchesPhone = order.customerPhone.toLowerCase().includes(q);
        const matchesItem = order.items.some((it) =>
          it.productName.toLowerCase().includes(q)
        );
        const matchesAllergies = Boolean(
          order.allergies && order.allergies.toLowerCase().includes(q)
        );
        if (!matchesNum && !matchesName && !matchesPhone && !matchesItem && !matchesAllergies) {
          return false;
        }
      }
      return true;
    });
  }, [orders, activeStatusTab, orderTypeFilter, searchQuery]);

  const handleStatusUpdated = (updatedOrder: Order) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    setSelectedOrder(updatedOrder);
  };

  const handleQuickStatusChange = async (order: Order, newStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        showToast(
          `Order ${order.orderNumber} updated to ${newStatus}`,
          "success"
        );
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? data.data : o))
        );
      } else {
        showToast(data.error || "Could not update order status.", "error");
      }
    } catch {
      showToast("Network error updating status", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main tracking-tight">
            Orders Management
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Track kitchen preparation, delivery progress, and customer tickets
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-main text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-primary" : "text-text-muted"}`}
            />
            <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_FILTERS.map((tab) => {
          const count = statusCounts[tab.id] || 0;
          const isActive = activeStatusTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveStatusTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-primary text-white shadow-xs"
                  : "bg-surface text-text-muted hover:text-text-main hover:bg-surface-hover border border-border"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Secondary Filters */}
      <div className="bg-surface rounded-xl border border-border p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by order #, customer name, phone, or items..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border text-xs bg-surface-subtle/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-main"
            >
              Clear
            </button>
          )}
        </div>

        {/* Fulfillment Type */}
        <div className="flex items-center gap-2">
          <select
            value={orderTypeFilter}
            onChange={(e) => setOrderTypeFilter(e.target.value)}
            className="text-xs font-medium px-3 py-2 rounded-lg border border-border bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="ALL">All Types (Delivery & Pickup)</option>
            <option value="DELIVERY">Delivery Only</option>
            <option value="PICKUP">Pickup Only</option>
          </select>
        </div>
      </div>

      {/* Orders List / Table */}
      {isLoading ? (
        <LoadingState message="Loading orders..." />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders found"
          description="There are currently no orders in the system."
        />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching orders"
          description="No orders match your filter criteria or search query."
          actionLabel="Reset Filters"
          onAction={() => {
            setActiveStatusTab("ALL");
            setOrderTypeFilter("ALL");
            setSearchQuery("");
          }}
        />
      ) : (
        <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle border-b border-border text-text-muted font-semibold">
                <tr>
                  <th className="py-3 px-5">Order #</th>
                  <th className="py-3 px-5">Time</th>
                  <th className="py-3 px-5">Customer</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">Items Summary</th>
                  <th className="py-3 px-5">Total</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((order) => {
                  const typeConfig = getOrderTypeConfig(order.orderType);
                  const itemsSummary = order.items
                    .map(
                      (it) =>
                        `${it.quantity}× ${it.productName}${
                          it.modifiers && it.modifiers.length > 0
                            ? ` (${it.modifiers.map((m) => m.modifierOptionName).join(", ")})`
                            : ""
                        }`
                    )
                    .join("; ");

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-surface-hover/60 transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      {/* Order Number */}
                      <td className="py-3.5 px-5 font-bold text-text-main">
                        <span className="text-primary hover:underline">
                          {order.orderNumber}
                        </span>
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-5 text-text-muted whitespace-nowrap">
                        {formatRelativeTime(order.createdAt)}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-text-main">
                          {order.customerName}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {order.customerPhone}
                        </div>
                        {order.allergies && order.allergies.trim() && (
                          <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold uppercase tracking-tight">
                            <span>ALLERGIES: {order.allergies.trim()}</span>
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${typeConfig.bgClass}`}
                        >
                          {typeConfig.label}
                        </span>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-5 max-w-xs">
                        <p className="truncate text-text-main font-medium">
                          {itemsSummary}
                        </p>
                        {order.allergies && order.allergies.trim() && (
                          <p className="text-[11px] text-red-700 font-bold uppercase truncate mt-0.5">
                            Allergies: {order.allergies.trim()}
                          </p>
                        )}
                        {order.notes && (
                          <p className="text-[11px] text-amber-700 font-medium truncate mt-0.5">
                            Note: {order.notes}
                          </p>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-5 font-bold text-sm text-text-main">
                        {formatCurrency(order.total, "MAD")}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">
                        <OrderStatusBadge status={order.status} size="sm" />
                      </td>

                      {/* Action */}
                      <td
                        className="py-3.5 px-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={order.status}
                            onChange={(e) =>
                              handleQuickStatusChange(
                                order,
                                e.target.value as OrderStatus
                              )
                            }
                            className="text-[11px] font-semibold px-2 py-1 rounded-md border border-border bg-surface text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="CONFIRMED">CONFIRMED</option>
                            <option value="PREPARING">PREPARING</option>
                            <option value="READY">READY</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>

                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                            title="View order details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          <div className="px-5 py-3 border-t border-border bg-surface-subtle/50 text-xs text-text-muted flex justify-between items-center">
            <span>
              Showing <strong>{filteredOrders.length}</strong> of <strong>{orders.length}</strong> orders
            </span>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          isOpen={Boolean(selectedOrder)}
          order={selectedOrder}
          currency="MAD"
          onClose={() => setSelectedOrder(null)}
          onStatusUpdated={handleStatusUpdated}
        />
      )}
    </div>
  );
}
