import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const projectRoot = "c:\\Users\\User\\Desktop\\LK";
const prisma = new PrismaClient();

interface ProductData {
  name: string;
  categoryName: string;
  categoryOrder: number;
  description: string;
  price: number;
  sourceFile: string;
  slug: string;
  prepStation?: string;
  prepTimeMinutes?: number;
}

const productsToSeed: ProductData[] = [
  // --- Bento Boxes (5 items) ---
  {
    name: "Bento Box Deluxe",
    categoryName: "Bento Boxes",
    categoryOrder: 4,
    description: "Assortiment complet: maki saumon, California rolls tobiko, rouleaux croustillants, nems dorés et salade fraîche avocat-crevettes.",
    price: 95.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02107.jpg"),
    slug: "bento-box-deluxe",
    prepStation: "SUSHI",
    prepTimeMinutes: 15,
  },
  {
    name: "Asian Bento Special",
    categoryName: "Bento Boxes",
    categoryOrder: 4,
    description: "Bento généreux composé de nems croustillants, rouleaux de printemps aux crevettes, riz sauté aux légumes et poulet, crudités de saison.",
    price: 89.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02108.jpg"),
    slug: "asian-bento-special",
    prepStation: "KITCHEN",
    prepTimeMinutes: 15,
  },
  {
    name: "Wok Noodles Bento",
    categoryName: "Bento Boxes",
    categoryOrder: 4,
    description: "Nouilles sautées au poulet et légumes croquants, accompagnées de California rolls au masago, rouleaux de printemps et salade verte.",
    price: 85.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02113.jpg"),
    slug: "wok-noodles-bento",
    prepStation: "KITCHEN",
    prepTimeMinutes: 15,
  },
  {
    name: "Yakitori & Sushi Bento",
    categoryName: "Bento Boxes",
    categoryOrder: 4,
    description: "Brochettes de yakitori grillées laquées sauce teriyaki, nems croustillants, rouleaux de printemps aux crevettes et riz parfumé.",
    price: 92.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02118.jpg"),
    slug: "yakitori-sushi-bento",
    prepStation: "KITCHEN",
    prepTimeMinutes: 15,
  },
  {
    name: "Sweet & Sour Chicken Bento",
    categoryName: "Bento Boxes",
    categoryOrder: 4,
    description: "Bouchées de poulet croustillant caramélisé sauce aigre-douce et sésame, rouleaux frits, sushis saumon-avocat et salade fraîche.",
    price: 88.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02122.jpg"),
    slug: "sweet-sour-chicken-bento",
    prepStation: "KITCHEN",
    prepTimeMinutes: 15,
  },

  // --- Asian Soups & Ramen (7 items) ---
  {
    name: "Classic Asian Noodle Soup",
    categoryName: "Asian Soups & Ramen",
    categoryOrder: 5,
    description: "Bouillon asiatique mijoté avec nouilles soba, crevettes tigrées, effiloché de poulet, pousses de bambou et champignons noirs.",
    price: 68.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02146.jpg"),
    slug: "classic-asian-noodle-soup",
    prepStation: "KITCHEN",
    prepTimeMinutes: 12,
  },
  {
    name: "Tom Yum Goong",
    categoryName: "Asian Soups & Ramen",
    categoryOrder: 5,
    description: "Soupe thaïlandaise emblématique relevée à la citronnelle, crevettes royales, champignons shiitake, piment frais et coriandre.",
    price: 75.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02153.jpg"),
    slug: "tom-yum-goong",
    prepStation: "KITCHEN",
    prepTimeMinutes: 12,
  },
  {
    name: "Seafood Special Ramen",
    categoryName: "Asian Soups & Ramen",
    categoryOrder: 5,
    description: "Ramen aux fruits de mer: calamars tendres, crevettes, filet de poisson blanc, pousses de bambou et champignons noirs.",
    price: 78.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02157.jpg"),
    slug: "seafood-special-ramen",
    prepStation: "KITCHEN",
    prepTimeMinutes: 14,
  },
  {
    name: "Meatball & Prawn Ramen",
    categoryName: "Asian Soups & Ramen",
    categoryOrder: 5,
    description: "Ramen gourmand garni de boulettes de volaille artisanales, grosses crevettes, œuf mollet mariné et champignons noirs.",
    price: 72.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02161.jpg"),
    slug: "meatball-prawn-ramen",
    prepStation: "KITCHEN",
    prepTimeMinutes: 14,
  },
  {
    name: "Wonton & Chicken Noodle Soup",
    categoryName: "Asian Soups & Ramen",
    categoryOrder: 5,
    description: "Raviolis wonton faits maison, effiloché de poulet fermier tendre, crevettes et nouilles dans un bouillon limpide au sésame.",
    price: 69.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02168.jpg"),
    slug: "wonton-chicken-noodle-soup",
    prepStation: "KITCHEN",
    prepTimeMinutes: 12,
  },
  {
    name: "Tom Kha Gai",
    categoryName: "Asian Soups & Ramen",
    categoryOrder: 5,
    description: "Soupe traditionnelle thaïlandaise au lait de coco onctueux, filet de poulet, champignons shiitake, galanga et citronnelle.",
    price: 70.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02173.jpg"),
    slug: "tom-kha-gai",
    prepStation: "KITCHEN",
    prepTimeMinutes: 12,
  },
  {
    name: "Teriyaki Chicken Ramen",
    categoryName: "Asian Soups & Ramen",
    categoryOrder: 5,
    description: "Ramen généreux au poulet grillé sauce teriyaki, maïs doux, algues wakame, champignons émincés et ciboule fraîche.",
    price: 68.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02176.jpg"),
    slug: "teriyaki-chicken-ramen",
    prepStation: "KITCHEN",
    prepTimeMinutes: 12,
  },

  // --- Sushi & Specialty Rolls (4 items) ---
  {
    name: "Salmon Nigiri (4 pcs)",
    categoryName: "Sushi",
    categoryOrder: 6,
    description: "Sushis traditionnels préparés avec de généreuses tranches de saumon d'Atlantique frais sur un riz vinaigré assaisonné.",
    price: 48.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02615.jpg"),
    slug: "salmon-nigiri",
    prepStation: "SUSHI",
    prepTimeMinutes: 10,
  },
  {
    name: "Sushi Sandwich Salmon Avocado",
    categoryName: "Sushi",
    categoryOrder: 6,
    description: "Sandwich sushi croustillant au tartare de saumon frais, lit d'avocat tranché, cream cheese et micro-pousses aromatiques.",
    price: 58.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02706.jpg"),
    slug: "sushi-sandwich-salmon-avocado",
    prepStation: "SUSHI",
    prepTimeMinutes: 12,
  },
  {
    name: "Green Dragon Salmon Roll (8 pcs)",
    categoryName: "Sushi",
    categoryOrder: 6,
    description: "Maki inversé au saumon frais et cream cheese, recouvert d'un éventail d'avocat crémeux et graines de sésame grillées.",
    price: 62.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02804.jpg"),
    slug: "green-dragon-salmon-roll",
    prepStation: "SUSHI",
    prepTimeMinutes: 12,
  },
  {
    name: "Crispy Katsu Chicken Roll (6 pcs)",
    categoryName: "Sushi",
    categoryOrder: 6,
    description: "Rolls panés croustillants au panko garnis de filet de poulet katsu tendre, feuille de roquette et sauce spicy mayo maison.",
    price: 54.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02916.jpg"),
    slug: "crispy-katsu-chicken-roll",
    prepStation: "SUSHI",
    prepTimeMinutes: 12,
  },

  // --- Starters, Yakitori & Platters (3 items) ---
  {
    name: "Yakitori Bœuf Fromage (4 pcs)",
    categoryName: "Starters & Sides",
    categoryOrder: 3,
    description: "Brochettes japonaises de fines lamelles de bœuf enrobant du fromage gouda fondant, laquées à la sauce teriyaki sucrée.",
    price: 52.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02201.jpg"),
    slug: "yakitori-boeuf-fromage",
    prepStation: "KITCHEN",
    prepTimeMinutes: 10,
  },
  {
    name: "Crispy Cheese Bites (5 pcs)",
    categoryName: "Starters & Sides",
    categoryOrder: 3,
    description: "Bouchées croustillantes panées au cœur coulant de fromage fondant et fines herbes, servies avec sauce piquante maison.",
    price: 42.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02250.jpg"),
    slug: "crispy-cheese-bites",
    prepStation: "KITCHEN",
    prepTimeMinutes: 8,
  },
  {
    name: "Asian Starters Sampler Platter",
    categoryName: "Starters & Sides",
    categoryOrder: 3,
    description: "Grand assortiment dégustation: beignets de crevettes aux amandes, brochette teriyaki, rouleaux d'été, dim sum vapeur et croquettes au fromage.",
    price: 85.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02362.jpg"),
    slug: "asian-starters-sampler-platter",
    prepStation: "KITCHEN",
    prepTimeMinutes: 15,
  },

  // --- Salads (1 item) ---
  {
    name: "Royal Seafood & Mango Salad",
    categoryName: "Salads",
    categoryOrder: 7,
    description: "Salade exotique fraîche associant crevettes tigrées, chair de crabe, tranches de mangue mûre, edamame et vinaigrette sésame-agrumes.",
    price: 72.0,
    sourceFile: path.join(projectRoot, "Selection", "RED02301.jpg"),
    slug: "royal-seafood-mango-salad",
    prepStation: "KITCHEN",
    prepTimeMinutes: 8,
  },
];

