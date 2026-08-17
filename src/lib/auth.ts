import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "resto_admin_session";

function getAdminConfig() {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!password || !secret || secret.length < 32) {
    throw new Error(
      "CRITICAL: ADMIN_PASSWORD is missing or ADMIN_SESSION_SECRET is missing/too short."
    );
  }

  return { password, secret };
}

/**
 * Validate admin password
 */
export async function validateAdminPassword(inputPassword: string): Promise<boolean> {
  const { password, secret } = getAdminConfig();
  if (!inputPassword) return false;
  const expected = await createHmacSignature(`admin-password:${password}`, secret);
  const received = await createHmacSignature(`admin-password:${inputPassword}`, secret);
  return timingSafeStringEqual(received, expected);
}

function timingSafeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Convert string to hex
 */
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Creates HMAC signature using Web Crypto API (compatible with Edge and Node.js)
 */
async function createHmacSignature(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(message)
  );
  return toHex(signature);
}

/**
 * Creates a signed session token: <timestamp>.<hmacSignature>
 */
export async function createAdminSessionToken(): Promise<string> {
  const { secret } = getAdminConfig();
  const timestamp = Date.now().toString();
  const signature = await createHmacSignature(`admin-session:${timestamp}`, secret);
  return `${timestamp}.${signature}`;
}

/**
 * Verifies a signed session token
 */
export async function verifyAdminSessionToken(token: string | null | undefined): Promise<boolean> {
  if (!token || typeof token !== "string") return false;

  try {
    const { secret } = getAdminConfig();
    const [timestamp, signature] = token.split(".");
    if (!timestamp || !signature) return false;

    // Check expiration (7 days)
    const tokenTime = parseInt(timestamp, 10);
    if (isNaN(tokenTime) || Date.now() - tokenTime > 7 * 24 * 60 * 60 * 1000) {
      return false;
    }

    const expectedSignature = await createHmacSignature(`admin-session:${timestamp}`, secret);
    return timingSafeStringEqual(signature, expectedSignature);
  } catch {
    return false;
  }
}

/**
 * Extracts and verifies session from NextRequest cookies
 */
export async function getAdminSessionFromRequest(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME);
  return verifyAdminSessionToken(cookie?.value);
}

/**
 * Route Handler Guard: Ensures the incoming request has a valid admin session.
 * If not authenticated, returns a 401 Unauthorized Response.
 */
export async function requireAdminAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  const isAuthenticated = await getAdminSessionFromRequest(request);
  if (!isAuthenticated) {
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
