"use client";

import React from "react";
import Link from "next/link";
import { ShoppingBag, Plus, Minus, Trash2, ArrowRight, AlertTriangle } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { formatCurrency } from "@/lib/formatters";

interface CartSidebarProps {
  currency?: string;
  isRestaurantOpen: boolean;
}

export default function CartSidebar({
  currency = "MAD",
  isRestaurantOpen,
}: CartSidebarProps) {
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    getItemCount,
    getSubtotal,
    hasUnavailableItems,
  } = useCartStore();

  const itemCount = getItemCount();
  const subtotal = getSubtotal();
  const hasUnavailable = hasUnavailableItems();

  return (
    <aside className="bg-white rounded-2xl border border-[#EBE3D5] shadow-sm p-5 sticky top-36 flex flex-col justify-between max-h-[calc(100vh-160px)]">
      {/* Cart Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-base text-slate-900">Your Order</h3>
          <span className="bg-orange-100 text-primary text-[11px] font-extrabold px-2 py-0.5 rounded-full">
            {itemCount}
          </span>
        </div>

        {items.length > 0 && (
          <button
            onClick={clearCart}
            className="text-[11px] font-semibold text-slate-400 hover:text-red-600 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3.5 my-2">
        {items.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <ShoppingBag className="w-8 h-8 mx-auto opacity-30 mb-2" />
            <p className="text-xs font-semibold text-slate-600">Your cart is empty</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Select dishes from the menu to build your order
            </p>
          </div>
        ) : (
          items.map(({ product, quantity }) => {
            const isAvailable = product.available;
            const itemTotal = product.price * quantity;

            return (
              <div
                key={product.id}
                className={`p-3 rounded-xl border transition-all ${
                  !isAvailable
                    ? "bg-red-50/50 border-red-200"
                    : "bg-slate-50/60 border-slate-100"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-bold truncate ${
                        !isAvailable ? "text-red-800 line-through" : "text-slate-900"
                      }`}
                    >
                      {product.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatCurrency(product.price, currency)} each
                    </p>
                  </div>

                  <span className="text-xs font-black text-slate-900 shrink-0">
                    {formatCurrency(itemTotal, currency)}
                  </span>
                </div>

                {/* Unavailable warning */}
                {!isAvailable && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-red-600">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Sold Out — Please remove</span>
                  </div>
                )}

                {/* Quantity Controls & Remove */}
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold px-2 text-slate-900 min-w-[20px] text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                      disabled={!isAvailable}
                      className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-30"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(product.id)}
                    className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cart Summary & Checkout Button */}
      {items.length > 0 && (
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Subtotal</span>
            <span className="font-bold text-slate-900 text-sm">
              {formatCurrency(subtotal, currency)}
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Delivery fees calculated at next step
          </p>

          {!isRestaurantOpen ? (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold text-center">
              Restaurant is closed. Ordering paused.
            </div>
          ) : hasUnavailable ? (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-[11px] font-semibold text-center">
              Remove sold-out items to proceed.
            </div>
          ) : null}

          {/* Checkout CTA */}
          <Link
            href={!isRestaurantOpen || hasUnavailable ? "#" : "/checkout"}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold shadow-sm transition-all text-white ${
              !isRestaurantOpen || hasUnavailable
                ? "bg-slate-300 cursor-not-allowed opacity-70 pointer-events-none"
                : "bg-primary hover:bg-primary-hover active:scale-98"
            }`}
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </aside>
  );
}
