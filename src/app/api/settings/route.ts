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

export const dynamic = "force-dynamic";

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
      congestionBufferMinutes: Number(settings.congestionBufferMinutes ?? 5),
      maxCongestionBufferMinutes: Number(settings.maxCongestionBufferMinutes ?? 20),
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
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid settings request." }, { status: 400 });
    }
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
      congestionBufferMinutes,
      maxCongestionBufferMinutes,
      openingHours,
    } = body;

    const textFields: Array<[string, unknown, number]> = [
      ["Restaurant name", name, 100],
      ["Subtitle", subtitle, 200],
      ["Phone", phone, 30],
      ["Address", address, 500],
      ["Currency", currency, 10],
      ["Google Maps URL", googleMapsUrl, 2_000],
      ["WhatsApp number", whatsappNumber, 30],
    ];
    for (const [label, value, maxLength] of textFields) {
      if (value !== undefined && value !== null && (typeof value !== "string" || value.length > maxLength)) {
        return NextResponse.json({ success: false, error: `${label} is invalid.` }, { status: 400 });
      }
    }
    for (const [label, value] of [["Google Maps URL", googleMapsUrl]] as const) {
      if (typeof value === "string" && value.trim()) {
        try {
          const parsed = new URL(value);
          if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
        } catch {
          return NextResponse.json({ success: false, error: `${label} must be a valid HTTP(S) URL.` }, { status: 400 });
        }
      }
    }
    if (deliveryFee !== undefined) {
      const fee = Number(deliveryFee);
      if (!Number.isFinite(fee) || fee < 0 || fee > 10_000) {
        return NextResponse.json({ success: false, error: "Delivery fee must be a valid non-negative amount." }, { status: 400 });
      }
    }
    if (isOpenOverride !== undefined && isOpenOverride !== null && typeof isOpenOverride !== "boolean") {
      return NextResponse.json({ success: false, error: "Open/closed override must be true, false, or automatic." }, { status: 400 });
    }
    if (isAutoHours !== undefined && typeof isAutoHours !== "boolean") {
      return NextResponse.json({ success: false, error: "Automatic hours value is invalid." }, { status: 400 });
    }

    const numericCongestionBuffer =
      congestionBufferMinutes !== undefined && congestionBufferMinutes !== null
        ? Math.max(0, parseInt(String(congestionBufferMinutes), 10) || 5)
        : undefined;

    const numericMaxCongestion =
      maxCongestionBufferMinutes !== undefined && maxCongestionBufferMinutes !== null
        ? Math.max(0, parseInt(String(maxCongestionBufferMinutes), 10) || 20)
        : undefined;

    if (openingHours !== undefined) {
      if (!Array.isArray(openingHours) || openingHours.length > 7) {
        return NextResponse.json({ success: false, error: "Opening hours must contain at most seven days." }, { status: 400 });
      }
      const days = new Set<number>();
      for (const hour of openingHours) {
        if (
          !hour || typeof hour !== "object" ||
          !Number.isInteger(hour.dayOfWeek) || hour.dayOfWeek < 0 || hour.dayOfWeek > 6 ||
          days.has(hour.dayOfWeek) ||
          typeof hour.openTime !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hour.openTime) ||
          typeof hour.closeTime !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hour.closeTime) ||
          typeof hour.isClosed !== "boolean"
        ) {
          return NextResponse.json({ success: false, error: "One or more opening-hour entries are invalid." }, { status: 400 });
        }
        days.add(hour.dayOfWeek);
      }
    }

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

    const effectiveCongestionBuffer =
      numericCongestionBuffer !== undefined ? numericCongestionBuffer : (existing?.congestionBufferMinutes ?? 5);

    const effectiveMaxCongestion =
      numericMaxCongestion !== undefined ? numericMaxCongestion : (existing?.maxCongestionBufferMinutes ?? 20);

    const { updated, updatedOpeningHours } = await prisma.$transaction(async (tx) => {
      const saved = await tx.restaurantSettings.upsert({
        where: { id: "default" },
        create: {
          id: "default", name: effectiveName, subtitle: sanitizedSubtitle,
          phone: effectivePhone, address: effectiveAddress,
          googleMapsUrl: sanitizedGoogleMapsUrl, whatsappNumber: sanitizedWhatsappNumber,
          currency: effectiveCurrency, deliveryFee: numericDeliveryFee,
          isOpenOverride: effectiveIsOpenOverride, isAutoHours: effectiveIsAutoHours,
          congestionBufferMinutes: effectiveCongestionBuffer,
          maxCongestionBufferMinutes: effectiveMaxCongestion,
        },
        update: {
          name: effectiveName, subtitle: sanitizedSubtitle,
          phone: effectivePhone, address: effectiveAddress,
          googleMapsUrl: sanitizedGoogleMapsUrl, whatsappNumber: sanitizedWhatsappNumber,
          currency: effectiveCurrency, deliveryFee: numericDeliveryFee,
          isOpenOverride: effectiveIsOpenOverride, isAutoHours: effectiveIsAutoHours,
          congestionBufferMinutes: effectiveCongestionBuffer,
          maxCongestionBufferMinutes: effectiveMaxCongestion,
        },
      });

      if (Array.isArray(openingHours)) {
        for (const hour of openingHours) {
          const existingHour = await tx.openingHour.findFirst({
            where: { settingsId: "default", dayOfWeek: hour.dayOfWeek },
          });
          if (existingHour) {
            await tx.openingHour.update({
              where: { id: existingHour.id },
              data: { openTime: hour.openTime, closeTime: hour.closeTime, isClosed: hour.isClosed },
            });
          } else {
            await tx.openingHour.create({
              data: {
                dayOfWeek: hour.dayOfWeek,
                dayName: typeof hour.dayName === "string" ? hour.dayName.slice(0, 20) : "",
                openTime: hour.openTime,
                closeTime: hour.closeTime,
                isClosed: hour.isClosed,
                settingsId: "default",
              },
            });
          }
        }
      }
      const savedHours = await tx.openingHour.findMany({
        where: { settingsId: "default" },
        orderBy: { dayOfWeek: "asc" },
      });
      return { updated: saved, updatedOpeningHours: savedHours };
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
      congestionBufferMinutes: Number(updated.congestionBufferMinutes ?? 5),
      maxCongestionBufferMinutes: Number(updated.maxCongestionBufferMinutes ?? 20),
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
      { success: false, error: "Could not update restaurant settings." },
      { status: 500 }
    );
  }
}
