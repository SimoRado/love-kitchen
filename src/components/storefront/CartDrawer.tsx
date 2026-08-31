"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, ShoppingBag, Plus, Minus, Trash2, AlertTriangle, Edit2 } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { formatCurrency } from "@/lib/formatters";
import { calculateItemTotal } from "@/lib/money";
import { CartItem, SelectedModifierOptionSnapshot } from "@/lib/types";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
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
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const isClosingRef = useRef(false);
  const isRenderedRef = useRef(false);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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

  // Lock background body scroll while drawer is rendered
  useBodyScrollLock(isRendered);

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const finishDismiss = useCallback(() => {
    if (!isClosingRef.current) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    isRenderedRef.current = false;
    isClosingRef.current = false;
    setIsRendered(false);
    onCloseRef.current();
  }, []);

  const handleDismiss = useCallback(() => {
    if (isClosingRef.current || !isRenderedRef.current) return;
    isClosingRef.current = true;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setIsVisible(false);

    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(finishDismiss, 350);
  }, [finishDismiss]);

  useEffect(() => {
    if (isOpen) {
      if (isRenderedRef.current || isClosingRef.current) return;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      isRenderedRef.current = true;
      isClosingRef.current = false;
      setIsVisible(false);
      setIsRendered(true);
    } else if (!isOpen && isRenderedRef.current) {
      handleDismiss();
    }
  }, [isOpen, handleDismiss]);

  useEffect(() => {
    if (!isRendered || !isOpen || isClosingRef.current) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (isRenderedRef.current && !isClosingRef.current) {
          setIsVisible(true);
        }
      });
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRendered, isOpen]);

  const handlePanelTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "transform") return;

    if (!isVisible && isClosingRef.current) {
      finishDismiss();
    }
  };

  useEffect(() => {
    if (!isRendered || !isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!editingCartItem) {
          handleDismiss();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRendered, isVisible, editingCartItem, handleDismiss]);

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

  if (!isRendered) return null;

  const drawerContent = (
    <>
      <div
        className="fixed inset-0 z-50 overflow-hidden"
        style={{ overscrollBehavior: "contain" }}
      >
        {/* Backdrop */}
        <div
          style={{
            transitionProperty: "opacity",
            transitionDuration: "220ms",
            transitionTimingFunction: "ease-out",
            willChange: "opacity",
          }}
          className={`fixed inset-0 bg-slate-900/60 transition-opacity motion-reduce:transition-none ${
            isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={handleDismiss}
          onTouchMove={(e) => e.preventDefault()}
        />

        {/* Slide-out Panel Container */}
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 h-full max-h-[100dvh] h-[100dvh] pointer-events-none">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            onTransitionEnd={handlePanelTransitionEnd}
            style={{
              overscrollBehavior: "contain",
              transitionProperty: "transform",
              transitionDuration: "320ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              transform: isVisible ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)",
              willChange: "transform",
            }}
            className="w-screen max-w-md bg-[#FAF7F0] shadow-2xl flex flex-col justify-between border-l border-[#EFE8DC] h-full max-h-[100dvh] h-[100dvh] overflow-hidden pointer-events-auto motion-reduce:transition-none"
          >
            {/* Drawer Header (Fixed at top) */}
            <div className="p-4 sm:p-5 border-b border-[#E5DDD0] flex items-center justify-between bg-[#FAF7F0] shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#C8102E]" />
                <h3 id="cart-drawer-title" className="font-bold text-base text-slate-900">
                  Your Order
                </h3>
                <span className="bg-red-100 text-[#C8102E] text-xs font-bold px-2 py-0.5 rounded-full">
                  {itemCount}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs font-semibold text-slate-400 hover:text-red-600 transition-colors mr-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded px-1"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
                  aria-label="Close cart"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Items List */}
            <div
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 overscroll-contain bg-[#FAF7F0]"
              style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
            >
              {items.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <ShoppingBag className="w-12 h-12 mx-auto opacity-20 mb-3" />
                  <p className="text-sm font-bold text-slate-700">Your cart is empty</p>
                  <p className="text-xs text-slate-400 font-normal mt-1 max-w-xs mx-auto">
                    Browse our menu and select dishes to build your order.
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
                      className={`p-3.5 rounded-xl border transition-all bg-white ${
                        !isAvailable
                          ? "bg-red-50/60 border-red-200"
                          : "border-[#EFE8DC]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-bold truncate ${
                              !isAvailable ? "text-red-700 line-through" : "text-slate-800"
                            }`}
                          >
                            {product.name}
                          </p>
                          <p className="text-xs text-slate-500 font-normal mt-0.5">
                            {formatCurrency(configuredUnitPrice, currency)} each
                          </p>
                        </div>

                        <span className="text-sm font-bold text-slate-900 shrink-0">
                          {formatCurrency(itemTotal, currency)}
                        </span>
                      </div>

                      {/* Selected modifiers details */}
                      {selectedModifiers.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
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

                      {!isAvailable && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-red-600">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Sold Out — Please remove from cart</span>
                        </div>
                      )}

                      {/* Quantity & Edit controls */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1 bg-[#FAF7F0] border border-[#E5DDD0] rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, quantity - 1)}
                            className="p-1.5 rounded text-slate-600 hover:bg-white transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold px-3 text-slate-900 min-w-[24px] text-center">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, quantity + 1)}
                            disabled={!isAvailable}
                            className="p-1.5 rounded text-slate-600 hover:bg-white transition-colors disabled:opacity-30 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {product.modifierGroups && product.modifierGroups.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setEditingCartItem(item)}
                              className="text-xs font-bold text-slate-500 hover:text-[#C8102E] flex items-center gap-1 p-1 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-xs font-bold text-slate-400 hover:text-red-600 flex items-center gap-1 p-1 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none rounded"
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

            {/* Drawer Footer (Fixed at bottom) */}
            {items.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-[#E5DDD0] bg-[#FAF7F0] space-y-3.5 shrink-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 font-medium">Subtotal</span>
                  <span className="font-bold text-slate-900 text-base">
                    {formatCurrency(subtotal, currency)}
                  </span>
                </div>

                {!isRestaurantOpen ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold text-center">
                    The restaurant is currently closed. Orders cannot be placed right now.
                  </div>
                ) : hasUnavailable ? (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-semibold text-center">
                    Please remove sold-out items to proceed to checkout.
                  </div>
                ) : null}

                <Link
                  href={!isRestaurantOpen || hasUnavailable ? "#" : "/checkout"}
                  onClick={() => {
                    if (isRestaurantOpen && !hasUnavailable) handleDismiss();
                  }}
                  className={`w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-sm font-bold shadow-xs transition-all text-white focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none ${
                    !isRestaurantOpen || hasUnavailable
                      ? "bg-slate-300 cursor-not-allowed opacity-70 pointer-events-none"
                      : "bg-[#C8102E] hover:bg-[#B00D26] active:scale-98 cursor-pointer"
                  }`}
                >
                  <span>Proceed to Checkout</span>
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
          initialQuantity={editingCartItem.quantity}
          isEditing={true}
          onClose={() => setEditingCartItem(null)}
          onConfirm={handleConfirmEdit}
        />
      )}
    </>
  );

  return createPortal(drawerContent, document.body);
}
