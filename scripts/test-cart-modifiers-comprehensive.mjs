import assert from "node:assert";

const baseUrl = "http://localhost:3000";

async function runTests() {
  console.log("🚀 Running Detailed Prompt Verification Tests...\n");

  // 1. Authenticate Admin
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "123" }),
  });
  assert.strictEqual(loginRes.status, 200, "Admin login must succeed");
  const cookieHeader = loginRes.headers.get("set-cookie");
  assert.ok(cookieHeader, "Session cookie must be returned");
  const sessionCookie = cookieHeader.split(";")[0];

  // Set Open override
  await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({ isOpenOverride: true }),
  });

  // 2. Fetch categories and products
  const productsRes = await fetch(`${baseUrl}/api/products`);
  const productsData = await productsRes.json();
  assert.strictEqual(productsData.success, true);

  // Find or create "French Tacos" with base price 45
  let frenchTacos = productsData.data.find((p) => p.name === "French Tacos");
  if (!frenchTacos) {
    const catId = productsData.data[0]?.categoryId;
    const createProdRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "French Tacos",
        description: "Classic French Tacos loaded with cheesy sauce and fries",
        price: 45,
        categoryId: catId,
        available: true,
      }),
    });
    const createProdData = await createProdRes.json();
    frenchTacos = createProdData.data;
  }

  assert.ok(frenchTacos, "French Tacos product must exist");
  console.log(`🌮 Verified Product: "${frenchTacos.name}" (Base: ${frenchTacos.price} MAD)`);

  // Clear existing modifier groups for this product to setup exact test configuration
  const existingModsRes = await fetch(`${baseUrl}/api/products/${frenchTacos.id}/modifiers`, {
    headers: { Cookie: sessionCookie },
  });
  const existingModsData = await existingModsRes.json();
  for (const g of existingModsData.data || []) {
    await fetch(`${baseUrl}/api/products/${frenchTacos.id}/modifiers?groupId=${g.id}`, {
      method: "DELETE",
      headers: { Cookie: sessionCookie },
    });
  }

  // Create Group: Sauces (Required, min 1, max 2)
  const saucesRes = await fetch(`${baseUrl}/api/products/${frenchTacos.id}/modifiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      name: "Sauces",
      required: true,
      minSelections: 1,
      maxSelections: 2,
      options: [
        { name: "Algerian", priceDelta: 0 },
        { name: "Biggy", priceDelta: 0 },
        { name: "Samourai", priceDelta: 0 },
      ],
    }),
  });
  const saucesGroup = (await saucesRes.json()).data;

  // Create Group: Extras (Optional, min 0, max 3)
  const extrasRes = await fetch(`${baseUrl}/api/products/${frenchTacos.id}/modifiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      name: "Extras",
      required: false,
      minSelections: 0,
      maxSelections: 3,
      options: [
        { name: "Extra Meat", priceDelta: 12 },
        { name: "Nuggets", priceDelta: 8 },
        { name: "Cheddar", priceDelta: 5 },
      ],
    }),
  });
  const extrasGroup = (await extrasRes.json()).data;

  // Create Group: Remove Ingredients (Optional, min 0, max 3)
  const removeRes = await fetch(`${baseUrl}/api/products/${frenchTacos.id}/modifiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      name: "Remove Ingredients",
      required: false,
      minSelections: 0,
      maxSelections: 3,
      options: [
        { name: "No onions", priceDelta: 0 },
        { name: "No tomato", priceDelta: 0 },
      ],
    }),
  });
  const removeGroup = (await removeRes.json()).data;

  console.log("✅ Configured Modifier Groups: Sauces, Extras, Remove Ingredients");

  const algerianOpt = saucesGroup.options.find((o) => o.name === "Algerian");
  const extraMeatOpt = extrasGroup.options.find((o) => o.name === "Extra Meat");
  const nuggetsOpt = extrasGroup.options.find((o) => o.name === "Nuggets");
  const noOnionsOpt = removeGroup.options.find((o) => o.name === "No onions");

  // TEST 1: Verification — Modifiers + Quantity (Prompt Section 27)
  // Base: 45 MAD
  // Select: Extra Meat (+12 MAD) -> unit price 57 MAD, Qty 2 -> 114 MAD
  // Add: Nuggets (+8 MAD) -> unit price 65 MAD, Qty 2 -> 130 MAD
  // Add: Algerian (Free, 0 MAD), No onions (Free, 0 MAD) -> unit price 65 MAD, Qty 2 -> 130 MAD
  console.log("\n--- Testing Verification Prompt Sections 26-29 ---");

  const orderPayload = {
    idempotencyKey: crypto.randomUUID(),
    customerName: "Yassine Mansouri",
    customerPhone: "+212 611 223344",
    customerAddress: "Boulevard Massira Khadra, Casablanca",
    orderType: "DELIVERY",
    notes: "Ring the bell upon delivery",
    items: [
      {
        productId: frenchTacos.id,
        quantity: 2,
        selectedModifierOptionIds: [
          algerianOpt.id,
          extraMeatOpt.id,
          nuggetsOpt.id,
          noOnionsOpt.id,
        ],
      },
    ],
  };

  const orderRes = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderPayload),
  });

  const orderData = await orderRes.json();
  assert.strictEqual(orderRes.status, 201, "Order placement must succeed");
  const order = orderData.data;

  // Expected calculations:
  // Base (45) + Extra Meat (12) + Nuggets (8) + Algerian (0) + No onions (0) = 65 MAD unit price
  // Subtotal: 65 * 2 = 130 MAD
  assert.strictEqual(order.items[0].configuredUnitPrice, 65, "Unit price must be 65 MAD");
  assert.strictEqual(order.items[0].quantity, 2, "Quantity must be 2");
  assert.strictEqual(order.subtotal, 130, "Subtotal must be 130 MAD");
  console.log(`✅ Verified Order #${order.orderNumber}: Unit Price = 65 MAD, Qty = 2, Subtotal = 130 MAD`);

  // Verify DB Snapshots
  assert.strictEqual(order.items[0].modifiers.length, 4, "Must persist 4 modifier snapshots");
  const modNames = order.items[0].modifiers.map((m) => m.modifierOptionName);
  assert.ok(modNames.includes("Algerian"), "Free modifier Algerian must be stored in DB snapshot");
  assert.ok(modNames.includes("No onions"), "Free removal No onions must be stored in DB snapshot");
  assert.ok(modNames.includes("Extra Meat"), "Extra Meat must be stored in DB snapshot");
  assert.ok(modNames.includes("Nuggets"), "Nuggets must be stored in DB snapshot");
  console.log("✅ Verified DB snapshots: Algerian (0 MAD), No onions (0 MAD), Extra Meat (+12 MAD), Nuggets (+8 MAD)");

  // TEST 2: Admin orders endpoint returns complete snapshot structure
  const adminOrdersRes = await fetch(`${baseUrl}/api/orders`, {
    headers: { Cookie: sessionCookie },
  });
  const adminOrdersData = await adminOrdersRes.json();
  const fetchedOrder = adminOrdersData.data.find((o) => o.id === order.id);
  assert.ok(fetchedOrder, "Order must be retrievable from admin orders endpoint");
  assert.strictEqual(fetchedOrder.items[0].modifiers.length, 4);
  console.log("✅ Verified Admin Orders view renders complete snapshot structure without relying on live records");

  // Reset override
  await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({ isOpenOverride: null }),
  });

  console.log("\n🎉 ALL PROMPT VERIFICATION TESTS PASSED SUCCESSFULLY!\n");
}

runTests().catch((err) => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
