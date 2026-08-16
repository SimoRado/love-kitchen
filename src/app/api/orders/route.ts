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
        items: true,
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
    const settings = await prisma.restaurantSettings.findUnique({
      where: { id: "default" },
      include: {
        openingHours: {
          orderBy: { dayOfWeek: "asc" },
        },
      },
    });

    const openStatus = checkRestaurantOpen(settings);
    if (!openStatus.isOpen) {
      return NextResponse.json(
        {
          success: false,
          error: "The restaurant is currently closed. Orders cannot be placed right now.",
        },
        { status: 400 }
      );
    }

    // 3. Load & Verify all Products from Database (Authoritative check)
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
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    const validatedItemsToCreate: Array<{
      productId: string;
      productName: string;
      price: number;
      quantity: number;
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
      const authoritativePrice = roundMoney(dbProduct.price);

      validatedItemsToCreate.push({
        productId: dbProduct.id,
        productName: dbProduct.name,
        price: authoritativePrice,
        quantity: qty,
      });
    }

    // 4. Authoritative Totals Calculation using Money helper
    const settingsDeliveryFee = settings?.deliveryFee ?? 15;
    const { subtotal, deliveryFee, total } = calculateOrderTotals(
      validatedItemsToCreate,
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
        items: true,
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
