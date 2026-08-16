import { prisma } from "../src/lib/prisma";

async function cleanupOrders() {
  console.log("🧹 Starting safe cleanup of existing test orders...");
  
  try {
    // Delete in correct order (or cascade)
    // First, delete order items
    const deletedItems = await prisma.orderItem.deleteMany({});
    console.log(`Deleted ${deletedItems.count} OrderItems.`);

    // Then delete orders
    const deletedOrders = await prisma.order.deleteMany({});
    console.log(`Deleted ${deletedOrders.count} Orders.`);

    console.log("✅ All test orders safely removed! Products, categories, and settings preserved.");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  }
}

cleanupOrders();
