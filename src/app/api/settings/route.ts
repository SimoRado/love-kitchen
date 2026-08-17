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
          name: "Dark Kitchen",
          subtitle: "Artisanal Kitchen & Delivery",
          phone: "+212 522 123456",
          address: "N° 6, quartier les princesses, Résidence Miradore A, Rue Al Jounaid Arsat Lakbir, Casablanca",
          currency: "MAD",
          deliveryFee: 15,
          isOpenOverride: null,
          isAutoHours: true,
          openingHours: {
            create: DEFAULT_DAYS.map((d) => ({
              dayOfWeek: d.dayOfWeek,
              dayName: d.dayName,
              openTime: d.openTime,
              closeTime: d.closeTime,
              isClosed: d.isClosed,
            })),
          },
        },
        include: {
          openingHours: {
            orderBy: { dayOfWeek: "asc" },
          },
        },
      });
    }

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
      isOpenOverride: settings.isOpenOverride,
      isAutoHours: Boolean(settings.isAutoHours),
      openingHours: settings.openingHours,
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

    const existing = await prisma.restaurantSettings.findUnique({
      where: { id: "default" },
    });

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

    const effectiveIsOpenOverride =
      isOpenOverride === undefined
        ? existing?.isOpenOverride
        : isOpenOverride === null
        ? null
        : Boolean(isOpenOverride);

    const effectiveIsAutoHours =
      isAutoHours !== undefined ? Boolean(isAutoHours) : (existing?.isAutoHours ?? true);

    const updated = await prisma.restaurantSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        name: effectiveName,
        subtitle: sanitizedSubtitle,
        phone: effectivePhone,
        address: effectiveAddress,
        googleMapsUrl: sanitizedGoogleMapsUrl,
        whatsappNumber: sanitizedWhatsappNumber,
        currency: effectiveCurrency,
        deliveryFee: numericDeliveryFee,
        isOpenOverride: effectiveIsOpenOverride,
        isAutoHours: effectiveIsAutoHours,
      },
      update: {
        name: effectiveName,
        subtitle: sanitizedSubtitle,
        phone: effectivePhone,
        address: effectiveAddress,
        googleMapsUrl: sanitizedGoogleMapsUrl,
        whatsappNumber: sanitizedWhatsappNumber,
        currency: effectiveCurrency,
        deliveryFee: numericDeliveryFee,
        isOpenOverride: effectiveIsOpenOverride,
        isAutoHours: effectiveIsAutoHours,
      },
    });

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

    const updatedOpeningHours = await prisma.openingHour.findMany({
      where: { settingsId: "default" },
      orderBy: { dayOfWeek: "asc" },
    });

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
      isOpenOverride: updated.isOpenOverride,
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
