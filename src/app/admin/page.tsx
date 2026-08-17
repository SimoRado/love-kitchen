"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Banknote,
  Clock,
  Flame,
  CheckCircle2,
  UtensilsCrossed,
  ArrowRight,
  RefreshCw,
  Eye,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import OrderDetailsModal from "@/components/OrderDetailsModal";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { DashboardStats, Order } from "@/lib/types";
import {
  formatCurrency,
  formatRelativeTime,
  getOrderTypeConfig,
} from "@/lib/formatters";
import { useToast } from "@/components/ToastContext";

export default function DashboardPage() {
  const { showToast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.success && data.data) {
        setStats(data.data);
      } else {
        showToast(data.error || "Failed to load dashboard statistics", "error");
      }
    } catch {
      showToast("Network error loading dashboard statistics", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchStats();
  };

  const handleOrderStatusUpdated = (updatedOrder: Order) => {
    setSelectedOrder(updatedOrder);
    // Refresh stats and recent orders
    fetchStats();
  };

  if (isLoading) {
    return <LoadingState message="Loading dashboard statistics..." />;
  }

  return (
    <div className="space-y-8">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Real-time restaurant operational metrics and recent activity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-main text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-primary" : "text-text-muted"}`}
            />
            <span>{isRefreshing ? "Refreshing..." : "Refresh Data"}</span>
          </button>

          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Manage Orders</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* 1. Total Orders Today */}
        <StatCard
          title="Orders Today"
          value={stats?.ordersToday ?? 0}
          subtitle="Total placed today"
          icon={ShoppingBag}
          iconColor="text-primary"
          iconBg="bg-primary-light"
          badgeText="Today"
          badgeType="neutral"
        />

        {/* 2. Revenue Today */}
        <StatCard
          title="Revenue Today"
          value={formatCurrency(stats?.revenueToday ?? 0, "MAD")}
          subtitle="Excludes cancelled"
          icon={Banknote}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          badgeText="Gross Sales"
          badgeType="success"
        />

        {/* 3. Pending Orders */}
        <StatCard
          title="Pending Orders"
          value={stats?.pendingOrders ?? 0}
          subtitle="Needs confirmation"
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          badgeText={stats?.pendingOrders ? "Action Required" : "All Clear"}
          badgeType={stats?.pendingOrders ? "warning" : "neutral"}
        />

        {/* 4. Preparing Orders */}
        <StatCard
          title="In Kitchen"
          value={stats?.preparingOrders ?? 0}
          subtitle="Currently preparing"
          icon={Flame}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        />

        {/* 5. Completed Orders Today */}
        <StatCard
          title="Completed Today"
          value={stats?.completedOrders ?? 0}
          subtitle="Delivered / Picked up"
          icon={CheckCircle2}
          iconColor="text-slate-600"
          iconBg="bg-slate-100"
        />

        {/* 6. Total Products */}
        <StatCard
          title="Total Menu Products"
          value={stats?.totalProducts ?? 0}
          subtitle="Active items on catalog"
          icon={UtensilsCrossed}
          iconColor="text-primary"
          iconBg="bg-primary-light"
        />
      </div>

      {/* Recent Orders Section */}
      <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-text-main">
              Recent Orders
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Latest transactions placed across all fulfillment channels
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
          >
            <span>View all orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Orders Table */}
        {stats?.recentOrders && stats.recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle border-b border-border text-text-muted font-semibold">
                <tr>
                  <th className="py-3 px-5">Order #</th>
                  <th className="py-3 px-5">Customer</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">Total</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Time</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.recentOrders.map((order) => {
                  const typeConfig = getOrderTypeConfig(order.orderType);
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-surface-hover/60 transition-colors"
                    >
                      {/* Order Number */}
                      <td className="py-3.5 px-5 font-bold text-text-main">
                        {order.orderNumber}
                      </td>

                      {/* Customer Name */}
                      <td className="py-3.5 px-5 font-medium text-text-main">
                        <div>{order.customerName}</div>
                        <div className="text-[11px] text-text-muted font-normal">
                          {order.customerPhone}
                        </div>
                        {order.allergies && order.allergies.trim() && (
                          <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold uppercase tracking-tight">
                            <span>ALLERGIES: {order.allergies.trim()}</span>
                          </div>
                        )}
                      </td>

                      {/* Order Type */}
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${typeConfig.bgClass}`}
                        >
                          {typeConfig.label}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-5 font-bold text-text-main">
                        {formatCurrency(order.total, "MAD")}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">
                        <OrderStatusBadge status={order.status} size="sm" />
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-5 text-text-muted whitespace-nowrap">
                        {formatRelativeTime(order.createdAt)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-main hover:bg-surface-hover text-xs font-semibold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8">
            <EmptyState
              title="No orders yet"
              description="When customers place orders, they will appear here in real-time."
            />
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          isOpen={Boolean(selectedOrder)}
          order={selectedOrder}
          currency="MAD"
          onClose={() => setSelectedOrder(null)}
          onStatusUpdated={handleOrderStatusUpdated}
        />
      )}
    </div>
  );
}
