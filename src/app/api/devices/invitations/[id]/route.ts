import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDeviceManagementAccess } from "@/lib/deviceAuth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authError = await requireDeviceManagementAccess(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    await prisma.deviceRegistrationCode.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Pairing invitation cancelled." });
  } catch (error) {
    console.error("Failed to cancel pairing invitation:", error);
    return NextResponse.json({ success: false, error: "Could not cancel invitation." }, { status: 500 });
  }
}
