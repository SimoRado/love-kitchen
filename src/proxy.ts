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

  // 1. POS routes: Always accessible directly at /admin/pos
  if (pathname === "/admin/pos" || pathname.startsWith("/admin/pos/")) {
    return NextResponse.next();
  }

  // 2. Custom Admin Entry Path (e.g. /lovekitchen or configured access path)
  if (normalizedPath === adminAccessPath && normalizedPath !== "admin") {
    if (hasAdminCookie) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    // Unauthenticated: rewrite internally to login form while keeping URL in address bar
    return NextResponse.rewrite(new URL("/admin/login", request.url));
  }

  // 3. /admin/login page
  if (pathname === "/admin/login") {
    if (hasAdminCookie) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // 4. Admin Dashboard & Sub-routes (/admin, /admin/products, /admin/settings, /admin/devices, /admin/security, etc.)
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (hasAdminCookie) {
      return NextResponse.next();
    }

    // Unauthenticated user: directly open the admin login page
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // 5. Storefront & Public Routes: Pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
