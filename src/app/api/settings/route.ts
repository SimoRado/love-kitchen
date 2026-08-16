import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth";
import { roundMoney } from "@/lib/money";

const DEFAULT_DAYS = [
  { dayOfWeek: 1, dayName: "Monday", openTime: "11:30", closeTime: "23:30", isClosed: false },
  { dayOfWeek: 2, dayName: "Tuesday", openTime: "11:30", closeTime: "23:30", isClosed: false },
  { dayOfWeek: 3, dayName: "Wednesday", openTime: "11:30", closeTime: "23:30", isClosed: false },
  { dayOfWeek: 4, dayName: "Thursday", openTime: "11:30", closeTime: "23:30", isClosed: false },
  { dayOfWeek: 5, dayName: "Friday", openTime: "11:30", closeTime: "00:30", isClosed: false },
  { dayOfWeek: 6, dayName: "Saturday", openTime: "11:30", closeTime: "00:30", isClosed: false },
  { dayOfWeek: 0, dayName: "Sunday", openTime: "12:00", closeTime: "23:00", isClosed: false },
];

export async function GET() {
  try {
    let settings = await prisma.restaurantSettings.findUnique({
      where: { id: "default" },
      include: {
        openingHours: {
          orderBy: { dayOfWeek: "asc" },
        },
      },
    });

    if (!settings) {
      settings = await prisma.restaurantSettings.create({
        data: {
          id: "default",
          name: "Love Kitchen",
          phone: "+212 522 123456",
          address: "72 Boulevard Massira Khadra, Casablanca",
          currency: "MAD",
          deliveryFee: 15,
          isOpenOverride: null,
          isAutoHours: true,
          openingHours: {
            create: DEFAULT_DAYS,
          },
        },
        include: {
          openingHours: {
            orderBy: { dayOfWeek: "asc" },
          },
        },
      });
    }

    // Return public-safe settings data only
    const publicSettings = {
      id: settings.id,
      name: settings.name,
      phone: settings.phone,
      address: settings.address,
      currency: settings.currency || "MAD",
      deliveryFee: roundMoney(settings.deliveryFee ?? 15),
      isOpenOverride: settings.isOpenOverride,
      isAutoHours: settings.isAutoHours,
      openingHours: settings.openingHours,
    };

    return NextResponse.json({ success: true, data: publicSettings });
  } catch (error) {
    console.error("Error fetching restaurant settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      name,
      phone,
      address,
      currency,
      deliveryFee,
      isOpenOverride,
      isAutoHours,
      openingHours,
    } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Restaurant name is required" },
        { status: 400 }
      );
    }

    const numericDeliveryFee =
      deliveryFee !== undefined && deliveryFee !== null
        ? roundMoney(Math.max(0, Number(deliveryFee)))
        : 15;

    // Ensure settings record exists
    const existing = await prisma.restaurantSettings.findUnique({
      where: { id: "default" },
    });

    if (!existing) {
      await prisma.restaurantSettings.create({
        data: {
          id: "default",
          name: name.trim(),
          phone: phone ? phone.trim() : "",
          address: address ? address.trim() : "",
          currency: currency ? currency.trim() : "MAD",
          deliveryFee: numericDeliveryFee,
          isOpenOverride: isOpenOverride === undefined ? null : isOpenOverride,
          isAutoHours: isAutoHours !== undefined ? Boolean(isAutoHours) : true,
        },
      });
    } else {
      await prisma.restaurantSettings.update({
        where: { id: "default" },
        data: {
          name: name.trim(),
          phone: phone ? phone.trim() : "",
          address: address ? address.trim() : "",
          currency: currency ? currency.trim() : "MAD",
          deliveryFee: numericDeliveryFee,
          isOpenOverride: isOpenOverride === undefined ? existing.isOpenOverride : isOpenOverride,
          isAutoHours: isAutoHours !== undefined ? Boolean(isAutoHours) : existing.isAutoHours,
        },
      });
    }

    // Update opening hours if provided
    if (Array.isArray(openingHours)) {
      for (const hour of openingHours) {
        if (hour.id) {
          await prisma.openingHour.update({
            where: { id: hour.id },
            data: {
              openTime: hour.openTime || "09:00",
              closeTime: hour.closeTime || "23:00",
              isClosed: Boolean(hour.isClosed),
            },
          });
        } else if (typeof hour.dayOfWeek === "number") {
          await prisma.openingHour.create({
            data: {
              dayOfWeek: hour.dayOfWeek,
              dayName: hour.dayName || "",
              openTime: hour.openTime || "09:00",
              closeTime: hour.closeTime || "23:00",
              isClosed: Boolean(hour.isClosed),
              settingsId: "default",
            },
          });
        }
      }
    }

    const updatedSettings = await prisma.restaurantSettings.findUnique({
      where: { id: "default" },
      include: {
        openingHours: {
          orderBy: { dayOfWeek: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: "Restaurant settings updated successfully",
    });
  } catch (error) {
    console.error("Error updating restaurant settings:", error);
    return NextResponse.json(
      { success: false, error: "Could not update restaurant settings. Please try again." },
      { status: 500 }
    );
  }
}
