import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserFromRequest } from "@/lib/auth";

import { verifyAdminOtp } from "@/lib/otp";
import { sendSecurityAlertEmail } from "@/lib/emailService";
import { checkRateLimit } from "@/lib/rateLimit";
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

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateLimit = await checkRateLimit(`verify-email:ip:${ip}`, 5, 300);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many verification attempts. Please wait a few minutes before trying again.",
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { otp, newEmail } = body;

    if (!otp || !newEmail || typeof newEmail !== "string") {
      return NextResponse.json(
        { success: false, error: "Verification code and new email are required." },
        { status: 400 }
      );
    }

    const normalizedNewEmail = newEmail.trim().toLowerCase();

    const verifyResult = await verifyAdminOtp(admin.id, "EMAIL_CHANGE", otp, normalizedNewEmail);
    if (!verifyResult.valid) {
      return NextResponse.json(
        { success: false, error: verifyResult.error || "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    const previousEmail = admin.email;

    const updated = await prisma.adminUser.update({
      where: { id: admin.id },
      data: { email: normalizedNewEmail },
    });

    // Notify previous email about change
    await sendSecurityAlertEmail(
      previousEmail,
      "Your Administrator Email Address Has Been Changed",
      `Your Love Kitchen administrator account email was changed to ${normalizedNewEmail}. If you did not make this change, please contact technical support immediately.`
    );

    await recordAuditLog("EMAIL_CHANGED", {
      adminId: admin.id,
      details: { previousEmail, newEmail: normalizedNewEmail },
      req: request,
    });

    return NextResponse.json({
      success: true,
      message: "Administrator email address updated successfully.",
      data: {
        id: updated.id,
        email: updated.email,
        adminAccessPath: updated.adminAccessPath,
      },
    });
  } catch (error) {
    console.error("Verify email OTP error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify code and update email. Please try again." },
      { status: 500 }
    );
  }
}
