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

function normalizeOverrideFromDb(raw: any): boolean | null {
  if (raw === 1 || raw === true || raw === "1" || raw === "true") return true;
  if (raw === 0 || raw === false || raw === "0" || raw === "false") return false;
  return null;
}

function normalizeOverrideToDb(raw: any): number | null {
  if (raw === true || raw === 1 || raw === "true" || raw === "1") return 1;
  if (raw === false || raw === 0 || raw === "false" || raw === "0") return 0;
  return null;
}

export async function GET() {
  try {
    const rawSettings = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        subtitle: string | null;
        phone: string;
        address: string;
        googleMapsUrl: string | null;
        whatsappNumber: string | null;
        currency: string;
        deliveryFee: number;
        isOpenOverride: boolean | number | string | null;
        isAutoHours: boolean | number;
      }>
    >('SELECT * FROM "RestaurantSettings" WHERE "id" = "default" LIMIT 1');

    let settings = rawSettings && rawSettings.length > 0 ? rawSettings[0] : null;

    if (!settings) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "RestaurantSettings" ("id", "name", "subtitle", "phone", "address", "googleMapsUrl", "whatsappNumber", "currency", "deliveryFee", "isOpenOverride", "isAutoHours", "createdAt", "updatedAt") 
         VALUES ('default', 'Dark Kitchen', 'Artisanal Kitchen & Delivery', '+212 522 123456', 'N° 6, quartier les princesses, Résidence Miradore A, Rue Al Jounaid Arsat Lakbir, Casablanca', NULL, NULL, 'MAD', 15, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
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

    const parsedIsOpenOverride = normalizeOverrideFromDb(settings.isOpenOverride);

    // Return public-safe settings data only
    const publicSettings = {
      id: settings.id,
      name: settings.name,
      subtitle: settings.subtitle ?? null,
      phone: settings.phone,
      address: settings.address,
      googleMapsUrl: settings.googleMapsUrl ?? null,
      whatsappNumber: settings.whatsappNumber ?? null,
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
      googleMapsUrl,
      whatsappNumber,
      currency,
      deliveryFee,
      isOpenOverride,
      isAutoHours,
      openingHours,
    } = body;

    // Load existing
    const rawExisting = await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "RestaurantSettings" WHERE "id" = "default" LIMIT 1'
    );
    const existing = rawExisting && rawExisting.length > 0 ? rawExisting[0] : null;

    const effectiveName =
      name !== undefined && typeof name === "string" && name.trim() !== ""
        ? name.trim()
        : existing?.name ?? "Dark Kitchen";

    const sanitizedSubtitle =
      subtitle !== undefined
        ? subtitle !== null && typeof subtitle === "string" && subtitle.trim() !== ""
          ? subtitle.trim()
          : null
        : (existing?.subtitle ?? null);

    const numericDeliveryFee =
      deliveryFee !== undefined && deliveryFee !== null
        ? roundMoney(Math.max(0, Number(deliveryFee)))
        : Number(existing?.deliveryFee ?? 15);

    const effectivePhone = phone !== undefined ? phone.trim() : (existing?.phone ?? "+212 522 123456");
    const effectiveAddress =
      address !== undefined
        ? address.trim()
        : (existing?.address ?? "N° 6, quartier les princesses, Résidence Miradore A, Rue Al Jounaid Arsat Lakbir, Casablanca");

    const sanitizedGoogleMapsUrl =
      googleMapsUrl !== undefined
        ? googleMapsUrl !== null && typeof googleMapsUrl === "string" && googleMapsUrl.trim() !== ""
          ? googleMapsUrl.trim()
          : null
        : (existing?.googleMapsUrl ?? null);

    const sanitizedWhatsappNumber =
      whatsappNumber !== undefined
        ? whatsappNumber !== null && typeof whatsappNumber === "string" && whatsappNumber.trim() !== ""
          ? whatsappNumber.trim()
          : null
        : (existing?.whatsappNumber ?? null);

    const effectiveCurrency = currency !== undefined ? currency.trim() : (existing?.currency ?? "MAD");
    
    // Normalize override input: true => 1, false => 0, null => NULL
    const effectiveIsOpenOverride =
      isOpenOverride === undefined
        ? normalizeOverrideToDb(existing?.isOpenOverride)
        : normalizeOverrideToDb(isOpenOverride);

    const effectiveIsAutoHours =
      isAutoHours !== undefined ? (isAutoHours ? 1 : 0) : (existing?.isAutoHours ?? 1);

    if (!existing) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "RestaurantSettings" ("id", "name", "subtitle", "phone", "address", "googleMapsUrl", "whatsappNumber", "currency", "deliveryFee", "isOpenOverride", "isAutoHours", "createdAt", "updatedAt") 
         VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        effectiveName,
        sanitizedSubtitle,
        effectivePhone,
        effectiveAddress,
        sanitizedGoogleMapsUrl,
        sanitizedWhatsappNumber,
        effectiveCurrency,
        numericDeliveryFee,
        effectiveIsOpenOverride,
        effectiveIsAutoHours
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE "RestaurantSettings" 
         SET "name" = ?, "subtitle" = ?, "phone" = ?, "address" = ?, "googleMapsUrl" = ?, "whatsappNumber" = ?, "currency" = ?, "deliveryFee" = ?, "isOpenOverride" = ?, "isAutoHours" = ?, "updatedAt" = CURRENT_TIMESTAMP 
         WHERE "id" = 'default'`,
        effectiveName,
        sanitizedSubtitle,
        effectivePhone,
        effectiveAddress,
        sanitizedGoogleMapsUrl,
        sanitizedWhatsappNumber,
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

    const parsedIsOpenOverride = normalizeOverrideFromDb(updated.isOpenOverride);

    const updatedSettings = {
      id: updated.id,
      name: updated.name,
      subtitle: updated.subtitle ?? null,
      phone: updated.phone,
      address: updated.address,
      googleMapsUrl: updated.googleMapsUrl ?? null,
      whatsappNumber: updated.whatsappNumber ?? null,
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
