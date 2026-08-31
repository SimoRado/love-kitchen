"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Plus, Minus, Trash2, AlertTriangle, Edit2 } from "lucide-react";
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
      <aside className="bg-[#FAF7F0] rounded-2xl border border-[#EFE8DC] shadow-xs p-5 sticky top-36 z-10 self-start flex flex-col justify-between max-h-[calc(100vh-10rem)]">
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5DDD0]">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#C8102E]" />
            <h3 className="font-bold text-base text-slate-900">Your Order</h3>
            <span className="bg-red-100 text-[#C8102E] text-[11px] font-bold px-2 py-0.5 rounded-full">
              {itemCount}
            </span>
          </div>

          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs font-semibold text-slate-400 hover:text-red-600 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded px-1"
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
              <p className="text-xs font-bold text-slate-700">Your cart is empty</p>
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
                  className={`p-3 rounded-xl border transition-all bg-white ${
                    !isAvailable
                      ? "border-red-200 bg-red-50/40"
                      : "border-[#EFE8DC]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-bold truncate ${
                          !isAvailable ? "text-red-700 line-through" : "text-slate-900"
                        }`}
                      >
                        {product.name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                        {formatCurrency(configuredUnitPrice, currency)} each
                      </p>
                    </div>

                    <span className="text-xs font-bold text-slate-900 shrink-0">
                      {formatCurrency(itemTotal, currency)}
                    </span>
                  </div>

                  {/* Modifiers breakdown display */}
                  {selectedModifiers.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-1 text-[11px] text-slate-600">
                      {Object.entries(groupedModifiers).map(([groupName, mods]) => (
                        <div key={groupName} className="flex items-baseline gap-1 leading-tight">
                          <span className="font-semibold text-slate-700">{groupName}:</span>
                          <span className="text-slate-600 font-normal">
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
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-red-600">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Sold Out — Please remove</span>
                    </div>
                  )}

                  {/* Quantity Controls & Actions */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-[#FAF7F0] border border-[#E5DDD0] rounded-lg p-0.5">
                      <button
                        onClick={() => updateQuantity(item.id, quantity - 1)}
                        className="p-1 rounded text-slate-600 hover:bg-white transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold px-2 text-slate-900 min-w-[20px] text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, quantity + 1)}
                        disabled={!isAvailable}
                        className="p-1 rounded text-slate-600 hover:bg-white transition-colors disabled:opacity-30 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
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
                          className="text-slate-400 hover:text-[#C8102E] p-1 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded"
                          title="Edit customizations"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded"
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
          <div className="pt-4 border-t border-[#E5DDD0] space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Subtotal</span>
              <span className="font-bold text-slate-900 text-sm">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 font-normal">
              Delivery fee calculated at checkout
            </p>

            {hasUnavailable ? (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold text-center">
                Please remove sold out items to proceed
              </div>
            ) : !isRestaurantOpen ? (
              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-semibold text-center">
                Ordering is temporarily paused
              </div>
            ) : (
              <Link
                href="/checkout"
                className="w-full py-3 px-4 rounded-xl bg-[#C8102E] hover:bg-[#B00D26] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
              >
                <span>Proceed to Checkout</span>
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
