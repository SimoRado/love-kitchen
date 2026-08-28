import { deleteProductImage } from "./storage";

export function isVercelBlobUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** Delete only unreferenced product images; database writes never depend on cleanup. */
export async function deleteUnusedProductBlob(url: string | null | undefined): Promise<void> {
  await deleteProductImage(url);
}

