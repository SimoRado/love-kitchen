import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME, getAdminUserFromRequest, invalidateAllAdminSessions } from "@/lib/auth";
import { recordAuditLog } from "@/lib/auditLog";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Active admin session required." },
        { status: 401 }
      );
    }

    const currentToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const currentSessionId = currentToken ? currentToken.split(".")[0] : null;

    const sessions = await prisma.adminSession.findMany({
      where: { adminId: admin.id, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });

    const enriched = sessions.map((s) => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    }));

    return NextResponse.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    console.error("List sessions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch active sessions." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Active admin session required." },
        { status: 401 }
      );
    }

    const currentToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const currentSessionId = currentToken ? currentToken.split(".")[0] : undefined;

    // Revoke all other sessions except current
    await invalidateAllAdminSessions(admin.id, currentSessionId);

    await recordAuditLog("SESSIONS_REVOKED", {
      adminId: admin.id,
      details: { retainedSessionId: currentSessionId },
      req: request,
    });

    return NextResponse.json({
      success: true,
      message: "All other active sessions have been revoked.",
    });
  } catch (error) {
    console.error("Revoke sessions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to revoke other sessions." },
      { status: 500 }
    );
  }
}
