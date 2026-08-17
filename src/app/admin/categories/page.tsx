"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Tags,
  FolderTree,
  ArrowLeft,
  ChevronRight,
  UtensilsCrossed,
  Image as ImageIcon,
  Layers,
} from "lucide-react";
import CategoryModal from "@/components/CategoryModal";
import ProductModal from "@/components/ProductModal";
import ProductModifiersModal from "@/components/admin/ProductModifiersModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { Category, Product } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/components/ToastContext";

export default function CategoriesPage() {
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Category browsing view state
  const [selectedCategoryForProducts, setSelectedCategoryForProducts] = useState<Category | null>(null);

  // Category Modal states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Category Delete target
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Product Modal inside Category view states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedOptionProduct, setSelectedOptionProduct] = useState<Product | null>(null);

  // Product Delete target inside Category view
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);

  // Quick toggling availability map
  const [togglingMap, setTogglingMap] = useState<{ [id: string]: boolean }>({});

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load remote admin data after mount
    fetchCategories();
  }, [fetchCategories]);

  // Keep selectedCategoryForProducts synchronized with latest categories state
  const activeBrowsingCategory = useMemo(() => {
    if (!selectedCategoryForProducts) return null;
    return categories.find((c) => c.id === selectedCategoryForProducts.id) || selectedCategoryForProducts;
  }, [categories, selectedCategoryForProducts]);

  const handleSaveCategorySuccess = (savedCat: Category, isEdit: boolean) => {
    if (isEdit) {
      setCategories((prev) =>
        prev
          .map((c) => (c.id === savedCat.id ? { ...savedCat, products: c.products } : c))
          .sort((a, b) => a.displayOrder - b.displayOrder)
      );
    } else {
      setCategories((prev) =>
        [...prev, savedCat].sort((a, b) => a.displayOrder - b.displayOrder)
      );
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deleteTarget || isDeleting) return;

    // Check if category has products
    const productCount = deleteTarget._count?.products || deleteTarget.products?.length || 0;
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
        if (selectedCategoryForProducts?.id === deleteTarget.id) {
          setSelectedCategoryForProducts(null);
        }
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

  const handleToggleCategoryActive = async (cat: Category) => {
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

  // Product actions inside Category View
  const handleSaveProductSuccess = () => {
    fetchCategories();
  };

  const handleToggleProductAvailability = async (product: Product) => {
    if (togglingMap[product.id]) return;

    const newStatus = !product.available;
    setTogglingMap((prev) => ({ ...prev, [product.id]: true }));

    // Optimistic UI update
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        products: cat.products?.map((p) =>
          p.id === product.id ? { ...p, available: newStatus } : p
        ),
      }))
    );

    try {
      const res = await fetch(`/api/products/${product.id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          `"${product.name}" marked as ${newStatus ? "Available" : "Sold Out"}.`,
          "success"
        );
      } else {
        // Rollback
        setCategories((prev) =>
          prev.map((cat) => ({
            ...cat,
            products: cat.products?.map((p) =>
              p.id === product.id ? { ...p, available: !newStatus } : p
            ),
          }))
        );
        showToast(data.error || "Failed to update product availability", "error");
      }
    } catch {
      // Rollback
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          products: cat.products?.map((p) =>
            p.id === product.id ? { ...p, available: !newStatus } : p
          ),
        }))
      );
      showToast("Network error while updating availability", "error");
    } finally {
      setTogglingMap((prev) => ({ ...prev, [product.id]: false }));
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!deleteProductTarget || isDeletingProduct) return;

    try {
      setIsDeletingProduct(true);
      const res = await fetch(`/api/products/${deleteProductTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Product "${deleteProductTarget.name}" deleted successfully.`, "success");
        setDeleteProductTarget(null);
        fetchCategories();
      } else {
        showToast(data.error || "Could not delete product.", "error");
      }
    } catch {
      showToast("Network error while deleting product", "error");
    } finally {
      setIsDeletingProduct(false);
    }
  };

  // -------------------------------------------------------------
  // VIEW 1: CATEGORY PRODUCTS DETAIL VIEW
  // -------------------------------------------------------------
  if (activeBrowsingCategory) {
    const categoryProducts = activeBrowsingCategory.products || [];

    return (
      <div className="space-y-6">
        {/* Header & Back Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              onClick={() => setSelectedCategoryForProducts(null)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary transition-colors cursor-pointer mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Categories</span>
            </button>

            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-extrabold text-text-main tracking-tight flex items-center gap-2">
                <FolderTree className="w-6 h-6 text-primary" />
                <span>{activeBrowsingCategory.name}</span>
              </h1>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  activeBrowsingCategory.active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {activeBrowsingCategory.active ? "Active" : "Disabled"}
              </span>
              <span className="text-xs font-medium text-text-muted">
                (Display Order: {activeBrowsingCategory.displayOrder})
              </span>
            </div>

            <p className="text-sm text-text-muted">
              Managing all products currently assigned to &quot;{activeBrowsingCategory.name}&quot;
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsProductModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product to {activeBrowsingCategory.name}</span>
            </button>
          </div>
        </div>

        {/* Products Table or Empty State */}
        {categoryProducts.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            title={`No products in "${activeBrowsingCategory.name}" yet`}
            description={`This category has no products assigned. Add your first ${activeBrowsingCategory.name} item to display it on the customer storefront.`}
            actionLabel={`Add First ${activeBrowsingCategory.name} Item`}
            onAction={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
          />
        ) : (
          <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-subtle border-b border-border text-text-muted font-semibold">
                  <tr>
                    <th className="py-3 px-5">Product</th>
                    <th className="py-3 px-5">Price</th>
                    <th className="py-3 px-5">Availability</th>
                    <th className="py-3 px-5">Options & Add-ons</th>
                    <th className="py-3 px-5">Last Updated</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categoryProducts.map((product) => {
                    const isToggling = Boolean(togglingMap[product.id]);
                    const optionsCount = product.modifierGroups?.length ?? 0;

                    return (
                      <tr
                        key={product.id}
                        className="hover:bg-surface-hover/60 transition-colors"
                      >
                        {/* Product Thumbnail & Details */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 border border-border overflow-hidden shrink-0 flex items-center justify-center">
                              {product.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                      "https://placehold.co/100x100/f1f5f9/94a3b8?text=Food";
                                  }}
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-text-muted" />
                              )}
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <h4 className="font-bold text-text-main text-sm truncate">
                                {product.name}
                              </h4>
                              {product.description && (
                                <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-5 font-bold text-sm text-text-main">
                          {formatCurrency(product.price, "MAD")}
                        </td>

                        {/* Availability Toggle Switch */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleToggleProductAvailability(product)}
                              disabled={isToggling}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                                product.available ? "bg-primary" : "bg-slate-300"
                              }`}
                              title={`Click to mark as ${product.available ? "Sold Out" : "Available"}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                  product.available ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <span
                              className={`text-[11px] font-semibold ${
                                product.available ? "text-emerald-700" : "text-slate-500"
                              }`}
                            >
                              {isToggling ? "Updating..." : product.available ? "Available" : "Sold Out"}
                            </span>
                          </div>
                        </td>

                        {/* Options / Modifiers Button */}
                        <td className="py-3.5 px-5">
                          <button
                            onClick={() => setSelectedOptionProduct(product)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-main text-xs font-medium transition-colors cursor-pointer"
                            title="Manage product options and add-ons"
                          >
                            <Layers className="w-3.5 h-3.5 text-text-muted" />
                            <span>Options</span>
                            {optionsCount > 0 && (
                              <span className="bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5">
                                {optionsCount}
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-5 text-text-muted whitespace-nowrap">
                          {formatDate(product.updatedAt || product.createdAt)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Button */}
                            <button
                              onClick={() => {
                                setEditingProduct(product);
                                setIsProductModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
                              title="Edit product"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => setDeleteProductTarget(product)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete product"
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
                Total <strong>{categoryProducts.length}</strong> products in {activeBrowsingCategory.name}
              </span>
            </div>
          </div>
        )}

        {/* Product Modal for Create / Edit */}
        <ProductModal
          isOpen={isProductModalOpen}
          product={editingProduct}
          categories={categories}
          defaultCategoryId={activeBrowsingCategory.id}
          onClose={() => {
            setIsProductModalOpen(false);
            setEditingProduct(null);
          }}
          onSuccess={handleSaveProductSuccess}
        />

        {/* Product Options Modal */}
        <ProductModifiersModal
          isOpen={Boolean(selectedOptionProduct)}
          product={selectedOptionProduct}
          onClose={() => setSelectedOptionProduct(null)}
          onModifiersUpdated={fetchCategories}
        />

        {/* Delete Product Confirmation */}
        <ConfirmDialog
          isOpen={Boolean(deleteProductTarget)}
          title="Delete Product"
          message={`Are you sure you want to delete "${deleteProductTarget?.name}"? This action cannot be undone.`}
          confirmLabel="Delete Product"
          isDestructive={true}
          isLoading={isDeletingProduct}
          onConfirm={handleConfirmDeleteProduct}
          onCancel={() => setDeleteProductTarget(null)}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: CATEGORIES LIST VIEW
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main tracking-tight">
            Category Management
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Organize menu sections, view assigned products, and manage category visibility
          </p>
        </div>

        <button
          onClick={() => {
            setEditingCategory(null);
            setIsCategoryModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
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
            setIsCategoryModalOpen(true);
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
                  const productCount = cat._count?.products ?? cat.products?.length ?? 0;

                  return (
                    <tr
                      key={cat.id}
                      className="hover:bg-surface-hover/60 transition-colors group cursor-pointer"
                      onClick={() => setSelectedCategoryForProducts(cat)}
                    >
                      {/* Display Order */}
                      <td className="py-3.5 px-5 font-bold text-text-main">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                          {cat.displayOrder}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-5 font-bold text-sm text-text-main">
                        <div className="flex items-center gap-2.5">
                          <FolderTree className="w-4 h-4 text-primary shrink-0" />
                          <span className="group-hover:text-primary transition-colors">{cat.name}</span>
                          <span className="text-[10px] font-medium text-text-muted bg-slate-100 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline-flex items-center gap-1">
                            <span>Browse items</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </td>

                      {/* Linked Products Count Button */}
                      <td className="py-3.5 px-5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCategoryForProducts(cat);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                            productCount > 0
                              ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          <span>{productCount} {productCount === 1 ? "product" : "products"}</span>
                          <ChevronRight className="w-3 h-3 opacity-60" />
                        </button>
                      </td>

                      {/* Active Toggle */}
                      <td className="py-3.5 px-5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleCategoryActive(cat)}
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
                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Browse Button */}
                          <button
                            onClick={() => setSelectedCategoryForProducts(cat)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-orange-50 transition-colors cursor-pointer"
                            title="View products in category"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setIsCategoryModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
                            title="Edit category"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(cat)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
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
        isOpen={isCategoryModalOpen}
        category={editingCategory}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSuccess={handleSaveCategorySuccess}
      />

      {/* Delete Category Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Category"
        message={
          (deleteTarget?._count?.products || deleteTarget?.products?.length || 0) > 0
            ? `⚠️ Cannot delete "${deleteTarget?.name}" because it currently contains ${deleteTarget?._count?.products || deleteTarget?.products?.length} product(s). You must move or delete those products before removing this category.`
            : `Are you sure you want to delete category "${deleteTarget?.name}"?`
        }
        confirmLabel={
          (deleteTarget?._count?.products || deleteTarget?.products?.length || 0) > 0
            ? "I Understand"
            : "Delete Category"
        }
        isDestructive={!(deleteTarget?._count?.products && deleteTarget._count.products > 0)}
        isLoading={isDeleting}
        onConfirm={handleConfirmDeleteCategory}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
