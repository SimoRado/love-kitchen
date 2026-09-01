import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserFromRequest } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
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
    const { currentPassword, newEmail } = body;

    if (!currentPassword || !newEmail || typeof newEmail !== "string") {
      return NextResponse.json(
        { success: false, error: "Current password and new email address are required." },
        { status: 400 }
      );
    }

    const normalizedNewEmail = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedNewEmail)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address format." },
        { status: 400 }
      );
    }

    if (normalizedNewEmail === admin.email.toLowerCase()) {
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

    // Check if new email is already taken by another account
    const existingOther = await prisma.adminUser.findUnique({
      where: { email: normalizedNewEmail },
    });
    if (existingOther && existingOther.id !== admin.id) {
      return NextResponse.json(
        { success: false, error: "This email address is already in use by another account." },
        { status: 409 }
      );
    }

    // Update AdminUser email directly (single-step, password verified)
    const updated = await prisma.adminUser.update({
      where: { id: admin.id },
      data: { email: normalizedNewEmail },
    });

    await recordAuditLog("EMAIL_CHANGED", {
      adminId: admin.id,
      details: { newEmail: normalizedNewEmail },
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
    console.error("Change email error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update email address. Please try again." },
      { status: 500 }
    );
  }
}

export const PUT = POST;
