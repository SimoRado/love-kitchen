"use client";

import React, { useState, useMemo } from "react";
import { Search, UtensilsCrossed } from "lucide-react";
import { Product, Category } from "@/lib/types";
import ProductCard from "./ProductCard";

interface MenuGridProps {
  products: Product[];
  categories: Category[];
  activeCategoryId: string;
  currency?: string;
  isRestaurantOpen: boolean;
}

export default function MenuGrid({
  products,
  categories,
  activeCategoryId,
  currency = "MAD",
  isRestaurantOpen,
}: MenuGridProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const activeCategories = useMemo(
    () => categories.filter((c) => c.active),
    [categories]
  );

  // Filter products by category & search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (activeCategoryId !== "ALL" && p.categoryId !== activeCategoryId) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = (p.description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    });
  }, [products, activeCategoryId, searchQuery]);

  return (
    <section id="menu" className="space-y-6 scroll-mt-36 sm:scroll-mt-32">
      {/* Menu Header with Live Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight font-serif">
            {activeCategoryId === "ALL"
              ? "Our Full Menu"
              : activeCategories.find((c) => c.id === activeCategoryId)?.name || "Menu Section"}
          </h2>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            {filteredProducts.length} {filteredProducts.length === 1 ? "dish" : "dishes"} available to explore
          </p>
        </div>

        {/* Search input */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search food by name..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#E8DFD1] bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Products Grid or Empty State */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#E0D7C6] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-primary flex items-center justify-center mx-auto mb-3">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            No dishes found
          </h3>
          <p className="text-xs text-slate-500 font-normal mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No dishes match "${searchQuery}". Try searching for another ingredient or reset your search.`
              : "There are currently no items listed in this category."}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium shadow-xs hover:bg-primary-hover transition-colors"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              currency={currency}
              isRestaurantOpen={isRestaurantOpen}
            />
          ))}
        </div>
      )}
    </section>
  );
}
