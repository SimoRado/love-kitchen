import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
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
    const { available } = body;

    if (typeof available !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Invalid availability value" },
        { status: 400 }
      );
    }

    const product = await prisma.product.update({
      where: { id },
      data: { available },
      include: { category: true },
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: `Product marked as ${available ? "available" : "unavailable"}`,
    });
  } catch (error) {
    console.error("Error updating product availability:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update product availability" },
      { status: 500 }
    );
  }
}
