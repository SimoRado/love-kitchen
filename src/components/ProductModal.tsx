"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Upload, Loader2, Check } from "lucide-react";
import { Product, Category } from "@/lib/types";
import { useToast } from "./ToastContext";
import { adminFetch } from "@/lib/adminFetch";

interface ProductModalProps {
  isOpen: boolean;
  product?: Product | null; // null = create new
  categories: Category[];
  defaultCategoryId?: string;
  onClose: () => void;
  onSuccess: (savedProduct: Product, isEdit: boolean) => void;
}

export default function ProductModal({
  isOpen,
  product,
  categories,
  defaultCategoryId,
  onClose,
  onSuccess,
}: ProductModalProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [image, setImage] = useState("");
  const [available, setAvailable] = useState(true);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState("15");
  const [prepStation, setPrepStation] = useState("KITCHEN");

  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "optimizing">("idle");
  const isUploading = uploadStatus !== "idle";
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const isEdit = Boolean(product);

  /* eslint-disable react-hooks/set-state-in-effect -- reset the controlled form when its target changes */
  useEffect(() => {
    if (isOpen) {
      if (product) {
        setName(product.name);
        setDescription(product.description || "");
        setPrice(product.price.toString());
        setCategoryId(product.categoryId);
        setImage(product.image || "");
        setAvailable(product.available);
        setPrepTimeMinutes(String(product.prepTimeMinutes ?? 15));
        setPrepStation(product.prepStation || "KITCHEN");
      } else {
        setName("");
        setDescription("");
        setPrice("");
        setCategoryId(defaultCategoryId || (categories.length > 0 ? categories[0].id : ""));
        setImage("");
        setAvailable(true);
        setPrepTimeMinutes("15");
        setPrepStation("KITCHEN");
      }
      setErrors({});
      setUploadStatus("idle");
    }
  }, [isOpen, product, categories, defaultCategoryId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = "Product name is required.";
    }

    const numPrice = parseFloat(price);
    if (price.trim() === "" || isNaN(numPrice)) {
      newErrors.price = "Valid price is required.";
    } else if (numPrice < 0) {
      newErrors.price = "Price must be 0 or greater.";
    }

    const numPrepTime = parseInt(prepTimeMinutes, 10);
    if (prepTimeMinutes.trim() === "" || isNaN(numPrepTime) || numPrepTime < 0) {
      newErrors.prepTimeMinutes = "Preparation time must be 0 or greater.";
    }

    if (!categoryId) {
      newErrors.categoryId = "Please select a category.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side format sanity check
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/heic",
      "image/heif",
      "image/gif",
    ];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      showToast("Only JPEG, PNG, WEBP, AVIF, HEIC, and GIF images are supported.", "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Client-side sanity check (up to 30 MB supported)
    const MAX_SANITY_SIZE = 30 * 1024 * 1024;
    if (file.size > MAX_SANITY_SIZE) {
      showToast("Image size exceeds the 30 MB maximum limit.", "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      // Stage 1: Request short-lived signed upload URL (Admin Auth Required)
      setUploadStatus("uploading");

      const signRes = await adminFetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mimeType: file.type,
          fileName: file.name,
          fileSize: file.size,
        }),
      });

      const signData = await signRes.json();
      if (!signRes.ok || !signData.success || !signData.data?.signedUrl || !signData.data?.rawPath) {
        throw new Error(signData.error || "Failed to generate signed upload URL");
      }

      const { signedUrl, rawPath } = signData.data;

      // Stage 2: Upload RAW file DIRECTLY to storage (browser directly to Supabase Storage, bypassing Vercel serverless functions)
      const directUploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "true",
        },
        body: file,
      });

      if (!directUploadRes.ok) {
        const errorText = await directUploadRes.text().catch(() => "");
        throw new Error(
          `Direct storage upload failed (HTTP ${directUploadRes.status}${errorText ? `: ${errorText}` : ""}). Please try again.`
        );
      }

      // Stage 3: Request server-side Sharp optimization (auto EXIF rotate + 1200x750 WebP q80)
      setUploadStatus("optimizing");

      const processRes = await adminFetch("/api/upload/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawPath }),
      });

      const processData = await processRes.json();
      if (!processRes.ok || !processData.success || !processData.data?.url) {
        throw new Error(processData.error || "Server-side image optimization failed");
      }

      setImage(processData.data.url);
      showToast("Photo uploaded and optimized to WebP successfully", "success");
    } catch (err) {
      console.error("Image pipeline error:", err);
      const message = err instanceof Error ? err.message : "Failed to upload and process photo";
      showToast(message, "error");
    } finally {
      setUploadStatus("idle");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSaving) return;

    try {
      setIsSaving(true);
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price: parseFloat(price),
        categoryId,
        image: image.trim() || null,
        available,
        prepTimeMinutes: parseInt(prepTimeMinutes, 10) || 0,
        prepStation: prepStation.trim().toUpperCase() || "KITCHEN",
      };

      const url = isEdit ? `/api/products/${product?.id}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";

      const res = await adminFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success && data.data) {
        showToast(
          isEdit ? "Product updated successfully." : "Product added successfully.",
          "success"
        );
        onSuccess(data.data, isEdit);
        onClose();
      } else {
        showToast(data.error || (isEdit ? "Could not update product." : "Could not add product. Please try again."), "error");
      }
    } catch {
      showToast("Network error occurred. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={isSaving ? undefined : onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-surface rounded-2xl border border-border shadow-2xl max-w-xl w-full my-8 z-10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-subtle/50">
          <div>
            <h2 className="text-lg font-bold text-text-main">
              {isEdit ? "Edit Product" : "Add New Product"}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {isEdit ? "Update product details & pricing" : "Create a new item for your restaurant menu"}
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Product Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Classic Cheeseburger"
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                errors.name
                  ? "border-red-400 focus:border-red-500"
                  : "border-border focus:border-primary"
              }`}
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Category & Price Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  errors.categoryId
                    ? "border-red-400 focus:border-red-500"
                    : "border-border focus:border-primary"
                }`}
              >
                {categories.length === 0 && (
                  <option value="">No categories available</option>
                )}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="text-xs text-red-500 mt-1">{errors.categoryId}</p>
              )}
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                Price (MAD) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  errors.price
                    ? "border-red-400 focus:border-red-500"
                    : "border-border focus:border-primary"
                }`}
              />
              {errors.price && (
                <p className="text-xs text-red-500 mt-1">{errors.price}</p>
              )}
            </div>
          </div>

          {/* Preparation Time & Kitchen Station */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Preparation Time */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                Preparation Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={prepTimeMinutes}
                  onChange={(e) => setPrepTimeMinutes(e.target.value)}
                  placeholder="15"
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 pr-16 ${
                    errors.prepTimeMinutes
                      ? "border-red-400 focus:border-red-500"
                      : "border-border focus:border-primary"
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted pointer-events-none">
                  minutes
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                Estimated time needed to prepare this item.
              </p>
              {errors.prepTimeMinutes && (
                <p className="text-xs text-red-500 mt-1">{errors.prepTimeMinutes}</p>
              )}
            </div>

            {/* Preparation Station */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                Preparation Station
              </label>
              <select
                value={prepStation}
                onChange={(e) => setPrepStation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="BURGER">Burger Station</option>
                <option value="PIZZA">Pizza Station</option>
                <option value="SUSHI">Sushi Station</option>
                <option value="SIDES">Sides & Starters</option>
                <option value="DRINKS">Drinks & Bar</option>
                <option value="DESSERT">Dessert Station</option>
                <option value="KITCHEN">General Kitchen</option>
              </select>
              <p className="text-[11px] text-text-muted mt-1">
                Kitchen area preparing this item concurrently.
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="List ingredients, taste notes, or preparation details..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          {/* Product Image */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
              Product Image
            </label>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://... or upload a photo"
                  className="flex-1 px-3.5 py-2.5 rounded-lg border border-border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-border text-xs font-semibold text-text-main bg-surface-hover hover:bg-slate-200 transition-colors shrink-0 disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <Upload className="w-4 h-4 text-text-muted" />
                  )}
                  <span>
                    {uploadStatus === "uploading"
                      ? "Uploading photo..."
                      : uploadStatus === "optimizing"
                      ? "Optimizing photo..."
                      : "Upload"}
                  </span>
                </button>
              </div>

              {/* Image Preview */}
              {image && (
                <div className="relative w-full h-32 rounded-lg border border-border overflow-hidden bg-slate-50 flex items-center justify-center group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt="Product preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://placehold.co/600x400/f1f5f9/94a3b8?text=Invalid+Image+URL";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setImage("")}
                    className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/70 text-white hover:bg-red-600 transition-colors"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Availability Toggle */}
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-main">
                Availability Status
              </p>
              <p className="text-xs text-text-muted">
                {available
                  ? "Available for customers to order"
                  : "Marked as Sold Out on the menu"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAvailable(!available)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                available ? "bg-primary" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  available ? "translate-x-5" : "translate-x-0"
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
                <span>{isEdit ? "Save Changes" : "Create Product"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
