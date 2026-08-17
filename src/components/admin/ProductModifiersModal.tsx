"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Layers,
} from "lucide-react";
import { Product, ProductModifierGroup, ProductModifierOption } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "../ToastContext";
import ConfirmDialog from "../ConfirmDialog";
import { roundMoney } from "@/lib/money";

interface ProductModifiersModalProps {
  isOpen: boolean;
  product: Product | null;
  currency?: string;
  onClose: () => void;
  onModifiersUpdated?: () => void;
}

export default function ProductModifiersModal({
  isOpen,
  product,
  currency = "MAD",
  onClose,
  onModifiersUpdated,
}: ProductModifiersModalProps) {
  const { showToast } = useToast();

  const [groups, setGroups] = useState<ProductModifierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Group Form state (Create or Edit)
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupRequired, setGroupRequired] = useState(false);
  const [groupMin, setGroupMin] = useState(0);
  const [groupMax, setGroupMax] = useState(1);
  const [groupActive, setGroupActive] = useState(true);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupFormError, setGroupFormError] = useState<string | null>(null);

  // New Option inline forms per group
  const [addingOptionGroupId, setAddingOptionGroupId] = useState<string | null>(null);
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionPriceDelta, setNewOptionPriceDelta] = useState<string>("0");
  const [isSavingOption, setIsSavingOption] = useState(false);

  // Edit Option state
  const [editingOption, setEditingOption] = useState<ProductModifierOption | null>(null);
  const [editOptionName, setEditOptionName] = useState("");
  const [editOptionPriceDelta, setEditOptionPriceDelta] = useState("0");

  // Deletion targets
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<ProductModifierGroup | null>(null);
  const [deleteOptionTarget, setDeleteOptionTarget] = useState<ProductModifierOption | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchModifiers = useCallback(async () => {
    if (!product) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/products/${product.id}/modifiers`);
      const data = await res.json();
      if (data.success) {
        setGroups(data.data || []);
      } else {
        showToast(data.error || "Failed to load modifiers", "error");
      }
    } catch {
      showToast("Network error loading modifiers", "error");
    } finally {
      setIsLoading(false);
    }
  }, [product, showToast]);

  /* eslint-disable react-hooks/set-state-in-effect -- load modifiers and reset transient editor state on open */
  useEffect(() => {
    if (isOpen && product) {
      fetchModifiers();
      setIsGroupFormOpen(false);
      setEditingGroupId(null);
      setAddingOptionGroupId(null);
      setEditingOption(null);
    }
  }, [isOpen, product, fetchModifiers]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen || !product) return null;

  const handleOpenCreateGroup = () => {
    setEditingGroupId(null);
    setGroupName("");
    setGroupDesc("");
    setGroupRequired(false);
    setGroupMin(0);
    setGroupMax(1);
    setGroupActive(true);
    setGroupFormError(null);
    setIsGroupFormOpen(true);
  };

  const handleOpenEditGroup = (group: ProductModifierGroup) => {
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setGroupDesc(group.description || "");
    setGroupRequired(group.required);
    setGroupMin(group.minSelections);
    setGroupMax(group.maxSelections);
    setGroupActive(group.active);
    setGroupFormError(null);
    setIsGroupFormOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupFormError(null);

    if (!groupName.trim()) {
      setGroupFormError("Group name is required.");
      return;
    }

    const min = Number(groupMin);
    const max = Number(groupMax);

    if (isNaN(min) || min < 0) {
      setGroupFormError("Minimum selections must be 0 or greater.");
      return;
    }

    if (isNaN(max) || max < 1) {
      setGroupFormError("Maximum selections must be at least 1.");
      return;
    }

    if (min > max) {
      setGroupFormError("Minimum selections cannot exceed maximum selections.");
      return;
    }

    if (groupRequired && min < 1) {
      setGroupFormError("Required groups must have a minimum selection of at least 1.");
      return;
    }

    try {
      setIsSavingGroup(true);
      if (editingGroupId) {
        // Update existing group
        const targetGroup = groups.find((g) => g.id === editingGroupId);
        const res = await fetch(`/api/products/${product.id}/modifiers`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingGroupId,
            name: groupName.trim(),
            description: groupDesc.trim() || null,
            required: groupRequired,
            minSelections: min,
            maxSelections: max,
            active: groupActive,
            options: targetGroup?.options || [],
          }),
        });

        const data = await res.json();
        if (data.success) {
          showToast("Modifier group updated successfully", "success");
          setIsGroupFormOpen(false);
          fetchModifiers();
          if (onModifiersUpdated) onModifiersUpdated();
        } else {
          setGroupFormError(data.error || "Failed to update group");
        }
      } else {
        // Create new group
        const res = await fetch(`/api/products/${product.id}/modifiers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: groupName.trim(),
            description: groupDesc.trim() || null,
            required: groupRequired,
            minSelections: min,
            maxSelections: max,
            active: groupActive,
            options: [],
          }),
        });

        const data = await res.json();
        if (data.success) {
          showToast("Modifier group created successfully", "success");
          setIsGroupFormOpen(false);
          fetchModifiers();
          if (onModifiersUpdated) onModifiersUpdated();
        } else {
          setGroupFormError(data.error || "Failed to create group");
        }
      }
    } catch {
      setGroupFormError("Network error. Please try again.");
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleToggleGroupActive = async (group: ProductModifierGroup) => {
    try {
      const res = await fetch(`/api/products/${product.id}/modifiers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: group.id,
          active: !group.active,
          options: group.options,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          `Group marked as ${!group.active ? "Active" : "Inactive"}`,
          "success"
        );
        fetchModifiers();
        if (onModifiersUpdated) onModifiersUpdated();
      } else {
        showToast(data.error || "Failed to update group status", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    try {
      setIsDeleting(true);
      const res = await fetch(
        `/api/products/${product.id}/modifiers?groupId=${deleteGroupTarget.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        showToast("Modifier group deleted", "success");
        setDeleteGroupTarget(null);
        fetchModifiers();
        if (onModifiersUpdated) onModifiersUpdated();
      } else {
        showToast(data.error || "Failed to delete modifier group", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddOption = async (groupId: string) => {
    if (!newOptionName.trim()) {
      showToast("Option name is required", "error");
      return;
    }

    const delta = parseFloat(newOptionPriceDelta);
    const validDelta = roundMoney(isNaN(delta) || delta < 0 ? 0 : delta);

    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) return;

    try {
      setIsSavingOption(true);
      const updatedOptions = [
        ...targetGroup.options,
        {
          name: newOptionName.trim(),
          priceDelta: validDelta,
          active: true,
          displayOrder: targetGroup.options.length,
        },
      ];

      const res = await fetch(`/api/products/${product.id}/modifiers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: groupId,
          options: updatedOptions,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("Option added", "success");
        setAddingOptionGroupId(null);
        setNewOptionName("");
        setNewOptionPriceDelta("0");
        fetchModifiers();
        if (onModifiersUpdated) onModifiersUpdated();
      } else {
        showToast(data.error || "Failed to add option", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setIsSavingOption(false);
    }
  };

  const handleToggleOptionActive = async (
    group: ProductModifierGroup,
    option: ProductModifierOption
  ) => {
    try {
      const updatedOptions = group.options.map((o) =>
        o.id === option.id ? { ...o, active: !o.active } : o
      );

      const res = await fetch(`/api/products/${product.id}/modifiers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: group.id,
          options: updatedOptions,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          `Option marked as ${!option.active ? "Active" : "Inactive"}`,
          "success"
        );
        fetchModifiers();
        if (onModifiersUpdated) onModifiersUpdated();
      } else {
        showToast(data.error || "Failed to update option", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleStartEditOption = (option: ProductModifierOption) => {
    setEditingOption(option);
    setEditOptionName(option.name);
    setEditOptionPriceDelta(String(option.priceDelta));
  };

  const handleSaveEditOption = async (group: ProductModifierGroup) => {
    if (!editingOption) return;
    if (!editOptionName.trim()) {
      showToast("Option name is required", "error");
      return;
    }

    const delta = parseFloat(editOptionPriceDelta);
    const validDelta = roundMoney(isNaN(delta) || delta < 0 ? 0 : delta);

    try {
      const updatedOptions = group.options.map((o) =>
        o.id === editingOption.id
          ? { ...o, name: editOptionName.trim(), priceDelta: validDelta }
          : o
      );

      const res = await fetch(`/api/products/${product.id}/modifiers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: group.id,
          options: updatedOptions,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("Option updated", "success");
        setEditingOption(null);
        fetchModifiers();
        if (onModifiersUpdated) onModifiersUpdated();
      } else {
        showToast(data.error || "Failed to update option", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleDeleteOption = async () => {
    if (!deleteOptionTarget) return;
    try {
      setIsDeleting(true);
      const res = await fetch(
        `/api/products/${product.id}/modifiers?optionId=${deleteOptionTarget.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        showToast("Option deleted", "success");
        setDeleteOptionTarget(null);
        fetchModifiers();
        if (onModifiersUpdated) onModifiersUpdated();
      } else {
        showToast(data.error || "Failed to delete option", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        {/* Modal Window */}
        <div className="relative bg-surface rounded-2xl border border-border shadow-2xl max-w-3xl w-full my-8 z-10 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-subtle/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-text-main flex items-center gap-2">
                  Product Options & Add-ons
                  <span className="text-xs font-normal text-text-muted">
                    ({product.name})
                  </span>
                </h3>
                <p className="text-xs text-text-muted">
                  Base Price: {formatCurrency(product.price, currency)} • Configure customer choices, sauces, extras, and removals.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            {/* Top Action Bar */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-text-main uppercase tracking-wider">
                  Option Groups ({groups.length})
                </span>
                <p className="text-[11px] text-text-muted">
                  Define required choices (e.g. Size, Sauces) or optional extras.
                </p>
              </div>

              {!isGroupFormOpen && (
                <button
                  type="button"
                  onClick={handleOpenCreateGroup}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-medium shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Option Group</span>
                </button>
              )}
            </div>

            {/* Create / Edit Group Form Accordion */}
            {isGroupFormOpen && (
              <form
                onSubmit={handleSaveGroup}
                className="bg-surface-subtle border border-primary/20 rounded-xl p-4 space-y-4 animate-in fade-in"
              >
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {editingGroupId ? "Edit Option Group" : "New Option Group"}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsGroupFormOpen(false)}
                    className="text-text-muted hover:text-text-main text-xs"
                  >
                    Cancel
                  </button>
                </div>

                {groupFormError && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{groupFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Group Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-text-main mb-1">
                      Group Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="e.g. Choose Your Sauces, Extras, Remove Ingredients"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Description */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-text-main mb-1">
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={groupDesc}
                      onChange={(e) => setGroupDesc(e.target.value)}
                      placeholder="e.g. Choose up to 2 sauces free with your meal"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Required & Active */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={groupRequired}
                        onChange={(e) => {
                          setGroupRequired(e.target.checked);
                          if (e.target.checked && groupMin < 1) {
                            setGroupMin(1);
                          }
                        }}
                        className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                      />
                      <span className="text-xs font-medium text-text-main">
                        Required Selection
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={groupActive}
                        onChange={(e) => setGroupActive(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                      />
                      <span className="text-xs font-medium text-text-main">Active</span>
                    </label>
                  </div>

                  {/* Min / Max Selections */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-text-main mb-1">
                        Min Selections
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={groupMin}
                        onChange={(e) => setGroupMin(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-main mb-1">
                        Max Selections
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={groupMax}
                        onChange={(e) => setGroupMax(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsGroupFormOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:bg-surface"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingGroup}
                    className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-medium shadow-xs transition-all flex items-center gap-1.5"
                  >
                    {isSavingGroup ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{editingGroupId ? "Update Group" : "Save Group"}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Groups Listing */}
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-text-muted">
                <Loader2 className="w-6 h-6 animate-spin mb-2 text-primary" />
                <span className="text-xs">Loading product options...</span>
              </div>
            ) : groups.length === 0 ? (
              <div className="py-12 text-center text-text-muted border border-dashed border-border rounded-xl">
                <Layers className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p className="text-xs font-medium text-text-main">
                  No option groups configured for this product
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Customers will be able to add this product directly to their cart without customization.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className={`rounded-xl border transition-all ${
                      group.active
                        ? "bg-surface border-border shadow-xs"
                        : "bg-surface-subtle/50 border-border/60 opacity-70"
                    }`}
                  >
                    {/* Group Header Row */}
                    <div className="p-4 flex items-center justify-between gap-3 border-b border-border/60">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-text-main">
                            {group.name}
                          </h4>
                          {group.required ? (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              Required
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-medium tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              Optional
                            </span>
                          )}
                          {!group.active && (
                            <span className="text-[10px] uppercase font-medium tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-700">
                              Inactive
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-text-muted mt-0.5">
                          Min: {group.minSelections} • Max: {group.maxSelections}
                          {group.description ? ` • ${group.description}` : ""}
                        </p>
                      </div>

                      {/* Group Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleGroupActive(group)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition-colors cursor-pointer"
                          title={group.active ? "Disable group" : "Enable group"}
                        >
                          {group.active ? (
                            <ToggleRight className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-slate-400" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditGroup(group)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
                          title="Edit group"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteGroupTarget(group)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-surface-subtle transition-colors cursor-pointer"
                          title="Delete group"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Group Options List */}
                    <div className="p-4 space-y-2.5 bg-surface-subtle/20">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                          Options ({group.options.length})
                        </span>

                        {addingOptionGroupId !== group.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setAddingOptionGroupId(group.id);
                              setNewOptionName("");
                              setNewOptionPriceDelta("0");
                            }}
                            className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Option</span>
                          </button>
                        )}
                      </div>

                      {/* Add Option Inline Form */}
                      {addingOptionGroupId === group.id && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface border border-primary/30 animate-in fade-in">
                          <input
                            type="text"
                            value={newOptionName}
                            onChange={(e) => setNewOptionName(e.target.value)}
                            placeholder="Option name (e.g. Algerian, Extra Cheese, No onions)"
                            className="flex-1 px-2.5 py-1.5 text-xs rounded border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="flex items-center gap-1 w-28">
                            <span className="text-xs text-text-muted">+</span>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={newOptionPriceDelta}
                              onChange={(e) => setNewOptionPriceDelta(e.target.value)}
                              placeholder="0"
                              className="w-full px-2 py-1.5 text-xs rounded border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-[10px] text-text-muted">MAD</span>
                          </div>

                          <button
                            type="button"
                            disabled={isSavingOption}
                            onClick={() => handleAddOption(group.id)}
                            className="p-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer shrink-0"
                            title="Save Option"
                          >
                            {isSavingOption ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setAddingOptionGroupId(null)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-text-main transition-colors cursor-pointer shrink-0"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Options rendering */}
                      {group.options.length === 0 && addingOptionGroupId !== group.id ? (
                        <p className="text-[11px] text-text-muted italic py-1">
                          No options added yet. Click &quot;Add Option&quot; above.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5">
                          {group.options.map((option) => (
                            <div
                              key={option.id}
                              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                                option.active
                                  ? "bg-surface border-border"
                                  : "bg-surface-subtle border-border/50 opacity-60"
                              }`}
                            >
                              {editingOption?.id === option.id ? (
                                /* Inline Edit Option Form */
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="text"
                                    value={editOptionName}
                                    onChange={(e) => setEditOptionName(e.target.value)}
                                    className="flex-1 px-2 py-1 text-xs rounded border border-border bg-surface"
                                  />
                                  <div className="flex items-center gap-1 w-24">
                                    <span className="text-xs text-text-muted">+</span>
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      value={editOptionPriceDelta}
                                      onChange={(e) => setEditOptionPriceDelta(e.target.value)}
                                      className="w-full px-2 py-1 text-xs rounded border border-border bg-surface"
                                    />
                                    <span className="text-[10px] text-text-muted">MAD</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditOption(group)}
                                    className="p-1 text-emerald-600 hover:text-emerald-700"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingOption(null)}
                                    className="p-1 text-text-muted hover:text-text-main"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                /* Normal Option Display */
                                <>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`font-medium ${
                                        option.active ? "text-text-main" : "text-text-muted line-through"
                                      }`}
                                    >
                                      {option.name}
                                    </span>
                                    {!option.active && (
                                      <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                        Disabled
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <span className="font-semibold text-text-main text-xs">
                                      {option.priceDelta > 0
                                        ? `+${formatCurrency(option.priceDelta, currency)}`
                                        : "Free (0.00)"}
                                    </span>

                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleOptionActive(group, option)}
                                        className="p-1 text-text-muted hover:text-text-main"
                                        title={option.active ? "Disable option" : "Enable option"}
                                      >
                                        {option.active ? (
                                          <ToggleRight className="w-4 h-4 text-emerald-600" />
                                        ) : (
                                          <ToggleLeft className="w-4 h-4 text-slate-400" />
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleStartEditOption(option)}
                                        className="p-1 text-text-muted hover:text-primary"
                                        title="Edit option"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setDeleteOptionTarget(option)}
                                        className="p-1 text-text-muted hover:text-red-600"
                                        title="Delete option"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-end bg-surface-subtle/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-surface-subtle hover:bg-surface border border-border text-xs font-semibold text-text-main transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Delete Group Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteGroupTarget)}
        title="Delete Option Group"
        message={`Are you sure you want to delete "${deleteGroupTarget?.name}"? All options within this group will also be deleted.`}
        confirmLabel="Delete Group"
        isLoading={isDeleting}
        onConfirm={handleDeleteGroup}
        onCancel={() => setDeleteGroupTarget(null)}
      />

      {/* Confirm Delete Option Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteOptionTarget)}
        title="Delete Option"
        message={`Are you sure you want to delete "${deleteOptionTarget?.name}"?`}
        confirmLabel="Delete Option"
        isLoading={isDeleting}
        onConfirm={handleDeleteOption}
        onCancel={() => setDeleteOptionTarget(null)}
      />
    </>
  );
}
