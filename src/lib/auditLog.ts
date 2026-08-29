import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "EMAIL_CHANGED"
  | "EMAIL_CHANGE_OTP_REQUESTED"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET"
  | "ACCESS_PATH_CHANGED"
  | "DEVICE_REGISTERED"
  | "DEVICE_DISABLED"
  | "DEVICE_ACTIVATED"
  | "DEVICE_REVOKED"
  | "DEVICE_REPLACED"
  | "SETTINGS_UPDATED"
  | "PRODUCT_MODIFIED"
  | "SESSIONS_REVOKED"
  | "TEST_SECURITY_EVENT";

export interface AuditLogOptions {
  adminId?: string | null;
  adminUserId?: string | null;
  action?: string;
  details?: Record<string, unknown>;
  req?: NextRequest;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Records an immutable administrative audit event in PostgreSQL.
 * Passwords, raw OTPs, and session tokens MUST NEVER be included in details.
 */
export async function recordAuditLog(
  actionOrOptions: AuditAction | AuditLogOptions,
  options?: AuditLogOptions
) {
  try {
    let action: string;
    let opts: AuditLogOptions;

    if (typeof actionOrOptions === "string") {
      action = actionOrOptions;
      opts = options || {};
    } else {
      action = actionOrOptions.action || "SECURITY_EVENT";
      opts = actionOrOptions;
    }

    let ip = opts.ipAddress || null;
    let ua = opts.userAgent || null;

    if (opts.req) {
      ip =
        opts.req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        opts.req.headers.get("x-real-ip") ||
        ip;
      ua = opts.req.headers.get("user-agent") || ua;
    }

    const sanitizedDetails = opts.details ? { ...opts.details } : undefined;
    if (sanitizedDetails) {
      delete (sanitizedDetails as Record<string, unknown>).password;
      delete (sanitizedDetails as Record<string, unknown>).currentPassword;
      delete (sanitizedDetails as Record<string, unknown>).newPassword;
      delete (sanitizedDetails as Record<string, unknown>).otp;
      delete (sanitizedDetails as Record<string, unknown>).token;
      delete (sanitizedDetails as Record<string, unknown>).secret;
    }

    const created = await prisma.adminAuditLog.create({
      data: {
        adminId: opts.adminId || opts.adminUserId || null,
        action,
        details: sanitizedDetails ? JSON.stringify(sanitizedDetails) : null,
        ipAddress: ip ? ip.slice(0, 100) : null,
        userAgent: ua ? ua.slice(0, 500) : null,
      },
    });

    return created;
  } catch (error) {
    console.error("Failed to record audit log:", error);
    return null;
  }
}
