"use client";

import React from "react";
import {
  LayoutList,
  PlusCircle,
  History,
  RefreshCw,
  Store,
  Wifi,
  WifiOff,
} from "lucide-react";

export type PosTab = "register" | "new-order" | "history";

interface PosHeaderProps {
  activeTab: PosTab;
  onTabChange: (tab: PosTab) => void;
  pendingCount: number;
  activeCount: number;
  deviceName: string;
  devicePublicId: string;
  isConnected: boolean;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export default function PosHeader({
  activeTab,
  onTabChange,
  pendingCount,
  activeCount,
  deviceName,
  devicePublicId,
  isConnected,
  onRefresh,
  isRefreshing = false,
}: PosHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-slate-950 text-white border-b border-slate-800 shadow-md">
      <div className="px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-3">
        {/* Left: Device & App Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white font-black shadow-inner">
            <Store className="w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base tracking-tight leading-none text-white">
                POS Register
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                iPad Terminal
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5 truncate max-w-[180px]">
              {deviceName} • <span className="font-mono">{devicePublicId}</span>
            </p>
          </div>
        </div>

        {/* Center: Main Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {/* Register Tab */}
          <button
            type="button"
            onClick={() => onTabChange("register")}
            className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === "register"
                ? "bg-slate-800 text-white shadow-sm ring-1 ring-white/10"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <LayoutList className="w-4 h-4" />
            <span>Register</span>
            {(pendingCount > 0 || activeCount > 0) && (
              <div className="flex items-center gap-1 ml-1">
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-red-600 text-white animate-pulse">
                    {pendingCount}
                  </span>
                )}
                {activeCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-600 text-white">
                    {activeCount}
                  </span>
                )}
              </div>
            )}
          </button>

          {/* New Order Tab */}
          <button
            type="button"
            onClick={() => onTabChange("new-order")}
            className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === "new-order"
                ? "bg-orange-600 text-white shadow-sm ring-1 ring-white/10"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Order</span>
          </button>

          {/* History Tab */}
          <button
            type="button"
            onClick={() => onTabChange("history")}
            className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-slate-800 text-white shadow-sm ring-1 ring-white/10"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Orders / History</span>
          </button>
        </nav>

        {/* Right: Realtime status & Refresh / Exit */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Realtime Live Status Indicator */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isConnected
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                : "bg-amber-950/60 text-amber-400 border-amber-800/60"
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Connecting...</span>
              </>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 flex items-center gap-2 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-orange-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
}
