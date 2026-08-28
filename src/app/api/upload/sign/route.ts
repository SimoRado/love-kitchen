import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createSignedProductUploadUrl, SANITY_MAX_RAW_SIZE, getExtensionFromMime } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const { mimeType, fileName, fileSize } = body;

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

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Failed to generate signed upload URL:", error);
    const message = error instanceof Error ? error.message : "Failed to generate upload URL";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
