import sharp from "sharp";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { put, del } from "@vercel/blob";
import { prisma } from "./prisma";

export const SANITY_MAX_RAW_SIZE = 30 * 1024 * 1024; // 30 MB sanity cap
export const TARGET_WIDTH = 1200;
export const TARGET_HEIGHT = 900; // 4:3 aspect ratio matching product card design
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

/**
 * Creates a short-lived signed upload URL for a raw image file.
 * Browser will upload the raw file directly to this URL, bypassing Vercel function body.
 */
export async function createSignedProductUploadUrl(
  mimeType: string,
  fileName?: string
): Promise<{ signedUrl: string; token: string; rawPath: string }> {
  const extension = getExtensionFromMime(mimeType);
  if (!extension) {
    throw new Error("Only JPEG, PNG, WEBP, AVIF, HEIC, and GIF images are supported.");
  }

  const rawUuid = crypto.randomUUID();
  const rawPath = `raw/${rawUuid}.${extension}`;
  const supabase = getSupabaseStorageClient();

  if (supabase) {
    const { data, error } = await supabase.storage
      .from("product-images")
      .createSignedUploadUrl(rawPath, { upsert: true });


    if (error || !data) {
      console.warn("Supabase createSignedUploadUrl note:", error?.message);
    } else {
      return {
        signedUrl: data.signedUrl,
        token: data.token,
        rawPath,
      };
    }
  }

  // Direct public bucket fallback URL if service key not configured
  const projectUrl = getSupabaseProjectUrl();
  const directUploadUrl = `${projectUrl}/storage/v1/object/product-images/${rawPath}`;
  return {
    signedUrl: directUploadUrl,
    token: "",
    rawPath,
  };
}

/**
 * Downloads the raw file from storage, validates magic bytes,
 * resizes to 1200x900 (4:3), converts to WebP (q80),
 * uploads to final path products/<uuid>.webp, and deletes the raw file.
 */
export async function processRawProductImage(
  rawPath: string
): Promise<{ url: string; filename: string }> {
  // Prevent path traversal
  if (!rawPath || typeof rawPath !== "string" || !rawPath.startsWith("raw/") || rawPath.includes("..")) {
    throw new Error("Invalid raw storage path");
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

    if (!rawBuffer) {
      // Fallback: fetch via public object URL
      const publicRawUrl = `${projectUrl}/storage/v1/object/public/product-images/${rawPath}`;
      const res = await fetch(publicRawUrl);
      if (res.ok) {
        rawBuffer = Buffer.from(await res.arrayBuffer());
      }
    }

    if (!rawBuffer || rawBuffer.length === 0) {
      throw new Error("Raw image file was not found in storage. Please try uploading again.");
    }

    // 2. Sanity size check (<= 30 MB)
    if (rawBuffer.length > SANITY_MAX_RAW_SIZE) {
      throw new Error("Uploaded file exceeds the maximum allowed size of 30 MB.");
    }

    // 3. Validate magic signature bytes
    const signatureCheck = matchesImageSignature(new Uint8Array(rawBuffer.slice(0, 32)));
    if (!signatureCheck.valid) {
      throw new Error("This doesn't look like a valid image file. Please provide a genuine JPEG, PNG, WEBP, HEIC, or GIF image.");
    }

    // 4. Sharp image processing: EXIF rotate + Resize to 1200x900 (4:3) + WebP conversion (q80)
    const optimizedBuffer = await sharp(rawBuffer)
      .rotate() // Auto-orient based on EXIF
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const optimizedUuid = crypto.randomUUID();
    const finalStoragePath = `products/${optimizedUuid}.webp`;

    // 5. Upload optimized WebP to final product-images path
    let uploadSuccess = false;
    if (supabase) {
      const { error: optUploadError } = await supabase.storage
        .from("product-images")
        .upload(finalStoragePath, optimizedBuffer, {
          contentType: "image/webp",
          upsert: true,
          cacheControl: "31536000",
        });

      if (!optUploadError) {
        uploadSuccess = true;
      }
    }

    if (!uploadSuccess && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(finalStoragePath, optimizedBuffer, {
          access: "public",
          addRandomSuffix: false,
          contentType: "image/webp",
        });
        if (blob?.url) {
          uploadSuccess = true;
        }
      } catch (e) {
        console.warn("Vercel Blob upload note:", e);
      }
    }

    // 6. Delete the raw original file from Supabase Storage
    await deleteRawStorageFile(rawPath);

    const finalUrl = `${projectUrl}/storage/v1/object/public/product-images/${finalStoragePath}`;
    return {
      url: finalUrl,
      filename: finalStoragePath,
    };
  } catch (error) {
    // Always attempt to delete raw file on error so no orphaned files remain
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
  } catch (err) {
    console.warn("Raw storage cleanup note:", err);
  }
}

/**
 * Direct file upload fallback (processes file with sharp into WebP and uploads).
 */
export async function uploadProductImage(
  file: File,
  customPrefix?: string
): Promise<{ url: string; filename: string }> {
  if (!file || file.size === 0) {
    throw new Error("No image file provided.");
  }
  if (file.size > SANITY_MAX_RAW_SIZE) {
    throw new Error("Image size must not exceed 30 MB.");
  }

  const rawBytes = new Uint8Array(await file.arrayBuffer());
  const signatureCheck = matchesImageSignature(rawBytes.slice(0, 32));
  if (!signatureCheck.valid) {
    throw new Error("This doesn't look like a valid image file.");
  }

  // Sharp optimization
  const optimizedBuffer = await sharp(Buffer.from(rawBytes))
    .rotate()
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const finalUuid = crypto.randomUUID();
  const baseName = customPrefix
    ? `${customPrefix}-${finalUuid.slice(0, 8)}.webp`
    : `${finalUuid}.webp`;
  const storagePath = `products/${baseName}`;

  const supabase = getSupabaseStorageClient();
  if (supabase) {
    const { error } = await supabase.storage
      .from("product-images")
      .upload(storagePath, optimizedBuffer, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: "31536000",
      });

    if (!error) {
      const projectUrl = getSupabaseProjectUrl();
      return {
        url: `${projectUrl}/storage/v1/object/public/product-images/${storagePath}`,
        filename: storagePath,
      };
    }
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(storagePath, optimizedBuffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/webp",
    });
    return {
      url: blob.url,
      filename: blob.pathname,
    };
  }

  const projectUrl = getSupabaseProjectUrl();
  return {
    url: `${projectUrl}/storage/v1/object/public/product-images/${storagePath}`,
    filename: storagePath,
  };
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
    }
  } catch (error) {
    console.warn("Product image cleanup note:", error);
  }
}
