"use client";

import React from "react";
import { Clock3, Utensils, PlusCircle, CheckCircle } from "lucide-react";
import { Order } from "@/lib/types";
import PosOrderCard from "./PosOrderCard";
import PosSidebarHeader from "./PosSidebarHeader";
import { PosTab } from "./PosHeader";

interface PosRegisterViewProps {
  orders: Order[];
  currency?: string;
  updatingOrderId: string | null;
  onUpdateStatus: (order: Order, newStatus: string) => void;
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

export default function PosRegisterView({
  orders,
  currency = "MAD",
  updatingOrderId,
  onUpdateStatus,
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
}: PosRegisterViewProps) {
  const pendingOrders = orders.filter((o) => o.status === "PENDING");
  const activeOrders = orders.filter((o) => ["CONFIRMED", "PREPARING", "READY"].includes(o.status));
  const completedTodayCount = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_310px] xl:grid-cols-[1fr_340px] 2xl:grid-cols-[1fr_380px] gap-2.5 sm:gap-3 h-full overflow-hidden items-stretch min-h-0">
      {/* 1. LEFT MAIN AREA: 2-Column Ticket Queues */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 h-full overflow-y-auto min-h-0 pr-1">
        {/* Column 1: New Incoming Orders */}
        <section className="space-y-3">
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-3 shadow-xs sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                New Orders
              </h2>
            </div>
            <span className="rounded-full bg-red-600 text-white px-3 py-0.5 text-xs font-black tracking-wider">
              {pendingOrders.length} {pendingOrders.length === 1 ? "Order" : "Orders"}
            </span>
          </div>

          {pendingOrders.length > 0 ? (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <PosOrderCard
                  key={order.id}
                  order={order}
                  currency={currency}
                  isUpdating={updatingOrderId === order.id}
                  onUpdateStatus={onUpdateStatus}
                  onViewDetails={onViewDetails}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-500">
              <Clock3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Waiting for new orders</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Incoming orders from the website or register appear here instantly.
              </p>
            </div>
          )}
        </section>

        {/* Column 2: In Progress / Active Queue */}
        <section className="space-y-3">
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-3 shadow-xs sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                In Progress
              </h2>
            </div>
            <span className="rounded-full bg-slate-900 text-white px-3 py-0.5 text-xs font-black tracking-wider">
              {activeOrders.length} {activeOrders.length === 1 ? "Ticket" : "Tickets"}
            </span>
          </div>

          {activeOrders.length > 0 ? (
            <div className="space-y-3">
              {activeOrders.map((order) => (
                <PosOrderCard
                  key={order.id}
                  order={order}
                  currency={currency}
                  isUpdating={updatingOrderId === order.id}
                  onUpdateStatus={onUpdateStatus}
                  onViewDetails={onViewDetails}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-500">
              <Utensils className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No active tickets</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Accepted tickets being prepared in the kitchen will show up here.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* 2. RIGHT SIDEBAR: Control Panel & Register Summary */}
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

        {/* Register Overview Body */}
        <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto">
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Live Queue Overview
            </h3>
            <p className="text-xs text-slate-600">
              All incoming and active kitchen orders for this location.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-50/70 border border-red-200 rounded-xl p-3 text-center">
              <span className="block text-2xl font-black text-red-700 font-mono">
                {pendingOrders.length}
              </span>
              <span className="text-[11px] font-bold text-red-800">New Orders</span>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-center">
              <span className="block text-2xl font-black text-blue-700 font-mono">
                {activeOrders.length}
              </span>
              <span className="text-[11px] font-bold text-blue-800">In Progress</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Completed Today</span>
            </div>
            <span className="font-mono font-black text-slate-900 text-sm">
              {completedTodayCount}
            </span>
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