async function main() {
  console.log("🚀 Starting product image optimization and database seeding...");

  const uploadDir = path.join(projectRoot, "public", "uploads", "products");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // 1. Ensure categories exist
  const categoryMap = new Map<string, string>();

  for (const p of productsToSeed) {
    if (!categoryMap.has(p.categoryName)) {
      let category = await prisma.category.findFirst({
        where: { name: { equals: p.categoryName, mode: "insensitive" } },
      });

      if (!category) {
        console.log(`📁 Creating category: "${p.categoryName}"`);
        category = await prisma.category.create({
          data: {
            name: p.categoryName,
            displayOrder: p.categoryOrder,
            active: true,
          },
        });
      } else {
        // Ensure category is active
        if (!category.active) {
          category = await prisma.category.update({
            where: { id: category.id },
            data: { active: true },
          });
        }
      }
      categoryMap.set(p.categoryName, category.id);
    }
  }

  // 2. Process images and upsert products
  let count = 0;
  for (const item of productsToSeed) {
    count++;
    console.log(`[${count}/${productsToSeed.length}] Processing "${item.name}"...`);

    // Verify source file exists, fallback to PNG folder if Selection doesn't have it
    let sourcePath = item.sourceFile;
    if (!fs.existsSync(sourcePath)) {
      const baseName = path.basename(sourcePath, path.extname(sourcePath));
      const pngPath = path.join(projectRoot, "PNG", `${baseName}.png`);
      if (fs.existsSync(pngPath)) {
        sourcePath = pngPath;
      } else {
        console.error(`❌ Source image not found for ${item.name}: ${sourcePath}`);
        continue;
      }
    }

    const destFileName = `${item.slug}.webp`;
    const destFilePath = path.join(uploadDir, destFileName);
    const publicImageUrl = `/uploads/products/${destFileName}`;

    // Optimize image with Sharp (1200x750 16:10 aspect ratio, WebP quality 82)
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
      console.error(`  ❌ Sharp processing failed for ${item.name}:`, err);
      continue;
    }

    // 3. Upsert product in Database
    const categoryId = categoryMap.get(item.categoryName)!;

    const existing = await prisma.product.findFirst({
      where: { name: { equals: item.name, mode: "insensitive" } },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          description: item.description,
          price: item.price,
          image: publicImageUrl,
          available: true,
          categoryId,
          prepStation: item.prepStation || "KITCHEN",
          prepTimeMinutes: item.prepTimeMinutes || 15,
        },
      });
      console.log(`  ✓ Updated DB product: ${item.name}`);
    } else {
      await prisma.product.create({
        data: {
          name: item.name,
          description: item.description,
          price: item.price,
          image: publicImageUrl,
          available: true,
          categoryId,
          prepStation: item.prepStation || "KITCHEN",
          prepTimeMinutes: item.prepTimeMinutes || 15,
        },
      });
      console.log(`  ✓ Created DB product: ${item.name}`);
    }
  }

  console.log("\n🎉 All 20 products have been processed and seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
