import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createDeviceCredentialCookie,
  createPublicDeviceId,
  hashRegistrationCode,
  normalizeRegistrationCode,
  setDeviceCookie,
} from "@/lib/deviceAuth";
import { publishOrderEvent } from "@/lib/orderEvents";

const VALID_DEVICE_TYPES = new Set(["POS", "KITCHEN", "ADMIN"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawCode = typeof body.code === "string" ? body.code : "";
    const code = normalizeRegistrationCode(rawCode);
    if (!code) {
      return NextResponse.json({ success: false, error: "Pairing code is required." }, { status: 400 });
    }

    const codeHash = await hashRegistrationCode(code);

    const registration = await prisma.deviceRegistrationCode.findUnique({ where: { codeHash } });
    if (!registration || registration.usedAt || registration.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ success: false, error: "Invalid or expired pairing code." }, { status: 400 });
    }
    if (!VALID_DEVICE_TYPES.has(registration.deviceType)) {
      return NextResponse.json({ success: false, error: "Invalid device type." }, { status: 400 });
    }

    const isReconnect = Boolean(registration.replaceDeviceId && registration.restaurantId === "reconnect");

    const result = await prisma.$transaction(async (tx) => {
      // 1. Reconnect existing registered device
      if (isReconnect && registration.replaceDeviceId) {
        const existingDevice = await tx.device.findUnique({
          where: { id: registration.replaceDeviceId },
        });

        if (!existingDevice) {
          throw new Error("Device to connect was not found.");
        }

        const finalCookie = await createDeviceCredentialCookie(existingDevice.id);
        const updatedDevice = await tx.device.update({
          where: { id: existingDevice.id },
          data: {
            credentialHash: finalCookie.credentialHash,
            status: "ACTIVE",
            revokedAt: null,
            lastSeenAt: new Date(),
          },
        });

        await tx.deviceRegistrationCode.update({
          where: { id: registration.id },
          data: { usedAt: new Date() },
        });

        return { device: updatedDevice, cookieValue: finalCookie.cookieValue };
      }

      // 2. Standard device registration with optional replacement
      if (registration.replaceDeviceId) {
        await tx.device.updateMany({
          where: { id: registration.replaceDeviceId },
          data: { status: "REVOKED", revokedAt: new Date() },
        });
      }

      const initialCookie = await createDeviceCredentialCookie("pending");
      const device = await tx.device.create({
        data: {
          publicId: createPublicDeviceId(registration.deviceType as "POS" | "KITCHEN" | "ADMIN"),
          name: registration.deviceName,
          type: registration.deviceType,
          status: "ACTIVE",
          restaurantId: registration.restaurantId === "reconnect" ? "default" : registration.restaurantId,
          credentialHash: initialCookie.credentialHash,
          lastSeenAt: new Date(),
        },
      });
      const finalCookie = await createDeviceCredentialCookie(device.id);
      const updatedDevice = await tx.device.update({
        where: { id: device.id },
        data: { credentialHash: finalCookie.credentialHash },
      });
      await tx.deviceRegistrationCode.update({ where: { id: registration.id }, data: { usedAt: new Date() } });
      return { device: updatedDevice, cookieValue: finalCookie.cookieValue };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (registration.replaceDeviceId && !isReconnect) {
      publishOrderEvent({ type: "device-revoked", deviceId: registration.replaceDeviceId });
    }

    const response = NextResponse.json({
      success: true,
      data: {
        device: {
          id: result.device.id,
          publicId: result.device.publicId,
          name: result.device.name,
          type: result.device.type,
          status: result.device.status,
        },
      },
      message: "POS successfully registered.",
    });
    setDeviceCookie(response, result.cookieValue);
    return response;
  } catch (error) {
    console.error("Device registration failed:", error);
    return NextResponse.json({ success: false, error: "Could not register this device." }, { status: 500 });
  }
}