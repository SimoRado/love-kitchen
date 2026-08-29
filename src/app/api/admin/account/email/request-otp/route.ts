import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserFromRequest } from "@/lib/auth";

import { verifyPassword } from "@/lib/password";
import { createAdminOtp } from "@/lib/otp";
import { sendEmailVerificationOtp } from "@/lib/emailService";
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

    const rateLimit = await checkRateLimit(`change-email:ip:${ip}`, 3, 300);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many email change requests. Please wait a few minutes before trying again.",
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { currentPassword, newEmail } = body;

    if (!currentPassword || !newEmail || typeof newEmail !== "string") {
      return NextResponse.json(
        { success: false, error: "Current password and new email address are required." },
        { status: 400 }
      );
    }

    const normalizedNewEmail = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+d/.test(normalizedNewEmail)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address format." },
        { status: 400 }
      );
    }

    if (normalizedNewEmail === admin.email) {
      return NextResponse.json(
        { success: false, error: "New email address must be different from current email." },
        { status: 400 }
      );
    }

    // Verify current password
    const isPasswordValid = await verifyPassword(currentPassword, admin.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Incorrect current password." },
        { status: 401 }
      );
    }

    // Check if new email is already taken by another admin
    const existingOther = await prisma.adminUser.findUnique({
      where: { email: normalizedNewEmail },
    });
    if (existingOther && existingOther.id !== admin.id) {
      return NextResponse.json(
        { success: false, error: "This email address is already in use by another account." },
        { status: 409 }
      );
    }

    // Generate 10-minute OTP
    const { code } = await createAdminOtp(admin.id, "EMAIL_CHANGE", normalizedNewEmail);

    await sendEmailVerificationOtp(normalizedNewEmail, code);

    await recordAuditLog("EMAIL_CHANGE_OTP_REQUESTED", {
      adminId: admin.id,
      details: { fromEmail: admin.email, toEmail: normalizedNewEmail },
      req: request,
    });

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedNewEmail}. Valid for 10 minutes.`,
    });
  } catch (error) {
    console.error("Email change request OTP error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initiate email change. Please try again." },
      { status: 500 }
    );
  }
}
