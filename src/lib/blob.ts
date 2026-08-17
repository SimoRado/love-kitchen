import { del } from "@vercel/blob";
import { prisma } from "./prisma";

export function isVercelBlobUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** Delete only unreferenced product blobs; database writes never depend on cleanup. */
export async function deleteUnusedProductBlob(url: string | null | undefined): Promise<void> {
  if (!isVercelBlobUrl(url)) return;
  try {
    const references = await prisma.product.count({ where: { image: url } });
    if (references === 0) await del(url);
  } catch (error) {
    console.error("Product image cleanup failed:", error);
  }
}
