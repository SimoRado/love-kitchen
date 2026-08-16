import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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

      // Pending orders count (all time or active)
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
          items: true,
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
