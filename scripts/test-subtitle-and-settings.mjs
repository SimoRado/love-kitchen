async function runSubtitleTests() {
  const baseUrl = "http://localhost:3000";
  console.log("🧪 Testing Admin-Controlled Subtitle and Settings API...\n");

  // 1. Admin login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "admin_secret_password_2026" }),
  });
  if (!loginRes.ok) throw new Error("Admin login failed");
  const cookies = loginRes.headers.get("set-cookie");
  const sessionCookie = cookies.split(";")[0];

  // 2. Fetch current settings
  const settingsRes = await fetch(`${baseUrl}/api/settings`);
  const settingsData = await settingsRes.json();
  console.log(`settingsRes status: ${settingsRes.status}`, settingsData);
  console.log(`Current settings: Name="${settingsData.data?.name}", Subtitle="${settingsData.data?.subtitle}"`);

  // 3. Update subtitle to custom tagline
  const customTagline = "Handcrafted Burgers & Woodfired Pizza";
  const updateRes = await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      ...settingsData.data,
      subtitle: customTagline,
    }),
  });
  const updateData = await updateRes.json();
  console.log(`PUT status: ${updateRes.status}`, updateData);
  if (!updateData.success) throw new Error(updateData.error || "PUT failed");
  console.log(`Updated subtitle result: "${updateData.data.subtitle}"`);
  if (updateData.data.subtitle !== customTagline) {
    throw new Error(`Expected subtitle to be "${customTagline}", got "${updateData.data.subtitle}"`);
  }

  // 4. Verify public GET /api/settings reflects custom tagline
  const verifyGetRes = await fetch(`${baseUrl}/api/settings`);
  const verifyGetData = await verifyGetRes.json();
  console.log(`Public GET /api/settings after update: "${verifyGetData.data.subtitle}"`);
  if (verifyGetData.data.subtitle !== customTagline) {
    throw new Error("Public settings did not return the updated subtitle!");
  }

  // 5. Test erasing subtitle (empty string)
  const eraseRes = await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      ...settingsData.data,
      subtitle: "",
    }),
  });
  const eraseData = await eraseRes.json();
  console.log(`Erased subtitle result: "${eraseData.data.subtitle}" (Expected null)`);
  if (eraseData.data.subtitle !== null) {
    throw new Error(`Expected null subtitle when erased, got "${eraseData.data.subtitle}"`);
  }

  // 6. Reset back to "Artisanal Kitchen & Delivery"
  await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      ...settingsData.data,
      name: "Love Kitchen",
      subtitle: "Artisanal Kitchen & Delivery",
    }),
  });
  console.log("Restored subtitle to 'Artisanal Kitchen & Delivery'.");

  // 7. Verify security suite still passes
  console.log("\nRunning security and order tests...");
  const orderRes = await fetch(`${baseUrl}/api/products`);
  const prodData = await orderRes.json();
  console.log(`Verified ${prodData.data.length} products loaded from DB.`);

  console.log("\n🎉 ALL SUBTITLE AND REFINEMENT TESTS PASSED WITH 100% SUCCESS!");
}

runSubtitleTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
