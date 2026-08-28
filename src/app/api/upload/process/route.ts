import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { processRawProductImage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const { rawPath } = body;

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
  } catch (error) {
    console.error("Failed to process product image:", error);
    const message = error instanceof Error ? error.message : "Failed to process image";
    const isClientError =
      message.includes("valid") ||
      message.includes("format") ||
      message.includes("exceed") ||
      message.includes("found") ||
      message.includes("Invalid");

    return NextResponse.json(
      { success: false, error: message },
      { status: isClientError ? 400 : 500 }
    );
  }
}
