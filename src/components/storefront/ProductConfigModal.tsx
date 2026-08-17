"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Minus, Check, AlertCircle, UtensilsCrossed } from "lucide-react";
import { Product, SelectedModifierOptionSnapshot } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";
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

function formatSelectionRule(min: number, max: number, required: boolean): string {
  const effectiveMin = required ? Math.max(1, min) : min;
  if (effectiveMin === 0 && max === 1) return "Choose up to 1";
  if (effectiveMin === 1 && max === 1) return "Choose 1";
  if (effectiveMin === max) return `Choose exactly ${max}`;
  if (effectiveMin === 0) return `Choose up to ${max}`;
  return `Choose ${effectiveMin}–${max}`;
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
  const [mounted, setMounted] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedMap, setSelectedMap] = useState<Map<string, SelectedModifierOptionSnapshot>>(new Map());
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isClosingRef = useRef(false);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);

  // Lock background body scroll while modal is rendered (open or animating out)
  useBodyScrollLock(isRendered && Boolean(product));

  useEffect(() => {
    setMounted(true);
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Stable initialization key tracking to prevent infinite render loops and accidental state resets
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

  // Smooth dismiss handler with exit transition
  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setIsVisible(false);

    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => {
      setIsRendered(false);
      isClosingRef.current = false;
      onClose();
    }, 380);
  }, [onClose]);

  // Deterministic mount -> paint closed state -> animate open on next frame
  const productId = product?.id;
  useEffect(() => {
    if (isOpen && productId) {
      isClosingRef.current = false;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      // 1. Mount in closed initial state
      setIsRendered(true);
      setIsVisible(false);

      // 2. Allow browser to paint initial state, then transition to open
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else if (!isOpen && isRendered) {
      handleDismiss();
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, productId]); // Stable dependencies

  const handlePanelTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "transform" && e.propertyName !== "opacity") return;

    if (!isVisible && isClosingRef.current) {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      setIsRendered(false);
      isClosingRef.current = false;
      onClose();
    }
  };

  // Escape key listener
  useEffect(() => {
    if (!isRendered || !isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const activeEl = document.activeElement;
        const isTyping =
          activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement ||
          activeEl?.getAttribute("contenteditable") === "true";
        if (!isTyping) {
          handleDismiss();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRendered, isVisible, handleDismiss]);

  // Active modifier groups sorted by display order
  const activeGroups = useMemo(() => {
    return getProductActiveModifierGroups(product);
  }, [product]);

  // Pricing calculations
  const calculatedUnitPrice = useMemo(() => {
    if (!product) return 0;
    let total = product.price;
    selectedMap.forEach((sel) => {
      total = roundMoney(total + (Number(sel.priceDelta) || 0));
    });
    return total;
  }, [product, selectedMap]);

  const safeQuantity = Math.max(1, Math.floor(quantity) || 1);

  const totalCalculated = useMemo(() => {
    return roundMoney(calculatedUnitPrice * safeQuantity);
  }, [calculatedUnitPrice, safeQuantity]);

  if (!isRendered || !product || !mounted) return null;

  const handleToggleOption = (
    group: { id: string; name: string; maxSelections: number; required?: boolean },
    option: { id: string; name: string; priceDelta: number }
  ) => {
    setValidationError(null);

    setSelectedMap((prev) => {
      const next = new Map(prev);
      const isAlreadySelected = next.has(option.id);

      if (isAlreadySelected) {
        next.delete(option.id);
      } else {
        // Single selection group (radio behavior): Replace existing selection in this group
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
          // Multiple selections: Check max constraints
          let currentGroupSelectionsCount = 0;
          next.forEach((val) => {
            if (val.groupId === group.id) currentGroupSelectionsCount++;
          });

          if (currentGroupSelectionsCount >= group.maxSelections) {
            return next; // Block exceeding max selections
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
    // Validate minimum and maximum selection constraints across all active groups
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
      {/* 1. Backdrop Layer (Transitions opacity only with backdrop blur) */}
      <div
        style={{
          transitionProperty: "opacity",
          transitionDuration: "220ms",
          transitionTimingFunction: "ease-out",
        }}
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity motion-reduce:transition-none ${
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleDismiss}
        onTouchMove={(e) => e.preventDefault()}
      />

      {/* 2. Static Centering Wrapper (Never transforms, strictly manages positioning) */}
      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        {/* 3. Animated Inner Modal Panel */}
        <div
          onTransitionEnd={handlePanelTransitionEnd}
          style={{
            overscrollBehavior: "contain",
            backfaceVisibility: "hidden",
          }}
          className={`relative bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90dvh] sm:max-h-[85vh] flex flex-col z-10 overflow-hidden pointer-events-auto motion-reduce:transition-none ${
            isVisible
              ? "translate-y-0 opacity-100 sm:translate-y-0 sm:opacity-100 transition-transform duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)] sm:transition-opacity sm:duration-[220ms] sm:ease-out"
              : "translate-y-full opacity-100 sm:translate-y-0 sm:opacity-0 pointer-events-none transition-transform duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)] sm:transition-opacity sm:duration-[220ms] sm:ease-out"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Top Indicator Pill */}
          <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto sm:hidden mt-2.5 mb-0.5 shrink-0" />

          {/* Fixed Header */}
          <div className="relative p-4 sm:p-5 pb-3 sm:pb-4 border-b border-slate-100 flex items-start justify-between gap-3 sm:gap-4 bg-orange-50/30 shrink-0">
            <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-orange-100/60 flex items-center justify-center text-primary shrink-0">
                  <UtensilsCrossed className="w-5 h-5 sm:w-6 sm:h-6 opacity-60" />
                </div>
              )}

              <div className="min-w-0">
                <h3 className="font-semibold text-base sm:text-lg text-slate-900 leading-snug truncate">
                  {product.name}
                </h3>
                <p className="text-xs font-semibold text-primary mt-0.5">
                  Base: {formatCurrency(product.price, currency)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
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
              <p className="text-xs text-slate-500 leading-relaxed font-normal bg-slate-50 p-3 rounded-xl border border-slate-100">
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

              const ruleText = formatSelectionRule(
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
                      <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2 flex-wrap">
                        <span>{group.name}</span>
                        {isGroupRequired && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
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
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[44px] ${
                            isSelected
                              ? "border-primary bg-orange-50/60 shadow-xs"
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
                                  ? "bg-primary border-primary text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                            </div>

                            <span
                              className={`text-xs sm:text-sm font-medium truncate ${
                                isSelected ? "text-slate-900 font-semibold" : "text-slate-700"
                              }`}
                            >
                              {option.name}
                            </span>
                          </div>

                          {/* Price Delta */}
                          <span
                            className={`text-xs font-semibold shrink-0 ml-2 ${
                              option.priceDelta > 0
                                ? isSelected
                                ? "text-primary"
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

        {/* Fixed Footer Bar: Validation message, quantity, and live total CTA */}
        <div className="p-3.5 sm:p-5 border-t border-slate-100 bg-white space-y-2.5 sm:space-y-3 shrink-0">
          {validationError && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-in fade-in">
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
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 active:scale-95 transition-all cursor-pointer"
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
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 active:scale-95 transition-all cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Confirm / Add to Cart CTA */}
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-xs sm:text-sm shadow-md transition-all active:scale-98 flex items-center justify-between cursor-pointer"
            >
              <span>{isEditing ? "Update Cart Item" : "Add to Cart"}</span>
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
