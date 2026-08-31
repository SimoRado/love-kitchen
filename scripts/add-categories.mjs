import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addCategories() {
  const existingCategories = await prisma.category.findMany({
    orderBy: { displayOrder: "asc" },
  });

  console.log("Existing categories:", existingCategories.map((c) => `${c.name} (order: ${c.displayOrder})`));

  const maxOrder = existingCategories.reduce((max, c) => Math.max(max, c.displayOrder), 0);

  const categoriesToAdd = [
    { name: "Sushi", displayOrder: maxOrder + 1 },
    { name: "Poke Bowls", displayOrder: maxOrder + 2 },
    { name: "Salads", displayOrder: maxOrder + 3 },
  ];

  for (const cat of categoriesToAdd) {
    const existing = existingCategories.find(
      (c) => c.name.toLowerCase() === cat.name.toLowerCase()
    );

    if (existing) {
      console.log(`Category "${cat.name}" already exists with ID: ${existing.id}. Ensuring active=true.`);
      await prisma.category.update({
        where: { id: existing.id },
        data: { active: true },
      });
    } else {
      const created = await prisma.category.create({
        data: {
          name: cat.name,
          displayOrder: cat.displayOrder,
          active: true,
        },
      });
      console.log(`✅ Created category "${created.name}" (ID: ${created.id}, displayOrder: ${created.displayOrder})`);
    }
  }

  const allCategories = await prisma.category.findMany({
    orderBy: { displayOrder: "asc" },
  });

  console.log("\nUpdated categories list:");
  for (const c of allCategories) {
    console.log(`• [Order ${c.displayOrder}] ${c.name} (Active: ${c.active})`);
  }

  await prisma.$disconnect();
}

addCategories().catch(async (e) => {
  console.error("Error adding categories:", e);
  await prisma.$disconnect();
  process.exit(1);
});
