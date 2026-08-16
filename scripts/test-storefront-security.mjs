async function runSuite() {
  const baseUrl = "http://localhost:3000";
  console.log("🛡️ Starting Security, Storefront, and Order Validation Test Suite...\n");

  // 1. Unauthenticated API Protection Tests (Must all return 401)
  console.log("--- 1. Testing Unauthenticated Admin API Protection ---");

  const unauthPostProduct = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Hacker Burger", price: 10, categoryId: "123" }),
  });
  console.log(`🔒 POST /api/products without auth: ${unauthPostProduct.status} (Expected 401)`);
  if (unauthPostProduct.status !== 401) throw new Error("Security breach: POST /api/products not protected!");

  const unauthPutSettings = await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Hacked Bistro" }),
  });
  console.log(`🔒 PUT /api/settings without auth: ${unauthPutSettings.status} (Expected 401)`);
  if (unauthPutSettings.status !== 401) throw new Error("Security breach: PUT /api/settings not protected!");

  const unauthStats = await fetch(`${baseUrl}/api/stats`);
  console.log(`🔒 GET /api/stats without auth: ${unauthStats.status} (Expected 401)`);
  if (unauthStats.status !== 401) throw new Error("Security breach: GET /api/stats not protected!");

  // 2. Admin Authentication Flow
  console.log("\n--- 2. Testing Admin Login Flow ---");
  const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong_password_123" }),
  });
  console.log(`🔒 Login with bad password: ${badLogin.status} (Expected 401)`);

  const goodLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "admin_secret_password_2026" }),
  });
  console.log(`🔑 Login with valid password: ${goodLogin.status} (Expected 200)`);
  const cookies = goodLogin.headers.get("set-cookie");
  if (!cookies) throw new Error("Expected set-cookie header on successful login!");

  // Extract session cookie
  const sessionCookie = cookies.split(";")[0];

  // 3. Authenticated Admin Actions
  console.log("\n--- 3. Testing Authenticated Admin Operations ---");
  const authStats = await fetch(`${baseUrl}/api/stats`, {
    headers: { Cookie: sessionCookie },
  });
  const authStatsData = await authStats.json();
  console.log(`✅ Authenticated GET /api/stats: ${authStats.status}, Orders count: ${authStatsData.data.ordersToday}`);

  // 4. Public Storefront Data
  console.log("\n--- 4. Testing Public Storefront Data Endpoints ---");
  const productsRes = await fetch(`${baseUrl}/api/products`);
  const productsData = await productsRes.json();
  console.log(`✅ Public GET /api/products: fetched ${productsData.data.length} items.`);

  const settingsRes = await fetch(`${baseUrl}/api/settings`);
  const settingsData = await settingsRes.json();
  console.log(`✅ Public GET /api/settings: Restaurant "${settingsData.data.name}", Delivery Fee: ${settingsData.data.deliveryFee} ${settingsData.data.currency}`);

  // 5. Storefront Customer Order Placement (When Open)
  console.log("\n--- 5. Testing Storefront Order Placement ---");
  // Set restaurant to Open
  await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      ...settingsData.data,
      isOpenOverride: true,
      deliveryFee: 20,
    }),
  });

  const freshProdRes = await fetch(`${baseUrl}/api/products`);
  const freshProdData = await freshProdRes.json();
  const testProduct1 = freshProdData.data[0];
  const testProduct2 = freshProdData.data[1];

  const orderPayload = {
    customerName: "Kenza Tazi",
    customerPhone: "+212 660 001122",
    customerAddress: "55 Boulevard d'Anfa, 3rd Floor, Casablanca",
    orderType: "DELIVERY",
    notes: "Please call when arriving",
    items: [
      { productId: testProduct1.id, quantity: 2 },
      { productId: testProduct2.id, quantity: 1 },
    ],
  };

  const placeOrderRes = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderPayload),
  });
  const placeOrderData = await placeOrderRes.json();
  console.log(`✅ Customer Order Placed: #${placeOrderData.data.orderNumber}, Subtotal: ${placeOrderData.data.subtotal} MAD, Delivery: ${placeOrderData.data.deliveryFee} MAD, Total: ${placeOrderData.data.total} MAD`);

  if (placeOrderData.data.deliveryFee !== 20) {
    throw new Error(`Expected delivery fee of 20 MAD, got ${placeOrderData.data.deliveryFee}`);
  }

  // 6. Test Pickup Order (Delivery fee must be 0)
  console.log("\n--- 6. Testing Pickup Order (0 MAD Delivery Fee) ---");
  const pickupOrderPayload = {
    customerName: "Omar Bennani",
    customerPhone: "+212 661 334455",
    orderType: "PICKUP",
    items: [{ productId: testProduct1.id, quantity: 1 }],
  };

  const pickupOrderRes = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pickupOrderPayload),
  });
  const pickupOrderData = await pickupOrderRes.json();
  console.log(`✅ Pickup Order Placed: #${pickupOrderData.data.orderNumber}, Delivery Fee: ${pickupOrderData.data.deliveryFee} MAD (Expected 0)`);
  if (pickupOrderData.data.deliveryFee !== 0) throw new Error("Expected 0 delivery fee for pickup!");

  // 7. Test Unavailable Product Order Rejection
  console.log("\n--- 7. Testing Unavailable Product Rejection ---");
  // Mark testProduct1 unavailable
  const patchRes = await fetch(`${baseUrl}/api/products/${testProduct1.id}/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({ available: false }),
  });
  const patchText = await patchRes.text();
  console.log(`PATCH status: ${patchRes.status}`, patchText);
  const patchData = JSON.parse(patchText);

  const tryUnavailableOrder = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "Test User",
      customerPhone: "+212 600 000000",
      orderType: "PICKUP",
      items: [{ productId: testProduct1.id, quantity: 1 }],
    }),
  });
  const tryUnavailableData = await tryUnavailableOrder.json();
  console.log(`🔒 Order with unavailable item rejected: status ${tryUnavailableOrder.status}, Message: "${tryUnavailableData.error}"`);
  if (tryUnavailableOrder.status !== 400) throw new Error("Expected order with unavailable product to be rejected!");

  // Restore availability
  await fetch(`${baseUrl}/api/products/${testProduct1.id}/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({ available: true }),
  });

  // 8. Test Closed Restaurant Order Rejection
  console.log("\n--- 8. Testing Closed Restaurant Order Rejection ---");
  // Force restaurant CLOSED
  await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      ...settingsData.data,
      isOpenOverride: false,
    }),
  });

  const tryClosedOrder = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "Test User",
      customerPhone: "+212 600 000000",
      orderType: "PICKUP",
      items: [{ productId: testProduct1.id, quantity: 1 }],
    }),
  });
  const tryClosedData = await tryClosedOrder.json();
  console.log(`🔒 Order while restaurant closed rejected: status ${tryClosedOrder.status}, Message: "${tryClosedData.error}"`);
  if (tryClosedOrder.status !== 400) throw new Error("Expected order on closed restaurant to be rejected!");

  // Restore restaurant back to normal schedule (isOpenOverride: null)
  await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      ...settingsData.data,
      isOpenOverride: null,
      deliveryFee: 15,
    }),
  });
  console.log("✅ Restaurant schedule restored.");

  console.log("\n🎉 ALL SECURITY, STOREFRONT, AND DATA INTEGRITY TESTS PASSED WITH 100% SUCCESS!");
}

runSuite().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
