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
    const rawSettings = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        subtitle: string | null;
        phone: string;
        address: string;
        currency: string;
        deliveryFee: number;
        isOpenOverride: boolean | number | null;
        isAutoHours: boolean | number;
      }>
    >('SELECT * FROM "RestaurantSettings" WHERE "id" = "default" LIMIT 1');

    let settings = rawSettings && rawSettings.length > 0 ? rawSettings[0] : null;

    if (!settings) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "RestaurantSettings" ("id", "name", "subtitle", "phone", "address", "currency", "deliveryFee", "isOpenOverride", "isAutoHours", "createdAt", "updatedAt") 
         VALUES ('default', 'Love Kitchen', 'Artisanal Kitchen & Delivery', '+212 522 123456', '72 Boulevard Massira Khadra, Casablanca', 'MAD', 15, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      );

      for (const d of DEFAULT_DAYS) {
        await prisma.openingHour.create({
          data: {
            dayOfWeek: d.dayOfWeek,
            dayName: d.dayName,
            openTime: d.openTime,
            closeTime: d.closeTime,
            isClosed: d.isClosed,
            settingsId: "default",
          },
        });
      }

      const refreshed = await prisma.$queryRawUnsafe<any[]>(
        'SELECT * FROM "RestaurantSettings" WHERE "id" = "default" LIMIT 1'
      );
      settings = refreshed[0];
    }

    if (!settings) {
      throw new Error("Restaurant settings could not be retrieved or initialized.");
    }

    const openingHours = await prisma.openingHour.findMany({
      where: { settingsId: "default" },
      orderBy: { dayOfWeek: "asc" },
    });

    const parsedIsOpenOverride =
      settings.isOpenOverride === null || settings.isOpenOverride === undefined
        ? null
        : Boolean(settings.isOpenOverride);

    // Return public-safe settings data only
    const publicSettings = {
      id: settings.id,
      name: settings.name,
      subtitle: settings.subtitle ?? null,
      phone: settings.phone,
      address: settings.address,
      currency: settings.currency || "MAD",
      deliveryFee: roundMoney(Number(settings.deliveryFee ?? 15)),
      isOpenOverride: parsedIsOpenOverride,
      isAutoHours: Boolean(settings.isAutoHours),
      openingHours,
    };

    return NextResponse.json({ success: true, data: publicSettings });
  } catch (error) {
    console.error("Error fetching restaurant settings:", error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || "Failed to fetch settings" },
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
      subtitle,
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

    const sanitizedSubtitle =
      subtitle !== undefined && subtitle !== null && typeof subtitle === "string"
        ? subtitle.trim() || null
        : null;

    const numericDeliveryFee =
      deliveryFee !== undefined && deliveryFee !== null
        ? roundMoney(Math.max(0, Number(deliveryFee)))
        : 15;

    // Load existing
    const rawExisting = await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "RestaurantSettings" WHERE "id" = "default" LIMIT 1'
    );
    const existing = rawExisting && rawExisting.length > 0 ? rawExisting[0] : null;

    const effectivePhone = phone !== undefined ? phone.trim() : (existing?.phone ?? "");
    const effectiveAddress = address !== undefined ? address.trim() : (existing?.address ?? "");
    const effectiveCurrency = currency !== undefined ? currency.trim() : (existing?.currency ?? "MAD");
    const effectiveIsOpenOverride =
      isOpenOverride === undefined ? existing?.isOpenOverride : isOpenOverride;
    const effectiveIsAutoHours =
      isAutoHours !== undefined ? (isAutoHours ? 1 : 0) : (existing?.isAutoHours ?? 1);

    if (!existing) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "RestaurantSettings" ("id", "name", "subtitle", "phone", "address", "currency", "deliveryFee", "isOpenOverride", "isAutoHours", "createdAt", "updatedAt") 
         VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        name.trim(),
        sanitizedSubtitle,
        effectivePhone,
        effectiveAddress,
        effectiveCurrency,
        numericDeliveryFee,
        effectiveIsOpenOverride,
        effectiveIsAutoHours
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE "RestaurantSettings" 
         SET "name" = ?, "subtitle" = ?, "phone" = ?, "address" = ?, "currency" = ?, "deliveryFee" = ?, "isOpenOverride" = ?, "isAutoHours" = ?, "updatedAt" = CURRENT_TIMESTAMP 
         WHERE "id" = 'default'`,
        name.trim(),
        sanitizedSubtitle,
        effectivePhone,
        effectiveAddress,
        effectiveCurrency,
        numericDeliveryFee,
        effectiveIsOpenOverride,
        effectiveIsAutoHours
      );
    }

    // Update opening hours if provided
    if (Array.isArray(openingHours)) {
      for (const hour of openingHours) {
        if (typeof hour.dayOfWeek === "number") {
          const existingHour = hour.id
            ? await prisma.openingHour.findUnique({ where: { id: hour.id } })
            : await prisma.openingHour.findFirst({
                where: { settingsId: "default", dayOfWeek: hour.dayOfWeek },
              });

          if (existingHour) {
            await prisma.openingHour.update({
              where: { id: existingHour.id },
              data: {
                openTime: hour.openTime || "09:00",
                closeTime: hour.closeTime || "23:00",
                isClosed: Boolean(hour.isClosed),
              },
            });
          } else {
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
    }

    const rawUpdated = await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "RestaurantSettings" WHERE "id" = "default" LIMIT 1'
    );
    const updated = rawUpdated[0];

    const updatedOpeningHours = await prisma.openingHour.findMany({
      where: { settingsId: "default" },
      orderBy: { dayOfWeek: "asc" },
    });

    const parsedIsOpenOverride =
      updated.isOpenOverride === null || updated.isOpenOverride === undefined
        ? null
        : Boolean(updated.isOpenOverride);

    const updatedSettings = {
      id: updated.id,
      name: updated.name,
      subtitle: updated.subtitle ?? null,
      phone: updated.phone,
      address: updated.address,
      currency: updated.currency || "MAD",
      deliveryFee: roundMoney(Number(updated.deliveryFee ?? 15)),
      isOpenOverride: parsedIsOpenOverride,
      isAutoHours: Boolean(updated.isAutoHours),
      openingHours: updatedOpeningHours,
    };

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: "Restaurant settings updated successfully",
    });
  } catch (error) {
    console.error("Error updating restaurant settings:", error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || "Could not update restaurant settings." },
      { status: 500 }
    );
  }
}
