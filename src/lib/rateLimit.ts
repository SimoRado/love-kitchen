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

/**
 * Check whether an IP has exceeded failed login attempts without incrementing the counter.
 */
export async function checkFailedLoginRateLimit(
  key: string,
  maxFailures = 5
): Promise<{ allowed: boolean; resetAt?: Date }> {
  const now = new Date();
  try {
    const existing = await prisma.adminRateLimit.findUnique({
      where: { key },
    });

    if (!existing || existing.resetAt <= now) {
      return { allowed: true };
    }

    if (existing.count >= maxFailures) {
      return { allowed: false, resetAt: existing.resetAt };
    }

    return { allowed: true };
  } catch (error) {
    console.error("Failed login rate limit check error:", error);
    return { allowed: true };
  }
}

/**
 * Record a failed login attempt against the IP.
 */
export async function recordFailedLogin(
  key: string,
  windowSeconds = 300
): Promise<void> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  try {
    const existing = await prisma.adminRateLimit.findUnique({
      where: { key },
    });

    if (!existing || existing.resetAt <= now) {
      await prisma.adminRateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
    } else {
      await prisma.adminRateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
    }
  } catch (error) {
    console.error("Record failed login error:", error);
  }
}

/**
 * Reset/clear rate limit upon successful authentication.
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await prisma.adminRateLimit.deleteMany({
      where: { key },
    });
  } catch (error) {
    console.error("Rate limit reset error:", error);
  }
}
