import crypto from "node:crypto";
import { AdminOtp } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const OTP_EXPIRATION_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP code.
 */
export function generateNumericOtp(): string {
  const value = crypto.randomInt(100000, 1000000);
  return value.toString();
}

/**
 * Creates and stores a new single-use 10-minute OTP in PostgreSQL.
 * Previous unused OTPs of the same type for this admin are automatically invalidated.
 */
export async function createAdminOtp(
  adminId: string,
  type: "EMAIL_CHANGE" | "PASSWORD_RESET",
  targetEmail?: string | null
): Promise<{ code: string; expiresAt: Date; otpId: string }> {
  const code = generateNumericOtp();
  const codeHash = sha256(`otp:${type}:${adminId}:${code}`);
  const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

  // Invalidate previous unused OTPs of this type for this admin
  await prisma.adminOtp.updateMany({
    where: { adminId, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  const otp = await prisma.adminOtp.create({
    data: {
      adminId,
      type,
      targetEmail: targetEmail ? targetEmail.trim().toLowerCase() : null,
      codeHash,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt,
    },
  });

  return { code, expiresAt, otpId: otp.id };
}

/**
 * Verifies a single-use OTP code against the database.
 */
export async function verifyAdminOtp(
  adminId: string,
  type: "EMAIL_CHANGE" | "PASSWORD_RESET",
  code: string,
  targetEmail?: string | null
): Promise<{ valid: boolean; error?: string; otp?: AdminOtp }> {
  const normalizedCode = code.trim();
  if (!normalizedCode || normalizedCode.length !== 6) {
    return { valid: false, error: "Please enter a valid 6-digit verification code." };
  }

  const now = new Date();
  const otp = await prisma.adminOtp.findFirst({
    where: {
      adminId,
      type,
      usedAt: null,
      expiresAt: { gt: now },
      ...(targetEmail ? { targetEmail: targetEmail.trim().toLowerCase() } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return {
      valid: false,
      error: "Verification code is invalid or has expired. Please request a new code.",
    };
  }

  if (otp.attempts >= otp.maxAttempts) {
    await prisma.adminOtp.update({
      where: { id: otp.id },
      data: { usedAt: now },
    });
    return {
      valid: false,
      error: "Too many failed attempts. This code has been invalidated. Please request a new one.",
    };
  }

  // Increment attempt count
  await prisma.adminOtp.update({
    where: { id: otp.id },
    data: { attempts: { increment: 1 } },
  });

  const expectedHash = sha256(`otp:${type}:${adminId}:${normalizedCode}`);
  if (!timingSafeEqual(expectedHash, otp.codeHash)) {
    const remaining = Math.max(0, otp.maxAttempts - (otp.attempts + 1));
    return {
      valid: false,
      error: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
    };
  }

  // Mark as used immediately (single-use protection)
  const usedOtp = await prisma.adminOtp.update({
    where: { id: otp.id },
    data: { usedAt: now },
  });

  return { valid: true, otp: usedOtp };
}

export const createOtp = createAdminOtp;
export const verifyOtp = async (
  adminId: string,
  type: "EMAIL_CHANGE" | "PASSWORD_RESET",
  code: string,
  targetEmail?: string | null
) => {
  const result = await verifyAdminOtp(adminId, type, code, targetEmail);
  return { success: result.valid, ...result };
};
