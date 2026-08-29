import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminSessionToken,
} from "./lib/auth";
import { POS_DEVICE_COOKIE_NAME } from "./lib/deviceAuth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const hasPosCookie = Boolean(request.cookies.get(POS_DEVICE_COOKIE_NAME)?.value);
  const isAuthenticatedAdmin = await verifyAdminSessionToken(adminToken);

  // 1. POS routes: Always accessible directly (renders registration UI if un-paired, or register UI if paired)
  if (pathname === "/admin/pos" || pathname.startsWith("/admin/pos/")) {
    return NextResponse.next();
  }

  // 2. Admin Login Page:
  if (pathname === "/admin/login") {
    if (isAuthenticatedAdmin) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    // Isolate POS device: Prevent cashiers on registered POS iPads from accessing the admin login form
    if (hasPosCookie) {
      return NextResponse.redirect(new URL("/admin/pos", request.url));
    }
    return NextResponse.next();
  }

  // 3. Protected Admin Management Routes (/admin, /admin/products, /admin/settings, /admin/devices, etc.)
  if (!isAuthenticatedAdmin) {
    // If the client is a registered POS iPad attempting to access admin routes, bounce back to POS interface
    if (hasPosCookie) {
      return NextResponse.redirect(new URL("/admin/pos", request.url));
    }

    // Unauthenticated general browser: redirect to admin login
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    if (adminToken) {
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
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

