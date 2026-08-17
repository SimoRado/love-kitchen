import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAdminAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type. Only JPEG, PNG, WEBP, AVIF, and GIF are allowed.",
        },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Image size cannot exceed 5MB." },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name) || ".jpg";
    const sanitizedBase = path
      .basename(file.name, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .slice(0, 30);
    const uniqueFilename = `${sanitizedBase}-${Date.now()}${ext}`;

    let publicUrl = "";

    // 1. If Vercel Blob token is available or in production with Blob, upload to Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`products/${uniqueFilename}`, file, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      publicUrl = blob.url;
    } else {
      // 2. Local development fallback to filesystem
      try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
        await mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, uniqueFilename);
        await writeFile(filePath, buffer);
        publicUrl = `/uploads/products/${uniqueFilename}`;
      } catch (localErr) {
        console.error("Local filesystem write failed and BLOB_READ_WRITE_TOKEN is not configured:", localErr);
        return NextResponse.json(
          {
            success: false,
            error: "Persistent cloud storage is not configured. Please connect Vercel Blob and set BLOB_READ_WRITE_TOKEN.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        filename: uniqueFilename,
      },
      message: "Image uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload image. Please try again." },
      { status: 500 }
    );
  }
}
