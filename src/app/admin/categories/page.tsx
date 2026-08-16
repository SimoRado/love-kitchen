"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Tags,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FolderTree,
} from "lucide-react";
import CategoryModal from "@/components/CategoryModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { Category } from "@/lib/types";
import { useToast } from "@/components/ToastContext";

export default function CategoriesPage() {
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Delete target
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.success) {
        setCategories(data.data || []);
      } else {
        showToast(data.error || "Failed to load categories", "error");
      }
    } catch {
      showToast("Network error loading categories", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSaveSuccess = (savedCat: Category, isEdit: boolean) => {
    if (isEdit) {
      setCategories((prev) =>
        prev
          .map((c) => (c.id === savedCat.id ? savedCat : c))
          .sort((a, b) => a.displayOrder - b.displayOrder)
      );
    } else {
      setCategories((prev) =>
        [...prev, savedCat].sort((a, b) => a.displayOrder - b.displayOrder)
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    // Check if category has products
    const productCount = deleteTarget._count?.products || 0;
    if (productCount > 0) {
      showToast(
        `Cannot delete "${deleteTarget.name}" because it contains ${productCount} product(s). Reassign or delete those products first.`,
        "error"
      );
      setDeleteTarget(null);
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/categories/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Category "${deleteTarget.name}" deleted successfully.`, "success");
        setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        showToast(data.error || "Could not delete category.", "error");
      }
    } catch {
      showToast("Network error while deleting category", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    const newActive = !cat.active;

    // Optimistic update
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, active: newActive } : c))
    );

    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cat.name,
          displayOrder: cat.displayOrder,
          active: newActive,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          `Category "${cat.name}" is now ${newActive ? "Active" : "Disabled"}.`,
          "success"
        );
      } else {
        // Rollback
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, active: !newActive } : c))
        );
        showToast(data.error || "Failed to update category status", "error");
      }
    } catch {
      // Rollback
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, active: !newActive } : c))
      );
      showToast("Network error updating category status", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main tracking-tight">
            Category Management
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Organize menu sections, display priority, and visibility for customer ordering
          </p>
        </div>

        <button
          onClick={() => {
            setEditingCategory(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <LoadingState message="Loading categories..." />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Create categories like Burgers, Pizza, Drinks, and Desserts to structure your food menu."
          actionLabel="Create First Category"
          onAction={() => {
            setEditingCategory(null);
            setIsModalOpen(true);
          }}
        />
      ) : (
        <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle border-b border-border text-text-muted font-semibold">
                <tr>
                  <th className="py-3 px-5 w-24">Order</th>
                  <th className="py-3 px-5">Category Name</th>
                  <th className="py-3 px-5">Linked Products</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((cat) => {
                  const productCount = cat._count?.products ?? 0;

                  return (
                    <tr
                      key={cat.id}
                      className="hover:bg-surface-hover/60 transition-colors"
                    >
                      {/* Display Order */}
                      <td className="py-3.5 px-5 font-bold text-text-main">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                          {cat.displayOrder}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-5 font-bold text-sm text-text-main">
                        <div className="flex items-center gap-2">
                          <FolderTree className="w-4 h-4 text-primary" />
                          <span>{cat.name}</span>
                        </div>
                      </td>

                      {/* Linked Products Count */}
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            productCount > 0
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {productCount} {productCount === 1 ? "product" : "products"}
                        </span>
                      </td>

                      {/* Active Toggle */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(cat)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              cat.active ? "bg-primary" : "bg-slate-300"
                            }`}
                            title={`Click to mark as ${cat.active ? "Disabled" : "Active"}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                cat.active ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                          <span
                            className={`text-[11px] font-semibold ${
                              cat.active ? "text-emerald-700" : "text-slate-500"
                            }`}
                          >
                            {cat.active ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit */}
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                            title="Edit category"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(cat)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-border bg-surface-subtle/50 text-xs text-text-muted flex justify-between items-center">
            <span>
              Total <strong>{categories.length}</strong> categories configured
            </span>
          </div>
        </div>
      )}

      {/* Add / Edit Category Modal */}
      <CategoryModal
        isOpen={isModalOpen}
        category={editingCategory}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCategory(null);
        }}
        onSuccess={handleSaveSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Category"
        message={
          (deleteTarget?._count?.products || 0) > 0
            ? `⚠️ Cannot delete "${deleteTarget?.name}" because it currently contains ${deleteTarget?._count?.products} product(s). You must move or delete those products before removing this category.`
            : `Are you sure you want to delete category "${deleteTarget?.name}"?`
        }
        confirmLabel={
          (deleteTarget?._count?.products || 0) > 0
            ? "I Understand"
            : "Delete Category"
        }
        isDestructive={!(deleteTarget?._count?.products && deleteTarget._count.products > 0)}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
