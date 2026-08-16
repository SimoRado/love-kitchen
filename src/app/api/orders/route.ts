import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      orderType,
      notes,
      items,
      deliveryFee = 0,
    } = body;

    if (!customerName || !customerPhone) {
      return NextResponse.json(
        { success: false, error: "Customer name and phone number are required" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order must contain at least one item" },
        { status: 400 }
      );
    }

    // Calculate subtotal
    let subtotal = 0;
    const validatedItems = items.map((item: { productId?: string; productName: string; price: number; quantity: number }) => {
      const price = Number(item.price);
      const qty = Number(item.quantity) || 1;
      subtotal += price * qty;
      return {
        productId: item.productId || null,
        productName: item.productName,
        price,
        quantity: qty,
      };
    });

    const numericDeliveryFee = orderType === "PICKUP" ? 0 : Number(deliveryFee) || 0;
    const total = subtotal + numericDeliveryFee;

    // Generate unique order number (e.g. ORD-8492)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${randomSuffix}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress ? customerAddress.trim() : null,
        orderType: orderType === "PICKUP" ? "PICKUP" : "DELIVERY",
        status: "PENDING",
        subtotal,
        deliveryFee: numericDeliveryFee,
        total,
        notes: notes ? notes.trim() : null,
        items: {
          create: validatedItems,
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: order,
      message: "Order placed successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { success: false, error: "Could not create order. Please try again." },
      { status: 500 }
    );
  }
}
