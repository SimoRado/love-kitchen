import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy upload endpoint is deprecated.
 * Canonical upload architecture:
 * 1. POST /api/upload/sign -> Get short-lived signed upload URL
 * 2. Browser -> Direct Supabase Storage upload (0 MB through Vercel serverless)
 * 3. POST /api/upload/process -> Sharp WebP 1200x750 optimization & cleanup
 */
export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  return NextResponse.json(
    {
      success: false,
      error: "The /api/upload endpoint is deprecated. Please use the canonical signed upload pipeline: POST /api/upload/sign -> Direct Storage Upload -> POST /api/upload/process.",
    },
    { status: 400 }
  );
}
