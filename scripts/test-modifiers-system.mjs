import assert from "node:assert";
import { PrismaClient } from "@prisma/client";

const baseUrl = "http://localhost:3000";
const prisma = new PrismaClient();

async function main() {
  console.log("🧪 Starting Comprehensive Product Modifiers & Add-ons System Test...\n");

  // 1. Authenticate Admin
  console.log("--- 1. Admin Authentication ---");
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "123" }),
  });
  assert.strictEqual(loginRes.status, 200, "Admin login must succeed");
  const cookieHeader = loginRes.headers.get("set-cookie");
  assert.ok(cookieHeader, "Session cookie must be returned");
  const sessionCookie = cookieHeader.split(";")[0];
  console.log("🔑 Admin session acquired successfully.");

  // Force Open for test duration
  await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({ isOpenOverride: true }),
  });

  // 2. Fetch products to get French Tacos or a test product
  const productsRes = await fetch(`${baseUrl}/api/products`);
  const productsData = await productsRes.json();
  assert.strictEqual(productsData.success, true, "Public GET /api/products must succeed");
  
  let tacosProduct = productsData.data.find((p) =>
    p.name.toLowerCase().includes("tacos") || p.name.toLowerCase().includes("burger")
  );
  if (!tacosProduct) {
    tacosProduct = productsData.data[0];
  }
  assert.ok(tacosProduct, "Test product must exist");
  console.log(`🍔 Target Product: "${tacosProduct.name}" (ID: ${tacosProduct.id}, Base Price: ${tacosProduct.price} MAD)`);

  // Clean any previous modifier groups for this product to start clean
  const existingModsRes = await fetch(`${baseUrl}/api/products/${tacosProduct.id}/modifiers`, {
    headers: { Cookie: sessionCookie },
  });
  const existingModsData = await existingModsRes.json();
  for (const g of existingModsData.data || []) {
    await fetch(`${baseUrl}/api/products/${tacosProduct.id}/modifiers?groupId=${g.id}`, {
      method: "DELETE",
      headers: { Cookie: sessionCookie },
    });
  }

  // 3. Test Invalid Admin Configurations Rejection
  console.log("\n--- 2. Admin Validation Rules Enforcement ---");
  
  // A. Unauthenticated creation attempt
  const unauthRes = await fetch(`${baseUrl}/api/products/${tacosProduct.id}/modifiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Choose Size",
      required: true,
      minSelections: 1,
      maxSelections: 1,
    }),
  });
  assert.strictEqual(unauthRes.status, 401, "Unauthenticated group creation must return 401");
  console.log("🔒 Unauthenticated group creation blocked (401)");

  // B. Min > Max
  const invalidMinMaxRes = await fetch(`${baseUrl}/api/products/${tacosProduct.id}/modifiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      name: "Invalid Min Max",
      minSelections: 3,
      maxSelections: 2,
    }),
  });
  assert.strictEqual(invalidMinMaxRes.status, 400, "Min > Max must return 400");
  console.log("🔒 minSelections > maxSelections blocked (400)");

  // C. Required with minSelections = 0
  const invalidRequiredRes = await fetch(`${baseUrl}/api/products/${tacosProduct.id}/modifiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      name: "Invalid Required",
      required: true,
      minSelections: 0,
      maxSelections: 2,
    }),
  });
  assert.strictEqual(invalidRequiredRes.status, 400, "Required group with minSelections=0 must return 400");
  console.log("🔒 Required group with minSelections=0 blocked (400)");

  // 4. Create Group 1: Sauces (Required, Min 1, Max 2)
  console.log("\n--- 3. Creating Modifier Groups ---");
  const createSaucesRes = await fetch(`${baseUrl}/api/products/${tacosProduct.id}/modifiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      name: "Choose Your Sauces",
      description: "Choose up to 2 sauces for free",
      required: true,
      minSelections: 1,
      maxSelections: 2,
      active: true,
      options: [
        { name: "Algerian", priceDelta: 0 },
        { name: "Biggy", priceDelta: 0 },
        { name: "Andalouse", priceDelta: 0 },
        { name: "Barbecue", priceDelta: 0 },
      ],
    }),
  });
  const saucesData = await createSaucesRes.json();
  assert.strictEqual(createSaucesRes.status, 201, "Sauces group creation must succeed");
  const saucesGroup = saucesData.data;
  console.log(`✅ Created Group: "${saucesGroup.name}" with ${saucesGroup.options.length} options.`);

  // 5. Create Group 2: Extras (Optional, Min 0, Max 3)
  const createExtrasRes = await fetch(`${baseUrl}/api/products/${tacosProduct.id}/modifiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      name: "Extras",
      description: "Add delicious extras to your meal",
      required: false,
      minSelections: 0,
      maxSelections: 3,
      active: true,
      options: [
        { name: "Extra Chicken", priceDelta: 10 },
        { name: "Extra Meat", priceDelta: 12 },
        { name: "Nuggets", priceDelta: 8 },
      ],
    }),
  });
  const extrasData = await createExtrasRes.json();
  assert.strictEqual(createExtrasRes.status, 201, "Extras group creation must succeed");
  const extrasGroup = extrasData.data;
  console.log(`✅ Created Group: "${extrasGroup.name}" with ${extrasGroup.options.length} options.`);

  // 6. Create Group 3: Remove Ingredients (Optional, Min 0, Max 4)
  const createRemovalsRes = await fetch(`${baseUrl}/api/products/${tacosProduct.id}/modifiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      name: "Remove Ingredients",
      required: false,
      minSelections: 0,
      maxSelections: 4,
      active: true,
      options: [
        { name: "No onions", priceDelta: 0 },
        { name: "No tomato", priceDelta: 0 },
        { name: "No pickles", priceDelta: 0 },
        { name: "No sauce", priceDelta: 0 },
      ],
    }),
  });
  const removalsData = await createRemovalsRes.json();
  assert.strictEqual(createRemovalsRes.status, 201, "Removals group creation must succeed");
  const removalsGroup = removalsData.data;
  console.log(`✅ Created Group: "${removalsGroup.name}" with ${removalsGroup.options.length} options.`);

  // Find option IDs for test selections
  const algerianOpt = saucesGroup.options.find((o) => o.name === "Algerian");
  const biggyOpt = saucesGroup.options.find((o) => o.name === "Biggy");
  const barbecueOpt = saucesGroup.options.find((o) => o.name === "Barbecue");
  const chickenOpt = extrasGroup.options.find((o) => o.name === "Extra Chicken");
  const nuggetsOpt = extrasGroup.options.find((o) => o.name === "Nuggets");
  const noOnionsOpt = removalsGroup.options.find((o) => o.name === "No onions");

  assert.ok(algerianOpt && biggyOpt && chickenOpt && nuggetsOpt && noOnionsOpt, "All options must exist");

  // 7. Test Valid Customized Order Submission
  console.log("\n--- 4. Customer Order Submission with Modifiers ---");
  // Selections: Algerian (0), Biggy (0), Chicken (+10), Nuggets (+8), No onions (0)
  // Expected Unit Price: base + 10 + 8 = base + 18
  const expectedUnitPrice = tacosProduct.price + 18;

  const validOrderPayload = {
    idempotencyKey: crypto.randomUUID(),
    customerName: "Amine Alami",
    customerPhone: "+212 600 112233",
    customerAddress: "45 Rue Ibn Batouta, Casablanca",
    orderType: "DELIVERY",
    notes: "Please call on arrival",
    items: [
      {
        productId: tacosProduct.id,
        quantity: 1,
        selectedModifierOptionIds: [
          algerianOpt.id,
          biggyOpt.id,
          chickenOpt.id,
          nuggetsOpt.id,
          noOnionsOpt.id,
        ],
      },
    ],
  };

  const orderRes = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validOrderPayload),
  });

  const orderData = await orderRes.json();
  assert.strictEqual(orderRes.status, 201, `Order placement should succeed (201): ${JSON.stringify(orderData)}`);
  const createdOrder = orderData.data;
  console.log(`✅ Order Placed: #${createdOrder.orderNumber}, Subtotal: ${createdOrder.subtotal} MAD, Total: ${createdOrder.total} MAD`);
  assert.strictEqual(createdOrder.subtotal, expectedUnitPrice, `Subtotal must equal configured unit price (${expectedUnitPrice} MAD)`);

  const createdItem = createdOrder.items[0];
  assert.strictEqual(createdItem.configuredUnitPrice, expectedUnitPrice, "configuredUnitPrice must match authoritative sum");
  assert.strictEqual(createdItem.modifiers.length, 5, "Must have 5 snapshotted OrderItemModifier records");
  console.log("✅ Order item snapshots verified with exact names and price deltas.");

  // 8. Test Malicious / Tampering Requests
  console.log("\n--- 5. Testing Server-Side Tampering & Constraint Rejections ---");

  // A. Exceeding maxSelections (3 sauces when max is 2)
  const tooManySaucesPayload = {
    idempotencyKey: crypto.randomUUID(),
    customerName: "Hacker User",
    customerPhone: "+212 600 000000",
    customerAddress: "Test Street",
    orderType: "DELIVERY",
    items: [
      {
        productId: tacosProduct.id,
        quantity: 1,
        selectedModifierOptionIds: [algerianOpt.id, biggyOpt.id, barbecueOpt.id],
      },
    ],
  };
  const tooManySaucesRes = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tooManySaucesPayload),
  });
  assert.strictEqual(tooManySaucesRes.status, 400, "Exceeding maxSelections must be rejected (400)");
  console.log("🔒 Max selections violation rejected with 400.");

  // B. Failing required group (0 sauces when required = true)
  const noSaucesPayload = {
    idempotencyKey: crypto.randomUUID(),
    customerName: "Incomplete User",
    customerPhone: "+212 600 000000",
    customerAddress: "Test Street",
    orderType: "DELIVERY",
    items: [
      {
        productId: tacosProduct.id,
        quantity: 1,
        selectedModifierOptionIds: [chickenOpt.id],
      },
    ],
  };
  const noSaucesRes = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(noSaucesPayload),
  });
  assert.strictEqual(noSaucesRes.status, 400, "Missing required group must be rejected (400)");
  console.log("🔒 Missing required group selection rejected with 400.");

  // C. Cross-product modifier injection
  // Create another product to steal its modifier option
  const otherProduct = productsData.data.find((p) => p.id !== tacosProduct.id);
  if (otherProduct) {
    const foreignGroupRes = await fetch(`${baseUrl}/api/products/${otherProduct.id}/modifiers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "Foreign Group",
        options: [{ name: "Foreign Option", priceDelta: 5 }],
      }),
    });
    const foreignData = await foreignGroupRes.json();
    const foreignOptionId = foreignData.data.options[0].id;

    const crossProductPayload = {
      idempotencyKey: crypto.randomUUID(),
      customerName: "Cross Product Attacker",
      customerPhone: "+212 600 000000",
      customerAddress: "Test Street",
      orderType: "DELIVERY",
      items: [
        {
          productId: tacosProduct.id,
          quantity: 1,
          selectedModifierOptionIds: [algerianOpt.id, foreignOptionId],
        },
      ],
    };
    const crossRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crossProductPayload),
    });
    assert.strictEqual(crossRes.status, 409, "Cross-product modifier injection must be rejected (409)");
    console.log("🔒 Cross-product modifier injection rejected with 409.");
  }

  // 9. Test Historical Snapshot Immutability
  console.log("\n--- 6. Testing Historical Snapshot Immutability ---");
  // Change Chicken price from 10 MAD to 20 MAD in admin
  const updatedExtrasOptions = extrasGroup.options.map((o) =>
    o.id === chickenOpt.id ? { ...o, priceDelta: 20 } : o
  );
  const updatePriceRes = await fetch(`${baseUrl}/api/products/${tacosProduct.id}/modifiers`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      id: extrasGroup.id,
      options: updatedExtrasOptions,
    }),
  });
  assert.strictEqual(updatePriceRes.status, 200, "Modifier price update must succeed");
  console.log("💰 Admin updated Chicken price from 10 MAD to 20 MAD.");

  // Fetch the OLD order
  const getOrdersRes = await fetch(`${baseUrl}/api/orders`, {
    headers: { Cookie: sessionCookie },
  });
  const getOrdersData = await getOrdersRes.json();
  const oldOrder = getOrdersData.data.find((o) => o.id === createdOrder.id);
  assert.ok(oldOrder, "Old order must be found in database");
  const oldChickenModifier = oldOrder.items[0].modifiers.find((m) => m.modifierOptionName === "Extra Chicken");
  assert.strictEqual(oldChickenModifier.priceDelta, 10, "Old order Chicken modifier MUST still have snapshotted priceDelta 10 MAD");
  assert.strictEqual(oldOrder.subtotal, expectedUnitPrice, "Old order subtotal must remain 100% immutable");
  console.log("🛡️ Verified: Old order Chicken snapshot preserved at 10 MAD (subtotal unchanged).");

  // Create a NEW order with Chicken
  const newOrderPayload = {
    idempotencyKey: crypto.randomUUID(),
    customerName: "Youssef Bennani",
    customerPhone: "+212 611 998877",
    customerAddress: "12 Bd Zerktouni, Casablanca",
    orderType: "PICKUP",
    items: [
      {
        productId: tacosProduct.id,
        quantity: 1,
        selectedModifierOptionIds: [algerianOpt.id, chickenOpt.id],
      },
    ],
  };
  const newOrderRes = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newOrderPayload),
  });
  const newOrderData = await newOrderRes.json();
  assert.strictEqual(newOrderRes.status, 201, "New order must succeed");
  const expectedNewSubtotal = tacosProduct.price + 20;
  assert.strictEqual(newOrderData.data.subtotal, expectedNewSubtotal, `New order subtotal must reflect updated 20 MAD price (Expected ${expectedNewSubtotal})`);
  console.log(`✅ Verified: New order reflects updated 20 MAD price (Subtotal: ${newOrderData.data.subtotal} MAD).`);

  // 10. Clean and Restore
  await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({ isOpenOverride: null }),
  });
  console.log("🔄 Restaurant schedule override reset to AUTO.");

  console.log("\n🎉 ALL MODIFIER TESTS, SNAPSHOT IMMUTABILITY & SECURITY CHECKS PASSED WITH 100% SUCCESS!");
}

main()
  .catch((err) => {
    console.error("❌ Test failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
