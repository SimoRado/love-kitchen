import { NextRequest, NextResponse } from "next/server";
import { calculateOrderPreparationEstimate } from "@/lib/prepTimeEstimator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : [];

    const estimate = await calculateOrderPreparationEstimate(
      items.map((it: { productId?: string; quantity?: number }) => ({
        productId: it.productId,
        quantity: Math.max(1, Number(it.quantity) || 1),
      }))
    );

    return NextResponse.json({
      success: true,
      data: {
        estimatedPrepMinutes: estimate.estimatedPrepMinutes,
        estimatedReadyAt: estimate.estimatedReadyAt.toISOString(),
        basePrepMinutes: estimate.basePrepMinutes,
        congestionBufferMinutes: estimate.congestionBufferMinutes,
        activeOrdersCount: estimate.activeOrdersCount,
      },
    });
  } catch (error) {
    console.error("Failed to calculate prep estimate:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate preparation estimate." },
      { status: 500 }
    );
  }
}
