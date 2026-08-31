import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      name: true,
      price: true,
      category: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  console.log(`Remaining products (${products.length}):`);
  for (const p of products) {
    console.log(`• [${p.category.name}] ${p.name} - ${p.price} MAD`);
  }

  await prisma.$disconnect();
}

main();
