"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  UtensilsCrossed,
  Image as ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import ProductModal from "@/components/ProductModal";
import ProductModifiersModal from "@/components/admin/ProductModifiersModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { Product, Category } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/components/ToastContext";

export default function ProductsPage() {
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedAvailability, setSelectedAvailability] = useState("ALL");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedModifierProduct, setSelectedModifierProduct] = useState<Product | null>(null);

  // Delete confirmation
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick toggling availability loading map
  const [togglingMap, setTogglingMap] = useState<{ [id: string]: boolean }>({});

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [prodRes, catRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/categories"),
      ]);

      const prodData = await prodRes.json();
      const catData = await catRes.json();

      if (prodData.success) {
        setProducts(prodData.data || []);
      } else {
        showToast(prodData.error || "Failed to load products", "error");
      }

      if (catData.success) {
        setCategories(catData.data || []);
      }
    } catch {
      showToast("Network error loading products", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered Products Memo
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategory !== "ALL" && p.categoryId !== selectedCategory) {
        return false;
      }
      // Availability filter
      if (selectedAvailability === "AVAILABLE" && !p.available) return false;
      if (selectedAvailability === "SOLDOUT" && p.available) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesDesc = (p.description || "").toLowerCase().includes(query);
        const matchesCategory = (p.category?.name || "").toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesCategory) return false;
      }

      return true;
    });
  }, [products, selectedCategory, selectedAvailability, searchQuery]);

  // Handle Quick Availability Toggle
  const handleToggleAvailability = async (product: Product) => {
    if (togglingMap[product.id]) return;

    const newStatus = !product.available;
    setTogglingMap((prev) => ({ ...prev, [product.id]: true }));

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, available: newStatus } : p))
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
          `"${product.name}" marked as ${newStatus ? "Available" : "Sold Out"}`,
          "success"
        );
      } else {
        // Rollback
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, available: !newStatus } : p))
        );
        showToast(data.error || "Failed to update availability", "error");
      }
    } catch {
      // Rollback
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, available: !newStatus } : p))
      );
      showToast("Network error updating product availability", "error");
    } finally {
      setTogglingMap((prev) => ({ ...prev, [product.id]: false }));
    }
  };

  // Handle Save Success (Add or Edit)
  const handleSaveSuccess = (savedProduct: Product, isEdit: boolean) => {
    if (isEdit) {
      setProducts((prev) =>
        prev.map((p) => (p.id === savedProduct.id ? savedProduct : p))
      );
    } else {
      setProducts((prev) => [savedProduct, ...prev]);
    }
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!deleteProductTarget || isDeleting) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/products/${deleteProductTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        showToast(`"${deleteProductTarget.name}" deleted successfully.`, "success");
        setProducts((prev) =>
          prev.filter((p) => p.id !== deleteProductTarget.id)
        );
        setDeleteProductTarget(null);
      } else {
        showToast(data.error || "Could not delete product.", "error");
      }
    } catch {
      showToast("Network error while deleting product", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main tracking-tight">
            Products Management
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage your restaurant menu, pricing, categories, and inventory availability
          </p>
        </div>

        <button
          onClick={() => {
            setEditingProduct(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface rounded-xl border border-border p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name or ingredients..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border text-xs bg-surface-subtle/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-main"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-border bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Availability Filter */}
          <select
            value={selectedAvailability}
            onChange={(e) => setSelectedAvailability(e.target.value)}
            className="text-xs font-medium px-3 py-2 rounded-lg border border-border bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available Only</option>
            <option value="SOLDOUT">Sold Out Only</option>
          </select>

          {/* Reset Filters */}
          {(searchQuery || selectedCategory !== "ALL" || selectedAvailability !== "ALL") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("ALL");
                setSelectedAvailability("ALL");
              }}
              className="px-2.5 py-2 text-xs font-semibold text-primary hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <LoadingState message="Loading restaurant products..." />
      ) : products.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No products yet"
          description="Your menu is currently empty. Add your first product to start taking orders."
          actionLabel="Add Your First Product"
          onAction={() => {
            setEditingProduct(null);
            setIsModalOpen(true);
          }}
        />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching products"
          description="No products match your search query or selected filters."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery("");
            setSelectedCategory("ALL");
            setSelectedAvailability("ALL");
          }}
        />
      ) : (
        <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle border-b border-border text-text-muted font-semibold">
                <tr>
                  <th className="py-3 px-5">Product</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5">Price</th>
                  <th className="py-3 px-5">Availability</th>
                  <th className="py-3 px-5">Last Updated</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProducts.map((product) => {
                  const isToggling = Boolean(togglingMap[product.id]);

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

                      {/* Category */}
                      <td className="py-3.5 px-5">
                        <span className="inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {product.category?.name || "Unassigned"}
                        </span>
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
                            onClick={() => handleToggleAvailability(product)}
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

                      {/* Date */}
                      <td className="py-3.5 px-5 text-text-muted whitespace-nowrap">
                        {formatDate(product.updatedAt || product.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Modifiers Button */}
                          <button
                            onClick={() => setSelectedModifierProduct(product)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-main text-xs font-medium transition-colors cursor-pointer mr-1"
                            title="Manage add-ons and modifiers"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span>Modifiers</span>
                            {product.modifierGroups && product.modifierGroups.length > 0 && (
                              <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                                {product.modifierGroups.length}
                              </span>
                            )}
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setIsModalOpen(true);
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

          {/* Table Footer Count */}
          <div className="px-5 py-3 border-t border-border bg-surface-subtle/50 text-xs text-text-muted flex justify-between items-center">
            <span>
              Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> products
            </span>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <ProductModal
        isOpen={isModalOpen}
        product={editingProduct}
        categories={categories}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={handleSaveSuccess}
      />

      {/* Product Modifiers Modal */}
      <ProductModifiersModal
        isOpen={Boolean(selectedModifierProduct)}
        product={selectedModifierProduct}
        onClose={() => setSelectedModifierProduct(null)}
        onModifiersUpdated={fetchData}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteProductTarget)}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteProductTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Product"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteProductTarget(null)}
      />
    </div>
  );
}
