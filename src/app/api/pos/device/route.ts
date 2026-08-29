import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaffRole, getDeviceFromRequest } from "@/lib/deviceAuth";

export async function GET(request: NextRequest) {
  const [device, adminRole] = await Promise.all([
    getDeviceFromRequest(request),
    getCurrentStaffRole(request),
  ]);

  const isRegistered = Boolean(device && device.status === "ACTIVE");

  return NextResponse.json({
    success: true,
    data: {
      device: device
        ? {
            id: device.id,
            publicId: device.publicId,
            name: device.name,
            type: device.type,
            status: device.status,
            lastSeenAt: device.lastSeenAt,
          }
        : null,
      isRegistered,
      staffAuthenticated: isRegistered || Boolean(adminRole),
      role: adminRole || (isRegistered ? "POS" : null),
    },
  });
}