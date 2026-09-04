"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  ShoppingBag,
  User,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { RestaurantSettings } from "@/lib/types";
import { checkRestaurantOpen, RestaurantOpenStatus } from "@/lib/openingHoursHelper";
import { formatCurrency, formatTime } from "@/lib/formatters";
import { calculateOrderTotals } from "@/lib/money";

export default function CheckoutPage() {
  const router = useRouter();

  const {
    items,
    orderType,
    customerInfo,
    setOrderType,
    setCustomerInfo,
    clearCart,
    reconcileWithLatestProducts,
    hasUnavailableItems,
    hasHydrated,
  } = useCartStore();

  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [prepEstimate, setPrepEstimate] = useState<{
    estimatedPrepMinutes: number;
    estimatedReadyAt: string;
  } | null>(null);

  // Form Fields
  const [name, setName] = useState(customerInfo.customerName || "");
  const [phone, setPhone] = useState(customerInfo.customerPhone || "");
  const [address, setAddress] = useState(customerInfo.customerAddress || "");
  const [allergies, setAllergies] = useState(customerInfo.allergies || "");
  const [notes, setNotes] = useState(customerInfo.notes || "");
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const submissionLock = React.useRef(false);
  const idempotencyKey = React.useRef<string | null>(null);

  // Ensure checkout page always opens at the top (scrollY = 0) on initial navigation
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      const raf = requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      });
      return () => cancelAnimationFrame(raf);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- synchronize form defaults after persisted cart hydration */
  useEffect(() => {
    if (!hasHydrated) return;
    setName(customerInfo.customerName || "");
    setPhone(customerInfo.customerPhone || "");
    setAddress(customerInfo.customerAddress || "");
    setAllergies(customerInfo.allergies || "");
    setNotes(customerInfo.notes || "");
  }, [
    hasHydrated,
    customerInfo.customerName,
    customerInfo.customerPhone,
    customerInfo.customerAddress,
    customerInfo.allergies,
    customerInfo.notes,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const loadData = useCallback(async () => {
    try {
      const [setRes, prodRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/products"),
      ]);

      const setData = await setRes.json();
      const prodData = await prodRes.json();

      if (setData.success && setData.data) {
        setSettings(setData.data);
      }

      if (prodData.success && prodData.data) {
        reconcileWithLatestProducts(prodData.data);
      }
    } catch (err) {
      console.error("Error loading checkout data:", err);
    }
  }, [reconcileWithLatestProducts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load authoritative checkout data after mount
    loadData();
  }, [loadData]);

  // Dynamic Kitchen Preparation Time Estimation
  useEffect(() => {
    let isCancelled = false;

    if (items.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear estimate when empty
      setPrepEstimate(null);
      return;
    }

    const payload = {
      orderType,
      items: items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
      })),
    };

    fetch("/api/orders/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data.success && data.data) {
          setPrepEstimate(data.data);
        }
      })
      .catch((err) => {
        console.error("Estimation fetch error:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [items, orderType]);

  const openStatus: RestaurantOpenStatus = checkRestaurantOpen(settings);
  const currency = settings?.currency || "MAD";
  const settingsDeliveryFee = settings?.deliveryFee ?? 15;

  const { subtotal, deliveryFee, total } = calculateOrderTotals(
    items,
    orderType,
    settingsDeliveryFee
  );

  const hasUnavailable = hasUnavailableItems();

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!name.trim()) {
      errors.name = "Please enter your full name.";
    }

    if (!phone.trim()) {
      errors.phone = "Please enter your phone number.";
    } else {
      const cleanPhone = phone.replace(/[\s\-().]/g, "");
      if (cleanPhone.length < 8) {
        errors.phone = "Please enter a valid contact phone number.";
      }
    }

    if (orderType === "DELIVERY" && !address.trim()) {
      errors.address = "Please enter your delivery street address.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionLock.current || isSubmitting) return;

    setErrorMessage("");

    if (!openStatus.isOpen) {
      setErrorMessage(
        "The restaurant is currently closed. Orders cannot be placed right now."
      );
      return;
    }

    if (hasUnavailable) {
      setErrorMessage(
        "One or more items in your cart are currently sold out. Please remove them to continue."
      );
      return;
    }

    if (!validateForm()) {
      return;
    }

    // Save customer info to persistent cart store
    setCustomerInfo({
      customerName: name.trim(),
      customerPhone: phone.trim(),
      customerAddress: orderType === "DELIVERY" ? address.trim() : "",
      allergies: allergies.trim(),
      notes: notes.trim(),
    });

    try {
      submissionLock.current = true;
      setIsSubmitting(true);

      if (!idempotencyKey.current) {
        idempotencyKey.current = `web-${crypto.randomUUID()}`;
      }

      // Map cart items into the robust order submission payload
      const orderPayload = {
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerAddress: orderType === "DELIVERY" ? address.trim() : null,
        allergies: allergies.trim() || null,
        notes: notes.trim() || null,
        orderType,
        total,
        idempotencyKey: idempotencyKey.current,
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          selectedModifierOptionIds: item.selectedModifiers.map((m) => m.optionId),
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // If items are unavailable, refresh products list
        if (res.status === 409) {
          const prodRes = await fetch("/api/products");
          const prodData = await prodRes.json();
          if (prodData.success && prodData.data) {
            reconcileWithLatestProducts(prodData.data);
          }
        }
        throw new Error(data.error || "Failed to submit your order. Please try again.");
      }

      // Clear cart on successful order creation
      clearCart();
      submissionLock.current = false;

      // Navigate to order success screen
      const orderNumber = data.data.orderNumber;
      const readyAt = data.data.estimatedReadyAt || "";
      const prepMin = data.data.estimatedPrepMinutes || "";
      router.push(
        `/checkout/success?orderNumber=${encodeURIComponent(
          orderNumber
        )}&type=${orderType}&total=${total}&currency=${encodeURIComponent(
          currency
        )}&estimatedReadyAt=${encodeURIComponent(
          readyAt
        )}&estimatedPrepMinutes=${encodeURIComponent(prepMin)}`
      );
    } catch (err) {
      console.error("Order submit error:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again."
      );
      submissionLock.current = false;
      idempotencyKey.current = null;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#C8102E]" aria-label="Loading cart" />
      </div>
    );
  }

  if (items.length === 0 && !isSubmitting) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col justify-center items-center p-6 text-center">
        <div className="max-w-md bg-white rounded-2xl border border-[#EFE8DC] p-8 shadow-xs">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 font-serif">
            Your Cart is Empty
          </h2>
          <p className="text-xs text-slate-500 font-normal mt-1 mb-6">
            You don&apos;t have any dishes in your cart to checkout.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C8102E] hover:bg-[#B00D26] text-white text-xs font-bold shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Menu</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-slate-900 flex flex-col antialiased">
      {/* Checkout Navbar: Solid Red Bar */}
      <header className="sticky top-0 z-30 bg-[#C8102E] text-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-white hover:text-white/80 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none rounded py-1 px-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </Link>

          <span className="font-bold text-base text-white font-serif">
            {settings?.name || "Love Kitchen"} • Checkout
          </span>

          <div className="w-16" />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Closed Restaurant Alert */}
        {!openStatus.isOpen && (
          <div className="mb-6 p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-amber-950">
                The restaurant is currently closed.
              </p>
              <p className="text-amber-800 font-normal mt-0.5">
                Orders cannot be placed right now. {openStatus.statusDetail}.
              </p>
            </div>
          </div>
        )}

        {/* Unavailable items alert */}
        {hasUnavailable && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-900">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-red-950">
                Sold Out item in your cart
              </p>
              <p className="text-red-800 font-normal mt-0.5">
                One or more dishes in your cart are no longer available. Please return to the menu and remove them to complete your order.
              </p>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-900">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-red-800">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Fulfillment & Customer Details (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Fulfillment Type Selection */}
            <div className="bg-white rounded-2xl border border-[#EFE8DC] p-5 sm:p-6 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                1. Order Fulfillment
              </h2>

              <div className="grid grid-cols-2 gap-3">
                {/* Delivery */}
                <button
                  type="button"
                  onClick={() => setOrderType("DELIVERY")}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none ${
                    orderType === "DELIVERY"
                      ? "border-[#C8102E] bg-red-50/50 ring-2 ring-[#C8102E]/20"
                      : "border-[#EFE8DC] hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Truck
                      className={`w-5 h-5 ${
                        orderType === "DELIVERY"
                          ? "text-[#C8102E]"
                          : "text-slate-400"
                      }`}
                    />
                    {orderType === "DELIVERY" && (
                      <CheckCircle2 className="w-4 h-4 text-[#C8102E]" />
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-bold text-slate-900">Delivery</p>
                    <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                      Fee: {formatCurrency(settingsDeliveryFee, currency)}
                    </p>
                  </div>
                </button>

                {/* Pickup */}
                <button
                  type="button"
                  onClick={() => setOrderType("PICKUP")}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none ${
                    orderType === "PICKUP"
                      ? "border-[#C8102E] bg-red-50/50 ring-2 ring-[#C8102E]/20"
                      : "border-[#EFE8DC] hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <ShoppingBag
                      className={`w-5 h-5 ${
                        orderType === "PICKUP"
                          ? "text-[#C8102E]"
                          : "text-slate-400"
                      }`}
                    />
                    {orderType === "PICKUP" && (
                      <CheckCircle2 className="w-4 h-4 text-[#C8102E]" />
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-bold text-slate-900">Pickup</p>
                    <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
                      Free (0.00)
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Customer Contact Information */}
            <div className="bg-white rounded-2xl border border-[#EFE8DC] p-5 sm:p-6 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                2. Customer Information
              </h2>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Your Full Name <span className="text-[#C8102E]">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (formErrors.name) setFormErrors({ ...formErrors, name: "" });
                      }}
                      placeholder="e.g. Sarah Mansouri"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 transition-colors ${
                        formErrors.name
                          ? "border-red-400 focus:border-red-500"
                          : "border-[#EFE8DC] focus:border-[#C8102E]"
                      }`}
                    />
                  </div>
                  {formErrors.name && (
                    <p className="text-[11px] text-red-500 mt-1">{formErrors.name}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Phone Number <span className="text-[#C8102E]">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (formErrors.phone) setFormErrors({ ...formErrors, phone: "" });
                      }}
                      placeholder="e.g. +212 661 123456"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 transition-colors ${
                        formErrors.phone
                          ? "border-red-400 focus:border-red-500"
                          : "border-[#EFE8DC] focus:border-[#C8102E]"
                      }`}
                    />
                  </div>
                  {formErrors.phone && (
                    <p className="text-[11px] text-red-500 mt-1">{formErrors.phone}</p>
                  )}
                </div>

                {/* Delivery Address (only for Delivery) */}
                {orderType === "DELIVERY" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Delivery Street Address <span className="text-[#C8102E]">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <textarea
                        rows={2}
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          if (formErrors.address) setFormErrors({ ...formErrors, address: "" });
                        }}
                        placeholder="Street, building, apartment/floor number..."
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 transition-colors resize-none ${
                          formErrors.address
                            ? "border-red-400 focus:border-red-500"
                            : "border-[#EFE8DC] focus:border-[#C8102E]"
                        }`}
                      />
                    </div>
                    {formErrors.address && (
                      <p className="text-[11px] text-red-500 mt-1">{formErrors.address}</p>
                    )}
                  </div>
                )}

                {/* Allergies */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Allergies (Optional)
                  </label>
                  <div className="relative">
                    <AlertCircle className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <textarea
                      rows={2}
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      placeholder="e.g. peanuts, dairy, shellfish..."
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#EFE8DC] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] transition-colors resize-none"
                    />
                  </div>
                </div>

                {/* Order Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Special Instructions / Notes (Optional)
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Extra napkins, please do not ring the bell..."
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#EFE8DC] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Placement (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white rounded-2xl border border-[#EFE8DC] p-5 sm:p-6 shadow-xs space-y-4 sticky top-24">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-3 border-b border-slate-100">
                Order Summary
              </h2>

              {/* Items List */}
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto space-y-2.5 py-1">
                {items.map((item) => {
                  const { product, quantity, selectedModifiers = [], configuredUnitPrice } = item;
                  const itemTotal = configuredUnitPrice * quantity;

                  const groupedModifiers: { [groupName: string]: string[] } = {};
                  for (const mod of selectedModifiers) {
                    if (!groupedModifiers[mod.groupName]) {
                      groupedModifiers[mod.groupName] = [];
                    }
                    groupedModifiers[mod.groupName].push(
                      `${mod.optionName}${
                        mod.priceDelta > 0
                          ? ` (+${formatCurrency(mod.priceDelta, currency)})`
                          : ""
                      }`
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="pt-2.5 first:pt-0 flex items-start justify-between text-xs gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-800">
                          {quantity}× {product.name}
                        </span>
                        <span className="block text-[11px] text-slate-500 font-normal">
                          {formatCurrency(configuredUnitPrice, currency)} each
                        </span>

                        {selectedModifiers.length > 0 && (
                          <div className="mt-1 space-y-0.5 text-[11px] text-slate-600 bg-[#FAF7F0] p-2 rounded-lg border border-[#EFE8DC]">
                            {Object.entries(groupedModifiers).map(([groupName, optionsList]) => (
                              <p key={groupName} className="leading-snug">
                                <span className="font-medium text-slate-700">{groupName}: </span>
                                <span className="text-slate-600 font-normal">{optionsList.join(", ")}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      <span className="font-bold text-slate-900 shrink-0">
                        {formatCurrency(itemTotal, currency)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Kitchen Preparation Estimate */}
              {prepEstimate && (
                <div className="bg-red-50/70 border border-red-200/80 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-red-950">
                      <Clock className="w-3.5 h-3.5 text-[#C8102E] shrink-0" />
                      <span>Ready by {formatTime(prepEstimate.estimatedReadyAt)}</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#C8102E] bg-white px-2 py-0.5 rounded-md border border-red-200 shadow-2xs font-mono">
                      ~{prepEstimate.estimatedPrepMinutes} min
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Estimated kitchen preparation time.
                  </p>
                </div>
              )}

              {/* Pricing Breakdown */}
              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(subtotal, currency)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>{orderType === "DELIVERY" ? "Delivery" : "Pickup"}</span>
                  <span className="font-bold text-slate-900">
                    {orderType === "DELIVERY"
                      ? formatCurrency(deliveryFee, currency)
                      : formatCurrency(0, currency)}
                  </span>
                </div>

                <div className="flex justify-between text-sm font-bold text-slate-900 pt-3 border-t border-slate-200">
                  <span>Total Amount</span>
                  <span className="text-[#C8102E] font-bold text-base">
                    {formatCurrency(total, currency)}
                  </span>
                </div>
              </div>

              {/* Place Order CTA Button */}
              <button
                type="submit"
                disabled={isSubmitting || !openStatus.isOpen || hasUnavailable}
                className={`w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl font-bold text-xs shadow-xs transition-all text-white cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none ${
                  isSubmitting || !openStatus.isOpen || hasUnavailable
                    ? "bg-slate-300 cursor-not-allowed opacity-70"
                    : "bg-[#C8102E] hover:bg-[#B00D26] active:scale-98"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Order...</span>
                  </>
                ) : !openStatus.isOpen ? (
                  <span>Restaurant Currently Closed</span>
                ) : hasUnavailable ? (
                  <span>Remove Sold-Out Dishes</span>
                ) : (
                  <span>Place Order Now • {formatCurrency(total, currency)}</span>
                )}
              </button>

              <p className="text-[11px] text-slate-400 font-normal text-center">
                Payment is made upon delivery / pickup.
              </p>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
