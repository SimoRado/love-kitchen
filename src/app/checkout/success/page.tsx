"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ShoppingBag, Truck, ArrowLeft, Clock } from "lucide-react";
import { formatCurrency, formatTime } from "@/lib/formatters";

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || "ORD-XXXX";
  const orderType = searchParams.get("type") || "DELIVERY";
  const total = parseFloat(searchParams.get("total") || "0");
  const currency = searchParams.get("currency") || "MAD";
  const estimatedReadyAt = searchParams.get("estimatedReadyAt");
  const estimatedPrepMinutes = searchParams.get("estimatedPrepMinutes");

  return (
    <div className="min-h-screen bg-[#FAF7F0] flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl border border-[#EFE8DC] p-8 shadow-xs text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-5 shadow-xs">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-serif">
          Order Received!
        </h1>
        <p className="text-xs text-slate-500 font-normal mt-1.5 leading-relaxed">
          Your order <strong className="text-slate-900 font-semibold font-mono">#{orderNumber}</strong> has been sent to the kitchen and is being prepared.
        </p>

        {/* Estimated Ready Time Card */}
        {estimatedReadyAt && (
          <div className="my-5 p-4 bg-red-50/80 border border-red-200 rounded-2xl flex items-center justify-between text-red-950 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C8102E] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#C8102E]">
                  Ready around
                </p>
                <p className="text-base font-black text-slate-900 font-mono">
                  {formatTime(estimatedReadyAt)}
                </p>
              </div>
            </div>
            {estimatedPrepMinutes && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white border border-red-200 text-[#C8102E] shadow-2xs font-mono">
                ~{estimatedPrepMinutes} min
              </span>
            )}
          </div>
        )}

        {/* Order Details Summary Box */}
        <div className="my-5 p-4 rounded-2xl bg-[#FAF7F0] border border-[#EFE8DC] text-left space-y-2.5 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span>Order Reference:</span>
            <span className="font-semibold text-slate-900 font-mono">{orderNumber}</span>
          </div>

          <div className="flex justify-between items-center text-slate-600">
            <span>Fulfillment Method:</span>
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              {orderType === "DELIVERY" ? (
                <>
                  <Truck className="w-3.5 h-3.5 text-[#C8102E]" />
                  <span>Delivery</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 text-[#C8102E]" />
                  <span>Pickup</span>
                </>
              )}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-600 pt-2 border-t border-[#E5DDD0]">
            <span>Total Payable:</span>
            <span className="font-bold text-base text-[#C8102E] font-mono">
              {formatCurrency(total, currency)}
            </span>
          </div>
        </div>

        {/* Preparation notice */}
        <div className="p-3 bg-[#FAF7F0] border border-[#EFE8DC] rounded-xl flex items-center gap-2.5 text-slate-700 text-xs mb-6 text-left">
          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="font-normal text-[11px]">
            Our chefs are preparing your meal fresh. Pay upon delivery/pickup.
          </span>
        </div>

        {/* Action Button */}
        <Link
          href="/"
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-[#C8102E] hover:bg-[#B00D26] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
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
    <Suspense fallback={<div className="min-h-screen bg-[#FAF7F0]" />}>
      <OrderSuccessContent />
    </Suspense>
  );
}
