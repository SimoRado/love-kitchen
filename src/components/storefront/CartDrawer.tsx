"use client";

import React, { useState } from "react";
import Link from "next/link";
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight, AlertTriangle, Edit2 } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { formatCurrency } from "@/lib/formatters";
import { calculateItemTotal } from "@/lib/money";
import { CartItem, SelectedModifierOptionSnapshot } from "@/lib/types";
import ProductConfigModal from "./ProductConfigModal";

interface CartDrawerProps {
  isOpen: boolean;
  currency?: string;
  isRestaurantOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({
  isOpen,
  currency = "MAD",
  isRestaurantOpen,
  onClose,
}: CartDrawerProps) {
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    getItemCount,
    getSubtotal,
    hasUnavailableItems,
    updateItemConfiguration,
  } = useCartStore();

  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);

  const itemCount = getItemCount();
  const subtotal = getSubtotal();
  const hasUnavailable = hasUnavailableItems();

  const handleConfirmEdit = (
    selectedModifiers: SelectedModifierOptionSnapshot[],
    quantity: number
  ) => {
    if (!editingCartItem) return;
    updateItemConfiguration(editingCartItem.id, selectedModifiers);
    if (quantity !== editingCartItem.quantity) {
      updateQuantity(editingCartItem.id, quantity);
    }
    setEditingCartItem(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        {/* Slide-out Panel */}
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
          <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-slate-200">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-orange-50/30">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-base text-slate-900">Your Order</h3>
                <span className="bg-orange-100 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                  {itemCount}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs font-medium text-slate-400 hover:text-red-600 transition-colors mr-2 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Close cart"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
              {items.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <ShoppingBag className="w-12 h-12 mx-auto opacity-20 mb-3" />
                  <p className="text-sm font-medium text-slate-600">Your cart is empty</p>
                  <p className="text-xs text-slate-400 font-normal mt-1 max-w-xs mx-auto">
                    Browse our artisanal menu and tap &quot;Add to Cart&quot; to build your food order.
                  </p>
                </div>
              ) : (
                items.map((item) => {
                  const { product, quantity, selectedModifiers = [], configuredUnitPrice } = item;
                  const isAvailable = product.available;
                  const itemTotal = calculateItemTotal(configuredUnitPrice, quantity);

                  // Group modifiers by group name for compact display
                  const groupedModifiers: { [groupName: string]: SelectedModifierOptionSnapshot[] } = {};
                  for (const mod of selectedModifiers) {
                    if (!groupedModifiers[mod.groupName]) {
                      groupedModifiers[mod.groupName] = [];
                    }
                    groupedModifiers[mod.groupName].push(mod);
                  }

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        !isAvailable
                          ? "bg-red-50/60 border-red-200"
                          : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-semibold truncate ${
                              !isAvailable ? "text-red-800 line-through" : "text-slate-800"
                            }`}
                          >
                            {product.name}
                          </p>
                          <p className="text-xs text-slate-500 font-normal mt-0.5">
                            {formatCurrency(configuredUnitPrice, currency)} each
                          </p>
                        </div>

                        <span className="text-sm font-semibold text-slate-900 shrink-0">
                          {formatCurrency(itemTotal, currency)}
                        </span>
                      </div>

                      {/* Selected modifiers details */}
                      {selectedModifiers.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1 text-xs text-slate-600">
                          {Object.entries(groupedModifiers).map(([groupName, mods]) => (
                            <div key={groupName} className="flex items-baseline gap-1 leading-tight">
                              <span className="font-medium text-slate-500">{groupName}:</span>
                              <span className="text-slate-800 font-normal">
                                {mods
                                  .map(
                                    (m) =>
                                      `${m.optionName}${
                                        m.priceDelta > 0
                                          ? ` (+${formatCurrency(m.priceDelta, currency)})`
                                          : ""
                                      }`
                                  )
                                  .join(", ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {!isAvailable && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Sold Out — Please remove from cart</span>
                        </div>
                      )}

                      {/* Quantity & Edit controls */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                          <button
                            onClick={() => updateQuantity(item.id, quantity - 1)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-medium px-3 text-slate-900 min-w-[24px] text-center">
                            {quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, quantity + 1)}
                            disabled={!isAvailable}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-30 cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {product.modifierGroups && product.modifierGroups.length > 0 && (
                            <button
                              onClick={() => setEditingCartItem(item)}
                              className="text-xs font-medium text-slate-500 hover:text-primary flex items-center gap-1 p-1 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          )}

                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-xs font-medium text-slate-400 hover:text-red-600 flex items-center gap-1 p-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            {items.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 space-y-3.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 font-medium">Subtotal</span>
                  <span className="font-semibold text-slate-900 text-base">
                    {formatCurrency(subtotal, currency)}
                  </span>
                </div>

                {!isRestaurantOpen ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium text-center">
                    The restaurant is currently closed. Orders cannot be placed right now.
                  </div>
                ) : hasUnavailable ? (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-medium text-center">
                    Please remove sold-out items to proceed to checkout.
                  </div>
                ) : null}

                <Link
                  href={!isRestaurantOpen || hasUnavailable ? "#" : "/checkout"}
                  onClick={() => {
                    if (isRestaurantOpen && !hasUnavailable) onClose();
                  }}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold shadow-xs transition-all text-white ${
                    !isRestaurantOpen || hasUnavailable
                      ? "bg-slate-300 cursor-not-allowed opacity-70 pointer-events-none"
                      : "bg-primary hover:bg-primary-hover active:scale-98 cursor-pointer"
                  }`}
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Config Modal */}
      {editingCartItem && (
        <ProductConfigModal
          isOpen={Boolean(editingCartItem)}
          product={editingCartItem.product}
          currency={currency}
          initialSelections={editingCartItem.selectedModifiers}
          isEditing={true}
          onClose={() => setEditingCartItem(null)}
          onConfirm={handleConfirmEdit}
        />
      )}
    </>
  );
}
