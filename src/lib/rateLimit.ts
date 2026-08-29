import { prisma } from "@/lib/prisma";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Distributed rate limiter using PostgreSQL AdminRateLimit table.
 * Fully compatible with Vercel serverless functions, multi-region deployments, and local dev.
 */
export async function checkRateLimit(
  key: string,
  maxLimit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  try {
    const existing = await prisma.adminRateLimit.findUnique({
      where: { key },
    });

    if (!existing || existing.resetAt <= now) {
      const record = await prisma.adminRateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return { allowed: true, remaining: maxLimit - 1, resetAt: record.resetAt };
    }

    if (existing.count >= maxLimit) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }

    const updated = await prisma.adminRateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });

    return {
      allowed: true,
      remaining: Math.max(0, maxLimit - updated.count),
      resetAt: updated.resetAt,
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    return { allowed: true, remaining: 1, resetAt };
  }
}

export async function resetRateLimit(key: string): Promise<void> {
  try {
    await prisma.adminRateLimit.deleteMany({
      where: { key },
    });
  } catch (error) {
    console.error("Rate limit reset error:", error);
  }
}

