"use client";

import React from "react";
import { Clock3, Utensils } from "lucide-react";
import { Order } from "@/lib/types";
import PosOrderCard from "./PosOrderCard";

interface PosRegisterViewProps {
  orders: Order[];
  currency?: string;
  updatingOrderId: string | null;
  onUpdateStatus: (order: Order, newStatus: string) => void;
  onViewDetails?: (order: Order) => void;
}

export default function PosRegisterView({
  orders,
  currency = "MAD",
  updatingOrderId,
  onUpdateStatus,
  onViewDetails,
}: PosRegisterViewProps) {
  const pendingOrders = orders.filter((o) => o.status === "PENDING");
  const activeOrders = orders.filter((o) => ["CONFIRMED", "PREPARING", "READY"].includes(o.status));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Column 1: New Incoming Orders */}
      <section className="space-y-4">
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              New Orders
            </h2>
          </div>
          <span className="rounded-full bg-red-600 text-white px-3.5 py-1 text-xs font-black tracking-wider">
            {pendingOrders.length} {pendingOrders.length === 1 ? "Order" : "Orders"}
          </span>
        </div>

        {pendingOrders.length > 0 ? (
          <div className="space-y-4">
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
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-12 text-center text-slate-500">
            <Clock3 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-base font-bold text-slate-700">
              Waiting for new orders
            </p>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Incoming customer orders from the website will appear here instantly.
            </p>
          </div>
        )}
      </section>

      {/* Column 2: In Progress / Active Queue */}
      <section className="space-y-4">
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-blue-600" />
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              In Progress
            </h2>
          </div>
          <span className="rounded-full bg-slate-900 text-white px-3.5 py-1 text-xs font-black tracking-wider">
            {activeOrders.length} {activeOrders.length === 1 ? "Ticket" : "Tickets"}
          </span>
        </div>

        {activeOrders.length > 0 ? (
          <div className="space-y-4">
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
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-12 text-center text-slate-500">
            <Utensils className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-base font-bold text-slate-700">
              No active tickets
            </p>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Accepted orders being prepared in the kitchen will show up here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
