import { AdminUser } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export const DEFAULT_ADMIN_ACCESS_PATH = "lovekitchen";

export const RESERVED_ACCESS_PATHS = new Set([
  "api",
  "admin",
  "login",
  "pos",
  "_next",
  "checkout",
  "favicon.ico",
  "uploads",
  "robots.txt",
  "sitemap.xml",
  "manifest.json",
]);

let cachedPath: string = DEFAULT_ADMIN_ACCESS_PATH;
let cacheTime: number = 0;

export function invalidateAdminAccessPathCache(): void {
  cacheTime = 0;
}

/**
 * Validates a proposed admin access path.
 */
export function validateAccessPath(path: string): { valid: boolean; error?: string } {
  const normalized = path.trim().toLowerCase();
  if (!normalized) {
    return { valid: false, error: "Access path cannot be empty." };
  }
  if (normalized.length < 3 || normalized.length > 40) {
    return { valid: false, error: "Access path must be between 3 and 40 characters." };
  }
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    return {
      valid: false,
      error: "Access path can only contain lowercase letters, numbers, and hyphens.",
    };
  }
  if (RESERVED_ACCESS_PATHS.has(normalized)) {
    return { valid: false, error: `"${normalized}" is a reserved system path and cannot be used.` };
  }
  return { valid: true };
}

export const validateAdminAccessPath = validateAccessPath;

/**
 * Ensures an active AdminUser exists in PostgreSQL.
 * If none exists, bootstraps the initial account from environment variables.
 */
export async function getOrCreateDefaultAdmin(): Promise<AdminUser> {
  const existing = await prisma.adminUser.findFirst();
  if (existing) return existing;

  const email = (process.env.ADMIN_EMAIL || "admin@lovekitchen.ma").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "RestaurantAdmin2026!";
  const adminAccessPath = (process.env.ADMIN_ACCESS_PATH || DEFAULT_ADMIN_ACCESS_PATH).trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  return prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      adminAccessPath,
      sessionVersion: 1,
    },
  });
}

/**
 * Finds an administrator account by email (case-insensitive).
 */
export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const normalized = email.trim().toLowerCase();
  await getOrCreateDefaultAdmin(); // ensure DB is bootstrapped
  return prisma.adminUser.findUnique({
    where: { email: normalized },
  });
}

/**
 * Finds an administrator account by ID.
 */
export async function findAdminById(id: string): Promise<AdminUser | null> {
  return prisma.adminUser.findUnique({
    where: { id },
  });
}

/**
 * Retrieves the currently active admin access path.
 */
export async function getAdminAccessPath(): Promise<string> {
  const now = Date.now();
  if (now - cacheTime < 5000) {
    return cachedPath;
  }
  try {
    const admin = await prisma.adminUser.findFirst({
      select: { adminAccessPath: true },
    });
    if (admin?.adminAccessPath) {
      cachedPath = admin.adminAccessPath;
      cacheTime = now;
      return cachedPath;
    }
  } catch {}
  return DEFAULT_ADMIN_ACCESS_PATH;
}
