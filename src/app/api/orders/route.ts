import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRestaurantOpen } from "@/lib/openingHoursHelper";
import { calculateOrderTotals, roundMoney } from "@/lib/money";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();

    const whereClause: {
      status?: string;
      OR?: Array<{
        orderNumber?: { contains: string };
        customerName?: { contains: string };
        customerPhone?: { contains: string };
      }>;
    } = {};

    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
      ];
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      customerAddress,
      orderType = "DELIVERY",
      notes,
      items,
    } = body;

    // 1. Validate Customer Information
    if (!customerName || typeof customerName !== "string" || !customerName.trim()) {
      return NextResponse.json(
        { success: false, error: "Customer full name is required." },
        { status: 400 }
      );
    }

    if (!customerPhone || typeof customerPhone !== "string" || !customerPhone.trim()) {
      return NextResponse.json(
        { success: false, error: "Customer phone number is required." },
        { status: 400 }
      );
    }

    const normalizedOrderType =
      String(orderType).toUpperCase() === "PICKUP" ? "PICKUP" : "DELIVERY";

    if (
      normalizedOrderType === "DELIVERY" &&
      (!customerAddress || typeof customerAddress !== "string" || !customerAddress.trim())
    ) {
      return NextResponse.json(
        { success: false, error: "Delivery address is required for delivery orders." },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Your order must contain at least one product." },
        { status: 400 }
      );
    }

    // 2. Fetch Restaurant Settings & Verify Restaurant is OPEN
    const rawSettings = await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "RestaurantSettings" WHERE "id" = "default" LIMIT 1'
    );
    const dbSettings = rawSettings && rawSettings.length > 0 ? rawSettings[0] : null;

    const openingHours = await prisma.openingHour.findMany({
      where: { settingsId: "default" },
      orderBy: { dayOfWeek: "asc" },
    });

    const normalizedSettings = dbSettings
      ? {
          ...dbSettings,
          deliveryFee: Number(dbSettings.deliveryFee ?? 15),
          isOpenOverride:
            dbSettings.isOpenOverride === 1 || dbSettings.isOpenOverride === true
              ? true
              : dbSettings.isOpenOverride === 0 || dbSettings.isOpenOverride === false
              ? false
              : null,
          openingHours,
        }
      : null;

    const openStatus = checkRestaurantOpen(normalizedSettings);
    if (!openStatus.isOpen) {
      return NextResponse.json(
        {
          success: false,
          error: "The restaurant is currently closed. Orders cannot be placed right now.",
        },
        { status: 400 }
      );
    }

    // 3. Load & Verify all Products and their Active Modifier Groups/Options from Database
    const itemProductIds = items
      .map((it: { productId?: string }) => it.productId)
      .filter((id): id is string => Boolean(id));

    if (itemProductIds.length !== items.length) {
      return NextResponse.json(
        { success: false, error: "Invalid product information in order items." },
        { status: 400 }
      );
    }

    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: itemProductIds },
      },
      include: {
        modifierGroups: {
          where: { active: true },
          include: {
            options: {
              where: { active: true },
            },
          },
        },
      },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    const validatedItemsToCreate: Array<{
      productId: string;
      productName: string;
      price: number;
      configuredUnitPrice: number;
      quantity: number;
      modifiers?: {
        create: Array<{
          modifierGroupName: string;
          modifierOptionName: string;
          priceDelta: number;
        }>;
      };
    }> = [];

    for (const item of items) {
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) {
        return NextResponse.json(
          {
            success: false,
            error: "One or more items in your cart no longer exist. Please refresh your cart.",
          },
          { status: 400 }
        );
      }

      // Check product availability
      if (!dbProduct.available) {
        return NextResponse.json(
          {
            success: false,
            error: `"${dbProduct.name}" is currently unavailable or sold out. Please remove it from your cart.`,
          },
          { status: 400 }
        );
      }

      const qty = Math.max(1, Math.floor(Number(item.quantity)) || 1);
      const basePrice = roundMoney(dbProduct.price);

      // Selected modifier option IDs sent by client
      const incomingOptionIds: string[] = Array.isArray(item.selectedModifierOptionIds)
        ? item.selectedModifierOptionIds.filter((id: unknown): id is string => typeof id === "string" && Boolean(id.trim()))
        : [];

      // Create lookup of active options for this product
      const activeOptionsMap = new Map<
        string,
        {
          option: { id: string; name: string; priceDelta: number };
          group: { id: string; name: string; required: boolean; minSelections: number; maxSelections: number };
        }
      >();
      const groupSelectionsCount = new Map<string, number>();

      for (const group of dbProduct.modifierGroups) {
        groupSelectionsCount.set(group.id, 0);
        for (const opt of group.options) {
          activeOptionsMap.set(opt.id, { option: opt, group });
        }
      }

      const snapshotModifiersToCreate: Array<{
        modifierGroupName: string;
        modifierOptionName: string;
        priceDelta: number;
      }> = [];

      let totalModifierDelta = 0;

      // Verify every submitted option belongs to this product's active groups
      for (const optId of incomingOptionIds) {
        const found = activeOptionsMap.get(optId);
        if (!found) {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid or unavailable modifier option selected for "${dbProduct.name}". Please reconfigure this item.`,
            },
            { status: 400 }
          );
        }

        const count = (groupSelectionsCount.get(found.group.id) || 0) + 1;
        groupSelectionsCount.set(found.group.id, count);

        const delta = roundMoney(found.option.priceDelta);
        totalModifierDelta = roundMoney(totalModifierDelta + delta);

        snapshotModifiersToCreate.push({
          modifierGroupName: found.group.name,
          modifierOptionName: found.option.name,
          priceDelta: delta,
        });
      }

      // Verify group constraints (minSelections, maxSelections & required)
      for (const group of dbProduct.modifierGroups) {
        const count = groupSelectionsCount.get(group.id) || 0;

        if (group.required && count < group.minSelections) {
          return NextResponse.json(
            {
              success: false,
              error: `Please select at least ${group.minSelections} option(s) for "${group.name}" on "${dbProduct.name}".`,
            },
            { status: 400 }
          );
        }

        if (!group.required && group.minSelections > 0 && count > 0 && count < group.minSelections) {
          return NextResponse.json(
            {
              success: false,
              error: `Please select at least ${group.minSelections} option(s) for "${group.name}" on "${dbProduct.name}".`,
            },
            { status: 400 }
          );
        }

        if (count > group.maxSelections) {
          return NextResponse.json(
            {
              success: false,
              error: `You can select at most ${group.maxSelections} option(s) for "${group.name}" on "${dbProduct.name}".`,
            },
            { status: 400 }
          );
        }
      }

      const configuredUnitPrice = roundMoney(basePrice + totalModifierDelta);

      validatedItemsToCreate.push({
        productId: dbProduct.id,
        productName: dbProduct.name,
        price: basePrice,
        configuredUnitPrice,
        quantity: qty,
        ...(snapshotModifiersToCreate.length > 0
          ? {
              modifiers: {
                create: snapshotModifiersToCreate,
              },
            }
          : {}),
      });
    }

    // 4. Authoritative Totals Calculation using Money helper
    const settingsDeliveryFee = normalizedSettings?.deliveryFee ?? 15;
    const itemsForTotals = validatedItemsToCreate.map((it) => ({
      price: it.configuredUnitPrice,
      quantity: it.quantity,
    }));

    const { subtotal, deliveryFee, total } = calculateOrderTotals(
      itemsForTotals,
      normalizedOrderType,
      settingsDeliveryFee
    );

    // 5. Generate Order Number
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${randomSuffix}`;

    // 6. Create Order and OrderItems in Database
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: normalizedOrderType === "DELIVERY" ? customerAddress.trim() : null,
        orderType: normalizedOrderType,
        status: "PENDING",
        subtotal,
        deliveryFee,
        total,
        notes: notes && typeof notes === "string" ? notes.trim() : null,
        items: {
          create: validatedItemsToCreate,
        },
      },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: order,
        message: `Order #${order.orderNumber} placed successfully!`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error submitting order:", error);
    return NextResponse.json(
      { success: false, error: "Could not place your order. Please try again." },
      { status: 500 }
    );
  }
}
