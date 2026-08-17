"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Plus, Minus, Trash2, ArrowRight, AlertTriangle, Edit2 } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { formatCurrency } from "@/lib/formatters";
import { CartItem, SelectedModifierOptionSnapshot } from "@/lib/types";
import ProductConfigModal from "./ProductConfigModal";
import { calculateItemTotal } from "@/lib/money";

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
    updateItemConfiguration(editingCartItem.id, selectedModifiers, quantity);
    setEditingCartItem(null);
  };

  return (
    <>
      <aside className="bg-white rounded-2xl border border-[#EBE3D5] shadow-xs p-5 sticky top-36 z-10 self-start flex flex-col justify-between max-h-[calc(100vh-10rem)]">
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base text-slate-900">Your Order</h3>
            <span className="bg-orange-100 text-primary text-[11px] font-semibold px-2 py-0.5 rounded-full">
              {itemCount}
            </span>
          </div>

          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-[11px] font-medium text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 my-1 min-h-0">
          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ShoppingBag className="w-8 h-8 mx-auto opacity-30 mb-2" />
              <p className="text-xs font-medium text-slate-600">Your cart is empty</p>
              <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                Select dishes from the menu to build your order
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
                  className={`p-3 rounded-xl border transition-all ${
                    !isAvailable
                      ? "bg-red-50/50 border-red-200"
                      : "bg-slate-50/60 border-slate-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-semibold truncate ${
                          !isAvailable ? "text-red-800 line-through" : "text-slate-800"
                        }`}
                      >
                        {product.name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                        {formatCurrency(configuredUnitPrice, currency)} each
                      </p>
                    </div>

                    <span className="text-xs font-semibold text-slate-900 shrink-0">
                      {formatCurrency(itemTotal, currency)}
                    </span>
                  </div>

                  {/* Modifiers breakdown display */}
                  {selectedModifiers.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-1 text-[11px] text-slate-600">
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

                  {/* Unavailable warning */}
                  {!isAvailable && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-red-600">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Sold Out — Please remove</span>
                    </div>
                  )}

                  {/* Quantity Controls & Actions */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                      <button
                        onClick={() => updateQuantity(item.id, quantity - 1)}
                        className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-medium px-2 text-slate-900 min-w-[20px] text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, quantity + 1)}
                        disabled={!isAvailable}
                        className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-30 cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Edit Button if product has modifiers */}
                      {product.modifierGroups && product.modifierGroups.length > 0 && (
                        <button
                          onClick={() => setEditingCartItem(item)}
                          className="text-slate-400 hover:text-primary p-1 transition-colors cursor-pointer"
                          title="Edit customizations"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer */}
        {items.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between text-xs font-normal text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900 text-sm">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 font-normal">
              Delivery fee calculated at checkout
            </p>

            {hasUnavailable ? (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium text-center">
                Please remove sold out items to proceed
              </div>
            ) : !isRestaurantOpen ? (
              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-medium text-center">
                Ordering is temporarily paused
              </div>
            ) : (
              <Link
                href="/checkout"
                className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}
          </div>
        )}
      </aside>

      {/* Edit Config Modal */}
      {editingCartItem && (
        <ProductConfigModal
          isOpen={Boolean(editingCartItem)}
          product={editingCartItem.product}
          currency={currency}
          initialSelections={editingCartItem.selectedModifiers}
          initialQuantity={editingCartItem.quantity}
          isEditing={true}
          onClose={() => setEditingCartItem(null)}
          onConfirm={handleConfirmEdit}
        />
      )}
    </>
  );
}
