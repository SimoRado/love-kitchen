import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth";
import { roundMoney } from "@/lib/money";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const categoryId = searchParams.get("categoryId");
    const available = searchParams.get("available");

    const whereClause: {
      categoryId?: string;
      available?: boolean;
      OR?: Array<{
        name?: { contains: string };
        description?: { contains: string };
      }>;
    } = {};

    if (categoryId && categoryId !== "ALL") {
      whereClause.categoryId = categoryId;
    }

    if (available === "true") {
      whereClause.available = true;
    } else if (available === "false") {
      whereClause.available = false;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: true,
        modifierGroups: {
          where: { active: true },
          include: {
            options: {
              where: { active: true },
              orderBy: { displayOrder: "asc" },
            },
          },
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, description, price, image, available, categoryId } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Product name is required" },
        { status: 400 }
      );
    }

    const numericPrice = typeof price === "number" ? price : parseFloat(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return NextResponse.json(
        { success: false, error: "Price must be a valid number greater than or equal to 0" },
        { status: 400 }
      );
    }

    if (!categoryId || typeof categoryId !== "string") {
      return NextResponse.json(
        { success: false, error: "Category is required" },
        { status: 400 }
      );
    }

    if (description !== undefined && description !== null && typeof description !== "string") {
      return NextResponse.json({ success: false, error: "Description must be text" }, { status: 400 });
    }
    if (image !== undefined && image !== null && typeof image !== "string") {
      return NextResponse.json({ success: false, error: "Image URL must be text" }, { status: 400 });
    }

    // Verify category exists
    const categoryExists = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!categoryExists) {
      return NextResponse.json(
        { success: false, error: "Selected category does not exist" },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        price: roundMoney(numericPrice),
        image: typeof image === "string" && image.trim() ? image.trim() : null,
        available: available !== undefined ? Boolean(available) : true,
        categoryId,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: product,
        message: "Product created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { success: false, error: "Could not add product. Please try again." },
      { status: 500 }
    );
  }
}
