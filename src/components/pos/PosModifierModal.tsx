"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Check, AlertCircle, Plus, Minus } from "lucide-react";
import { Product, SelectedModifierOptionSnapshot } from "@/lib/types";
import { formatCurrency, formatModifierSelectionRule } from "@/lib/formatters";
import { roundMoney, getEffectiveProductPrice, hasActiveDiscount } from "@/lib/money";
import { getProductActiveModifierGroups } from "@/lib/constants";

interface PosModifierModalProps {
  isOpen: boolean;
  product: Product | null;
  currency?: string;
  initialSelections?: SelectedModifierOptionSnapshot[];
  initialQuantity?: number;
  isEditing?: boolean;
  onClose: () => void;
  onConfirm: (selectedModifiers: SelectedModifierOptionSnapshot[], quantity: number) => void;
}

export default function PosModifierModal({
  isOpen,
  product,
  currency = "MAD",
  initialSelections = [],
  initialQuantity = 1,
  isEditing = false,
  onClose,
  onConfirm,
}: PosModifierModalProps) {
  const [selectedMap, setSelectedMap] = useState<Map<string, SelectedModifierOptionSnapshot>>(new Map());
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- synchronize initial selections on modal open */
  useEffect(() => {
    if (!isOpen || !product) {
      setSelectedMap(new Map());
      setQuantity(1);
      setValidationError(null);
      return;
    }

    const map = new Map<string, SelectedModifierOptionSnapshot>();
    if (initialSelections && initialSelections.length > 0) {
      for (const sel of initialSelections) {
        map.set(sel.optionId, sel);
      }
    }
    setSelectedMap(map);
    setQuantity(Math.max(1, Math.floor(initialQuantity) || 1));
    setValidationError(null);
  }, [isOpen, product, initialSelections, initialQuantity]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const activeGroups = useMemo(() => {
    return getProductActiveModifierGroups(product);
  }, [product]);

  const calculatedUnitPrice = useMemo(() => {
    if (!product) return 0;
    let total = getEffectiveProductPrice(product.price, product.discountPercent);
    selectedMap.forEach((sel) => {
      total = roundMoney(total + (Number(sel.priceDelta) || 0));
    });
    return total;
  }, [product, selectedMap]);

  const safeQuantity = Math.max(1, Math.floor(quantity) || 1);
  const totalCalculated = useMemo(() => {
    return roundMoney(calculatedUnitPrice * safeQuantity);
  }, [calculatedUnitPrice, safeQuantity]);

  if (!isOpen || !product) return null;

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
        // Radio behavior: if single selection group, replace existing choice in this group
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
          // Multiple selections: Check max constraint
          let currentGroupSelectionsCount = 0;
          next.forEach((val) => {
            if (val.groupId === group.id) currentGroupSelectionsCount++;
          });

          if (currentGroupSelectionsCount >= group.maxSelections) {
            return next; // Block exceeding max limit
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
    // Validate minimum constraints across active modifier groups
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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50 shrink-0">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 leading-tight">
              {product.name}
            </h3>
            {hasActiveDiscount(product.discountPercent) ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-bold text-orange-600">
                  Base Price: {formatCurrency(getEffectiveProductPrice(product.price, product.discountPercent), currency)}
                </span>
                <span className="text-[11px] text-slate-400 line-through">
                  {formatCurrency(product.price, currency)}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black bg-orange-600 text-white">
                  -{product.discountPercent}%
                </span>
              </div>
            ) : (
              <p className="text-xs font-bold text-orange-600 mt-0.5">
                Base Price: {formatCurrency(product.price, currency)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Groups & Options */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
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
                className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs"
              >
                {/* Group Title & Rule */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <span>{group.name}</span>
                      {isGroupRequired && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-800">
                          Required
                        </span>
                      )}
                    </h4>
                    {group.description && (
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {group.description}
                      </p>
                    )}
                  </div>

                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {ruleText}
                  </span>
                </div>

                {/* Option Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {group.options.map((option) => {
                    const isSelected = selectedMap.has(option.id);
                    const isDisabled = !isSelected && isMaxReached;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleToggleOption(group, option)}
                        disabled={isDisabled}
                        className={`min-h-[50px] p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer active:scale-[0.98] ${
                          isSelected
                            ? "border-orange-600 bg-orange-50 text-slate-950 font-bold shadow-xs ring-2 ring-orange-500/20"
                            : isDisabled
                            ? "border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-${
                              group.maxSelections === 1 ? "full" : "md"
                            } border flex items-center justify-center transition-colors shrink-0 ${
                              isSelected
                                ? "bg-orange-600 border-orange-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className="text-xs sm:text-sm font-bold truncate">
                            {option.name}
                          </span>
                        </div>

                        <span
                          className={`text-xs font-extrabold shrink-0 ml-2 ${
                            option.priceDelta > 0
                              ? isSelected
                                ? "text-orange-700"
                                : "text-slate-900"
                              : "text-slate-400 font-medium"
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

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 space-y-3 shrink-0">
          {validationError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Quantity Selector */}
            <div className="flex items-center border border-slate-300 rounded-xl bg-white p-1 shrink-0">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 active:scale-95 transition-all cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center text-sm font-black text-slate-900">
                {safeQuantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 active:scale-95 transition-all cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Confirm CTA */}
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 h-12 sm:h-14 px-5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-black text-sm sm:text-base shadow-sm transition-all active:scale-[0.98] flex items-center justify-between cursor-pointer"
            >
              <span>{isEditing ? "Update Cart Item" : "Add to Order"}</span>
              <span className="bg-white/20 px-3 py-1 rounded-lg text-xs font-black">
                {formatCurrency(totalCalculated, currency)}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
