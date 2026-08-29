"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { PosTab } from "./PosHeader";

interface PosSidebarHeaderProps {
  activeTab: PosTab;
  onTabChange: (tab: PosTab) => void;
  pendingCount: number;
  activeCount?: number;
  deviceName?: string;
  devicePublicId?: string;
  isConnected: boolean;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export default function PosSidebarHeader({
  activeTab,
  onTabChange,
  pendingCount,
  devicePublicId,
  isConnected,
  onRefresh,
  isRefreshing = false,
}: PosSidebarHeaderProps) {
  return (
    <div className="p-2.5 sm:p-3 border-b border-slate-200 bg-slate-50 space-y-2 shrink-0">
      {/* Compact Terminal Info & Live Status Row */}
      <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-[11px] shadow-2xs shrink-0">
            {devicePublicId || "POS"}
          </span>
          <div className="flex items-center gap-1 text-[11px] font-extrabold truncate">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected ? "bg-emerald-500 ring-2 ring-emerald-100 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span className={isConnected ? "text-emerald-700 font-bold" : "text-amber-700"}>
              {isConnected ? "Live" : "Connecting"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-orange-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Relocated Segmented Navigation Control */}
      <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-xl">
        {/* Register Tab */}
        <button
          type="button"
          onClick={() => onTabChange("register")}
          className={`py-1.5 px-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[36px] ${
            activeTab === "register"
              ? "bg-slate-950 text-white shadow-xs"
              : "text-slate-700 hover:text-slate-950 hover:bg-white/60"
          }`}
        >
          <span>Register</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-red-600 text-white animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>

        {/* New Order Tab */}
        <button
          type="button"
          onClick={() => onTabChange("new-order")}
          className={`py-1.5 px-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[36px] ${
            activeTab === "new-order"
              ? "bg-orange-600 text-white shadow-xs"
              : "text-slate-700 hover:text-slate-950 hover:bg-white/60"
          }`}
        >
          <span>New Order</span>
        </button>

        {/* History Tab */}
        <button
          type="button"
          onClick={() => onTabChange("history")}
          className={`py-1.5 px-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[36px] ${
            activeTab === "history"
              ? "bg-slate-950 text-white shadow-xs"
              : "text-slate-700 hover:text-slate-950 hover:bg-white/60"
          }`}
        >
          <span>History</span>
        </button>
      </div>
    </div>
  );
}
