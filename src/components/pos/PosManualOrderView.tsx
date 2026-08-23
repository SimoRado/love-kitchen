"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Edit2,
  ShoppingBag,
  Truck,
  Loader2,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  UtensilsCrossed,
} from "lucide-react";
import { Category, Product, CartItem, SelectedModifierOptionSnapshot, OrderType } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";
import { calculateOrderTotals, calculateItemTotal } from "@/lib/money";
import { hasActiveModifiers } from "@/lib/constants";
import { generateCartItemId, calculateConfiguredPrice } from "@/store/useCartStore";
import PosModifierModal from "./PosModifierModal";

interface PosManualOrderViewProps {
  categories: Category[];
  products: Product[];
  currency?: string;
  deliveryFee?: number;
  onOrderCreated: (newOrderNumber: string) => void;
}

export default function PosManualOrderView({
  categories,
  products,
  currency = "MAD",
  deliveryFee = 15,
  onOrderCreated,
}: PosManualOrderViewProps) {
  // Navigation & filtering
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Cart / Order state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("PICKUP");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");

  // Clear confirmation modal/dialog state
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Customization Modal State
  const [configuringProduct, setConfiguringProduct] = useState<Product | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [modalInitialSelections, setModalInitialSelections] = useState<SelectedModifierOptionSnapshot[]>([]);
  const [modalInitialQuantity, setModalInitialQuantity] = useState(1);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Filtered categories & products
  const activeCategories = useMemo(() => {
    return categories.filter((c) => c.active);
  }, [categories]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!product.available) return false;
      if (selectedCategoryId !== "ALL" && product.categoryId !== selectedCategoryId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesDesc = Boolean(product.description && product.description.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // Order Totals calculation
  const { subtotal, total } = useMemo(() => {
    return calculateOrderTotals(
      cartItems.map((it) => ({ price: it.configuredUnitPrice, quantity: it.quantity })),
      orderType,
      deliveryFee
    );
  }, [cartItems, orderType, deliveryFee]);

  // Fast Product Tap
  const handleProductTap = (product: Product) => {
    if (hasActiveModifiers(product)) {
      // Open customization modal
      setConfiguringProduct(product);
      setEditingCartItemId(null);
      setModalInitialSelections([]);
      setModalInitialQuantity(1);
    } else {
      // 1-tap fast add / increment
      const itemId = generateCartItemId(product.id, []);
      const configuredUnitPrice = product.price;

      setCartItems((prev) => {
        const existingIndex = prev.findIndex((it) => it.id === itemId);
        if (existingIndex > -1) {
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            quantity: next[existingIndex].quantity + 1,
          };
          return next;
        }
        return [
          ...prev,
          {
            id: itemId,
            product,
            quantity: 1,
            selectedModifiers: [],
            configuredUnitPrice,
          },
        ];
      });
    }
  };

  // Modifier Modal Confirm (Add or Edit)
  const handleModifierConfirm = (
    selectedModifiers: SelectedModifierOptionSnapshot[],
    quantity: number
  ) => {
    if (!configuringProduct) return;

    const sortedModifiers = [...selectedModifiers].sort((a, b) =>
      a.optionId.localeCompare(b.optionId)
    );
    const itemId = generateCartItemId(configuringProduct.id, sortedModifiers);
    const configuredUnitPrice = calculateConfiguredPrice(configuringProduct.price, sortedModifiers);

    setCartItems((prev) => {
      if (editingCartItemId) {
        // Editing existing line
        const withoutOld = prev.filter((it) => it.id !== editingCartItemId);
        const existingTargetIndex = withoutOld.findIndex((it) => it.id === itemId);
        if (existingTargetIndex > -1) {
          // Merge with identical existing line
          withoutOld[existingTargetIndex] = {
            ...withoutOld[existingTargetIndex],
            quantity: withoutOld[existingTargetIndex].quantity + quantity,
            configuredUnitPrice,
            selectedModifiers: sortedModifiers,
          };
          return withoutOld;
        }
        return [
          ...withoutOld,
          {
            id: itemId,
            product: configuringProduct,
            quantity,
            selectedModifiers: sortedModifiers,
            configuredUnitPrice,
          },
        ];
      }

      // Adding new line
      const existingIndex = prev.findIndex((it) => it.id === itemId);
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + quantity,
          configuredUnitPrice,
          selectedModifiers: sortedModifiers,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: itemId,
          product: configuringProduct,
          quantity,
          selectedModifiers: sortedModifiers,
          configuredUnitPrice,
        },
      ];
    });

    setConfiguringProduct(null);
    setEditingCartItemId(null);
  };

  // Edit item customizations
  const handleEditItem = (item: CartItem) => {
    setConfiguringProduct(item.product);
    setEditingCartItemId(item.id);
    setModalInitialSelections(item.selectedModifiers || []);
    setModalInitialQuantity(item.quantity);
  };

  // Quantity changes
  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, quantity: newQty } : it))
    );
  };

  // Remove single line item
  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  // Clear entire cart with confirmation
  const handleClearClick = () => {
    if (cartItems.length === 0) return;
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    setCartItems([]);
    setCustomerName("");
    setCustomerPhone("");
    setAllergies("");
    setNotes("");
    setShowClearConfirm(false);
  };

  // Submit manual POS order
  const handleCreateOrder = async () => {
    if (cartItems.length === 0 || isSubmitting) return;

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const payload = {
        customerName: customerName.trim() || "POS Walk-in",
        customerPhone: customerPhone.trim(),
        orderType,
        allergies: allergies.trim() || null,
        notes: notes.trim() || null,
        initialStatus: "CONFIRMED",
        items: cartItems.map((it) => ({
          productId: it.product.id,
          quantity: it.quantity,
          selectedModifierOptionIds: (it.selectedModifiers || []).map((m) => m.optionId),
        })),
      };

      const res = await fetch("/api/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.data) {
        // Reset manual order state
        setCartItems([]);
        setCustomerName("");
        setCustomerPhone("");
        setAllergies("");
        setNotes("");
        onOrderCreated(data.data.orderNumber);
      } else {
        setErrorMessage(data.error || "Failed to create POS order.");
      }
    } catch (err) {
      console.error("POS order creation failed:", err);
      setErrorMessage("Network error creating order. Please check connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] xl:grid-cols-[1fr_340px] 2xl:grid-cols-[1fr_380px] gap-4 sm:gap-5 h-[calc(100vh-5.5rem)] items-stretch">
      {/* LEFT / MAIN AREA (72-75% on iPad/Desktop): Menu Catalog */}
      <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-w-0">
        {/* Top: Category Tabs & Search Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 space-y-3 bg-slate-50 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes or drinks..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700"
              >
                Clear
              </button>
            )}
          </div>

          {/* Refined Prominent Category Pills Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategoryId("ALL")}
              className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                selectedCategoryId === "ALL"
                  ? "bg-slate-950 text-white shadow-sm ring-1 ring-white/10"
                  : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950 border border-slate-200 shadow-2xs"
              }`}
            >
              <span>All Items</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  selectedCategoryId === "ALL"
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {products.filter((p) => p.available).length}
              </span>
            </button>

            {activeCategories.map((cat) => {
              const count = products.filter((p) => p.categoryId === cat.id && p.available).length;
              const isSelected = selectedCategoryId === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                    isSelected
                      ? "bg-slate-950 text-white shadow-sm ring-1 ring-white/10"
                      : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950 border border-slate-200 shadow-2xs"
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Cards Grid with Food Images */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5">
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
              {filteredProducts.map((product) => {
                const hasOptions = hasActiveModifiers(product);

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductTap(product)}
                    className="group relative rounded-2xl border border-slate-200 bg-white hover:border-orange-500 hover:shadow-md active:scale-[0.98] transition-all text-left flex flex-col justify-between overflow-hidden shadow-2xs cursor-pointer min-w-0"
                  >
                    {/* 1. Food Image Header with Aspect Ratio & Fallback */}
                    <div className="relative w-full aspect-[16/10] sm:aspect-[4/3] bg-slate-100 overflow-hidden shrink-0">
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://placehold.co/600x400/fff7ed/ea580c?text=Love+Kitchen";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-orange-50/60 text-orange-400">
                          <UtensilsCrossed className="w-8 h-8 opacity-40" />
                        </div>
                      )}

                      {/* Customization Options Indicator Badge Overlay */}
                      {hasOptions && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-xs text-white text-[10px] font-extrabold tracking-wider uppercase shadow-xs">
                          <SlidersHorizontal className="w-3 h-3 text-orange-400" />
                          <span>Customizable</span>
                        </div>
                      )}
                    </div>

                    {/* 2. Card Body: Title & Short Description */}
                    <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-orange-950 line-clamp-2 leading-snug tracking-tight">
                          {product.name}
                        </h4>
                        {product.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal">
                            {product.description}
                          </p>
                        )}
                      </div>

                      {/* 3. Card Footer: Price & Touch Action Button */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-black text-slate-950 font-mono">
                          {formatCurrency(product.price, currency)}
                        </span>
                        <span
                          className={`text-[10px] sm:text-[11px] font-extrabold px-2 py-1 rounded-lg transition-colors shrink-0 uppercase tracking-wider ${
                            hasOptions
                              ? "bg-orange-100 text-orange-800 group-hover:bg-orange-600 group-hover:text-white"
                              : "bg-slate-100 text-slate-800 group-hover:bg-orange-600 group-hover:text-white"
                          }`}
                        >
                          {hasOptions ? "Options" : "+ Add"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <ShoppingBag className="w-12 h-12 mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">No dishes match your selection</p>
              <p className="text-xs text-slate-400 mt-1">Try picking another category or clear search</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE (~26-28% on iPad/Desktop): Current Order Panel (Always Visible) */}
      <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-w-0">
        {/* Header: Title & Clear Order */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">Current Order</h3>
            {cartItems.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-orange-600 text-white">
                {cartItems.reduce((sum, it) => sum + it.quantity, 0)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleClearClick}
            disabled={cartItems.length === 0}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 active:bg-red-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        {/* Order Type & Fast Details Selector */}
        <div className="p-3 border-b border-slate-100 bg-white space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setOrderType("PICKUP")}
              className={`py-2 px-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                orderType === "PICKUP"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Dine-In / Pickup</span>
            </button>
            <button
              type="button"
              onClick={() => setOrderType("DELIVERY")}
              className={`py-2 px-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                orderType === "DELIVERY"
                  ? "bg-purple-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Delivery</span>
            </button>
          </div>

          {/* Quick optional customer label */}
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer / Table #"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium truncate"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note (optional)"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium truncate"
            />
          </div>
        </div>

        {/* Scrollable Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cartItems.length > 0 ? (
            cartItems.map((item) => {
              const lineTotal = calculateItemTotal(item.configuredUnitPrice, item.quantity);
              const hasOptions = (item.selectedModifiers || []).length > 0;

              return (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-extrabold text-xs text-slate-900 leading-snug">
                          {item.product.name}
                        </span>
                        {hasOptions && (
                          <button
                            type="button"
                            onClick={() => handleEditItem(item)}
                            className="p-1 text-slate-400 hover:text-orange-600 rounded hover:bg-orange-50 transition-colors"
                            title="Edit modifiers"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Selected Modifiers list */}
                      {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                        <div className="mt-1 space-y-0.5 text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          {item.selectedModifiers.map((mod) => (
                            <p key={mod.optionId} className="flex justify-between leading-tight">
                              <span>+ {mod.optionName}</span>
                              {mod.priceDelta > 0 && (
                                <span className="text-slate-400 font-mono">
                                  +{formatCurrency(mod.priceDelta, currency)}
                                </span>
                              )}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Line Total */}
                    <span className="font-black text-xs text-slate-900 shrink-0 font-mono">
                      {formatCurrency(lineTotal, currency)}
                    </span>
                  </div>

                  {/* Quantity & Delete Controls */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
                    <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white text-slate-700 active:scale-95 transition-all cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-black text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white text-slate-700 active:scale-95 transition-all cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <ShoppingBag className="w-9 h-9 mb-2 text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Order is empty</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tap items on the left menu to add them
              </p>
            </div>
          )}
        </div>

        {/* BOTTOM CALCULATION / CALCULATOR & CHECKOUT AREA */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 space-y-2.5 shrink-0">
          {errorMessage && (
            <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
              {errorMessage}
            </div>
          )}

          {/* Pricing Breakdown */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Subtotal</span>
              <span className="font-bold text-slate-900 font-mono">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>

            {orderType === "DELIVERY" && (
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Delivery Fee</span>
                <span className="font-bold text-slate-900 font-mono">
                  {formatCurrency(deliveryFee, currency)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200">
              <span className="font-black text-xs uppercase tracking-wider text-slate-900">
                TOTAL
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-950 font-mono">
                {formatCurrency(total, currency)}
              </span>
            </div>
          </div>

          {/* Primary Action Button: Create Order */}
          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={cartItems.length === 0 || isSubmitting}
            className="w-full h-12 sm:h-13 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:bg-slate-300 disabled:opacity-70 text-white font-black text-sm sm:text-base shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Order...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                <span>Create Order • {formatCurrency(total, currency)}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Product Customization Modal */}
      {configuringProduct && (
        <PosModifierModal
          isOpen={Boolean(configuringProduct)}
          product={configuringProduct}
          currency={currency}
          initialSelections={modalInitialSelections}
          initialQuantity={modalInitialQuantity}
          isEditing={Boolean(editingCartItemId)}
          onClose={() => {
            setConfiguringProduct(null);
            setEditingCartItemId(null);
          }}
          onConfirm={handleModifierConfirm}
        />
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Clear Current Order?</h3>
              <p className="text-xs text-slate-500 mt-1">
                This will remove all {cartItems.reduce((s, it) => s + it.quantity, 0)} items from the current order.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
              >
                Yes, Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
