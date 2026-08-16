"use client";

import React from "react";
import { ShoppingBag, ArrowRight } from "lucide-react";
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
    <div className="fixed bottom-4 inset-x-4 z-40 lg:hidden animate-in slide-in-from-bottom-5 duration-200">
      <button
        onClick={onOpenCart}
        className="w-full bg-primary hover:bg-primary-hover text-white py-3.5 px-5 rounded-2xl shadow-xl flex items-center justify-between font-bold text-sm transition-all active:scale-98 cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs">
            {itemCount}
          </div>
          <span>View Cart</span>
        </div>

        <div className="flex items-center gap-2">
          <span>{formatCurrency(subtotal, currency)}</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </button>
    </div>
  );
}
