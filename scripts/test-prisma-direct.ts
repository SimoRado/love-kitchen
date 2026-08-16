import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Testing direct Prisma update with subtitle...");
  const s = await prisma.restaurantSettings.update({
    where: { id: "default" },
    data: {
      subtitle: "Artisanal Kitchen & Delivery",
    },
  });
  console.log("Success! Updated settings:", s);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
