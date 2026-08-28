import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth";
import { getCasablancaDayBounds } from "@/lib/openingHoursHelper";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { start: today, end: tomorrow } = getCasablancaDayBounds();

    const [
      ordersTodayCount,
      revenueResult,
      pendingCount,
      preparingCount,
      completedCount,
      totalProductsCount,
      recentOrders,
    ] = await Promise.all([
      // Total orders today
      prisma.order.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),

      // Revenue today (excluding cancelled orders)
      prisma.order.aggregate({
        _sum: {
          total: true,
        },
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
          status: {
            not: "CANCELLED",
          },
        },
      }),

      // Pending orders count
      prisma.order.count({
        where: { status: "PENDING" },
      }),

      // Preparing orders count
      prisma.order.count({
        where: { status: "PREPARING" },
      }),

      // Completed orders count today
      prisma.order.count({
        where: {
          status: "COMPLETED",
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),

      // Total products count
      prisma.product.count(),

      // Recent 6 orders
      prisma.order.findMany({
        take: 6,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          items: {
            include: {
              modifiers: true,
            },
          },
        },
      }),
    ]);

    const revenueToday = revenueResult._sum.total || 0;

    return NextResponse.json({
      success: true,
      data: {
        ordersToday: ordersTodayCount,
        revenueToday,
        pendingOrders: pendingCount,
        preparingOrders: preparingCount,
        completedOrders: completedCount,
        totalProducts: totalProductsCount,
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load dashboard statistics" },
      { status: 500 }
    );
  }
}
