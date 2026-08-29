import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { findAdminByEmail } from "@/lib/adminAccount";
import { verifyPassword, hashPassword } from "@/lib/password";
import { verifyAdminOtp } from "@/lib/otp";
import { invalidateAllAdminSessions } from "@/lib/auth";
import { sendSecurityAlertEmail } from "@/lib/emailService";
import { checkRateLimit } from "@/lib/rateLimit";
import { recordAuditLog } from "@/lib/auditLog";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateLimit = await checkRateLimit(`reset-pass:ip:${ip}`, 5, 300);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many reset attempts. Please wait a few minutes before trying again.",
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { email, otp, newPassword, confirmPassword } = body;

    if (!email || !otp || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: "All fields are required." },
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

    const admin = await findAdminByEmail(email);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Invalid request or expired verification code." },
        { status: 400 }
      );
    }

    const verifyResult = await verifyAdminOtp(admin.id, "PASSWORD_RESET", otp, admin.email);
    if (!verifyResult.valid) {
      return NextResponse.json(
        { success: false, error: verifyResult.error || "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash },
    });

    // Invalidate all active sessions across all devices
    await invalidateAllAdminSessions(admin.id);

    await sendSecurityAlertEmail(
      admin.email,
      "Your Administrator Password Has Been Reset",
      "Your administrator dashboard password was successfully reset using a security verification code. All active sessions have been invalidated."
    );

    await recordAuditLog("PASSWORD_RESET", {
      adminId: admin.id,
      details: { email: admin.email },
      req: request,
    });

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reset password. Please try again." },
      { status: 500 }
    );
  }
}
