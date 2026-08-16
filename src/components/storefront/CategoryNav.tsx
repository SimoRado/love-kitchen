"use client";

import React from "react";
import { Category } from "@/lib/types";

interface CategoryNavProps {
  categories: Category[];
  activeCategoryId: string;
  onSelectCategory: (id: string) => void;
}

export default function CategoryNav({
  categories,
  activeCategoryId,
  onSelectCategory,
}: CategoryNavProps) {
  const activeCategories = categories.filter((c) => c.active);

  return (
    <div className="sticky top-18 z-20 bg-[#FFFDF9]/95 backdrop-blur-md border-b border-[#EBE3D5] py-3 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          {/* "All" button */}
          <button
            onClick={() => onSelectCategory("ALL")}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeCategoryId === "ALL"
                ? "bg-primary text-white shadow-sm"
                : "bg-white hover:bg-orange-50/60 text-slate-700 border border-[#E8DFD1]"
            }`}
          >
            All Items
          </button>

          {/* Individual Category buttons */}
          {activeCategories.map((cat) => {
            const isSelected = activeCategoryId === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary text-white shadow-sm"
                    : "bg-white hover:bg-orange-50/60 text-slate-700 border border-[#E8DFD1]"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
