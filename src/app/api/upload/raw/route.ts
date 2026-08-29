import { NextRequest, NextResponse } from "next/server";
import { saveLocalRawFile, SANITY_MAX_RAW_SIZE } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get("path");

    if (!rawPath || !rawPath.startsWith("raw/") || rawPath.includes("..")) {
      return NextResponse.json({ success: false, error: "Invalid path" }, { status: 400 });
    }

    const contentType = request.headers.get("content-type") || "";
    let buffer: Buffer;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      // Supabase storage format appends file under "" or "file"
      let file: File | null = null;
      for (const value of formData.values()) {
        if (value instanceof File) {
          file = value;
          break;
        }
      }
      if (!file) {
        return NextResponse.json({ success: false, error: "No file in form data" }, { status: 400 });
      }
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      buffer = Buffer.from(await request.arrayBuffer());
    }

    if (buffer.length === 0) {
      return NextResponse.json({ success: false, error: "Empty file body" }, { status: 400 });
    }

    if (buffer.length > SANITY_MAX_RAW_SIZE) {
      return NextResponse.json({ success: false, error: "File exceeds 30 MB limit" }, { status: 400 });
    }

    await saveLocalRawFile(rawPath, buffer);

    return NextResponse.json({
      success: true,
      message: "Raw file uploaded to temporary storage",
      path: rawPath,
    });
  } catch (error) {
    console.error("Local raw upload failed:", error);
    const message = error instanceof Error ? error.message : "Failed to upload raw file";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return PUT(request);
}
