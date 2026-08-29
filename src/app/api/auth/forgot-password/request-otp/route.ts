import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { findAdminByEmail } from "@/lib/adminAccount";
import { createAdminOtp } from "@/lib/otp";
import { sendPasswordResetOtpEmail } from "@/lib/emailService";
import { checkRateLimit } from "@/lib/rateLimit";
import { recordAuditLog } from "@/lib/auditLog";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateLimit = await checkRateLimit(`forgot-pass:ip:${ip}`, 3, 300);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many password reset requests. Please wait a few minutes before trying again.",
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Please enter a valid administrator email address." },
        { status: 400 }
      );
    }

    const admin = await findAdminByEmail(email);

    // Generic positive response to prevent user enumeration
    if (!admin) {
      return NextResponse.json({
        success: true,
        message: "If an account matches this email, a 6-digit verification code has been dispatched.",
      });
    }

    // Generate 10-minute OTP
    const { code } = await createAdminOtp(admin.id, "PASSWORD_RESET", admin.email);

    await sendPasswordResetOtpEmail(admin.email, code);

    await recordAuditLog("PASSWORD_RESET_REQUESTED", {
      adminId: admin.id,
      details: { email: admin.email },
      req: request,
    });

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${admin.email}. Valid for 10 minutes.`,
    });
  } catch (error) {
    console.error("Forgot password request OTP error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to dispatch reset code. Please try again." },
      { status: 500 }
    );
  }
}
