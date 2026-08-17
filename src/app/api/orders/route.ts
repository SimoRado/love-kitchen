import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth";
import { checkRestaurantOpen } from "@/lib/openingHoursHelper";
import { calculateOrderTotals, roundMoney } from "@/lib/money";

const VALID_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
]);
const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;

const orderInclude = {
  items: { include: { modifiers: true } },
} satisfies Prisma.OrderInclude;

class OrderRequestError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new OrderRequestError(`${label} is required.`);
  }
  const result = value.trim();
  if (result.length > maxLength) {
    throw new OrderRequestError(`${label} is too long.`);
  }
  return result;
}

function optionalText(value: unknown, label: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new OrderRequestError(`${label} must be text.`);
  const result = value.trim();
  if (!result) return null;
  if (result.length > maxLength) throw new OrderRequestError(`${label} is too long.`);
  return result;
}

function generateOrderNumber(): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `ORD-${time}-${random}`;
}

function withoutIdempotencyKey<T extends { idempotencyKey?: string | null }>(order: T) {
  const copy = { ...order };
  delete copy.idempotencyKey;
  return copy;
}

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.toUpperCase();
    const search = searchParams.get("search")?.trim().slice(0, 100);
    const where: Prisma.OrderWhereInput = {};

    if (status && status !== "ALL") {
      if (!VALID_STATUSES.has(status)) {
        return NextResponse.json({ success: false, error: "Invalid order status." }, { status: 400 });
      }
      where.status = status;
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return NextResponse.json({ success: true, data: orders.map(withoutIdempotencyKey) });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new OrderRequestError("Request body must be valid JSON.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new OrderRequestError("Invalid order request.");
    }

    const input = body as Record<string, unknown>;
    const customerName = requiredText(input.customerName, "Customer full name", 100);
    const customerPhone = requiredText(input.customerPhone, "Customer phone number", 30);
    const phoneDigits = customerPhone.replace(/\D/g, "");
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      throw new OrderRequestError("Please provide a valid phone number.");
    }

    if (input.orderType !== "DELIVERY" && input.orderType !== "PICKUP") {
      throw new OrderRequestError("Order type must be DELIVERY or PICKUP.");
    }
    const orderType = input.orderType;
    const customerAddress = orderType === "DELIVERY"
      ? requiredText(input.customerAddress, "Delivery address", 500)
      : null;
    const allergies = optionalText(input.allergies, "Allergies", 500);
    const notes = optionalText(input.notes, "Notes", 1000);
    const idempotencyKey = requiredText(input.idempotencyKey, "Checkout request ID", 100);
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) {
      throw new OrderRequestError("Invalid checkout request ID.");
    }
    if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > MAX_ITEMS) {
      throw new OrderRequestError(`Your order must contain between 1 and ${MAX_ITEMS} items.`);
    }

    const existingOrder = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: orderInclude,
    });
    if (existingOrder) {
      return NextResponse.json({ success: true, data: withoutIdempotencyKey(existingOrder), message: `Order #${existingOrder.orderNumber} already placed.` });
    }

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const order = await prisma.$transaction(async (tx) => {
          const duplicate = await tx.order.findUnique({
            where: { idempotencyKey },
            include: orderInclude,
          });
          if (duplicate) return duplicate;

          const settings = await tx.restaurantSettings.findUnique({
            where: { id: "default" },
            include: { openingHours: { orderBy: { dayOfWeek: "asc" } } },
          });
          if (!settings || !checkRestaurantOpen(settings).isOpen) {
            throw new OrderRequestError("The restaurant is currently closed. Orders cannot be placed right now.", 409);
          }

          const rawItems = input.items as Array<Record<string, unknown>>;
          const productIds = rawItems.map((item) => {
            if (!item || typeof item !== "object") throw new OrderRequestError("Invalid order item.");
            return requiredText(item.productId, "Product ID", 100);
          });
          const products = await tx.product.findMany({
            where: { id: { in: [...new Set(productIds)] } },
            include: {
              modifierGroups: {
                where: { active: true },
                include: { options: { where: { active: true } } },
              },
            },
          });
          const productMap = new Map(products.map((product) => [product.id, product]));
          const createItems: Prisma.OrderItemCreateWithoutOrderInput[] = [];

          for (let itemIndex = 0; itemIndex < rawItems.length; itemIndex++) {
            const rawItem = rawItems[itemIndex];
            const product = productMap.get(productIds[itemIndex]);
            if (!product) throw new OrderRequestError("One or more cart items no longer exist. Please refresh your cart.", 409);
            if (!product.available) throw new OrderRequestError(`"${product.name}" is currently unavailable. Please remove it from your cart.`, 409);

            const quantity = Number(rawItem.quantity);
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
              throw new OrderRequestError(`Quantity for "${product.name}" must be between 1 and ${MAX_QUANTITY}.`);
            }
            if (rawItem.selectedModifierOptionIds !== undefined && !Array.isArray(rawItem.selectedModifierOptionIds)) {
              throw new OrderRequestError(`Invalid modifier selections for "${product.name}".`);
            }
            const optionIds = (rawItem.selectedModifierOptionIds ?? []) as unknown[];
            if (optionIds.length > 50 || optionIds.some((id) => typeof id !== "string" || !id)) {
              throw new OrderRequestError(`Invalid modifier selections for "${product.name}".`);
            }
            if (new Set(optionIds).size !== optionIds.length) {
              throw new OrderRequestError(`Duplicate modifier selections are not allowed for "${product.name}".`);
            }

            const options = new Map<string, { option: { name: string; priceDelta: number }; group: typeof product.modifierGroups[number] }>();
            const groupCounts = new Map<string, number>();
            for (const group of product.modifierGroups) {
              groupCounts.set(group.id, 0);
              for (const option of group.options) options.set(option.id, { option, group });
            }

            let modifierTotal = 0;
            const modifierSnapshots: Prisma.OrderItemModifierCreateWithoutOrderItemInput[] = [];
            for (const optionId of optionIds) {
              const selected = options.get(optionId as string);
              if (!selected) {
                throw new OrderRequestError(`A modifier for "${product.name}" changed or is unavailable. Please reconfigure it.`, 409);
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
              if (count < minimum) throw new OrderRequestError(`Please select at least ${minimum} option(s) for "${group.name}" on "${product.name}".`);
              if (count > group.maxSelections) throw new OrderRequestError(`You can select at most ${group.maxSelections} option(s) for "${group.name}" on "${product.name}".`);
            }

            const basePrice = roundMoney(product.price);
            const configuredUnitPrice = roundMoney(basePrice + modifierTotal);
            if (configuredUnitPrice < 0) throw new OrderRequestError(`Invalid configured price for "${product.name}".`, 409);
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
            Number(settings.deliveryFee)
          );
          return tx.order.create({
            data: {
              orderNumber: generateOrderNumber(),
              idempotencyKey,
              customerName,
              customerPhone,
              customerAddress,
              orderType,
              status: "PENDING",
              allergies,
              notes,
              ...totals,
              items: { create: createItems },
            },
            include: orderInclude,
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });

        return NextResponse.json(
          { success: true, data: withoutIdempotencyKey(order), message: `Order #${order.orderNumber} placed successfully!` },
          { status: 201 }
        );
      } catch (error) {
        if (error instanceof OrderRequestError) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2034" && attempt < 3) continue;
          if (error.code === "P2002") {
            const duplicate = await prisma.order.findUnique({ where: { idempotencyKey }, include: orderInclude });
            if (duplicate) return NextResponse.json({ success: true, data: withoutIdempotencyKey(duplicate), message: `Order #${duplicate.orderNumber} already placed.` });
            if (attempt < 3) continue;
          }
        }
        throw error;
      }
    }
    throw new Error("Order transaction retry limit reached");
  } catch (error) {
    if (error instanceof OrderRequestError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to submit order:", error);
    return NextResponse.json({ success: false, error: "Could not place your order. Please try again." }, { status: 500 });
  }
}
