"use client";

import React, { useRef } from "react";
import { ArrowLeft, ArrowRight, UtensilsCrossed, Sparkles } from "lucide-react";
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

  const handleScroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -320 : 320;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const handleSelect = (id: string) => {
    onSelectCategory(id);
    const menuEl = document.getElementById("menu");
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const allCategoryItems = [
    { id: "ALL", name: "All Items", image: null as string | null },
    ...activeCategories.map((c) => ({ id: c.id, name: c.name, image: (c as { image?: string | null }).image || null })),
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full overflow-hidden box-border">
      {/* Header: Title and Navigation Arrows */}
      <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
        <div className="space-y-1">
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.22em] sm:tracking-[0.25em] text-amber-900/70 uppercase">
            Explore Our Menu
          </span>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 font-serif leading-tight tracking-tight">
            What are you <span className="text-[#C8102E]">craving?</span>
          </h2>
        </div>

        {/* Circular Navigation Arrows */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleScroll("left")}
            aria-label="Scroll categories left"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-stone-300 bg-white/80 hover:bg-stone-100 hover:border-slate-800 text-slate-700 hover:text-slate-900 flex items-center justify-center transition-colors shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll("right")}
            aria-label="Scroll categories right"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-stone-300 bg-white/80 hover:bg-stone-100 hover:border-slate-800 text-slate-700 hover:text-slate-900 flex items-center justify-center transition-colors shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Circles Horizontal Scroll Track */}
      <div
        ref={scrollContainerRef}
        tabIndex={0}
        aria-label="Category list"
        className="flex items-start gap-4 sm:gap-6 overflow-x-auto pb-4 pt-1 scroll-smooth focus:outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden w-full min-w-0"
      >
        {allCategoryItems.map((cat) => {
          const isSelected = activeCategoryId === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => handleSelect(cat.id)}
              className="flex flex-col items-center group cursor-pointer focus-visible:outline-none shrink-0 w-20 sm:w-28 md:w-32 text-center"
            >
              {/* Circular Card / Placeholder */}
              <div className="relative mb-2 sm:mb-3">
                <div
                  className={`w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden transition-colors flex items-center justify-center p-1 sm:p-1.5 shadow-md ${
                    isSelected
                      ? "ring-3 sm:ring-4 ring-[#C8102E] ring-offset-2 ring-offset-[#FAF7F0]"
                      : "ring-2 ring-[#E5DFD5] group-hover:ring-slate-400"
                  }`}
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-b from-[#252525] to-[#151515] flex flex-col items-center justify-center relative">
                    {/* Placeholder content: clean, elegant culinary motif */}
                    {cat.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cat.image}
                        alt={cat.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-stone-400 group-hover:text-stone-200 transition-colors">
                        {cat.id === "ALL" ? (
                          <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400/80 mb-1" />
                        ) : (
                          <UtensilsCrossed className="w-7 h-7 sm:w-8 sm:h-8 text-neutral-400 mb-1" />
                        )}
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-neutral-400">
                          {cat.id === "ALL" ? "Full Menu" : "Choice"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Small circular accent dot at bottom center (matching reference) */}
                <div
                  className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border flex items-center justify-center transition-colors shadow-xs ${
                    isSelected
                      ? "bg-[#C8102E] border-white text-white"
                      : "bg-[#181818] border-white/20 text-neutral-400 group-hover:border-[#C8102E]"
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? "bg-white" : "bg-neutral-300"
                    }`}
                  />
                </div>
              </div>

              {/* Category Label */}
              <span
                className={`text-xs sm:text-sm font-bold leading-snug px-1 line-clamp-2 transition-colors ${
                  isSelected
                    ? "text-[#C8102E]"
                    : "text-slate-800 group-hover:text-[#C8102E]"
                }`}
              >
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
