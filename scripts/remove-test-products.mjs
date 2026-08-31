import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function removeTestProducts() {
  console.log("🔍 Searching for test products in the database...");
  
  const testProducts = await prisma.product.findMany({
    where: {
      name: {
        contains: "test",
        mode: "insensitive",
      },
    },
    include: {
      orderItems: true,
      modifierGroups: {
        include: {
          options: true,
        },
      },
    },
  });

  console.log(`Found ${testProducts.length} test product(s):`);
  for (const p of testProducts) {
    console.log(` - ID: ${p.id} | Name: "${p.name}" | Price: ${p.price} MAD | OrderItems linked: ${p.orderItems.length}`);
  }

  if (testProducts.length === 0) {
    console.log("✅ No test products found.");
    await prisma.$disconnect();
    return;
  }

  const productIds = testProducts.map((p) => p.id);

  // If there are orderItems referencing these products, remove order item modifiers and order items for clean deletion
  console.log("🗑️ Deleting associated OrderItemModifier and OrderItem records for test products...");
  const orderItems = await prisma.orderItem.findMany({
    where: { productId: { in: productIds } },
    select: { id: true },
  });
  const orderItemIds = orderItems.map((oi) => oi.id);

  if (orderItemIds.length > 0) {
    await prisma.orderItemModifier.deleteMany({
      where: { orderItemId: { in: orderItemIds } },
    });
    await prisma.orderItem.deleteMany({
      where: { id: { in: orderItemIds } },
    });
  }

  // Delete modifier options and groups
  console.log("🗑️ Deleting modifier options and modifier groups...");
  await prisma.productModifierOption.deleteMany({
    where: {
      modifierGroup: {
        productId: { in: productIds },
      },
    },
  });

  await prisma.productModifierGroup.deleteMany({
    where: {
      productId: { in: productIds },
    },
  });

  // Delete products
  console.log("🗑️ Deleting test products...");
  const deleteResult = await prisma.product.deleteMany({
    where: {
      id: { in: productIds },
    },
  });

  console.log(`✅ Successfully deleted ${deleteResult.count} test product(s)!`);
  
  const remainingCount = await prisma.product.count();
  console.log(`📊 Total real products remaining in menu: ${remainingCount}`);
  
  await prisma.$disconnect();
}

removeTestProducts().catch(async (e) => {
  console.error("❌ Error deleting test products:", e);
  await prisma.$disconnect();
  process.exit(1);
});
