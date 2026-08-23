import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePosAccess } from "@/lib/deviceAuth";

const ACTIVE_POS_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"];
const orderInclude = { items: { include: { modifiers: true } } } satisfies Prisma.OrderInclude;

function withoutIdempotencyKey<T extends { idempotencyKey?: string | null }>(order: T) {
  const copy = { ...order };
  delete copy.idempotencyKey;
  return copy;
}

export async function GET(request: NextRequest) {
  const access = await requirePosAccess(request);
  if (access instanceof NextResponse) return access;

  const orders = await prisma.order.findMany({
    where: { status: { in: ACTIVE_POS_STATUSES } },
    include: orderInclude,
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({ success: true, data: orders.map(withoutIdempotencyKey) });
}