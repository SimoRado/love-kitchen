"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ShoppingBag, Truck, ArrowLeft, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || "ORD-XXXX";
  const orderType = searchParams.get("type") || "DELIVERY";
  const total = parseFloat(searchParams.get("total") || "0");
  const currency = searchParams.get("currency") || "MAD";

  return (
    <div className="min-h-screen bg-[#FFFDF9] flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl border border-[#EBE3D5] p-8 shadow-xs text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-5 shadow-xs">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-serif">
          Order Received!
        </h1>
        <p className="text-xs text-slate-500 font-normal mt-1.5 leading-relaxed">
          Your order <strong className="text-slate-900 font-semibold">#{orderNumber}</strong> has been sent to the kitchen and is being prepared.
        </p>

        {/* Order Details Summary Box */}
        <div className="my-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left space-y-2.5 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span>Order Reference:</span>
            <span className="font-semibold text-slate-900">{orderNumber}</span>
          </div>

          <div className="flex justify-between items-center text-slate-600">
            <span>Fulfillment Method:</span>
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              {orderType === "DELIVERY" ? (
                <>
                  <Truck className="w-3.5 h-3.5 text-primary" />
                  <span>Delivery</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                  <span>Pickup</span>
                </>
              )}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-600 pt-2 border-t border-slate-200">
            <span>Total Payable:</span>
            <span className="font-semibold text-base text-primary">
              {formatCurrency(total, currency)}
            </span>
          </div>
        </div>

        {/* Preparation notice */}
        <div className="p-3 bg-orange-50/70 border border-orange-100 rounded-xl flex items-center gap-2.5 text-orange-950 text-xs mb-6 text-left">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          <span className="font-normal">Our chefs are preparing your meal fresh. Pay upon delivery/pickup.</span>
        </div>

        {/* Action Button */}
        <Link
          href="/"
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Restaurant Menu</span>
        </Link>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFFDF9]" />}>
      <OrderSuccessContent />
    </Suspense>
  );
}
