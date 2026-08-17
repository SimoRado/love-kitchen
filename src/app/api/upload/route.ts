import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

function matchesImageSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (type === "image/gif") return new TextDecoder().decode(bytes.slice(0, 6)).startsWith("GIF8");
  if (type === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (type === "image/avif") return new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp" && new TextDecoder().decode(bytes.slice(8, 16)).includes("avif");
  return false;
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }
    const extension = EXTENSION_BY_TYPE[file.type];
    if (!extension) {
      return NextResponse.json({ success: false, error: "Only JPEG, PNG, WEBP, AVIF, and GIF images are allowed." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ success: false, error: "Image size must be between 1 byte and 5MB." }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    if (!matchesImageSignature(file.type, bytes)) {
      return NextResponse.json({ success: false, error: "The uploaded file does not match its image type." }, { status: 400 });
    }

    const baseName = file.name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "product";
    const blob = await put(`products/${baseName}.${extension}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    return NextResponse.json({
      success: true,
      data: { url: blob.url, filename: blob.pathname },
      message: "Image uploaded successfully",
    });
  } catch (error) {
    console.error("Product image upload failed:", error);
    return NextResponse.json(
      { success: false, error: "Persistent image upload failed. Verify the Vercel Blob integration and try again." },
      { status: 500 }
    );
  }
}
