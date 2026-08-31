"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Loader2, Sparkles, LogOut } from "lucide-react";
import { useToast } from "./ToastContext";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  onOpenSidebar: () => void;
  onDataRefresh?: () => void;
}

export default function AdminHeader({
  title,
  subtitle,
  onOpenSidebar,
  onDataRefresh,
}: AdminHeaderProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSeedDatabase = async () => {
    if (isSeeding) return;
    const confirmed = window.confirm(
      "Reset and load fresh demo categories, products, and sample orders?"
    );
    if (!confirmed) return;

    try {
      setIsSeeding(true);
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Database seeded successfully!", "success");
        if (onDataRefresh) {
          onDataRefresh();
        } else {
          window.location.reload();
        }
      } else {
        showToast(data.error || "Failed to seed database", "error");
      }
    } catch {
      showToast("Network error while seeding database", "error");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      // Hard navigation — bypasses Next.js client router cache and any
      // stale cookie state. The proxy will see the cleared admin cookie
      // and serve the login page directly.
      window.location.href = "/admin/login";
    } catch {
      showToast("Logout failed. Please try again.", "error");
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-surface/90 backdrop-blur-md border-b border-border px-4 sm:px-8 flex items-center justify-between">
      {/* Left section: Hamburger button on mobile & Title */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onOpenSidebar}
          className="p-2 -ml-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text-main leading-none">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-text-muted mt-1 hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right section: Actions & Status */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Demo Re-seed button */}
        <button
          onClick={handleSeedDatabase}
          disabled={isSeeding}
          title="Reset database to fresh sample products, orders, and categories"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-muted hover:text-primary hover:border-primary/40 hover:bg-primary-light transition-all disabled:opacity-50"
        >
          {isSeeding ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-accent" />
          )}
          <span className="hidden md:inline">
            {isSeeding ? "Seeding..." : "Reset Demo Data"}
          </span>
        </button>

        {/* Admin Badge */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 font-medium border border-orange-200">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Admin Live
          </span>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          title="Log out of Admin Portal"
          className="p-1.5 rounded-lg border border-border text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors ml-1"
          aria-label="Log out"
        >
          {isLoggingOut ? (
            <Loader2 className="w-4 h-4 animate-spin text-red-500" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
}
