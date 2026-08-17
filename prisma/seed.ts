import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clean up existing data (Safe Cascade)
  await prisma.orderItemModifier.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productModifierOption.deleteMany();
  await prisma.productModifierGroup.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.openingHour.deleteMany();
  await prisma.restaurantSettings.deleteMany();

  // 1. Restaurant Settings
  await prisma.restaurantSettings.create({
    data: {
      id: "default",
      name: "Love Kitchen",
      subtitle: "Artisanal Kitchen & Delivery",
      phone: "+212 522 123456",
      address: "N° 6, quartier les princesses, Résidence Miradore A, Rue Al Jounaid Arsat Lakbir, Casablanca",
      currency: "MAD",
      deliveryFee: 15,
      isOpenOverride: null, // Follow schedule
      isAutoHours: true,
      openingHours: {
        create: [
          { dayOfWeek: 1, dayName: "Monday", openTime: "11:30", closeTime: "23:30", isClosed: false },
          { dayOfWeek: 2, dayName: "Tuesday", openTime: "11:30", closeTime: "23:30", isClosed: false },
          { dayOfWeek: 3, dayName: "Wednesday", openTime: "11:30", closeTime: "23:30", isClosed: false },
          { dayOfWeek: 4, dayName: "Thursday", openTime: "11:30", closeTime: "23:30", isClosed: false },
          { dayOfWeek: 5, dayName: "Friday", openTime: "11:30", closeTime: "00:30", isClosed: false },
          { dayOfWeek: 6, dayName: "Saturday", openTime: "11:30", closeTime: "00:30", isClosed: false },
          { dayOfWeek: 0, dayName: "Sunday", openTime: "12:00", closeTime: "23:00", isClosed: false },
        ],
      },
    },
  });
  console.log("✅ Restaurant settings & opening hours created.");

  // 2. Categories
  const catBurgers = await prisma.category.create({
    data: { name: "Burgers & Tacos", displayOrder: 1, active: true },
  });
  const catPizza = await prisma.category.create({
    data: { name: "Pizza", displayOrder: 2, active: true },
  });
  const catSides = await prisma.category.create({
    data: { name: "Starters & Sides", displayOrder: 3, active: true },
  });
  const catDesserts = await prisma.category.create({
    data: { name: "Desserts", displayOrder: 4, active: true },
  });
  const catDrinks = await prisma.category.create({
    data: { name: "Drinks", displayOrder: 5, active: true },
  });
  console.log("✅ Categories created.");

  // 3. Products
  await prisma.product.create({
    data: {
      name: "French Tacos (Artisanal)",
      description: "Signature French tacos with golden french fries and creamy house Gruyère cheese sauce wrapped in a toasted tortilla.",
      price: 45,
      image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80",
      available: true,
      categoryId: catBurgers.id,
      modifierGroups: {
        create: [
          {
            name: "Choose Your Sauces",
            description: "Choose up to 2 sauces for free",
            required: true,
            minSelections: 1,
            maxSelections: 2,
            displayOrder: 1,
            active: true,
            options: {
              create: [
                { name: "Algerian", priceDelta: 0, displayOrder: 1, active: true },
                { name: "Biggy", priceDelta: 0, displayOrder: 2, active: true },
                { name: "Andalouse", priceDelta: 0, displayOrder: 3, active: true },
                { name: "Barbecue", priceDelta: 0, displayOrder: 4, active: true },
              ],
            },
          },
          {
            name: "Extras",
            description: "Add savory extras to your tacos",
            required: false,
            minSelections: 0,
            maxSelections: 3,
            displayOrder: 2,
            active: true,
            options: {
              create: [
                { name: "Extra Chicken", priceDelta: 10, displayOrder: 1, active: true },
                { name: "Extra Meat", priceDelta: 12, displayOrder: 2, active: true },
                { name: "Nuggets", priceDelta: 8, displayOrder: 3, active: true },
              ],
            },
          },
          {
            name: "Remove Ingredients",
            description: "Custom exclusions",
            required: false,
            minSelections: 0,
            maxSelections: 4,
            displayOrder: 3,
            active: true,
            options: {
              create: [
                { name: "No onions", priceDelta: 0, displayOrder: 1, active: true },
                { name: "No tomato", priceDelta: 0, displayOrder: 2, active: true },
                { name: "No pickles", priceDelta: 0, displayOrder: 3, active: true },
                { name: "No sauce", priceDelta: 0, displayOrder: 4, active: true },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      name: "Classic Cheeseburger",
      description: "Juicy prime beef patty with aged cheddar, crisp lettuce, fresh tomato, pickles, and our signature burger sauce on a toasted brioche bun.",
      price: 65,
      image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80",
      available: true,
      categoryId: catBurgers.id,
    },
  });

  await prisma.product.create({
    data: {
      name: "Double Bacon Smash Burger",
      description: "Two crispy smashed beef patties, smoky beef bacon strips, caramelized onions, double cheddar, and BBQ aioli.",
      price: 85,
      image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80",
      available: true,
      categoryId: catBurgers.id,
    },
  });

  await prisma.product.create({
    data: {
      name: "Crispy Truffle Chicken Burger",
      description: "Crispy buttermilk fried chicken breast, truffle mayonnaise, melted provolone cheese, and fresh baby arugula.",
      price: 75,
      image: "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600&auto=format&fit=crop&q=80",
      available: true,
      categoryId: catBurgers.id,
    },
  });

  await prisma.product.create({
    data: {
      name: "Pizza Margherita D.O.P.",
      description: "San Marzano tomato sauce, fresh mozzarella di bufala, basil leaves, and a drizzle of cold-pressed extra virgin olive oil.",
      price: 70,
      image: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600&auto=format&fit=crop&q=80",
      available: true,
      categoryId: catPizza.id,
    },
  });

  await prisma.product.create({
    data: {
      name: "Pizza Diavola Piccante",
      description: "Fiery tomato sauce base, fior di latte mozzarella, artisanal spicy beef salami, and Calabrian chili oil.",
      price: 85,
      image: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&auto=format&fit=crop&q=80",
      available: true,
      categoryId: catPizza.id,
    },
  });

  await prisma.product.create({
    data: {
      name: "Loaded Truffle Parmesan Fries",
      description: "Hand-cut golden french fries tossed with aromatic white truffle oil, freshly grated 24-month Parmigiano-Reggiano, and parsley.",
      price: 35,
      image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80",
      available: true,
      categoryId: catSides.id,
    },
  });

  await prisma.product.create({
    data: {
      name: "Crispy Mozzarella Sticks",
      description: "6 crispy golden breaded mozzarella sticks served with house warm basil marinara dip.",
      price: 40,
      image: "https://images.unsplash.com/photo-1531749668029-2db88e4276c7?w=600&auto=format&fit=crop&q=80",
      available: true,
      categoryId: catSides.id,
    },
  });

  await prisma.product.create({
    data: {
      name: "Warm Molten Chocolate Lava Cake",
      description: "Rich Belgian dark chocolate cake with a warm flowing center, served with artisanal Madagascar vanilla ice cream.",
      price: 45,
      image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80",
      available: true,
      categoryId: catDesserts.id,
    },
  });

  await prisma.product.create({
    data: {
      name: "Homemade Italian Tiramisu",
      description: "Layers of espresso-infused savoiardi biscuits and velvety mascarpone cream, finished with Valrhona cocoa powder.",
      price: 40,
      image: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80",
      available: true,
      categoryId: catDesserts.id,
    },
  });

  await prisma.product.create({
    data: {
      name: "Fresh Pressed Lemonade & Mint",
      description: "Freshly squeezed citrus lemonade infused with organic garden mint and light cane sugar syrup.",
      price: 25,
      image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80",
      available: true,
      categoryId: catDrinks.id,
    },
  });

  await prisma.product.create({
    data: {
      name: "Coca-Cola Zero (33cl)",
      description: "Ice cold can of Coca-Cola Zero Sugar.",
      price: 15,
      image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80",
      available: true,
      categoryId: catDrinks.id,
    },
  });

  console.log("✅ Products created (including customizable French Tacos).");
  console.log("✅ Clean slate (0 initial test orders). Ready for production testing.");
  console.log("🎉 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
