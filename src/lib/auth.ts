import crypto from "node:crypto";
import { AdminUser } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const ADMIN_COOKIE_NAME = "resto_admin_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days persistent admin session

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Creates a new database-backed session for an administrator.
 */
export async function createAdminSession(
  adminId: string,
  ipOrReq?: string | NextRequest | null,
  uaParam?: string | null
): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const secret = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(`admin-session:${secret}`);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  let ip: string | null = null;
  let ua: string | null = null;

  if (ipOrReq && typeof ipOrReq === "object" && "headers" in ipOrReq) {
    ip =
      ipOrReq.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      ipOrReq.headers.get("x-real-ip") ||
      null;
    ua = ipOrReq.headers.get("user-agent") || null;
  } else if (typeof ipOrReq === "string") {
    ip = ipOrReq;
    ua = uaParam || null;
  }

  const session = await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash,
      userAgent: ua ? ua.slice(0, 500) : null,
      ipAddress: ip ? ip.slice(0, 100) : null,
      expiresAt,
    },
  });

  const cookieToken = `${session.id}.${secret}`;
  return { token: cookieToken, expiresAt, sessionId: session.id };
}

/**
 * Validates a session token string against the PostgreSQL AdminSession table.
 * Returns the associated AdminUser if valid, otherwise null.
 */
export async function verifyAdminSessionToken(
  token: string | null | undefined
): Promise<AdminUser | null> {
  if (!token || typeof token !== "string") return null;

  const dotIndex = token.indexOf(".");
  if (dotIndex < 1) return null;

  const sessionId = token.slice(0, dotIndex);
  const secret = token.slice(dotIndex + 1);
  if (!sessionId || !secret || secret.length !== 64 || !/^[0-9a-f]{64}$/i.test(secret)) {
    return null;
  }

  try {
    const session = await prisma.adminSession.findUnique({
      where: { id: sessionId },
      include: { admin: true },
    });

    if (!session || !session.admin) return null;

    // Check expiration
    if (session.expiresAt <= new Date()) {
      await prisma.adminSession.deleteMany({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // Timing-safe comparison of token hash
    const expectedHash = sha256(`admin-session:${secret}`);
    if (!timingSafeEqual(expectedHash, session.tokenHash)) return null;

    // Update lastActiveAt periodically (if more than 5 minutes old)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (session.lastActiveAt < fiveMinutesAgo) {
      await prisma.adminSession
        .updateMany({
          where: { id: session.id },
          data: { lastActiveAt: new Date() },
        })
        .catch(() => {});
    }

    return session.admin;
  } catch (error) {
    console.error("Error verifying admin session:", error);
    return null;
  }
}

/**
 * Extracts and verifies the admin session from NextRequest cookies.
 */
export async function getAdminUserFromRequest(request: NextRequest): Promise<AdminUser | null> {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}

/**
 * Boolean helper for route authorization checks.
 */
export async function getAdminSessionFromRequest(request: NextRequest): Promise<boolean> {
  const admin = await getAdminUserFromRequest(request);
  return Boolean(admin);
}

/**
 * Route Handler Guard: Ensures the incoming request has a valid admin session.
 * If not authenticated, returns a 401 Unauthorized Response.
 */
export async function requireAdminAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  const admin = await getAdminUserFromRequest(request);
  if (!admin) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized. Admin authentication required to perform this action.",
      },
      { status: 401 }
    );
  }
  return null;
}

/**
 * Attaches the persistent HTTP-only admin session cookie to a NextResponse.
 */
export function setAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Clears the admin session cookie from a NextResponse.
 */
export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Invalidates a single session by its cookie token value.
 */
export async function invalidateSessionByToken(token: string | null | undefined): Promise<void> {
  if (!token) return;
  const dotIndex = token.indexOf(".");
  if (dotIndex < 1) return;
  const sessionId = token.slice(0, dotIndex);
  try {
    await prisma.adminSession.deleteMany({ where: { id: sessionId } });
  } catch {}
}

/**
 * Global session invalidation: Revokes ALL sessions for an admin user (e.g. after password change).
 */
export async function invalidateAllAdminSessions(
  adminId: string,
  exceptSessionId?: string
): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.adminUser.update({
        where: { id: adminId },
        data: { sessionVersion: { increment: 1 } },
      }),
      prisma.adminSession.deleteMany({
        where: {
          adminId,
          ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
        },
      }),
    ]);
  } catch (error) {
    console.error("Failed to invalidate admin sessions:", error);
  }
}
