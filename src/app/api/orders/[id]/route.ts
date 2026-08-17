import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    const safeOrder = { ...order, idempotencyKey: undefined };
    return NextResponse.json({ success: true, data: safeOrder });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Valid values: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: status.toUpperCase(),
      },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: `Order status updated to ${status.toUpperCase()}`,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      { success: false, error: "Could not update order status." },
      { status: 500 }
    );
  }
}
