import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { put, del } from "@vercel/blob";
import { prisma } from "./prisma";

export const SANITY_MAX_RAW_SIZE = 30 * 1024 * 1024; // 30 MB sanity cap
export const TARGET_WIDTH = 1200;
export const TARGET_HEIGHT = 750; // 16:10 (~1.6:1) aspect ratio matching product card presentation
export const WEBP_QUALITY = 80;

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

export function getExtensionFromMime(mimeType: string): string | null {
  return ALLOWED_IMAGE_TYPES[mimeType.toLowerCase()] || null;
}

export function matchesImageSignature(bytes: Uint8Array): { valid: boolean; format?: string } {
  if (bytes.length < 12) return { valid: false };

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { valid: true, format: "jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { valid: true, format: "png" };
  }

  // GIF: GIF87a or GIF89a
  const ascii6 = new TextDecoder().decode(bytes.slice(0, 6));
  if (ascii6.startsWith("GIF8")) {
    return { valid: true, format: "gif" };
  }

  // WEBP: RIFF....WEBP
  const riff = new TextDecoder().decode(bytes.slice(0, 4));
  const webp = new TextDecoder().decode(bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") {
    return { valid: true, format: "webp" };
  }

  // HEIC / AVIF / HEIF: ftyp box in bytes 4-8
  const ftyp = new TextDecoder().decode(bytes.slice(4, 8));
  if (ftyp === "ftyp") {
    const brand = new TextDecoder().decode(bytes.slice(8, 12)).toLowerCase();
    const isAvifOrHeic = [
      "avif",
      "avis",
      "heic",
      "heix",
      "hevc",
      "heim",
      "heis",
      "mif1",
      "msf1",
    ].some((b) => brand.includes(b));
    if (isAvifOrHeic) {
      return { valid: true, format: brand.includes("avif") ? "avif" : "heic" };
    }
  }

  return { valid: false };
}

export function getSupabaseProjectUrl(): string {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;

  const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    const refMatch = dbUrl.match(/postgres\.([a-z0-9]+)/i);
    if (refMatch && refMatch[1]) {
      return `https://${refMatch[1]}.supabase.co`;
    }
  }
  return "https://eeqknxbboyupavepvsng.supabase.co";
}

let cachedSupabaseClient: SupabaseClient | null = null;

export function getSupabaseStorageClient(): SupabaseClient | null {
  if (cachedSupabaseClient) return cachedSupabaseClient;

  const url = getSupabaseProjectUrl();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    cachedSupabaseClient = createClient(url, key, {
      auth: { persistSession: false },
    });
    return cachedSupabaseClient;
  }
  return null;
}

const LOCAL_STORAGE_DIR = path.join(process.cwd(), "public", "uploads");

function ensureLocalDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Creates a short-lived signed upload URL for a raw image file.
 * Browser will upload the raw file directly to this URL, bypassing Vercel function body.
 */
export async function createSignedProductUploadUrl(
  mimeType: string,
  fileName?: string,
  fileSize?: number
): Promise<{ signedUrl: string; token: string; rawPath: string }> {
  const extension = getExtensionFromMime(mimeType);
  if (!extension) {
    throw new Error("Only JPEG, PNG, WEBP, AVIF, HEIC, and GIF images are supported.");
  }

  if (fileSize !== undefined && typeof fileSize === "number" && fileSize > SANITY_MAX_RAW_SIZE) {
    throw new Error("Image size exceeds the 30 MB maximum limit.");
  }

  const rawUuid = crypto.randomUUID();
  const rawPath = `raw/${rawUuid}.${extension}`;
  const supabase = getSupabaseStorageClient();

  if (supabase) {
    const { data, error } = await supabase.storage
      .from("product-images")
      .createSignedUploadUrl(rawPath, { upsert: true });

    if (!error && data?.signedUrl) {
      return {
        signedUrl: data.signedUrl,
        token: data.token || "",
        rawPath,
      };
    }
    if (error) {
      console.error("Supabase createSignedUploadUrl error:", error.message);
      throw new Error(`Failed to generate Supabase Storage signed upload URL: ${error.message}`);
    }
  }

  // In production / Vercel, cloud storage is strictly required to prevent FUNCTION_PAYLOAD_TOO_LARGE errors
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error(
      "Cloud storage is not configured for production. Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in your environment variables."
    );
  }

  // Development-only direct upload URL when cloud storage credentials are not provided
  return {
    signedUrl: `/api/upload/raw?path=${encodeURIComponent(rawPath)}`,
    token: "local-dev-token",
    rawPath,
  };
}

