"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Tags,
  Settings,
  X,
  Store,
  ChevronRight,
  MonitorCog,
  TabletSmartphone,
} from "lucide-react";

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "Orders",
    href: "/admin/orders",
    icon: ShoppingBag,
    exact: false,
  },
  {
    name: "Products",
    href: "/admin/products",
    icon: UtensilsCrossed,
    exact: false,
  },
  {
    name: "Categories",
    href: "/admin/categories",
    icon: Tags,
    exact: false,
  },
  {
    name: "POS Register",
    href: "/admin/pos",
    icon: MonitorCog,
    exact: false,
  },
  {
    name: "Devices / POS",
    href: "/admin/devices",
    icon: TabletSmartphone,
    exact: false,
  },
  {
    name: "Restaurant Settings",
    href: "/admin/settings",
    icon: Settings,
    exact: false,
  },
];

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const isLinkActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-surface border-r border-border flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand / Logo Header */}
        <div className="h-16 px-6 border-b border-border flex items-center justify-between">
          <Link
            href="/admin"
            className="flex items-center gap-3 group"
            onClick={onClose}
          >
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm group-hover:bg-primary-hover transition-colors">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base text-text-main tracking-tight block leading-tight">
                RestoAdmin
              </span>
              <span className="text-xs font-medium text-text-muted">
                Management Portal
              </span>
            </div>
          </Link>

          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Operations
          </div>
          {navItems.map((item) => {
            const active = isLinkActive(item.href, item.exact);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-primary-light text-primary font-semibold"
                    : "text-text-muted hover:text-text-main hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      active ? "text-primary" : "text-text-muted"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {active && <ChevronRight className="w-4 h-4 text-primary" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer info */}
        <div className="p-4 border-t border-border bg-surface-subtle/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-primary font-bold text-xs">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-main truncate">
                Admin Manager
              </p>
              <p className="text-[11px] text-text-muted truncate">
                v1.0.0 • SQLite
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
