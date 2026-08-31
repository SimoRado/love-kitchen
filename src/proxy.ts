import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "resto_admin_session";
export const POS_DEVICE_COOKIE_NAME = "resto_pos_device";
export const DEFAULT_ADMIN_ACCESS_PATH = (process.env.ADMIN_ACCESS_PATH || "lovekitchen").toLowerCase();

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const hasAdminCookie = Boolean(adminToken && adminToken.length > 10);
  const adminAccessPath = DEFAULT_ADMIN_ACCESS_PATH;
  const normalizedPath = pathname.replace(/^\//, "").toLowerCase();

  // Helper: strict cache prevention headers (prevents bfcache and browser caching)
  const withNoCache = (res: NextResponse) => {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
    return res;
  };

  // ─── ROUTING ARCHITECTURE ──────────────────────────────────────────────
  //
  // 1. POS routes (/admin/pos, /admin/pos/*)
  //    Always accessible directly. The POS page and POS APIs independently
  //    verify the registered POS device in the database.
  //
  // 2. Custom Admin Entry Path (e.g. /lovekitchen or configured access path)
  //    - If Admin session present → redirect to /admin
  //    - If unauthenticated → rewrite to /admin/login
  //
  // 3. Admin Login Page (/admin/login)
  //    - Always serves the login page directly (no automatic redirect to /admin/pos).
  //
  // 4. Admin Dashboard & Protected Sub-routes (/admin, /admin/products, /admin/settings, etc.)
  //    - If Admin session present → allow access to /admin
  //    - If missing or unauthenticated → redirect to /admin/login (NEVER /admin/pos).
  //
  // 5. Storefront & Public Routes
  //    - Pass through.
  // ───────────────────────────────────────────────────────────────────────

  // 1. POS routes: Always accessible directly at /admin/pos
  if (pathname === "/admin/pos" || pathname.startsWith("/admin/pos/")) {
    return withNoCache(NextResponse.next());
  }

  // 2. Custom Admin Entry Path (e.g. /lovekitchen or configured access path)
  if (normalizedPath === adminAccessPath && normalizedPath !== "admin") {
    if (hasAdminCookie) {
      return withNoCache(NextResponse.redirect(new URL("/admin", request.url)));
    }
    // Unauthenticated: rewrite internally to login form while keeping URL in address bar
    return withNoCache(NextResponse.rewrite(new URL("/admin/login", request.url)));
  }

  // 3. Admin Login Page (/admin/login)
  if (pathname === "/admin/login") {
    return withNoCache(NextResponse.next());
  }

  // 4. Admin Dashboard & Protected Sub-routes (/admin, /admin/products, /admin/settings, etc.)
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // If admin session cookie present, pass through to allow page/server-side validation
    if (hasAdminCookie) {
      return withNoCache(NextResponse.next());
    }

    // Unauthenticated visitor (regardless of whether a POS cookie exists) → redirect to admin login
    return withNoCache(NextResponse.redirect(new URL("/admin/login", request.url)));
  }

  // 5. Storefront & Public Routes: Pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
