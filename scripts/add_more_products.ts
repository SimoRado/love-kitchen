import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const projectRoot = path.resolve("C:/Users/User/Desktop/LK");
const selectionDir = path.join(projectRoot, "pics", "Selection");
const pngDir = path.join(projectRoot, "pics", "PNG");
const outputDir = path.join(projectRoot, "public", "images", "products");

// 16 legacy test products to remove
const LEGACY_TEST_PRODUCTS = [
  "French Tacos (Artisanal)",
  "Classic Cheeseburger",
  "Double Bacon Smash Burger",
  "Crispy Truffle Chicken Burger",
  "Pizza Margherita D.O.P.",
  "Pizza Diavola Piccante",
  "Loaded Truffle Parmesan Fries",
  "Crispy Mozzarella Sticks",
  "Warm Molten Chocolate Lava Cake",
  "Homemade Italian Tiramisu",
  "Fresh Pressed Lemonade & Mint",
  "Coca-Cola Zero (33cl)",
  "Sushi 36pcs",
  "Test Burger 1788273896887",
  "Test Pizza 1788273897956",
  "Test Sushi 1788273899175",
];

// 20 new distinct products
interface ProductItem {
  photoId: string;
  name: string;
  categoryName: string;
  price: number;
  description: string;
  slug: string;
  prepTimeMinutes: number;
  prepStation: string;
}

