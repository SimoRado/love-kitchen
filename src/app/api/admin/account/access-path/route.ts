import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserFromRequest } from "@/lib/auth";

import { verifyPassword } from "@/lib/password";
import { validateAdminAccessPath, invalidateAdminAccessPathCache } from "@/lib/adminAccount";
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
    const { currentPassword, newAccessPath } = body;

    if (!currentPassword || !newAccessPath) {
      return NextResponse.json(
        { success: false, error: "Current password and new access path are required." },
        { status: 400 }
      );
    }

    // Validate proposed path
    const validation = validateAdminAccessPath(newAccessPath);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error || "Invalid access path format." },
        { status: 400 }
      );
    }

    const normalizedPath = newAccessPath.trim().toLowerCase();

    // Verify current password
    const isCurrentValid = await verifyPassword(currentPassword, admin.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        { success: false, error: "Incorrect current password." },
        { status: 401 }
      );
    }

    const previousPath = admin.adminAccessPath;

    const updated = await prisma.adminUser.update({
      where: { id: admin.id },
      data: { adminAccessPath: normalizedPath },
    });

    invalidateAdminAccessPathCache();

    await recordAuditLog("ACCESS_PATH_CHANGED", {
      adminId: admin.id,
      details: { previousPath, newPath: normalizedPath },
      req: request,
    });

    return NextResponse.json({
      success: true,
      message: `Admin access URL updated to /${normalizedPath}`,
      data: {
        id: updated.id,
        email: updated.email,
        adminAccessPath: updated.adminAccessPath,
      },
    });
  } catch (error) {
    console.error("Change access path error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update access path. Please try again." },
      { status: 500 }
    );
  }
}
