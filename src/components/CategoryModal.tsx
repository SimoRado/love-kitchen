"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Check } from "lucide-react";
import { Category } from "@/lib/types";
import { useToast } from "./ToastContext";
import { adminFetch } from "@/lib/adminFetch";

interface CategoryModalProps {
  isOpen: boolean;
  category?: Category | null;
  onClose: () => void;
  onSuccess: (savedCategory: Category, isEdit: boolean) => void;
}

export default function CategoryModal({
  isOpen,
  category,
  onClose,
  onSuccess,
}: CategoryModalProps) {
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [active, setActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const isEdit = Boolean(category);

  /* eslint-disable react-hooks/set-state-in-effect -- reset the controlled form when its target changes */
  useEffect(() => {
    if (isOpen) {
      if (category) {
        setName(category.name);
        setDisplayOrder(category.displayOrder.toString());
        setActive(category.active);
      } else {
        setName("");
        setDisplayOrder("0");
        setActive(true);
      }
      setError("");
    }
  }, [isOpen, category]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    if (isSaving) return;

    try {
      setIsSaving(true);
      const payload = {
        name: name.trim(),
        displayOrder: parseInt(displayOrder) || 0,
        active,
      };

      const url = isEdit ? `/api/categories/${category?.id}` : "/api/categories";
      const method = isEdit ? "PUT" : "POST";

      const res = await adminFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success && data.data) {
        showToast(
          isEdit ? "Category updated successfully." : "Category created successfully.",
          "success"
        );
        onSuccess(data.data, isEdit);
        onClose();
      } else {
        showToast(data.error || "Could not save category.", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={isSaving ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface rounded-2xl border border-border shadow-2xl max-w-md w-full z-10 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-subtle/50">
          <div>
            <h2 className="text-lg font-bold text-text-main">
              {isEdit ? "Edit Category" : "Add Category"}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {isEdit ? "Rename or reorder category" : "Create a new menu category"}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. Burgers, Starters, Drinks"
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                error
                  ? "border-red-400 focus:border-red-500"
                  : "border-border focus:border-primary"
              }`}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {/* Display Order */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
              Display Order
            </label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              placeholder="0"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Lower numbers appear first on your menu.
            </p>
          </div>

          {/* Active Status */}
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-main">
                Active Category
              </p>
              <p className="text-xs text-text-muted">
                {active
                  ? "Visible in menu and dashboard"
                  : "Hidden from customer menu"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                active ? "bg-primary" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  active ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-surface-subtle/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{isEdit ? "Save Changes" : "Create Category"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
