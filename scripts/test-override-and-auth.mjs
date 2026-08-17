import assert from "node:assert";

async function main() {
  const baseUrl = "http://localhost:3000";
  console.log("🧪 Testing Password '123' and Override Priority System...\n");

  // ==========================================
  // 1. TEST ADMIN AUTHENTICATION WITH '123'
  // ==========================================
  console.log("--- 1. Testing Admin Authentication with Password '123' ---");

  const wrongLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong_password" }),
  });
  console.log(`🔒 Login with wrong password: ${wrongLoginRes.status} (Expected 401)`);
  assert.strictEqual(wrongLoginRes.status, 401, "Expected 401 for wrong password");

  const goodLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "123" }),
  });
  console.log(`🔑 Login with password '123': ${goodLoginRes.status} (Expected 200)`);
  assert.strictEqual(goodLoginRes.status, 200, "Expected 200 for password '123'");

  const setCookie = goodLoginRes.headers.get("set-cookie");
  const sessionCookie = setCookie ? setCookie.split(";")[0] : "";
  console.log(`🍪 Admin session cookie obtained: ${sessionCookie.slice(0, 30)}...`);

  // ==========================================
  // 2. TEST PRODUCTS & BASE SETTINGS
  // ==========================================
  const prodsRes = await fetch(`${baseUrl}/api/products`);
  const prodsData = await prodsRes.json();
  const testProduct = prodsData.data[0];

  const baseSettingsRes = await fetch(`${baseUrl}/api/settings`);
  const baseSettings = await baseSettingsRes.json();

  // ==========================================
  // 3. TEST FORCE CLOSED (isOpenOverride: false)
  // ==========================================
  console.log("\n--- 2. Testing FORCE CLOSED (isOpenOverride: false) ---");
  const forceClosedRes = await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      ...baseSettings.data,
      isOpenOverride: false,
    }),
  });
  assert.strictEqual(forceClosedRes.status, 200);

  const getForceClosed = await fetch(`${baseUrl}/api/settings`);
  const forceClosedData = await getForceClosed.json();
  console.log("Settings after Force Closed:", {
    isOpenOverride: forceClosedData.data.isOpenOverride,
    name: forceClosedData.data.name,
  });
  assert.strictEqual(forceClosedData.data.isOpenOverride, false, "Expected isOpenOverride to be false");

  // Attempt placing an order while Force Closed
  const orderAttemptClosed = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      customerName: "Test Buyer",
      customerPhone: "+212 600 112233",
      orderType: "PICKUP",
      items: [{ productId: testProduct.id, quantity: 1 }],
    }),
  });
  const orderAttemptClosedData = await orderAttemptClosed.json();
  console.log(`🔒 Order placement while Force Closed: ${orderAttemptClosed.status}, Error: "${orderAttemptClosedData.error}"`);
  assert.strictEqual(orderAttemptClosed.status, 409, "Expected order to be rejected when Force Closed");

  // ==========================================
  // 4. TEST FORCE OPEN (isOpenOverride: true)
  // ==========================================
  console.log("\n--- 3. Testing FORCE OPEN (isOpenOverride: true) ---");
  const forceOpenRes = await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      ...baseSettings.data,
      isOpenOverride: true,
    }),
  });
  assert.strictEqual(forceOpenRes.status, 200);

  const getForceOpen = await fetch(`${baseUrl}/api/settings`);
  const forceOpenData = await getForceOpen.json();
  console.log("Settings after Force Open:", {
    isOpenOverride: forceOpenData.data.isOpenOverride,
  });
  assert.strictEqual(forceOpenData.data.isOpenOverride, true, "Expected isOpenOverride to be true");

  // Attempt placing an order while Force Open
  const orderAttemptOpen = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      customerName: "Test Buyer",
      customerPhone: "+212 600 112233",
      orderType: "PICKUP",
      items: [{ productId: testProduct.id, quantity: 1 }],
    }),
  });
  const orderAttemptOpenData = await orderAttemptOpen.json();
  console.log(`✅ Order placement while Force Open: ${orderAttemptOpen.status}, Order #: ${orderAttemptOpenData.data?.orderNumber}`);
  assert.strictEqual(orderAttemptOpen.status, 201, "Expected order to succeed when Force Open");

  // ==========================================
  // 5. TEST AUTO SCHEDULE (isOpenOverride: null)
  // ==========================================
  console.log("\n--- 4. Testing AUTO SCHEDULE (isOpenOverride: null) ---");
  const autoRes = await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      ...baseSettings.data,
      isOpenOverride: null,
    }),
  });
  assert.strictEqual(autoRes.status, 200);

  const getAuto = await fetch(`${baseUrl}/api/settings`);
  const autoData = await getAuto.json();
  console.log("Settings after Auto Schedule:", {
    isOpenOverride: autoData.data.isOpenOverride,
  });
  assert.strictEqual(autoData.data.isOpenOverride, null, "Expected isOpenOverride to be null");

  console.log("\n🎉 ALL PASSWORD, OVERRIDE, AND ORDER TESTS PASSED WITH 100% SUCCESS!");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
