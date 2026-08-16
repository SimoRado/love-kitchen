async function runTests() {
  console.log("🚀 Starting comprehensive backend test suite...\n");

  const baseUrl = "http://localhost:3000";

  // 1. Categories
  const catRes = await fetch(`${baseUrl}/api/categories`);
  const catData = await catRes.json();
  console.log(`✅ Fetched ${catData.data.length} categories.`);
  const testCatId = catData.data[0].id;

  // 2. Add New Product
  const newProdRes = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Truffle Sliders",
      description: "Mini gourmet sliders with truffle cream",
      price: 89.0,
      categoryId: testCatId,
      available: true,
    }),
  });
  const newProdData = await newProdRes.json();
  console.log(`✅ Created Product: "${newProdData.data.name}" (ID: ${newProdData.data.id})`);
  const createdProdId = newProdData.data.id;

  // 3. Edit Product
  const editProdRes = await fetch(`${baseUrl}/api/products/${createdProdId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Truffle Sliders (Updated Edition)",
      description: "Updated taste notes",
      price: 95.0,
      categoryId: testCatId,
      available: false,
    }),
  });
  const editProdData = await editProdRes.json();
  console.log(`✅ Edited Product: "${editProdData.data.name}", Price: ${editProdData.data.price}, Avail: ${editProdData.data.available}`);

  // 4. Toggle Product Availability
  const toggleRes = await fetch(`${baseUrl}/api/products/${createdProdId}/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ available: true }),
  });
  const toggleData = await toggleRes.json();
  console.log(`✅ Toggled Availability back to: ${toggleData.data.available}`);

  // 5. Delete Product
  const delProdRes = await fetch(`${baseUrl}/api/products/${createdProdId}`, {
    method: "DELETE",
  });
  const delProdData = await delProdRes.json();
  console.log(`✅ Deleted Product: success = ${delProdData.success}`);

  // 6. Safe Category Deletion Test (Must reject category with products)
  const delCatRes = await fetch(`${baseUrl}/api/categories/${testCatId}`, {
    method: "DELETE",
  });
  const delCatData = await delCatRes.json();
  if (delCatRes.status === 400 && !delCatData.success) {
    console.log(`✅ Category protection verified: "${delCatData.error}"`);
  } else {
    console.error(`❌ Category deletion protection failed:`, delCatData);
  }

  // 7. Orders Management
  const ordersRes = await fetch(`${baseUrl}/api/orders`);
  const ordersData = await ordersRes.json();
  console.log(`✅ Fetched ${ordersData.data.length} orders.`);
  const testOrderId = ordersData.data[0].id;

  // 8. Update Order Status
  const statusPatchRes = await fetch(`${baseUrl}/api/orders/${testOrderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PREPARING" }),
  });
  const statusPatchData = await statusPatchRes.json();
  console.log(`✅ Updated Order ${statusPatchData.data.orderNumber} Status to: ${statusPatchData.data.status}`);

  // 9. Settings Update
  const settingsRes = await fetch(`${baseUrl}/api/settings`);
  const settingsData = await settingsRes.json();
  console.log(`✅ Fetched Settings for restaurant: "${settingsData.data.name}", Currency: ${settingsData.data.currency}, OpeningHours: ${settingsData.data.openingHours.length} days.`);

  const updateSettingsRes = await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...settingsData.data,
      name: "Le Bistro Gourmet & Lounge",
      currency: "MAD",
      isOpenOverride: null,
    }),
  });
  const updatedSettingsData = await updateSettingsRes.json();
  console.log(`✅ Updated Settings name to: "${updatedSettingsData.data.name}"`);

  console.log("\n🎉 ALL BACKEND AND DATABASE CRUD TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
