"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import AdminHeader from "@/components/AdminHeader";
import { ToastProvider } from "@/components/ToastContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Client-side Back/Forward & bfcache Safety Net
  // This ONLY runs on browser back/forward, bfcache restore, or tab re-focus —
  // NOT on initial page load (the server-side proxy handles initial routing).
  const verifyAdminAccess = useCallback(async () => {
    // Skip verification on login and POS pages
    if (pathname === "/admin/pos" || pathname === "/admin/login") return;

    // Verify the admin session is still valid server-side
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        // Clear stale session cookie before redirecting
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        window.location.replace("/admin/login");
      }
    } catch {
      // Network error — don't redirect, let the page stay
    }
  }, [pathname]);

  useEffect(() => {
    // Proactively verify admin access on mount for protected routes
    verifyAdminAccess();

    // Re-verify on bfcache restore (back/forward button from a cached page)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        verifyAdminAccess();
      }
    };

    // Re-verify on browser back/forward button navigation
    const handlePopState = () => {
      verifyAdminAccess();
    };

    // Re-verify when the tab becomes visible again (e.g. user switches back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        verifyAdminAccess();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [verifyAdminAccess]);

  // For /admin/login page, render clean standalone container
  if (pathname === "/admin/login" || pathname === "/admin/pos") {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg-main text-text-main flex flex-col antialiased">
        {/* Sidebar */}
        <AdminSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area (offset by sidebar on desktop) */}
        <div className="lg:pl-64 flex flex-col flex-1 min-h-screen">
          {/* Top Bar Header */}
          <AdminHeader
            title="Restaurant Admin"
            subtitle="Live Operations & Menu Management"
            onOpenSidebar={() => setSidebarOpen(true)}
          />

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
