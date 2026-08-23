"use client";

import React, { useState, useMemo } from "react";
import { Search, Eye, History, CheckCircle, XCircle, PlusCircle } from "lucide-react";
import { Order } from "@/lib/types";
import { formatCurrency, formatRelativeTime, formatTime } from "@/lib/formatters";
import PosSidebarHeader from "./PosSidebarHeader";
import { PosTab } from "./PosHeader";

interface PosHistoryViewProps {
  orders: Order[];
  currency?: string;
  onViewDetails?: (order: Order) => void;
  // Navigation & status props for unified right sidebar
  activeTab: PosTab;
  onTabChange: (tab: PosTab) => void;
  pendingCount: number;
  activeCount: number;
  deviceName?: string;
  devicePublicId?: string;
  isConnected: boolean;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export default function PosHistoryView({
  orders,
  currency = "MAD",
  onViewDetails,
  activeTab,
  onTabChange,
  pendingCount,
  activeCount,
  deviceName,
  devicePublicId,
  isConnected,
  onRefresh,
  isRefreshing,
}: PosHistoryViewProps) {
  const [filter, setFilter] = useState<"ALL" | "COMPLETED" | "CANCELLED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const historyOrders = useMemo(() => {
    return orders.filter((o) => ["COMPLETED", "CANCELLED"].includes(o.status));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return historyOrders.filter((order) => {
      if (filter !== "ALL" && order.status !== filter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = order.orderNumber.toLowerCase().includes(q);
        const matchesName = order.customerName.toLowerCase().includes(q);
        const matchesPhone = order.customerPhone.toLowerCase().includes(q);
        const matchesItem = order.items.some((it) => it.productName.toLowerCase().includes(q));
        if (!matchesNum && !matchesName && !matchesPhone && !matchesItem) return false;
      }
      return true;
    });
  }, [historyOrders, filter, searchQuery]);

  const completedOrders = historyOrders.filter((o) => o.status === "COMPLETED");
  const cancelledOrders = historyOrders.filter((o) => o.status === "CANCELLED");
  const todayTotalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_310px] xl:grid-cols-[1fr_340px] 2xl:grid-cols-[1fr_380px] gap-2.5 sm:gap-3 h-full overflow-hidden items-stretch min-h-0">
      {/* 1. LEFT MAIN AREA: History Search & Records Table */}
      <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-w-0 h-full">
        {/* Top Controls: Search Bar & Status Filter Pills */}
        <div className="p-2 sm:p-2.5 border-b border-slate-200 space-y-1.5 bg-slate-50 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order #, customer, phone, or dish..."
              className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer min-h-[34px] ${
                filter === "ALL"
                  ? "bg-slate-950 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              All Today ({historyOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("COMPLETED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 min-h-[34px] ${
                filter === "COMPLETED"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200"
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Completed ({completedOrders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter("CANCELLED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 min-h-[34px] ${
                filter === "CANCELLED"
                  ? "bg-rose-700 text-white shadow-xs"
                  : "bg-white text-rose-800 hover:bg-rose-50 border border-rose-200"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Rejected ({cancelledOrders.length})</span>
            </button>
          </div>
        </div>

        {/* Scrollable Records List */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 min-h-0">
          {filteredOrders.length > 0 ? (
            <div className="space-y-2">
              {filteredOrders.map((order) => {
                const isCompleted = order.status === "COMPLETED";

                return (
                  <article
                    key={order.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs sm:text-sm text-slate-950">
                          #{order.orderNumber.replace(/^ORD-/, "")}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            isCompleted
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {order.status}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {formatTime(order.createdAt)} • {formatRelativeTime(order.createdAt)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 mt-1 font-medium truncate">
                        <span className="font-bold text-slate-800">{order.customerName}</span>
                        <span>•</span>
                        <span className="truncate">
                          {order.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-black text-xs sm:text-sm text-slate-950">
                        {formatCurrency(order.total, currency)}
                      </span>

                      {onViewDetails && (
                        <button
                          type="button"
                          onClick={() => onViewDetails(order)}
                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="View Order Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <History className="w-10 h-10 mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">No history records found</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Completed and cancelled orders for today will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 2. RIGHT SIDEBAR: History Overview & Fast Actions */}
      <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-w-0 h-full">
        {/* Top Header & Navigation */}
        <PosSidebarHeader
          activeTab={activeTab}
          onTabChange={onTabChange}
          pendingCount={pendingCount}
          activeCount={activeCount}
          deviceName={deviceName}
          devicePublicId={devicePublicId}
          isConnected={isConnected}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />

        {/* History Overview Body */}
        <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto">
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Today&apos;s Summary
            </h3>
            <p className="text-xs text-slate-600">
              Total completed revenue and tickets finalized today.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-center">
            <span className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Total Completed Revenue
            </span>
            <span className="text-2xl font-black text-emerald-950 font-mono mt-0.5 block">
              {formatCurrency(todayTotalRevenue, currency)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="block text-xl font-black text-slate-900 font-mono">
                {completedOrders.length}
              </span>
              <span className="text-[11px] font-bold text-slate-600">Completed</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="block text-xl font-black text-slate-900 font-mono">
                {cancelledOrders.length}
              </span>
              <span className="text-[11px] font-bold text-slate-600">Cancelled</span>
            </div>
          </div>
        </div>

        {/* Bottom Fast Action: Open New Order */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => onTabChange("new-order")}
            className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-black text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Open New Order Register</span>
          </button>
        </div>
      </div>
    </div>
  );
}
