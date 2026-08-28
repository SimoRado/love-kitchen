import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePosAccess } from "@/lib/deviceAuth";
import { calculateOrderTotals, roundMoney } from "@/lib/money";
import { publishOrderEvent } from "@/lib/orderEvents";
import { printOrder } from "@/lib/printingService";
import { calculateOrderPreparationEstimate } from "@/lib/prepTimeEstimator";

const ACTIVE_POS_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"];
const ALL_POS_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"];
const orderInclude = { items: { include: { modifiers: true } } } satisfies Prisma.OrderInclude;

function withoutIdempotencyKey<T extends { idempotencyKey?: string | null }>(order: T) {
  const copy = { ...order };
  delete copy.idempotencyKey;
  return copy;
}

function generateOrderNumber(): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `ORD-${time}-${random}`;
}

export async function GET(request: NextRequest) {
  const access = await requirePosAccess(request);
  if (access instanceof NextResponse) return access;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope")?.toLowerCase();
  const statusParam = searchParams.get("status")?.toUpperCase();

  let statusFilter: string[];
  if (statusParam && ALL_POS_STATUSES.includes(statusParam)) {
    statusFilter = [statusParam];
  } else if (scope === "all") {
    statusFilter = ALL_POS_STATUSES;
  } else if (scope === "history") {
    statusFilter = ["COMPLETED", "CANCELLED"];
  } else {
    statusFilter = ACTIVE_POS_STATUSES;
  }

  const orders = await prisma.order.findMany({
    where: { status: { in: statusFilter } },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ success: true, data: orders.map(withoutIdempotencyKey) });
}

export async function POST(request: NextRequest) {
  const access = await requirePosAccess(request);
  if (access instanceof NextResponse) return access;

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid order payload." }, { status: 400 });
    }

    const {
      customerName = "POS Walk-in",
      customerPhone = "",
      customerAddress = null,
      orderType = "PICKUP",
      allergies = null,
      notes = null,
      items,
      initialStatus = "CONFIRMED",
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "Order must contain at least one item." }, { status: 400 });
    }

    if (orderType !== "DELIVERY" && orderType !== "PICKUP") {
      return NextResponse.json({ success: false, error: "Invalid order type." }, { status: 400 });
    }

    const validInitialStatuses = ["PENDING", "CONFIRMED", "PREPARING"];
    const targetStatus = validInitialStatuses.includes(initialStatus) ? initialStatus : "CONFIRMED";

    const order = await prisma.$transaction(async (tx) => {
      const settings = await tx.restaurantSettings.findUnique({
        where: { id: "default" },
      });
      const deliveryFeeSetting = settings ? Number(settings.deliveryFee) : 0;

      const productIds = items.map((it: { productId: string }) => String(it.productId || ""));
      const products = await tx.product.findMany({
        where: { id: { in: [...new Set(productIds)] } },
        include: {
          modifierGroups: {
            where: { active: true },
            include: { options: { where: { active: true } } },
          },
        },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));
      const createItems: Prisma.OrderItemCreateWithoutOrderInput[] = [];

      for (const rawItem of items) {
        const product = productMap.get(String(rawItem.productId));
        if (!product) {
          throw new Error("One or more selected products no longer exist.");
        }
        if (!product.available) {
          throw new Error(`"${product.name}" is currently marked unavailable.`);
        }

        const quantity = Math.max(1, Math.floor(Number(rawItem.quantity)) || 1);
        const optionIds = Array.isArray(rawItem.selectedModifierOptionIds)
          ? rawItem.selectedModifierOptionIds.map((id: unknown) => String(id))
          : [];

        const optionsMap = new Map<string, { option: { name: string; priceDelta: number }; group: typeof product.modifierGroups[number] }>();
        const groupCounts = new Map<string, number>();
        for (const group of product.modifierGroups) {
          groupCounts.set(group.id, 0);
          for (const opt of group.options) {
            optionsMap.set(opt.id, { option: opt, group });
          }
        }

        let modifierTotal = 0;
        const modifierSnapshots: Prisma.OrderItemModifierCreateWithoutOrderItemInput[] = [];
        for (const optId of optionIds) {
          const selected = optionsMap.get(optId);
          if (!selected) {
            throw new Error(`A selected modifier for "${product.name}" is unavailable.`);
          }
          groupCounts.set(selected.group.id, (groupCounts.get(selected.group.id) ?? 0) + 1);
          const priceDelta = roundMoney(selected.option.priceDelta);
          modifierTotal = roundMoney(modifierTotal + priceDelta);
          modifierSnapshots.push({
            modifierGroupName: selected.group.name,
            modifierOptionName: selected.option.name,
            priceDelta,
          });
        }

        for (const group of product.modifierGroups) {
          const count = groupCounts.get(group.id) ?? 0;
          const minimum = group.required ? Math.max(1, group.minSelections) : group.minSelections;
          if (count < minimum) {
            throw new Error(`Please select at least ${minimum} option(s) for "${group.name}" on "${product.name}".`);
          }
          if (count > group.maxSelections) {
            throw new Error(`You can select at most ${group.maxSelections} option(s) for "${group.name}" on "${product.name}".`);
          }
        }

        const basePrice = roundMoney(product.price);
        const configuredUnitPrice = roundMoney(basePrice + modifierTotal);

        createItems.push({
          product: { connect: { id: product.id } },
          productName: product.name,
          price: basePrice,
          configuredUnitPrice,
          quantity,
          ...(modifierSnapshots.length ? { modifiers: { create: modifierSnapshots } } : {}),
        });
      }

      const totals = calculateOrderTotals(
        createItems.map((item) => ({ price: Number(item.configuredUnitPrice), quantity: Number(item.quantity) })),
        orderType,
        deliveryFeeSetting
      );

      const prepEstimate = await calculateOrderPreparationEstimate(
        items.map((it: { productId: string; quantity?: number }) => ({
          productId: String(it.productId || ""),
          quantity: Math.max(1, Math.floor(Number(it.quantity)) || 1),
        })),
        tx
      );

      return tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerName: String(customerName || "POS Walk-in").trim().slice(0, 100),
          customerPhone: String(customerPhone || "").trim().slice(0, 30),
          customerAddress: orderType === "DELIVERY" && customerAddress ? String(customerAddress).trim().slice(0, 500) : null,
          orderType,
          status: targetStatus,
          allergies: allergies ? String(allergies).trim().slice(0, 500) : null,
          notes: notes ? String(notes).trim().slice(0, 1000) : null,
          estimatedPrepMinutes: prepEstimate.estimatedPrepMinutes,
          estimatedReadyAt: prepEstimate.estimatedReadyAt,
          ...totals,
          items: { create: createItems },
        },
        include: orderInclude,
      });
    });

    if (order.status === "CONFIRMED") {
      await printOrder(order);
    }

    publishOrderEvent({ type: "order-created", order });

    return NextResponse.json({
      success: true,
      data: withoutIdempotencyKey(order),
      message: `Order #${order.orderNumber} created successfully.`,
    }, { status: 201 });
  } catch (error) {
    console.error("POS order creation error:", error);
    const message = error instanceof Error ? error.message : "Failed to create POS order.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}