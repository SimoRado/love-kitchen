import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, clearAdminSessionCookie, getAdminUserFromRequest, invalidateSessionByToken } from "@/lib/auth";
import { recordAuditLog } from "@/lib/auditLog";

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(request);
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

    if (token) {
      await invalidateSessionByToken(token);
    }

    if (admin) {
      await recordAuditLog("LOGOUT", {
        adminId: admin.id,
        details: { email: admin.email },
        req: request,
      });
    }

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully.",
    });

    clearAdminSessionCookie(response);
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    const response = NextResponse.json({ success: true, message: "Logged out." });
    clearAdminSessionCookie(response);
    return response;
  }
}
