import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaffRole, getDeviceFromRequest } from "@/lib/deviceAuth";

export async function GET(request: NextRequest) {
  const [device, role] = await Promise.all([
    getDeviceFromRequest(request),
    getCurrentStaffRole(request),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      device: device ? {
        id: device.id,
        publicId: device.publicId,
        name: device.name,
        type: device.type,
        status: device.status,
        lastSeenAt: device.lastSeenAt,
      } : null,
      staffAuthenticated: Boolean(role),
      role,
    },
  });
}