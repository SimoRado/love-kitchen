import fs from "node:fs";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

let adminCookie = "";
let createdProductIds = [];
let createdOrderIds = [];

function loadEnvValue(key) {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && match[1].trim() === key) return match[2].trim().replace(/^"|"$/g, "");
    }
  }
  return null;
}

function pass(msg) {
  console.log(`\x1b[32mPASS\x1b[0m ${msg}`);
}

function fail(msg) {
  console.error(`\x1b[31mFAIL\x1b[0m ${msg}`);
  process.exit(1);
}

async function loginAdmin() {
  const adminPassword = loadEnvValue("ADMIN_PASSWORD") || process.env.ADMIN_PASSWORD || "admin123";
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: adminPassword }),
  });
  if (!res.ok) fail(`Admin login failed: ${res.status}`);
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
  if (cookies.length) {
    adminCookie = cookies.map((c) => c.split(";")[0]).join("; ");
  }
  pass("Admin logged in successfully");
}

async function run() {
  console.log("==================================================");
  console.log("RUNNING KITCHEN PREPARATION ESTIMATION TEST SUITE");
  console.log("==================================================");

  await loginAdmin();

  // Clean any leftover active orders for deterministic test baseline
  const initialOrdersRes = await fetch(`${BASE_URL}/api/orders`, { headers: { Cookie: adminCookie } });
  const initialOrdersData = await initialOrdersRes.json();
  if (initialOrdersData.success && initialOrdersData.data) {
    for (const o of initialOrdersData.data) {
      if (o.status === "CONFIRMED" || o.status === "PREPARING" || o.status === "PENDING") {
        await fetch(`${BASE_URL}/api/orders/${o.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: adminCookie },
          body: JSON.stringify({ status: "COMPLETED" }),
        });
      }
    }
  }
  pass("Initial order state cleaned for deterministic estimation test");

  // 1. Fetch categories
  const catRes = await fetch(`${BASE_URL}/api/categories`);
  const catData = await catRes.json();
  if (!catData.success || !catData.data.length) fail("No categories found");
  const categoryId = catData.data[0].id;
  pass(`Fetched category for testing: ${catData.data[0].name}`);

  // 2. Create products with distinct prep times and stations
  // Product A: Gourmet Burger (20 min, station BURGER)
  const burgerRes = await fetch(`${BASE_URL}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      name: `Test Burger ${Date.now()}`,
      description: "Artisanal beef burger",
      price: 65,
      categoryId,
      prepTimeMinutes: 20,
      prepStation: "BURGER",
      available: true,
    }),
  });
  const burgerData = await burgerRes.json();
  if (!burgerData.success || !burgerData.data) fail("Failed to create burger product");
  const burger = burgerData.data;
  createdProductIds.push(burger.id);
  if (burger.prepTimeMinutes !== 20 || burger.prepStation !== "BURGER") {
    fail(`Expected prepTime 20 & station BURGER, got ${burger.prepTimeMinutes} & ${burger.prepStation}`);
  }
  pass(`Created test product with prepTime=20, station=BURGER (id=${burger.id})`);

  // Product B: Wood-Fired Pizza (30 min, station PIZZA)
  const pizzaRes = await fetch(`${BASE_URL}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      name: `Test Pizza ${Date.now()}`,
      description: "Crispy crust pizza",
      price: 80,
      categoryId,
      prepTimeMinutes: 30,
      prepStation: "PIZZA",
      available: true,
    }),
  });
  const pizzaData = await pizzaRes.json();
  if (!pizzaData.success || !pizzaData.data) fail("Failed to create pizza product");
  const pizza = pizzaData.data;
  createdProductIds.push(pizza.id);
  if (pizza.prepTimeMinutes !== 30 || pizza.prepStation !== "PIZZA") {
    fail(`Expected prepTime 30 & station PIZZA, got ${pizza.prepTimeMinutes} & ${pizza.prepStation}`);
  }
  pass(`Created test product with prepTime=30, station=PIZZA (id=${pizza.id})`);

  // Product C: Dragon Sushi Roll (25 min, station SUSHI)
  const sushiRes = await fetch(`${BASE_URL}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      name: `Test Sushi ${Date.now()}`,
      description: "Fresh sushi roll",
      price: 75,
      categoryId,
      prepTimeMinutes: 25,
      prepStation: "SUSHI",
      available: true,
    }),
  });
  const sushiData = await sushiRes.json();
  if (!sushiData.success || !sushiData.data) fail("Failed to create sushi product");
  const sushi = sushiData.data;
  createdProductIds.push(sushi.id);
  pass(`Created test product with prepTime=25, station=SUSHI (id=${sushi.id})`);

  // 3. Test Product Editing (PUT /api/products/:id)
  const editRes = await fetch(`${BASE_URL}/api/products/${burger.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      name: burger.name,
      price: burger.price,
      categoryId,
      prepTimeMinutes: 22,
      prepStation: "BURGER",
    }),
  });
  const editData = await editRes.json();
  if (!editData.success || editData.data.prepTimeMinutes !== 22) {
    fail("Failed to update prepTimeMinutes via PUT");
  }
  pass("Product prepTimeMinutes successfully updated to 22 min and verified via PUT");

  // Revert back to 20 for standard tests
  await fetch(`${BASE_URL}/api/products/${burger.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ name: burger.name, price: burger.price, categoryId, prepTimeMinutes: 20, prepStation: "BURGER" }),
  });

  // 4. Test Concurrent Kitchen Station Estimation:
  // Order containing Burger (20m) + Pizza (30m) + Sushi (25m)
  // Because stations work in parallel, base prep time MUST be max(20, 30, 25) = 30 min (NOT 20+30+25=75 min)
  const estRes = await fetch(`${BASE_URL}/api/orders/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [
        { productId: burger.id, quantity: 1 },
        { productId: pizza.id, quantity: 1 },
        { productId: sushi.id, quantity: 1 },
      ],
    }),
  });
  const estData = await estRes.json();
  if (!estData.success || !estData.data) fail("Failed to calculate estimate preview");
  if (estData.data.basePrepMinutes !== 30) {
    fail(`Expected concurrent base prep 30 min, got ${estData.data.basePrepMinutes}`);
  }
  pass(`Concurrent stations correctly evaluated: max(20, 30, 25) = ${estData.data.basePrepMinutes} min`);

  // 5. Test Active Kitchen Order Congestion:
  // Create Order #1 (Burger) and place in CONFIRMED state
  const order1Res = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "Active Order Customer 1",
      customerPhone: "0612345678",
      orderType: "PICKUP",
      idempotencyKey: `test-key-est-1-${Date.now()}`,
      items: [{ productId: burger.id, quantity: 1 }],
    }),
  });
  const order1Data = await order1Res.json();
  if (!order1Data.success || !order1Data.data) fail("Failed to create customer order 1");
  const order1 = order1Data.data;
  createdOrderIds.push(order1.id);
  if (!order1.estimatedPrepMinutes || !order1.estimatedReadyAt) {
    fail("Customer order 1 did not have estimatedPrepMinutes or estimatedReadyAt");
  }
  pass(`Customer Order #1 created with estimatedPrepMinutes=${order1.estimatedPrepMinutes}, readyAt=${order1.estimatedReadyAt}`);

  // Move Order #1 to CONFIRMED so it counts as active in kitchen
  const updateRes = await fetch(`${BASE_URL}/api/orders/${order1.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ status: "CONFIRMED" }),
  });
  if (!updateRes.ok) fail("Failed to move Order 1 to CONFIRMED");
  pass("Order #1 moved to CONFIRMED (active in kitchen)");

  // 6. Test Station-Aware Congestion:
  // Estimate for a new BURGER order (shares station with active Order #1) -> should add +5 min congestion buffer
  const burgerEstRes = await fetch(`${BASE_URL}/api/orders/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ productId: burger.id, quantity: 1 }],
    }),
  });
  const burgerEstData = await burgerEstRes.json();
  if (!burgerEstData.success) fail("Failed to get burger estimate");
  if (burgerEstData.data.congestionBufferMinutes < 5) {
    fail(`Expected at least 5m station congestion buffer, got ${burgerEstData.data.congestionBufferMinutes}`);
  }
  pass(`Burger estimate received station-aware congestion buffer (+${burgerEstData.data.congestionBufferMinutes}m) -> Total: ${burgerEstData.data.estimatedPrepMinutes}m`);

  // Estimate for a PIZZA order (different station from active Order #1) -> receives minimal cross-station buffer (+1m), NOT +5m
  const pizzaEstRes = await fetch(`${BASE_URL}/api/orders/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ productId: pizza.id, quantity: 1 }],
    }),
  });
  const pizzaEstData = await pizzaEstRes.json();
  if (!pizzaEstData.success) fail("Failed to get pizza estimate");
  if (pizzaEstData.data.congestionBufferMinutes >= 5) {
    fail(`Pizza at independent station should not receive full station buffer (+5m), got ${pizzaEstData.data.congestionBufferMinutes}`);
  }
  pass(`Pizza at independent station received independent queue buffer (+${pizzaEstData.data.congestionBufferMinutes}m) -> Total: ${pizzaEstData.data.estimatedPrepMinutes}m`);

  // 7. Test POS Manual Order Creation with Estimates
  // First register POS device and login
  const codeRes = await fetch(`${BASE_URL}/api/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ name: "Verification Terminal" }),
  });
  const codeData = await codeRes.json();
  if (!codeData.success || !codeData.data.code) fail("Failed to generate pairing invitation");

  const regRes = await fetch(`${BASE_URL}/api/pos/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: codeData.data.code }),
  });
  const posCookies = regRes.headers.getSetCookie ? regRes.headers.getSetCookie() : [regRes.headers.get("set-cookie")].filter(Boolean);
  const posCookie = posCookies.map((c) => c.split(";")[0]).join("; ");

  // Create manual POS order
  const posOrderRes = await fetch(`${BASE_URL}/api/pos/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${posCookie}; ${adminCookie}`,
    },
    body: JSON.stringify({
      customerName: "POS Walk-in Mohamed",
      orderType: "PICKUP",
      initialStatus: "CONFIRMED",
      items: [
        { productId: pizza.id, quantity: 1 },
        { productId: burger.id, quantity: 1 },
      ],
    }),
  });
  const posOrderData = await posOrderRes.json();
  if (!posOrderData.success || !posOrderData.data) fail("Failed to create POS manual order");
  const posOrder = posOrderData.data;
  createdOrderIds.push(posOrder.id);
  if (!posOrder.estimatedPrepMinutes || !posOrder.estimatedReadyAt) {
    fail("POS order missing estimatedPrepMinutes or estimatedReadyAt");
  }
  pass(`POS order created with estimatedPrepMinutes=${posOrder.estimatedPrepMinutes}, readyAt=${posOrder.estimatedReadyAt}`);

  // 8. Test Isolation of Completed/Cancelled Orders
  // Complete all active orders
  for (const orderId of createdOrderIds) {
    await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
  }
  pass("All active orders marked COMPLETED");

  // Now check estimate again -> congestion buffer should be 0
  const cleanEstRes = await fetch(`${BASE_URL}/api/orders/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ productId: burger.id, quantity: 1 }],
    }),
  });
  const cleanEstData = await cleanEstRes.json();
  if (cleanEstData.data.congestionBufferMinutes !== 0) {
    fail(`Expected 0 congestion buffer when all orders are completed, got ${cleanEstData.data.congestionBufferMinutes}`);
  }
  pass("Completed orders correctly removed from active congestion buffer (buffer = 0m)");

  // 9. Clean up test data
  for (const prodId of createdProductIds) {
    await fetch(`${BASE_URL}/api/products/${prodId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
  }
  pass("Cleaned up test products");

  console.log("==================================================");
  console.log("ALL KITCHEN PREPARATION ESTIMATION CHECKS PASSED!");
  console.log("==================================================");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
