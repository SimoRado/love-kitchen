import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearDeviceCookie, getDeviceFromRequest, requireDeviceManagementAccess } from "@/lib/deviceAuth";
import { publishOrderEvent } from "@/lib/orderEvents";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES = new Set(["ACTIVE", "INACTIVE", "REVOKED"]);

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authError = await requireDeviceManagementAccess(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();
    const data: { name?: string; status?: string; revokedAt?: Date | null } = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ success: false, error: "Device name cannot be empty." }, { status: 400 });
      data.name = name.slice(0, 80);
    }

    if (typeof body.status === "string") {
      const status = body.status.toUpperCase();
      if (!VALID_STATUSES.has(status)) {
        return NextResponse.json({ success: false, error: "Invalid device status." }, { status: 400 });
      }
      data.status = status;
      data.revokedAt = status === "REVOKED" ? new Date() : null;
    }

    const device = await prisma.device.update({ where: { id }, data });
    if (device.status === "REVOKED") {
      publishOrderEvent({ type: "device-revoked", deviceId: device.id });
    }

    const response = NextResponse.json({ success: true, data: device });
    const currentDevice = await getDeviceFromRequest(request);
    if (currentDevice?.id === device.id && device.status !== "ACTIVE") {
      clearDeviceCookie(response);
    }
    return response;
  } catch (error) {
    console.error("Failed to update device:", error);
    return NextResponse.json({ success: false, error: "Could not update device." }, { status: 500 });
  }
}
