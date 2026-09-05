"use client";

import React from "react";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { formatCurrency } from "@/lib/formatters";

interface MobileCartBarProps {
  currency?: string;
  onOpenCart: () => void;
}

export default function MobileCartBar({
  currency = "MAD",
  onOpenCart,
}: MobileCartBarProps) {
  const { getItemCount, getSubtotal } = useCartStore();
  const itemCount = getItemCount();
  const subtotal = getSubtotal();

  if (itemCount === 0) return null;

  return (
    <div
      style={{ bottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
      className="fixed inset-x-4 z-40 lg:hidden motion-reduce:transition-none"
    >
      <button
        onClick={onOpenCart}
        aria-label={`View order tray with ${itemCount} items for ${formatCurrency(subtotal, currency)}`}
        className="w-full bg-[#C8102E] hover:bg-[#B00D26] text-white py-3.5 px-5 rounded-2xl shadow-lg flex items-center justify-between font-bold text-sm transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
            {itemCount}
          </div>
          <span className="flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4" />
            <span>View Cart</span>
          </span>
        </div>

        <div className="flex items-center gap-2 font-bold text-sm tracking-tight">
          <span>{formatCurrency(subtotal, currency)}</span>
        </div>
      </button>
    </div>
  );
}
