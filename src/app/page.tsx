"use client";

import React, { useState, useEffect, useCallback } from "react";
import StoreNavbar from "@/components/storefront/StoreNavbar";
import StoreHero from "@/components/storefront/StoreHero";
import StoreStatusBanner from "@/components/storefront/StoreStatusBanner";
import CategoryNav from "@/components/storefront/CategoryNav";
import MenuGrid from "@/components/storefront/MenuGrid";
import CartSidebar from "@/components/storefront/CartSidebar";
import MobileCartBar from "@/components/storefront/MobileCartBar";
import CartDrawer from "@/components/storefront/CartDrawer";
import StoreFooter from "@/components/storefront/StoreFooter";
import { Product, Category, RestaurantSettings } from "@/lib/types";
import { checkRestaurantOpen, RestaurantOpenStatus } from "@/lib/openingHoursHelper";
import { useCartStore } from "@/store/useCartStore";
import { Loader2, RefreshCw } from "lucide-react";

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  const reconcileCart = useCartStore(
    (state) => state.reconcileWithLatestProducts
  );

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);

      const [prodRes, catRes, setRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/categories"),
        fetch("/api/settings"),
      ]);

      const prodData = await prodRes.json();
      const catData = await catRes.json();
      const setData = await setRes.json();

      if (prodData.success && prodData.data) {
        setProducts(prodData.data);
        // Reconcile user's persisted cart with fresh product availability & pricing
        reconcileCart(prodData.data);
      } else {
        throw new Error(prodData.error || "Failed to load products");
      }

      if (catData.success && catData.data) {
        setCategories(catData.data);
      }

      if (setData.success && setData.data) {
        setSettings(setData.data);
      }
    } catch (err) {
      console.error("Storefront fetch error:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [reconcileCart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openStatus: RestaurantOpenStatus = checkRestaurantOpen(settings);
  const currency = settings?.currency || "MAD";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex flex-col justify-center items-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-orange-100 text-primary flex items-center justify-center mb-4 animate-pulse">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 font-serif">
          Preparing Love Kitchen Menu...
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Loading fresh items, prices, and daily specials
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex flex-col justify-center items-center p-6 text-center">
        <div className="max-w-md bg-white rounded-2xl border border-red-200 p-8 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            We couldn&apos;t load the menu
          </h2>
          <p className="text-xs text-slate-500 mt-2 mb-6">
            There was an issue connecting to the restaurant system. Please check your internet connection and try again.
          </p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-slate-900 flex flex-col antialiased">
      {/* 1. Navbar */}
      <StoreNavbar
        restaurantName={settings?.name || "Love Kitchen"}
        openStatus={openStatus}
        onOpenCart={() => setIsCartDrawerOpen(true)}
      />

      {/* 2. Hero Section */}
      <StoreHero restaurantName={settings?.name || "Love Kitchen"} />

      {/* 3. Restaurant Information & Live Status Banner */}
      <StoreStatusBanner settings={settings} openStatus={openStatus} />

      {/* 4. Sticky Category Tabs */}
      <CategoryNav
        categories={categories}
        activeCategoryId={activeCategoryId}
        onSelectCategory={setActiveCategoryId}
      />

      {/* 5. Main Content: 70% Menu / 30% Sticky Cart Layout */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Menu Items Grid (70% on desktop) */}
          <div className="lg:col-span-8 space-y-8">
            <MenuGrid
              products={products}
              categories={categories}
              activeCategoryId={activeCategoryId}
              currency={currency}
              isRestaurantOpen={openStatus.isOpen}
            />
          </div>

          {/* Right Column: Sticky Cart Sidebar (30% on desktop) */}
          <div className="hidden lg:block lg:col-span-4">
            <CartSidebar
              currency={currency}
              isRestaurantOpen={openStatus.isOpen}
            />
          </div>
        </div>
      </main>

      {/* 6. Mobile Bottom Floating Cart Bar */}
      <MobileCartBar
        currency={currency}
        onOpenCart={() => setIsCartDrawerOpen(true)}
      />

      {/* 7. Slide-Out Cart Drawer */}
      <CartDrawer
        isOpen={isCartDrawerOpen}
        currency={currency}
        isRestaurantOpen={openStatus.isOpen}
        onClose={() => setIsCartDrawerOpen(false)}
      />

      {/* 8. Footer (without admin links) */}
      <StoreFooter settings={settings} />
    </div>
  );
}
