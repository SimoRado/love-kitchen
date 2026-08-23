import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePosAccess } from "@/lib/deviceAuth";
import { publishOrderEvent } from "@/lib/orderEvents";
import { printOrder } from "@/lib/printingService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const POS_STATUSES = ["CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"];

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requirePosAccess(request);
  if (access instanceof NextResponse) return access;

  try {
    const { id } = await params;
    const body = await request.json();
    const status = typeof body.status === "string" ? body.status.toUpperCase() : "";

    if (!POS_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: `Invalid POS status. Valid values: ${POS_STATUSES.join(", ")}` }, { status: 400 });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: { include: { modifiers: true } } },
    });

    if (status === "CONFIRMED") {
      await printOrder(updatedOrder);
    }

    publishOrderEvent({ type: "order-updated", order: updatedOrder });
    return NextResponse.json({ success: true, data: updatedOrder, message: `Order status updated to ${status}` });
  } catch (error) {
    console.error("POS status update failed:", error);
    return NextResponse.json({ success: false, error: "Could not update order status." }, { status: 500 });
  }
}
