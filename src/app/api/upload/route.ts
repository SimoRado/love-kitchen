import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import {
  createSignedProductUploadUrl,
  processRawProductImage,
  uploadProductImage,
  SANITY_MAX_RAW_SIZE,
  getExtensionFromMime,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const contentType = request.headers.get("content-type") || "";

  // 1. JSON Request: either "sign" or "process"
  if (contentType.includes("application/json")) {
    try {
      const body = await request.json().catch(() => ({}));
      const { action, rawPath, mimeType, fileName, fileSize } = body;

      // Handle signed upload URL generation
      if (action === "sign" || (mimeType && !rawPath)) {
        if (!mimeType || typeof mimeType !== "string") {
          return NextResponse.json(
            { success: false, error: "MIME type is required to generate an upload URL." },
            { status: 400 }
          );
        }
        const ext = getExtensionFromMime(mimeType);
        if (!ext) {
          return NextResponse.json(
            { success: false, error: "Only JPEG, PNG, WEBP, AVIF, HEIC, and GIF images are supported." },
            { status: 400 }
          );
        }
        if (fileSize !== undefined && typeof fileSize === "number" && fileSize > SANITY_MAX_RAW_SIZE) {
          return NextResponse.json(
            { success: false, error: "Image size exceeds the 30 MB limit." },
            { status: 400 }
          );
        }
        const result = await createSignedProductUploadUrl(mimeType, fileName);
        return NextResponse.json({ success: true, data: result });
      }

      // Handle raw image processing with sharp
      if (action === "process" || rawPath) {
        if (!rawPath || typeof rawPath !== "string") {
          return NextResponse.json(
            { success: false, error: "rawPath is required to process an uploaded image." },
            { status: 400 }
          );
        }
        const result = await processRawProductImage(rawPath);
        return NextResponse.json({
          success: true,
          data: result,
          message: "Image optimized and processed successfully",
        });
      }

      return NextResponse.json({ success: false, error: "Invalid action specified." }, { status: 400 });
    } catch (error) {
      console.error("Upload JSON handler failed:", error);
      const message = error instanceof Error ? error.message : "Upload handling failed";
      const isClientError =
        message.includes("valid") ||
        message.includes("format") ||
        message.includes("exceed") ||
        message.includes("found") ||
        message.includes("Invalid");
      return NextResponse.json({ success: false, error: message }, { status: isClientError ? 400 : 500 });
    }
  }

  // 2. Multipart/form-data: direct file fallback (processes with sharp into WebP)
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (file.size > SANITY_MAX_RAW_SIZE) {
      return NextResponse.json({ success: false, error: "Image size exceeds 30 MB." }, { status: 400 });
    }

    const result = await uploadProductImage(file);

    return NextResponse.json({
      success: true,
      data: result,
      message: "Image uploaded successfully",
    });
  } catch (error) {
    console.error("Product image direct upload failed:", error);
    const message = error instanceof Error ? error.message : "Failed to upload image. Please try again.";
    const isClientError =
      message.includes("valid") ||
      message.includes("format") ||
      message.includes("exceed") ||
      message.includes("match") ||
      message.includes("Invalid");
    return NextResponse.json({ success: false, error: message }, { status: isClientError ? 400 : 500 });
  }
}



