import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_DAYS = [
  { dayOfWeek: 1, dayName: "Monday", openTime: "09:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 2, dayName: "Tuesday", openTime: "09:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 3, dayName: "Wednesday", openTime: "09:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 4, dayName: "Thursday", openTime: "09:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 5, dayName: "Friday", openTime: "09:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 6, dayName: "Saturday", openTime: "09:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 0, dayName: "Sunday", openTime: "09:00", closeTime: "23:00", isClosed: false },
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
      // Auto create default settings
      settings = await prisma.restaurantSettings.create({
        data: {
          id: "default",
          name: "Le Gourmet",
          phone: "+212 522 123456",
          address: "72 Boulevard Massira Khadra, Casablanca",
          currency: "MAD",
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

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error("Error fetching restaurant settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      phone,
      address,
      currency,
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
