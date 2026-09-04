"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Minus, Check, AlertCircle, UtensilsCrossed } from "lucide-react";
import { Product, SelectedModifierOptionSnapshot } from "@/lib/types";
import { formatCurrency, formatModifierSelectionRule } from "@/lib/formatters";
import { roundMoney } from "@/lib/money";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { getProductActiveModifierGroups } from "@/lib/constants";

interface ProductConfigModalProps {
  isOpen: boolean;
  product: Product | null;
  currency?: string;
  initialSelections?: SelectedModifierOptionSnapshot[];
  initialQuantity?: number;
  isEditing?: boolean;
  onClose: () => void;
  onConfirm: (selectedModifiers: SelectedModifierOptionSnapshot[], quantity: number) => void;
}

export default function ProductConfigModal({
  isOpen,
  product,
  currency = "MAD",
  initialSelections = [],
  initialQuantity = 1,
  isEditing = false,
  onClose,
  onConfirm,
}: ProductConfigModalProps) {
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedMap, setSelectedMap] = useState<Map<string, SelectedModifierOptionSnapshot>>(new Map());
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isClosingRef = useRef(false);
  const isRenderedRef = useRef(false);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Lock background body scroll while modal is rendered
  useBodyScrollLock(isRendered && Boolean(product));

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const initKeyRef = useRef<string | null>(null);

  const initialSelectionsKey = useMemo(() => {
    if (!initialSelections || initialSelections.length === 0) return "";
    return initialSelections
      .map((s) => s.optionId)
      .sort()
      .join(",");
  }, [initialSelections]);

  const currentInitKey = isOpen && product
    ? `${product.id}_${isEditing ? "edit" : "new"}_${initialSelectionsKey}_${initialQuantity}`
    : null;

  useEffect(() => {
    if (!isOpen || !product) {
      initKeyRef.current = null;
      return;
    }

    if (initKeyRef.current !== currentInitKey) {
      initKeyRef.current = currentInitKey;
      const map = new Map<string, SelectedModifierOptionSnapshot>();
      if (initialSelections && initialSelections.length > 0) {
        for (const sel of initialSelections) {
          map.set(sel.optionId, sel);
        }
      }
      setSelectedMap(map);
      const safeInitialQty = Math.max(1, Math.floor(initialQuantity) || 1);
      setQuantity(safeInitialQty);
      setValidationError(null);
    }
  }, [isOpen, product, currentInitKey, initialSelections, initialQuantity]);

  const finishDismiss = useCallback(() => {
    if (!isClosingRef.current) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    isRenderedRef.current = false;
    isClosingRef.current = false;
    setIsRendered(false);
    onCloseRef.current();
  }, []);

  const handleDismiss = useCallback(() => {
    if (isClosingRef.current || !isRenderedRef.current) return;
    isClosingRef.current = true;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setIsVisible(false);

    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(finishDismiss, 350);
  }, [finishDismiss]);

  useEffect(() => {
    if (isOpen && product) {
      if (isRenderedRef.current || isClosingRef.current) return;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      isRenderedRef.current = true;
      isClosingRef.current = false;
      setIsVisible(false);
      setIsRendered(true);
    } else if (!isOpen && isRenderedRef.current) {
      handleDismiss();
    }
  }, [isOpen, product, handleDismiss]);

  useEffect(() => {
    if (!isRendered || !isOpen || !product || isClosingRef.current) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (isRenderedRef.current && !isClosingRef.current) {
          setIsVisible(true);
        }
      });
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRendered, isOpen, product]);

  const handlePanelTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "transform" && e.propertyName !== "opacity") return;

    if (!isVisible && isClosingRef.current) {
      finishDismiss();
    }
  };

  useEffect(() => {
    if (!isRendered || !isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRendered, isVisible, handleDismiss]);

  if (!isRendered || !product) return null;

  const activeGroups = getProductActiveModifierGroups(product);

  const modifiersDeltaSum = Array.from(selectedMap.values()).reduce(
    (sum, m) => sum + (Number(m.priceDelta) || 0),
    0
  );
  const unitPriceCalculated = roundMoney(product.price + modifiersDeltaSum);
  const safeQuantity = Math.max(1, Math.floor(quantity) || 1);
  const totalCalculated = roundMoney(unitPriceCalculated * safeQuantity);

  const handleToggleOption = (
    group: (typeof activeGroups)[0],
    option: (typeof activeGroups)[0]["options"][0]
  ) => {
    setValidationError(null);
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const isCurrentlySelected = next.has(option.id);

      if (isCurrentlySelected) {
        next.delete(option.id);
      } else {
        if (group.maxSelections === 1) {
          const groupKeysToDelete: string[] = [];
          next.forEach((val, key) => {
            if (val.groupId === group.id) {
              groupKeysToDelete.push(key);
            }
          });
          groupKeysToDelete.forEach((k) => next.delete(k));

          next.set(option.id, {
            groupId: group.id,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            priceDelta: roundMoney(Number(option.priceDelta) || 0),
          });
        } else {
          let currentGroupSelectionsCount = 0;
          next.forEach((val) => {
            if (val.groupId === group.id) currentGroupSelectionsCount++;
          });

          if (currentGroupSelectionsCount >= group.maxSelections) {
            return next;
          }

          next.set(option.id, {
            groupId: group.id,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            priceDelta: roundMoney(Number(option.priceDelta) || 0),
          });
        }
      }

      return next;
    });
  };

  const handleConfirm = () => {
    for (const group of activeGroups) {
      let count = 0;
      selectedMap.forEach((sel) => {
        if (sel.groupId === group.id) count++;
      });

      const effectiveMin = group.required
        ? Math.max(1, group.minSelections ?? 0)
        : (group.minSelections ?? 0);

      if (effectiveMin > 0 && count < effectiveMin) {
        setValidationError(
          effectiveMin === 1
            ? `Please choose at least 1 option for "${group.name}".`
            : `Please choose at least ${effectiveMin} options for "${group.name}".`
        );
        return;
      }

      if (count > group.maxSelections) {
        setValidationError(
          `You can choose at most ${group.maxSelections} option(s) for "${group.name}".`
        );
        return;
      }
    }

    const selectionsArray = Array.from(selectedMap.values());
    onConfirm(selectionsArray, safeQuantity);
    handleDismiss();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 overflow-hidden pointer-events-auto"
      style={{ overscrollBehavior: "contain" }}
    >
      {/* 1. Backdrop Layer */}
      <div
        style={{
          transitionProperty: "opacity",
          transitionDuration: "220ms",
          transitionTimingFunction: "ease-out",
          willChange: "opacity",
        }}
        className={`fixed inset-0 bg-slate-900/60 transition-opacity motion-reduce:transition-none ${
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleDismiss}
        onTouchMove={(e) => e.preventDefault()}
      />

      {/* 2. Positioning Wrapper */}
      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        {/* 3. Modal Panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-config-title"
          onTransitionEnd={handlePanelTransitionEnd}
          style={{
            overscrollBehavior: "contain",
            backfaceVisibility: "hidden",
            willChange: "transform, opacity",
          }}
          className={`relative transform-gpu bg-[#FAF7F0] rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90dvh] sm:max-h-[85vh] flex flex-col z-10 overflow-hidden pointer-events-auto motion-reduce:transition-none ${
            isVisible
              ? "translate-y-0 opacity-100 sm:translate-y-0 sm:opacity-100 transition-transform duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)] sm:transition-opacity sm:duration-[220ms] sm:ease-out"
              : "translate-y-full opacity-100 sm:translate-y-0 sm:opacity-0 pointer-events-none transition-transform duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)] sm:transition-opacity sm:duration-[220ms] sm:ease-out"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Top Indicator Pill */}
          <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto sm:hidden mt-2.5 mb-0.5 shrink-0" />

          {/* Fixed Header */}
          <div className="relative p-4 sm:p-5 pb-3 sm:pb-4 border-b border-slate-100 flex items-start justify-between gap-3 sm:gap-4 bg-red-50/30 shrink-0">
            <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-red-100/60 flex items-center justify-center text-[#C8102E] shrink-0">
                  <UtensilsCrossed className="w-5 h-5 sm:w-6 sm:h-6 opacity-60" />
                </div>
              )}

              <div className="min-w-0">
                <h3 id="product-config-title" className="font-bold text-base sm:text-lg text-slate-900 leading-snug truncate">
                  {product.name}
                </h3>
                <p className="text-xs font-bold text-[#C8102E] mt-0.5">
                  Base: {formatCurrency(product.price, currency)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
              aria-label="Close customization dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Groups & Options Area */}
          <div
            className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 sm:space-y-6 overscroll-contain pb-6"
            style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
          >
            {product.description && (
              <p className="text-xs text-slate-600 leading-relaxed font-normal bg-slate-50 p-3 rounded-xl border border-slate-100">
                {product.description}
              </p>
            )}

            {activeGroups.map((group) => {
              let groupSelectionsCount = 0;
              selectedMap.forEach((sel) => {
                if (sel.groupId === group.id) groupSelectionsCount++;
              });

              const isMaxReached =
                group.maxSelections > 1 && groupSelectionsCount >= group.maxSelections;

              const isGroupRequired =
                group.required || (group.minSelections !== undefined && group.minSelections > 0);

              const ruleText = formatModifierSelectionRule(
                group.minSelections ?? 0,
                group.maxSelections ?? 1,
                Boolean(group.required)
              );

              return (
                <div
                  key={group.id}
                  className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 space-y-3"
                >
                  {/* Group Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2 flex-wrap">
                        <span>{group.name}</span>
                        {isGroupRequired && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-red-100 text-[#C8102E]">
                            Required
                          </span>
                        )}
                      </h4>
                      {group.description && (
                        <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                          {group.description}
                        </p>
                      )}
                    </div>

                    <span className="text-[11px] font-medium text-slate-500 shrink-0 bg-slate-100 px-2 py-0.5 rounded">
                      {ruleText}
                    </span>
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {group.options.map((option) => {
                      const isSelected = selectedMap.has(option.id);
                      const isDisabled = !isSelected && isMaxReached;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleToggleOption(group, option)}
                          disabled={isDisabled}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none ${
                            isSelected
                              ? "border-[#C8102E] bg-red-50/60 shadow-xs"
                              : isDisabled
                              ? "border-slate-100 bg-slate-50/50 opacity-40 cursor-not-allowed"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Selection indicator */}
                            <div
                              className={`w-5 h-5 rounded-${
                                group.maxSelections === 1 ? "full" : "md"
                              } border flex items-center justify-center transition-colors shrink-0 ${
                                isSelected
                                  ? "bg-[#C8102E] border-[#C8102E] text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                            </div>

                            <span
                              className={`text-xs sm:text-sm font-medium truncate ${
                                isSelected ? "text-slate-900 font-bold" : "text-slate-700"
                              }`}
                            >
                              {option.name}
                            </span>
                          </div>

                          {/* Price Delta */}
                          <span
                            className={`text-xs font-bold shrink-0 ml-2 ${
                              option.priceDelta > 0
                                ? isSelected
                                  ? "text-[#C8102E]"
                                  : "text-slate-800"
                                : "text-slate-400 font-normal"
                            }`}
                          >
                            {option.priceDelta > 0
                              ? `+${formatCurrency(option.priceDelta, currency)}`
                              : "Free"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fixed Footer Bar */}
          <div className="p-3.5 sm:p-5 border-t border-[#E5DDD0] bg-[#FAF7F0] space-y-2.5 sm:space-y-3 shrink-0">
            {validationError && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              {/* Quantity Selector */}
              <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, (Math.floor(q) || 1) - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 active:scale-95 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center text-xs font-bold text-slate-800">
                  {safeQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => (Math.floor(q) || 1) + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 active:scale-95 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Confirm / Add to Cart CTA */}
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3 px-4 rounded-xl bg-[#C8102E] hover:bg-[#B00D26] text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-98 flex items-center justify-between cursor-pointer focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:outline-none"
              >
                <span>{isEditing ? "Update Order Item" : "Add to Order"}</span>
                <span className="bg-white/20 px-2.5 py-1 rounded-lg text-xs font-bold">
                  {formatCurrency(totalCalculated, currency)}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