const NEW_PRODUCTS: ProductItem[] = [
  {
    photoId: "RED02190",
    name: "Ebi & Chicken Ramen Special",
    categoryName: "Asian Soups & Ramen",
    price: 74,
    description:
      "Bouillon riche mijoté avec nouilles soba, crevettes tigrées royales, émincé de poulet fermier, œuf mollet mariné, oignons rouges et piment doux.",
    slug: "ebi-chicken-ramen-special",
    prepTimeMinutes: 14,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02210",
    name: "Yakitori Tsukune (3 pcs)",
    categoryName: "Starters & Sides",
    price: 38,
    description:
      "Brochettes japonaises traditionnelles de boulettes de volaille fondantes, laquées à la sauce teriyaki sucrée et sésame grillé.",
    slug: "yakitori-tsukune",
    prepTimeMinutes: 10,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02204",
    name: "Yakitori Saumon Teriyaki (2 pcs)",
    categoryName: "Starters & Sides",
    price: 45,
    description:
      "Brochettes de dés de saumon d'Atlantique frais grillés, nappés d'un glaçage teriyaki maison onctueux.",
    slug: "yakitori-saumon-teriyaki",
    prepTimeMinutes: 10,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02223",
    name: "Assortiment Yakitori Grillades (5 pcs)",
    categoryName: "Starters & Sides",
    price: 65,
    description:
      "Plateau dégustation de 5 brochettes variées: bœuf gouda fondant, tsukune volaille, saumon laqué, rouleau croustillant et crevettes grillées.",
    slug: "assortiment-yakitori-grillades",
    prepTimeMinutes: 12,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02244",
    name: "Crevettes Tempura aux Amandes (4 pcs)",
    categoryName: "Starters & Sides",
    price: 58,
    description:
      "Gambas géantes enveloppées d'une panure dorée ultra-croustillante aux éclats d'amandes effilées, servies avec dip sweet chili.",
    slug: "crevettes-tempura-amandes",
    prepTimeMinutes: 10,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02261",
    name: "Poulet Karaage Japonais (6 pcs)",
    categoryName: "Starters & Sides",
    price: 46,
    description:
      "Bouchées croustillantes de poulet mariné au gingembre frais, sauce soja et ail, frites selon la recette traditionnelle nippone.",
    slug: "poulet-karaage-japonais",
    prepTimeMinutes: 10,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02267",
    name: "Calamars Frits Croustillants (6 pcs)",
    categoryName: "Starters & Sides",
    price: 48,
    description:
      "Anneaux tendres de calamars frais enrobés d'une pâte tempura légère et dorée, servis avec quartier de citron frais.",
    slug: "calamars-frits-croustillants",
    prepTimeMinutes: 8,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02285",
    name: "Salade de Bœuf Thaï (Yam Nua)",
    categoryName: "Salads",
    price: 68,
    description:
      "Fines lamelles de bœuf mariné et sauté au wok, tomates fraîches, oignons rouges, menthe, coriandre et jus de citron vert pimenté.",
    slug: "salade-boeuf-thai",
    prepTimeMinutes: 10,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02308",
    name: "Poke Bowl Saumon & Thon Hawaïen",
    categoryName: "Poke Bowls",
    price: 75,
    description:
      "Dés de saumon frais et thon rouge mariné, avocat onctueux, radis croquants, suprêmes d'orange, wontons dorés et sauce ponzu sésame.",
    slug: "poke-bowl-saumon-thon",
    prepTimeMinutes: 12,
    prepStation: "SUSHI",
  },
  {
    photoId: "RED02314",
    name: "Poke Bowl Saumon Fresh & Avocado",
    categoryName: "Poke Bowls",
    price: 72,
    description:
      "Tranches généreuses de saumon frais sur riz shari assaisonné, avocat mûr émincé, rubans de wonton croustillants et sésame grillé.",
    slug: "poke-bowl-saumon-avocat",
    prepTimeMinutes: 12,
    prepStation: "SUSHI",
  },
  {
    photoId: "RED02317",
    name: "Salade Croquante Poulet Asiatique",
    categoryName: "Salads",
    price: 58,
    description:
      "Émincé de poulet pané tiède sur mélange de jeunes pousses, julienne de poivrons croquants, oignons rouges et vinaigrette sésame.",
    slug: "salade-croquante-poulet",
    prepTimeMinutes: 10,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02326",
    name: "Ebi Tempura Japonais (4 pcs)",
    categoryName: "Starters & Sides",
    price: 54,
    description:
      "Crevettes tigrées frites dans une pâte tempura aérienne et croustillante, présentées sur lit de salade croquante.",
    slug: "ebi-tempura-japonais",
    prepTimeMinutes: 10,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02335",
    name: "Dim Sum Siu Mai Vapeur (4 pcs)",
    categoryName: "Starters & Sides",
    price: 48,
    description:
      "Bouchées vapeur traditionnelles Siu Mai farcies d'un mélange délicat de crevettes et volaille parfumée aux fines herbes et sésame.",
    slug: "dim-sum-siu-mai",
    prepTimeMinutes: 12,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02374",
    name: "Grand Plateau Dégustation Asiatique (20 pcs)",
    categoryName: "Starters & Sides",
    price: 120,
    description:
      "Plateau festif comprenant 4 ebi tempura amandes, 6 nems croustillants, 2 brochettes yakitori, 6 dim sum vapeur et 2 brochettes de boulettes.",
    slug: "grand-plateau-degustation",
    prepTimeMinutes: 18,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02383",
    name: "Poulet Croustillant Sel & Poivre",
    categoryName: "Starters & Sides",
    price: 55,
    description:
      "Morceaux de poulet tendres frits au wok avec poivrons multicolores, oignons rouges, piments frais et sel aromatisé aux 5 épices.",
    slug: "poulet-croustillant-sel-poivre",
    prepTimeMinutes: 10,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02411",
    name: "Bœuf au Basilic Thaï & Piments",
    categoryName: "Asian Soups & Ramen",
    price: 78,
    description:
      "Émincé de filet de bœuf mijoté au wok dans un jus relevé au basilic thaïlandais sacré, piments doux et sauce soja brune.",
    slug: "boeuf-basilic-thai",
    prepTimeMinutes: 12,
    prepStation: "KITCHEN",
  },
  {
    photoId: "RED02622",
    name: "Nigiri Daurade Royale (4 pcs)",
    categoryName: "Sushi",
    price: 50,
    description:
      "Tranches soyeuses de filet de daurade royale ultra-fraîche délicatement posées sur riz vinaigré shari traditionnel.",
    slug: "nigiri-daurade-royale",
    prepTimeMinutes: 10,
    prepStation: "SUSHI",
  },
  {
    photoId: "RED02635",
    name: "Carpaccio de Saumon Ponzu & Truffe",
    categoryName: "Sushi",
    price: 78,
    description:
      "Rosace raffinée de fines lamelles de saumon cru, câpres, radis, micro-pousses et sauce ponzu parfumée à l'huile de truffe blanche.",
    slug: "carpaccio-saumon-ponzu",
    prepTimeMinutes: 12,
    prepStation: "SUSHI",
  },
  {
    photoId: "RED02665",
    name: "Sashimi Daurade Royale (5 pcs)",
    categoryName: "Sushi",
    price: 62,
    description:
      "Sashimis purs de daurade royale servis ultra-frais avec citron et fleurs comestibles.",
    slug: "sashimi-daurade-royale",
    prepTimeMinutes: 10,
    prepStation: "SUSHI",
  },
  {
    photoId: "RED02682",
    name: "Crispy Nori Taco Bœuf Wagyu (2 pcs)",
    categoryName: "Sushi",
    price: 52,
    description:
      "Tacos fusion croustillants à base de feuille de nori dorée, garnis d'émincé de bœuf grillé caramélisé et ciboule fraîche.",
    slug: "crispy-nori-taco-wagyu",
    prepTimeMinutes: 10,
    prepStation: "SUSHI",
  },
];

