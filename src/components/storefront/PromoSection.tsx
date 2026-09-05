"use client";

import React from "react";
import { Leaf, ChefHat, Heart, Utensils, Flame, Sparkles, LucideIcon } from "lucide-react";

interface FeatureItem {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

interface PromoBlockProps {
  eyebrow: string;
  titlePrefix: string;
  titleAccent: string;
  description: string;
  ctaText?: string;
  ctaHref?: string;
  imageSrc: string;
  imageAlt: string;
  imagePosition?: string;
  features: [FeatureItem, FeatureItem, FeatureItem];
  layout: "text-left" | "image-left";
  onCtaClick?: () => void;
}

function PromoBlock({
  eyebrow,
  titlePrefix,
  titleAccent,
  description,
  ctaText = "Explore Menu",
  ctaHref = "#menu",
  imageSrc,
  imageAlt,
  imagePosition = "center",
  features,
  layout,
  onCtaClick,
}: PromoBlockProps) {
  const handleCta = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onCtaClick) {
      e.preventDefault();
      onCtaClick();
      return;
    }
    if (ctaHref.startsWith("#")) {
      e.preventDefault();
      const target = document.getElementById(ctaHref.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const isTextLeft = layout === "text-left";

  const textPanel = (
    <div
      className={`w-1/2 p-3.5 sm:p-7 md:p-10 lg:p-14 xl:p-20 flex flex-col justify-between bg-[#FAF6F0] min-w-0 box-border ${
        isTextLeft
          ? "lg:pl-16 xl:pl-24 lg:pr-10 xl:pr-16"
          : "lg:pr-16 xl:pr-24 lg:pl-10 xl:pl-16"
      }`}
    >
      <div className="space-y-1.5 sm:space-y-3.5 lg:space-y-4 max-w-xl">
        <span className="text-[9px] sm:text-xs md:text-sm font-bold tracking-[0.2em] text-amber-900/80 uppercase block truncate">
          {eyebrow}
        </span>

        <h2 className="text-sm sm:text-xl md:text-3xl lg:text-4xl xl:text-5xl font-black text-slate-900 font-serif leading-[1.18] tracking-tight">
          {titlePrefix}{" "}
          <span className="text-[#C8102E]">{titleAccent}</span>
        </h2>

        {/* Small subtle decorative element */}
        <div className="flex items-center gap-1.5 pt-0.5 pb-0.5">
          <div className="w-4 sm:w-8 h-[1.5px] sm:h-[2px] bg-[#C8102E]/40 rounded-full" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#C8102E]/60" />
        </div>

        <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-slate-600 font-normal leading-relaxed line-clamp-3 sm:line-clamp-none">
          {description}
        </p>

        <div className="pt-1 sm:pt-2">
          <a
            href={ctaHref}
            onClick={handleCta}
            className="inline-flex items-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-5 sm:py-2.5 lg:px-6 lg:py-3 rounded-full bg-[#C8102E] hover:bg-[#B00D26] text-white text-[10px] sm:text-xs md:text-sm font-bold shadow-sm transition-colors cursor-pointer w-fit focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
          >
            <span>{ctaText}</span>
            <span className="text-xs sm:text-base leading-none">→</span>
          </a>
        </div>
      </div>

      {/* 3 Features Bar */}
      <div className="pt-2 sm:pt-6 mt-2 sm:mt-4 border-t border-[#EFE8DC] grid grid-cols-3 gap-1 sm:gap-3 max-w-xl">
        {features.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="space-y-0.5 sm:space-y-1 min-w-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded sm:rounded-lg bg-red-50 text-[#C8102E] flex items-center justify-center mb-0.5 sm:mb-1.5 shrink-0">
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <h3 className="text-[8px] sm:text-[11px] md:text-xs font-bold text-slate-900 leading-tight truncate sm:whitespace-normal">
                {item.title}
              </h3>
              <p className="hidden sm:block text-[9px] md:text-[11px] text-slate-500 font-normal leading-snug">
                {item.subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );

  const imagePanel = (
    <div className="w-1/2 relative bg-neutral-950 overflow-hidden min-w-0">
      {/* Static image without any hover animations or scales */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt={imageAlt}
        style={{ objectPosition: imagePosition }}
        className="w-full h-full object-cover select-none pointer-events-none"
      />
    </div>
  );

  return (
    <div className="flex flex-row items-stretch w-full min-h-[290px] sm:min-h-[380px] md:min-h-[460px] lg:min-h-[520px] xl:min-h-[560px] overflow-hidden">
      {layout === "text-left" ? (
        <>
          {textPanel}
          {imagePanel}
        </>
      ) : (
        <>
          {imagePanel}
          {textPanel}
        </>
      )}
    </div>
  );
}

export default function PromoSection() {
  return (
    <section className="w-full max-w-full overflow-hidden box-border bg-[#FAF6F0] m-0 p-0">
      {/* Row 1: ASIA (TEXT LEFT | IMAGE RIGHT) */}
      <PromoBlock
        eyebrow="SAVOR THE"
        titlePrefix="Best of Asia,"
        titleAccent="made for you."
        description="Explore a world of bold flavors and authentic recipes. From fresh sushi to hearty bowls, every bite is a journey."
        ctaText="Explore Menu"
        ctaHref="#menu"
        imageSrc="/images/promo-asian.jpg"
        imageAlt="Delicious Asian sushi rolls, nigiri, and specialties"
        imagePosition="55% center"
        layout="text-left"
        features={[
          { icon: Leaf, title: "Fresh Ingredients", subtitle: "Locally sourced" },
          { icon: ChefHat, title: "Expert Chefs", subtitle: "Passionate & skilled" },
          { icon: Heart, title: "Made with Love", subtitle: "In every dish" },
        ]}
      />

      {/* Row 2: AMERICA (IMAGE LEFT | TEXT RIGHT) - Transitions directly without divider */}
      <PromoBlock
        eyebrow="CLASSIC & CRISPY"
        titlePrefix="Best of America,"
        titleAccent="made for you."
        description="Crispy, juicy, and always satisfying. Your favorite American comfort foods, made the right way."
        ctaText="Explore Menu"
        ctaHref="#menu"
        imageSrc="/images/promo-american.png"
        imageAlt="Crispy American style tenders, wraps, and crinkle fries"
        imagePosition="45% center"
        layout="image-left"
        features={[
          { icon: Utensils, title: "Locally Sourced", subtitle: "Premium quality ingredients" },
          { icon: Flame, title: "Cooked to Order", subtitle: "Made Fresh" },
          { icon: Sparkles, title: "Signature Flavors", subtitle: "Unforgettable taste" },
        ]}
      />
    </section>
  );
}
