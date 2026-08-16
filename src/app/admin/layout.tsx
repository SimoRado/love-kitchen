"use client";

import React, { useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import AdminHeader from "@/components/AdminHeader";
import { ToastProvider } from "@/components/ToastContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
