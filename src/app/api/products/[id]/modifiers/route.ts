import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth, getAdminSessionFromRequest } from "@/lib/auth";
import { roundMoney } from "@/lib/money";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId } = await params;
    const isAdmin = await getAdminSessionFromRequest(request);

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    const modifierGroups = await prisma.productModifierGroup.findMany({
      where: {
        productId,
        ...(isAdmin ? {} : { active: true }),
      },
      include: {
        options: {
          where: isAdmin ? {} : { active: true },
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: modifierGroups,
    });
  } catch (error) {
    console.error("Error fetching product modifiers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch modifiers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id: productId } = await params;
    const body = await request.json();
    const {
      name,
      description,
      required = false,
      minSelections = 0,
      maxSelections = 1,
      displayOrder = 0,
      active = true,
      options = [],
    } = body;

    // 1. Validation
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Modifier group name is required" },
        { status: 400 }
      );
    }

    const min = Number(minSelections);
    const max = Number(maxSelections);

    if (!Number.isInteger(min) || min < 0) {
      return NextResponse.json(
        { success: false, error: "Minimum selections must be 0 or greater" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(max) || max < 1) {
      return NextResponse.json(
        { success: false, error: "Maximum selections must be at least 1" },
        { status: 400 }
      );
    }

    if (min > max) {
      return NextResponse.json(
        { success: false, error: "Minimum selections cannot exceed maximum selections" },
        { status: 400 }
      );
    }

    if (required && min < 1) {
      return NextResponse.json(
        { success: false, error: "Required groups must have minimum selections of at least 1" },
        { status: 400 }
      );
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    // Format options
    const formattedOptions: Array<{
      name: string;
      priceDelta: number;
      active: boolean;
      displayOrder: number;
    }> = [];

    if (!Array.isArray(options) || options.length > 100) {
      return NextResponse.json(
        { success: false, error: "Modifier options must be an array of at most 100 items" },
        { status: 400 }
      );
    }

    if (Array.isArray(options)) {
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        if (opt && opt.name && typeof opt.name === "string" && opt.name.trim()) {
          const delta = typeof opt.priceDelta === "number" ? opt.priceDelta : parseFloat(opt.priceDelta);
          if (!Number.isFinite(delta) || delta < 0) {
            return NextResponse.json(
              { success: false, error: `Invalid price for modifier option ${i + 1}` },
              { status: 400 }
            );
          }
          formattedOptions.push({
            name: opt.name.trim(),
            priceDelta: roundMoney(isNaN(delta) || delta < 0 ? 0 : delta),
            active: opt.active !== undefined ? Boolean(opt.active) : true,
            displayOrder: opt.displayOrder !== undefined ? Number(opt.displayOrder) : i,
          });
        }
      }
    }

    const createdGroup = await prisma.productModifierGroup.create({
      data: {
        productId,
        name: name.trim(),
        description: description ? description.trim() : null,
        required: Boolean(required),
        minSelections: min,
        maxSelections: max,
        displayOrder: Number(displayOrder) || 0,
        active: Boolean(active),
        options: {
          create: formattedOptions,
        },
      },
      include: {
        options: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: createdGroup,
        message: "Modifier group created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating modifier group:", error);
    return NextResponse.json(
      { success: false, error: "Could not create modifier group" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id: productId } = await params;
    const body = await request.json();
    const {
      id: groupId,
      name,
      description,
      required,
      minSelections,
      maxSelections,
      displayOrder,
      active,
      options,
    } = body;

    if (!groupId) {
      return NextResponse.json(
        { success: false, error: "Modifier group ID is required for update" },
        { status: 400 }
      );
    }

    const existingGroup = await prisma.productModifierGroup.findFirst({
      where: { id: groupId, productId },
      include: { options: true },
    });

    if (!existingGroup) {
      return NextResponse.json(
        { success: false, error: "Modifier group not found for this product" },
        { status: 404 }
      );
    }

    const min = minSelections !== undefined ? Number(minSelections) : existingGroup.minSelections;
    const max = maxSelections !== undefined ? Number(maxSelections) : existingGroup.maxSelections;

    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1 || min > max) {
      return NextResponse.json(
        { success: false, error: "Invalid min or max selections configuration" },
        { status: 400 }
      );
    }

    const effectiveRequired = required !== undefined ? required : existingGroup.required;
    if (typeof effectiveRequired !== "boolean" || (effectiveRequired && min < 1)) {
      return NextResponse.json(
        { success: false, error: "Required groups must have minimum selections of at least 1" },
        { status: 400 }
      );
    }
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return NextResponse.json(
        { success: false, error: "Modifier group name is required" },
        { status: 400 }
      );
    }
    if (options !== undefined && (!Array.isArray(options) || options.length > 100)) {
      return NextResponse.json(
        { success: false, error: "Modifier options must be an array of at most 100 items" },
        { status: 400 }
      );
    }

    // Update group basic fields
    await prisma.productModifierGroup.update({
      where: { id: groupId },
      data: {
        name: name !== undefined ? name.trim() : existingGroup.name,
        description: description !== undefined ? (description ? description.trim() : null) : existingGroup.description,
        required: required !== undefined ? Boolean(required) : existingGroup.required,
        minSelections: min,
        maxSelections: max,
        displayOrder: displayOrder !== undefined ? Number(displayOrder) : existingGroup.displayOrder,
        active: active !== undefined ? Boolean(active) : existingGroup.active,
      },
    });

    // Handle options if provided
    if (Array.isArray(options)) {
      const existingOptionIds = new Set(existingGroup.options.map((o) => o.id));
      const incomingOptionIds = new Set(options.filter((o) => o.id).map((o) => o.id));

      // 1. Delete removed options
      for (const opt of existingGroup.options) {
        if (!incomingOptionIds.has(opt.id)) {
          await prisma.productModifierOption.delete({ where: { id: opt.id } });
        }
      }

      // 2. Upsert incoming options
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        if (!opt.name || !opt.name.trim()) continue;

        const delta = typeof opt.priceDelta === "number" ? opt.priceDelta : parseFloat(opt.priceDelta);
          if (!Number.isFinite(delta) || delta < 0) {
            return NextResponse.json(
              { success: false, error: `Invalid price for modifier option ${i + 1}` },
              { status: 400 }
            );
          }
          const priceDelta = roundMoney(delta);
        const optActive = opt.active !== undefined ? Boolean(opt.active) : true;
        const optOrder = opt.displayOrder !== undefined ? Number(opt.displayOrder) : i;

        if (opt.id && existingOptionIds.has(opt.id)) {
          // Update existing
          await prisma.productModifierOption.update({
            where: { id: opt.id },
            data: {
              name: opt.name.trim(),
              priceDelta,
              active: optActive,
              displayOrder: optOrder,
            },
          });
        } else {
          // Create new option
          await prisma.productModifierOption.create({
            data: {
              modifierGroupId: groupId,
              name: opt.name.trim(),
              priceDelta,
              active: optActive,
              displayOrder: optOrder,
            },
          });
        }
      }
    }

    const updatedGroup = await prisma.productModifierGroup.findUnique({
      where: { id: groupId },
      include: {
        options: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedGroup,
      message: "Modifier group updated successfully",
    });
  } catch (error) {
    console.error("Error updating modifier group:", error);
    return NextResponse.json(
      { success: false, error: "Could not update modifier group" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id: productId } = await params;
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    const optionId = searchParams.get("optionId");

    if (!groupId && !optionId) {
      return NextResponse.json(
        { success: false, error: "Either groupId or optionId must be provided for deletion" },
        { status: 400 }
      );
    }

    if (groupId) {
      // Cascade deletes current options; historical OrderItemModifier snapshots remain untouched.
      const existing = await prisma.productModifierGroup.findFirst({
        where: { id: groupId, productId },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: "Modifier group not found for this product" },
          { status: 404 }
        );
      }

      await prisma.productModifierGroup.delete({
        where: { id: groupId },
      });

      return NextResponse.json({
        success: true,
        message: "Modifier group and its options deleted successfully",
      });
    }

    if (optionId) {
      // Explicit option deletion
      const option = await prisma.productModifierOption.findUnique({
        where: { id: optionId },
        include: { modifierGroup: true },
      });

      if (!option || option.modifierGroup.productId !== productId) {
        return NextResponse.json(
          { success: false, error: "Modifier option not found for this product" },
          { status: 404 }
        );
      }

      await prisma.productModifierOption.delete({
        where: { id: optionId },
      });

      return NextResponse.json({
        success: true,
        message: "Modifier option deleted successfully",
      });
    }
  } catch (error) {
    console.error("Error deleting modifier:", error);
    return NextResponse.json(
      { success: false, error: "Could not delete modifier" },
      { status: 500 }
    );
  }
}
