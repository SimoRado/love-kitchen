"use client";

import React, { useState } from "react";
import { Plus, Check, UtensilsCrossed } from "lucide-react";
import { Product, SelectedModifierOptionSnapshot } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";
import { useCartStore } from "@/store/useCartStore";
import { hasActiveModifiers } from "@/lib/constants";
import ProductConfigModal from "./ProductConfigModal";

interface ProductCardProps {
  product: Product;
  currency?: string;
  isRestaurantOpen: boolean;
  onConfigureProduct?: (product: Product) => void;
}

export default function ProductCard({
  product,
  currency = "MAD",
  isRestaurantOpen,
  onConfigureProduct,
}: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [justAdded, setJustAdded] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const isAvailable = product.available;
  const canOrder = isRestaurantOpen && isAvailable;
  const productHasModifiers = hasActiveModifiers(product);

  const handleAddToCartClick = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!canOrder) return;

    if (productHasModifiers) {
      if (onConfigureProduct) {
        onConfigureProduct(product);
      } else {
        setIsConfigModalOpen(true);
      }
      return;
    }

    addItem(product, 1);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 1200);
  };

  const handleConfigModalConfirm = (
    selectedModifiers: SelectedModifierOptionSnapshot[],
    quantity: number
  ) => {
    addItem(product, quantity, selectedModifiers);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 1200);
  };

  return (
    <>
      <div
        className={`group bg-white rounded-xl sm:rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden h-full ${
          !isAvailable
            ? "border-slate-200 bg-slate-50/40"
            : "border-[#EBE3D5] hover:border-primary/40 hover:shadow-xs"
        }`}
      >
        <div
          onClick={canOrder ? (e) => handleAddToCartClick(e) : undefined}
          className={canOrder ? "cursor-pointer" : ""}
        >
          {/* Product Image Area */}
          <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-slate-100 overflow-hidden">
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image}
                alt={product.name}
                className={`w-full h-full object-cover ${
                  !isAvailable ? "grayscale opacity-70" : ""
                }`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://placehold.co/600x400/fff7ed/ea580c?text=Love+Kitchen";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-orange-50/50 text-slate-400">
                <UtensilsCrossed className="w-6 h-6 sm:w-8 sm:h-8 opacity-40" />
              </div>
            )}

            {/* Badges Overlay */}
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-1 items-end">
              {!isAvailable ? (
                <div className="bg-slate-900/80 text-white text-[10px] sm:text-[11px] font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md backdrop-blur-xs shadow-xs">
                  Unavailable
                </div>
              ) : null}
            </div>
          </div>

          {/* Details Area */}
          <div className="p-3 sm:p-5">
            <div className="flex items-start justify-between gap-1.5">
              <h3
                className={`font-semibold text-xs sm:text-base tracking-tight leading-snug line-clamp-2 min-h-[2rem] sm:min-h-0 ${
                  !isAvailable ? "text-slate-400 line-through" : "text-slate-800"
                }`}
              >
                {product.name}
              </h3>

              {!isAvailable && (
                <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                  Sold Out
                </span>
              )}
            </div>

            {product.description && (
              <p className="text-[11px] sm:text-xs text-slate-500 font-normal mt-1 line-clamp-2 leading-relaxed">
                {product.description}
              </p>
            )}
          </div>
        </div>

        {/* Card Footer: Price & Add to Cart */}
        <div className="p-3 sm:p-5 pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mt-1 sm:mt-2 border-t border-slate-100 pt-2.5 sm:pt-3">
          <div className="flex flex-col">
            <span className="text-xs sm:text-base font-semibold text-slate-900 tracking-tight whitespace-nowrap">
              {formatCurrency(product.price, currency)}
            </span>
          </div>

          {/* Add to Cart Button */}
          <button
            type="button"
            onClick={(e) => handleAddToCartClick(e)}
            disabled={!canOrder}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-2.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-medium sm:font-semibold transition-all active:scale-95 cursor-pointer shrink-0 ${
              !isRestaurantOpen
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : !isAvailable
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : justAdded
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-primary hover:bg-primary-hover text-white shadow-xs"
            }`}
          >
            {!isRestaurantOpen ? (
              <span>Closed</span>
            ) : !isAvailable ? (
              <span>Unavailable</span>
            ) : justAdded ? (
              <>
                <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Added</span>
              </>
            ) : (
              <>
                <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Add to Cart</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Fallback Product Configuration Modal if standalone */}
      {!onConfigureProduct && productHasModifiers && (
        <ProductConfigModal
          isOpen={isConfigModalOpen}
          product={product}
          currency={currency}
          onClose={() => setIsConfigModalOpen(false)}
          onConfirm={handleConfigModalConfirm}
        />
      )}
    </>
  );
}
