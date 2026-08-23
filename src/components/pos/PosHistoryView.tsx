"use client";

import React, { useState, useMemo } from "react";
import { Search, Eye, History, CheckCircle, XCircle } from "lucide-react";
import { Order } from "@/lib/types";
import { formatCurrency, formatRelativeTime, formatTime } from "@/lib/formatters";

interface PosHistoryViewProps {
  orders: Order[];
  currency?: string;
  onViewDetails?: (order: Order) => void;
}

export default function PosHistoryView({
  orders,
  currency = "MAD",
  onViewDetails,
}: PosHistoryViewProps) {
  const [filter, setFilter] = useState<"ALL" | "COMPLETED" | "CANCELLED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // History orders are completed or cancelled
  const historyOrders = useMemo(() => {
    return orders.filter((o) => ["COMPLETED", "CANCELLED"].includes(o.status));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return historyOrders.filter((order) => {
      if (filter !== "ALL" && order.status !== filter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = order.orderNumber.toLowerCase().includes(q);
        const matchesCustomer = order.customerName.toLowerCase().includes(q);
        const matchesPhone = order.customerPhone.toLowerCase().includes(q);
        const matchesItem = order.items.some((it) => it.productName.toLowerCase().includes(q));
        if (!matchesNum && !matchesCustomer && !matchesPhone && !matchesItem) return false;
      }
      return true;
    });
  }, [historyOrders, filter, searchQuery]);

  const completedCount = useMemo(
    () => historyOrders.filter((o) => o.status === "COMPLETED").length,
    [historyOrders]
  );
  const cancelledCount = useMemo(
    () => historyOrders.filter((o) => o.status === "CANCELLED").length,
    [historyOrders]
  );

  return (
    <div className="space-y-4">
      {/* Top Filter & Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              filter === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Today ({historyOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("COMPLETED")}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              filter === "COMPLETED"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Completed ({completedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("CANCELLED")}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              filter === "CANCELLED"
                ? "bg-red-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Rejected / Cancelled ({cancelledCount})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order # or customer..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      {/* Orders List / Cards */}
      {filteredOrders.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
          {filteredOrders.map((order) => {
            const isCompleted = order.status === "COMPLETED";
            const orderNum = order.orderNumber.replace(/^ORD-/, "");

            return (
              <div
                key={order.id}
                onClick={() => onViewDetails?.(order)}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer"
              >
                {/* Left: Number, Time, Customer */}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-lg text-slate-900">
                      #{orderNum}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isCompleted
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {order.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                      {order.orderType}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-500">
                    {formatTime(order.createdAt)} • {formatRelativeTime(order.createdAt)} •{" "}
                    <span className="text-slate-800">{order.customerName}</span>
                  </p>

                  {/* Items summary */}
                  <p className="text-xs text-slate-700 font-medium truncate max-w-xl">
                    {order.items
                      .map(
                        (it) =>
                          `${it.quantity}× ${it.productName}${
                            it.modifiers && it.modifiers.length > 0
                              ? ` (${it.modifiers.map((m) => m.modifierOptionName).join(", ")})`
                              : ""
                          }`
                      )
                      .join("; ")}
                  </p>
                </div>

                {/* Right: Total & Details Action */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <span className="font-mono font-black text-lg text-slate-950">
                    {formatCurrency(order.total, currency)}
                  </span>
                  {onViewDetails && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewDetails(order);
                      }}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Details</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-12 text-center text-slate-500">
          <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-base font-bold text-slate-700">No order history found</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Completed or rejected tickets from today will be archived here.
          </p>
        </div>
      )}
    </div>
  );
}
