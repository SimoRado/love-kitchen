import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface PrepEstimateInputItem {
  productId?: string | null;
  quantity: number;
}

export interface PrepEstimateResult {
  estimatedPrepMinutes: number;
  estimatedReadyAt: Date;
  basePrepMinutes: number;
  congestionBufferMinutes: number;
  stationsInvolved: string[];
  activeOrdersCount: number;
}

type PrismaClientOrTx =
  | typeof prisma
  | Prisma.TransactionClient;

/**
 * Calculates the authoritative estimated kitchen preparation time and ready-at timestamp.
 *
 * Algorithm:
 * 1. Base Workload (Concurrent Stations):
 *    - Items are grouped by their kitchen station (e.g. BURGER, PIZZA, SUSHI, SIDES, DRINKS, KITCHEN).
 *    - Each station prepares items in parallel; within a station, multiple quantities add small conservative buffer (+2m per additional item).
 *    - Base prep time is the MAXIMUM workload across all involved stations (not the sum across different stations).
 *
 * 2. Active Kitchen Congestion:
 *    - Counts active orders in the kitchen (status CONFIRMED or PREPARING; excludes CANCELLED, COMPLETED, READY).
 *    - Active orders sharing stations with this order add `congestionBufferMinutes` (default 5m).
 *    - Active orders in other stations add a smaller cross-station buffer (+1m).
 *    - Total congestion buffer is strictly capped at `maxCongestionBufferMinutes` (default 20m).
 *
 * 3. Result:
 *    - totalMinutes = basePrepMinutes + congestionBuffer
 *    - estimatedReadyAt = Date.now() + totalMinutes * 60 * 1000
 */
export async function calculateOrderPreparationEstimate(
  items: PrepEstimateInputItem[],
  db: PrismaClientOrTx = prisma
): Promise<PrepEstimateResult> {
  // Fallback defaults if no items provided
  if (!items || items.length === 0) {
    return {
      estimatedPrepMinutes: 15,
      estimatedReadyAt: new Date(Date.now() + 15 * 60 * 1000),
      basePrepMinutes: 15,
      congestionBufferMinutes: 0,
      stationsInvolved: ["KITCHEN"],
      activeOrdersCount: 0,
    };
  }

  // 1. Fetch products referenced in this order
  const productIds = Array.from(
    new Set(items.map((it) => it.productId).filter((id): id is string => Boolean(id)))
  );

  const products = productIds.length > 0
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, prepTimeMinutes: true, prepStation: true },
      })
    : [];

  const productMap = new Map(products.map((p) => [p.id, p]));

  // 2. Group items by station and calculate per-station workload
  const stationWorkloadMap = new Map<string, { maxItemTime: number; totalQty: number }>();

  for (const item of items) {
    const prod = item.productId ? productMap.get(item.productId) : null;
    const itemPrepTime = Math.max(0, prod?.prepTimeMinutes ?? 15);
    const station = (prod?.prepStation || "KITCHEN").trim().toUpperCase() || "KITCHEN";
    const qty = Math.max(1, item.quantity || 1);

    const existing = stationWorkloadMap.get(station) || { maxItemTime: 0, totalQty: 0 };
    stationWorkloadMap.set(station, {
      maxItemTime: Math.max(existing.maxItemTime, itemPrepTime),
      totalQty: existing.totalQty + qty,
    });
  }

  const orderStations = new Set(stationWorkloadMap.keys());

  // Calculate base preparation time: stations work CONCURRENTLY -> max workload across stations
  let basePrepMinutes = 0;
  for (const [, { maxItemTime, totalQty }] of stationWorkloadMap.entries()) {
    // 1st item takes full prep time; additional items in same station add 2 min each (up to +10 min cap per station)
    const additionalItemBuffer = Math.min(10, Math.max(0, totalQty - 1) * 2);
    const stationTotal = maxItemTime + additionalItemBuffer;
    if (stationTotal > basePrepMinutes) {
      basePrepMinutes = stationTotal;
    }
  }

  // Ensure sensible minimum base prep time
  if (basePrepMinutes <= 0) {
    basePrepMinutes = 15;
  }

  // 3. Fetch restaurant settings for congestion buffers
  const settings = await db.restaurantSettings.findUnique({
    where: { id: "default" },
    select: {
      congestionBufferMinutes: true,
      maxCongestionBufferMinutes: true,
    },
  });

  const perOrderBuffer = Math.max(1, settings?.congestionBufferMinutes ?? 5);
  const maxBuffer = Math.max(0, settings?.maxCongestionBufferMinutes ?? 20);

  // 4. Query active kitchen orders (CONFIRMED or PREPARING only)
  const activeOrders = await db.order.findMany({
    where: {
      status: { in: ["CONFIRMED", "PREPARING"] },
    },
    select: {
      id: true,
      items: {
        select: {
          productId: true,
          product: {
            select: { prepStation: true },
          },
        },
      },
    },
    take: 50,
  });

  // Calculate congestion buffer based on station overlap
  let calculatedCongestion = 0;

  for (const activeOrder of activeOrders) {
    const activeStations = new Set(
      activeOrder.items.map((it) =>
        (it.product?.prepStation || "KITCHEN").trim().toUpperCase() || "KITCHEN"
      )
    );

    // Check if active order shares any station with the new order
    const hasStationOverlap = Array.from(orderStations).some((st) => activeStations.has(st));

    if (hasStationOverlap) {
      calculatedCongestion += perOrderBuffer; // e.g. +5 min
    } else {
      calculatedCongestion += 1; // minor cross-station queue coordination buffer (+1 min)
    }
  }

  // Cap congestion buffer at configured maximum
  const finalCongestionBuffer = Math.min(calculatedCongestion, maxBuffer);
  const totalEstimatedPrepMinutes = Math.round(basePrepMinutes + finalCongestionBuffer);
  const estimatedReadyAt = new Date(Date.now() + totalEstimatedPrepMinutes * 60 * 1000);

  return {
    estimatedPrepMinutes: totalEstimatedPrepMinutes,
    estimatedReadyAt,
    basePrepMinutes: Math.round(basePrepMinutes),
    congestionBufferMinutes: finalCongestionBuffer,
    stationsInvolved: Array.from(orderStations),
    activeOrdersCount: activeOrders.length,
  };
}
