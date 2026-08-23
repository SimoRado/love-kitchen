import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateRegistrationCode,
  hashRegistrationCode,
  requireDeviceManagementAccess,
} from "@/lib/deviceAuth";

const VALID_DEVICE_TYPES = new Set(["POS", "KITCHEN", "ADMIN"]);

function safeDevice(device: {
  id: string;
  publicId: string;
  name: string;
  type: string;
  status: string;
  restaurantId: string;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
}) {
  return {
    id: device.id,
    publicId: device.publicId,
    name: device.name,
    type: device.type,
    status: device.status,
    restaurantId: device.restaurantId,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
    lastSeenAt: device.lastSeenAt,
    revokedAt: device.revokedAt,
  };
}

export async function GET(request: NextRequest) {
  const authError = await requireDeviceManagementAccess(request);
  if (authError) return authError;

  const devices = await prisma.device.findMany({ orderBy: [{ type: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json({ success: true, data: devices.map(safeDevice) });
}

export async function POST(request: NextRequest) {
  const authError = await requireDeviceManagementAccess(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : "Restaurant iPad";
    const type = typeof body.type === "string" ? body.type.toUpperCase() : "POS";
    const replaceDeviceId = typeof body.replaceDeviceId === "string" ? body.replaceDeviceId : null;

    if (!VALID_DEVICE_TYPES.has(type)) {
      return NextResponse.json({ success: false, error: "Invalid device type." }, { status: 400 });
    }

    if (replaceDeviceId) {
      const existing = await prisma.device.findUnique({ where: { id: replaceDeviceId } });
      if (!existing) return NextResponse.json({ success: false, error: "Device to replace was not found." }, { status: 404 });
    }

    const code = generateRegistrationCode();
    const codeHash = await hashRegistrationCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const registration = await prisma.deviceRegistrationCode.create({
      data: {
        codeHash,
        deviceName: name,
        deviceType: type,
        restaurantId: "default",
        replaceDeviceId,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        code,
        expiresAt: registration.expiresAt,
        replaceDeviceId,
        deviceName: registration.deviceName,
        deviceType: registration.deviceType,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create device registration code:", error);
    return NextResponse.json({ success: false, error: "Could not create registration code." }, { status: 500 });
  }
}
