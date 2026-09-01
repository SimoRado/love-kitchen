import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { findAdminByEmail, getOrCreateDefaultAdmin } from "@/lib/adminAccount";
import { verifyPassword } from "@/lib/password";
import { createAdminSession, setAdminSessionCookie } from "@/lib/auth";
import { getDeviceFromRequest } from "@/lib/deviceAuth";
import { recordAuditLog } from "@/lib/auditLog";

export async function POST(request: NextRequest) {
  try {
    // 0. POS Device Terminal Lock: Active registered POS devices cannot elevate to Admin
    const activePosDevice = await getDeviceFromRequest(request);
    if (activePosDevice && activePosDevice.status === "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: "Administrator login is not available on registered POS terminals.",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let { email, password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Password is required." },
        { status: 400 }
      );
    }

    let admin = null;
    if (email && typeof email === "string" && email.trim()) {
      admin = await findAdminByEmail(email);
    } else {
      admin = await getOrCreateDefaultAdmin();
    }

    if (!admin) {
      await recordAuditLog("LOGIN_FAILED", {
        details: { attemptedEmail: typeof email === "string" ? email.trim().toLowerCase() : "default", reason: "Account not found" },
        req: request,
      });
      return NextResponse.json(
        { success: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, admin.passwordHash);
    if (!isValidPassword) {
      await recordAuditLog("LOGIN_FAILED", {
        adminId: admin.id,
        details: { attemptedEmail: admin.email, reason: "Incorrect password" },
        req: request,
      });
      return NextResponse.json(
        { success: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // 1. Create database-backed multi-device session (30 days persistent)
    const { token } = await createAdminSession(admin.id, request);
    await recordAuditLog("LOGIN_SUCCESS", {
      adminId: admin.id,
      details: { email: admin.email },
      req: request,
    });

    const response = NextResponse.json({
      success: true,
      message: "Admin authenticated successfully.",
      data: {
        id: admin.id,
        email: admin.email,
        adminAccessPath: admin.adminAccessPath,
      },
    });

    setAdminSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication service error. Please try again." },
      { status: 500 }
    );
  }
}