async function main() {
  console.log("🚀 Starting menu cleanup and adding 20 new products...");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Remove legacy test products
  console.log("\n🧹 Removing legacy test products...");
  for (const legacyName of LEGACY_TEST_PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { name: { equals: legacyName, mode: "insensitive" } },
      include: {
        modifierGroups: {
          include: { options: true },
        },
      },
    });

    if (existing) {
      // Clean up linked modifiers
      for (const mg of existing.modifierGroups) {
        await prisma.productModifierOption.deleteMany({
          where: { modifierGroupId: mg.id },
        });
        await prisma.productModifierGroup.delete({
          where: { id: mg.id },
        });
      }

      // Nullify order items referencing this product to avoid FK constraint errors
      await prisma.orderItem.updateMany({
        where: { productId: existing.id },
        data: { productId: null },
      });

      // Delete the product
      await prisma.product.delete({
        where: { id: existing.id },
      });
      console.log(`  ✓ Removed legacy product: ${legacyName}`);
    }
  }

  // 2. Deactivate empty legacy categories (Burgers & Tacos, Pizza, Desserts)
  console.log("\n📁 Managing categories...");
  const categoriesToCheck = ["Burgers & Tacos", "Pizza", "Desserts", "Drinks"];
  for (const catName of categoriesToCheck) {
    const cat = await prisma.category.findFirst({
      where: { name: { equals: catName, mode: "insensitive" } },
      include: { _count: { select: { products: true } } },
    });
    if (cat && cat._count.products === 0) {
      await prisma.category.update({
        where: { id: cat.id },
        data: { active: false },
      });
      console.log(`  ✓ Deactivated empty category: "${catName}"`);
    }
  }

  // Ensure Poke Bowls category exists and is active
  let pokeCategory = await prisma.category.findFirst({
    where: { name: { equals: "Poke Bowls", mode: "insensitive" } },
  });
  if (!pokeCategory) {
    pokeCategory = await prisma.category.create({
      data: {
        name: "Poke Bowls",
        displayOrder: 7,
        active: true,
      },
    });
    console.log(`  ✓ Created active category: "Poke Bowls"`);
  } else if (!pokeCategory.active) {
    await prisma.category.update({
      where: { id: pokeCategory.id },
      data: { active: true },
    });
    console.log(`  ✓ Activated category: "Poke Bowls"`);
  }

  // Category cache
  const allCategories = await prisma.category.findMany();
  const categoryMap = new Map<string, string>();
  for (const c of allCategories) {
    categoryMap.set(c.name.toLowerCase(), c.id);
  }

  // 3. Process new 20 images and upsert products
  console.log("\n📸 Processing 20 new images and upserting products...");
  let count = 0;
  for (const item of NEW_PRODUCTS) {
    count++;
    console.log(`[${count}/${NEW_PRODUCTS.length}] ${item.name} (${item.photoId})...`);

    // Locate source file in Selection or PNG
    let sourcePath = path.join(selectionDir, `${item.photoId}.jpg`);
    if (!fs.existsSync(sourcePath)) {
      const pngPath = path.join(pngDir, `${item.photoId}.png`);
      if (fs.existsSync(pngPath)) {
        sourcePath = pngPath;
      } else {
        console.error(`  ❌ Image not found for ${item.photoId} at ${sourcePath}`);
        continue;
      }
    }

    const destFileName = `${item.slug}.webp`;
    const destFilePath = path.join(outputDir, destFileName);
    const publicUrl = `/images/products/${destFileName}`;

    // Optimize image with Sharp: 1200x750, 16:10 aspect ratio, quality 82 WebP
    try {
      await sharp(sourcePath)
        .rotate()
        .resize(1200, 750, {
          fit: "cover",
          position: "center",
        })
        .webp({ quality: 82, effort: 4 })
        .toFile(destFilePath);

      const stats = fs.statSync(destFilePath);
      console.log(`  ✓ Image saved: ${destFileName} (${Math.round(stats.size / 1024)} KB)`);
    } catch (err) {
      console.error(`  ❌ Sharp error for ${item.name}:`, err);
      continue;
    }

    // Get category ID
    const catId = categoryMap.get(item.categoryName.toLowerCase());
    if (!catId) {
      console.error(`  ❌ Category not found: ${item.categoryName}`);
      continue;
    }

    // Upsert product in Prisma
    const existing = await prisma.product.findFirst({
      where: { name: { equals: item.name, mode: "insensitive" } },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          description: item.description,
          price: item.price,
          image: publicUrl,
          available: true,
          prepTimeMinutes: item.prepTimeMinutes,
          prepStation: item.prepStation,
          categoryId: catId,
        },
      });
      console.log(`  ✓ Updated DB product: ${item.name}`);
    } else {
      await prisma.product.create({
        data: {
          name: item.name,
          description: item.description,
          price: item.price,
          image: publicUrl,
          available: true,
          prepTimeMinutes: item.prepTimeMinutes,
          prepStation: item.prepStation,
          categoryId: catId,
        },
      });
      console.log(`  ✓ Created DB product: ${item.name}`);
    }
  }

  // 4. Final verification
  const finalProducts = await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n🎉 DONE! Total active products in database: ${finalProducts.length}`);
  console.log("\nBreakdown by category:");
  const catCount: Record<string, number> = {};
  for (const p of finalProducts) {
    catCount[p.category.name] = (catCount[p.category.name] || 0) + 1;
  }
  for (const [k, v] of Object.entries(catCount)) {
    console.log(`  - ${k}: ${v} products`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
