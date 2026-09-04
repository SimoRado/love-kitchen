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

  // ─── CANONICAL ROUTING ARCHITECTURE ──────────────────────────────────
  //
  // 1. POS canonical entry (/admin/pos, /admin/pos/*)
  //    Always accessible directly. The POS page and POS APIs independently
  //    verify the registered POS device in PostgreSQL.
  //    - Registered active device → POS register
  //    - Unregistered / invalid → POS pairing code screen
  //
  // 2. Custom Admin Entry Path (e.g. /lovekitchen or configured access path)
  //    - If Admin session present → redirect to /admin
  //    - Unauthenticated → rewrite to /admin/login
  //
  // 3. Admin Login Page (/admin/login)
  //    - If Admin session present → redirect to /admin
  //    - Unauthenticated → serve login page directly (200 OK)
  //
  // 4. Admin Portal & Protected Sub-routes (/admin, /admin/products, /admin/settings, etc.)
  //    - If Admin session present → allow access to Admin dashboard (200 OK)
  //    - If missing, invalid, or no admin session → redirect strictly to /admin/login (307)
  //    - Absence of an admin session NEVER converts /admin into /admin/pos
  //
  // 5. Storefront & Public Routes
  //    - Pass through.
  // ───────────────────────────────────────────────────────────────────────

  // 0. API Route Protection (Centralized CSRF / Origin Verification)
  if (pathname.startsWith("/api/")) {
    const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
    if (isStateChanging) {
      const host = (
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        request.nextUrl.host
      ).toLowerCase();

      const origin = request.headers.get("origin");
      if (origin) {
        try {
          const originHost = new URL(origin).host.toLowerCase();
          if (originHost !== host) {
            return NextResponse.json(
              { success: false, error: "Cross-origin request forbidden." },
              { status: 403 }
            );
          }
        } catch {
          return NextResponse.json(
            { success: false, error: "Invalid request origin." },
            { status: 400 }
          );
        }
      } else {
        const referer = request.headers.get("referer");
        if (referer) {
          try {
            const refererHost = new URL(referer).host.toLowerCase();
            if (refererHost !== host) {
              return NextResponse.json(
                { success: false, error: "Cross-origin request forbidden." },
                { status: 403 }
              );
            }
          } catch {
            return NextResponse.json(
              { success: false, error: "Invalid request referer." },
              { status: 400 }
            );
          }
        }
      }
    }
    return NextResponse.next();
  }

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
    if (hasAdminCookie) {
      return withNoCache(NextResponse.redirect(new URL("/admin", request.url)));
    }
    return withNoCache(NextResponse.next());
  }

  // 4. Admin Portal & Protected Sub-routes (/admin, /admin/products, /admin/settings, /admin/devices, /admin/security, /admin/orders, /admin/categories)
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // If admin session cookie present, pass through to allow page & server-side validation
    if (hasAdminCookie) {
      return withNoCache(NextResponse.next());
    }

    // Unauthenticated visitor (no cookies, stale POS cookie, etc.) → redirect strictly to /admin/login
    return withNoCache(NextResponse.redirect(new URL("/admin/login", request.url)));
  }

  // 5. Storefront & Public Routes: Pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