/**
 * Saves a raw uploaded file in local development storage.
 */
export const RAW_PATH_REGEX = /^raw\/[0-9a-zA-Z_-]{8,64}\.(jpg|jpeg|png|webp|avif|heic|heif|gif)$/i;

export async function saveLocalRawFile(rawPath: string, buffer: Buffer): Promise<void> {
  if (!rawPath || typeof rawPath !== "string" || !RAW_PATH_REGEX.test(rawPath)) {
    throw new Error("Invalid raw storage path");
  }
  const fullPath = path.resolve(LOCAL_STORAGE_DIR, rawPath);
  if (!fullPath.startsWith(path.resolve(LOCAL_STORAGE_DIR))) {
    throw new Error("Invalid raw storage path");
  }
  ensureLocalDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, buffer);
}

/**
 * Downloads the raw file from storage, validates magic bytes,
 * resizes to 1200x750 (16:10), converts to WebP (q80),
 * uploads to final path products/<uuid>.webp, verifies existence, and deletes the raw file.
 */
export async function processRawProductImage(
  rawPath: string
): Promise<{ url: string; filename: string }> {
  // Prevent path traversal and malicious filenames
  if (!rawPath || typeof rawPath !== "string" || !RAW_PATH_REGEX.test(rawPath)) {
    throw new Error("Invalid raw storage path format.");
  }

  const supabase = getSupabaseStorageClient();
  const projectUrl = getSupabaseProjectUrl();
  let rawBuffer: Buffer | null = null;

  try {
    // 1. Download raw file from Supabase Storage
    if (supabase) {
      const { data, error } = await supabase.storage.from("product-images").download(rawPath);
      if (!error && data) {
        rawBuffer = Buffer.from(await data.arrayBuffer());
      }
    }

    // 2. Local development fallback
    if (!rawBuffer) {
      const localRawFile = path.join(LOCAL_STORAGE_DIR, rawPath);
      if (fs.existsSync(localRawFile)) {
        rawBuffer = fs.readFileSync(localRawFile);
      }
    }

    if (!rawBuffer || rawBuffer.length === 0) {
      throw new Error("Raw image file was not found in storage. Please try uploading again.");
    }

    // 3. Sanity size check (<= 30 MB)
    if (rawBuffer.length > SANITY_MAX_RAW_SIZE) {
      throw new Error("Uploaded file exceeds the maximum allowed size of 30 MB.");
    }

    // 4. Validate magic signature bytes
    const signatureCheck = matchesImageSignature(new Uint8Array(rawBuffer.slice(0, 32)));
    if (!signatureCheck.valid) {
      throw new Error("This doesn't look like a valid image file. Please provide a genuine JPEG, PNG, WEBP, HEIC, or GIF image.");
    }

    // 5. Sharp image processing: EXIF rotate + Resize to 1200x750 (16:10) + WebP conversion (q80)
    let optimizedBuffer: Buffer;
    try {
      optimizedBuffer = await sharp(rawBuffer)
        .rotate() // Auto-orient based on EXIF
        .resize(TARGET_WIDTH, TARGET_HEIGHT, {
          fit: "cover",
          position: "centre",
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    } catch (sharpError) {
      console.error("Sharp processing failed:", sharpError);
      throw new Error("Failed to process image format with Sharp. Please provide a valid JPEG, PNG, or WEBP image.");
    }

    const optimizedUuid = crypto.randomUUID();
    const finalStoragePath = `products/${optimizedUuid}.webp`;

    // 6. Upload optimized WebP to final product-images path
    let finalUrl = "";
    if (supabase) {
      const { error: optUploadError } = await supabase.storage
        .from("product-images")
        .upload(finalStoragePath, optimizedBuffer, {
          contentType: "image/webp",
          upsert: true,
          cacheControl: "31536000",
        });

      if (optUploadError) {
        throw new Error(`Failed to upload optimized image to Supabase Storage: ${optUploadError.message}`);
      }

      finalUrl = `${projectUrl}/storage/v1/object/public/product-images/${finalStoragePath}`;
    } else if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(finalStoragePath, optimizedBuffer, {
        access: "public",
        addRandomSuffix: false,
        contentType: "image/webp",
      });
      if (!blob?.url) {
        throw new Error("Failed to upload optimized image to Vercel Blob.");
      }
      finalUrl = blob.url;
    } else {
      // Local development storage
      const localFinalPath = path.join(LOCAL_STORAGE_DIR, finalStoragePath);
      ensureLocalDir(path.dirname(localFinalPath));
      fs.writeFileSync(localFinalPath, optimizedBuffer);
      finalUrl = `/uploads/${finalStoragePath}`;
    }

    // 7. Delete the raw original file from Storage only after successful upload
    await deleteRawStorageFile(rawPath);

    return {
      url: finalUrl,
      filename: finalStoragePath,
    };
  } catch (error) {
    // Attempt to delete raw file on error to avoid orphan temp files
    await deleteRawStorageFile(rawPath);
    throw error;
  }
}

async function deleteRawStorageFile(rawPath: string): Promise<void> {
  try {
    const supabase = getSupabaseStorageClient();
    if (supabase) {
      await supabase.storage.from("product-images").remove([rawPath]);
    }
    const localRawFile = path.join(LOCAL_STORAGE_DIR, rawPath);
    if (fs.existsSync(localRawFile)) {
      fs.unlinkSync(localRawFile);
    }
  } catch (err) {
    console.warn("Raw storage cleanup note:", err);
  }
}

/**
 * Direct file upload fallback is disabled to prevent Vercel 413 FUNCTION_PAYLOAD_TOO_LARGE.
 * @deprecated Use the canonical signed upload pipeline: POST /api/upload/sign -> Direct Storage -> POST /api/upload/process
 */
export async function uploadProductImage(
  _file: File,
  _customPrefix?: string
): Promise<{ url: string; filename: string }> {
  void _file;
  void _customPrefix;
  throw new Error(
    "Direct function upload is deprecated and disabled. Use the canonical signed upload pipeline (/api/upload/sign -> direct storage -> /api/upload/process)."
  );
}

/**
 * Safely delete an unreferenced product image from storage.
 * Database transactions never block on deletion failures.
 */
export async function deleteProductImage(url: string | null | undefined): Promise<void> {
  if (!url || typeof url !== "string") return;

  try {
    const count = await prisma.product.count({ where: { image: url } });
    if (count > 0) return;

    if (url.includes(".blob.vercel-storage.com")) {
      await del(url);
      return;
    }

    if (url.includes("/storage/v1/object/public/product-images/")) {
      const storagePath = url.split("/storage/v1/object/public/product-images/")[1];
      if (storagePath) {
        const supabase = getSupabaseStorageClient();
        if (supabase) {
          await supabase.storage.from("product-images").remove([storagePath]);
        }
      }
      return;
    }

    if (url.startsWith("/uploads/products/") || url.includes("/uploads/products/")) {
      const relativePart = url.startsWith("/uploads/") ? url.replace("/uploads/", "") : url;
      const resolvedBase = path.resolve(LOCAL_STORAGE_DIR);
      const localFile = path.resolve(LOCAL_STORAGE_DIR, relativePart);
      if (!localFile.startsWith(resolvedBase)) {
        return;
      }
      if (fs.existsSync(localFile)) {
        fs.unlinkSync(localFile);
      }
    }
  } catch (error) {
    console.warn("Product image cleanup note:", error);
  }
}

