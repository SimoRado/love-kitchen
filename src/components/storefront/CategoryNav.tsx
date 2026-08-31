"use client";

import React, { useRef } from "react";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleSelect = (id: string) => {
    onSelectCategory(id);
    const menuEl = document.getElementById("menu");
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav
      aria-label="Menu categories"
      className="sticky top-18 z-20 bg-[#FAF7F0]/95 backdrop-blur-md border-b border-[#E5DDD0] py-3 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={scrollContainerRef}
          className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 scroll-smooth"
        >
          {/* "All Items" Button */}
          <button
            onClick={() => handleSelect("ALL")}
            className={`px-4 py-2 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none ${
              activeCategoryId === "ALL"
                ? "bg-[#C8102E] text-white font-bold shadow-xs"
                : "bg-[#F0ECE4] hover:bg-[#E5DFD5] text-slate-800 font-medium"
            }`}
          >
            <span>All Items</span>
          </button>

          {/* Categories */}
          {activeCategories.map((cat) => {
            const isSelected = activeCategoryId === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => handleSelect(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none ${
                  isSelected
                    ? "bg-[#C8102E] text-white font-bold shadow-xs"
                    : "bg-[#F0ECE4] hover:bg-[#E5DFD5] text-slate-800 font-medium"
                }`}
              >
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
