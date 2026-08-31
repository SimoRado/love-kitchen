import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserFromRequest, invalidateAllAdminSessions } from "@/lib/auth";
import { verifyPassword, hashPassword } from "@/lib/password";
import { sendSecurityAlertEmail } from "@/lib/emailService";
import { recordAuditLog } from "@/lib/auditLog";

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Active admin session required." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: "All password fields are required." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "New password and confirmation do not match." },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const isCurrentValid = await verifyPassword(currentPassword, admin.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        { success: false, error: "Incorrect current password." },
        { status: 401 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash },
    });

    const currentToken = request.cookies.get("resto_admin_session")?.value;
    const currentSessionId = currentToken ? currentToken.split(".")[0] : undefined;

    // Invalidate all open sessions across other devices while preserving the current active session
    await invalidateAllAdminSessions(admin.id, currentSessionId);

    await sendSecurityAlertEmail(
      admin.email,
      "Your Administrator Password Has Been Updated",
      "Your administrator dashboard password was successfully updated. All other active computer sessions have been invalidated."
    );

    await recordAuditLog("PASSWORD_CHANGED", {
      adminId: admin.id,
      details: { email: admin.email },
      req: request,
    });

    return NextResponse.json({
      success: true,
      message: "Password updated successfully. All other sessions have been signed out.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update password. Please try again." },
      { status: 500 }
    );
  }
}
