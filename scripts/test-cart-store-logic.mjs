import assert from "node:assert";

// Test Cart Line Identity & Merging Logic
function generateCartItemId(productId, selectedModifiers = []) {
  const sortedOptionIds = selectedModifiers
    .map((m) => m.optionId)
    .sort()
    .join("_");
  return sortedOptionIds ? `${productId}_${sortedOptionIds}` : productId;
}

function calculateConfiguredPrice(basePrice, selectedModifiers = []) {
  const modifierDeltaSum = selectedModifiers.reduce(
    (acc, m) => acc + (Number(m.priceDelta) || 0),
    0
  );
  return Math.round((basePrice + modifierDeltaSum) * 100) / 100;
}

console.log("🧪 Testing Cart Store Configuration Identity & Merging Logic...\n");

// Product: French Tacos (45 MAD)
const product = { id: "prod_tacos", name: "French Tacos", price: 45, available: true };

// Config A: Algerian (0) + Chicken (10) -> Unit Price: 55 MAD
const configA = [
  { groupId: "g1", groupName: "Sauces", optionId: "opt_algerian", optionName: "Algerian", priceDelta: 0 },
  { groupId: "g2", groupName: "Extras", optionId: "opt_chicken", optionName: "Chicken", priceDelta: 10 },
];
const idA = generateCartItemId(product.id, configA);
const priceA = calculateConfiguredPrice(product.price, configA);
assert.strictEqual(idA, "prod_tacos_opt_algerian_opt_chicken");
assert.strictEqual(priceA, 55);
console.log("✅ Config A Identity:", idA, "Unit Price:", priceA);

// Config B: Biggy (0) + Nuggets (8) -> Unit Price: 53 MAD
const configB = [
  { groupId: "g1", groupName: "Sauces", optionId: "opt_biggy", optionName: "Biggy", priceDelta: 0 },
  { groupId: "g2", groupName: "Extras", optionId: "opt_nuggets", optionName: "Nuggets", priceDelta: 8 },
];
const idB = generateCartItemId(product.id, configB);
const priceB = calculateConfiguredPrice(product.price, configB);
assert.strictEqual(idB, "prod_tacos_opt_biggy_opt_nuggets");
assert.strictEqual(priceB, 53);
console.log("✅ Config B Identity:", idB, "Unit Price:", priceB);

// Ensure different configurations create distinct items
assert.notStrictEqual(idA, idB, "Distinct configurations must have distinct IDs");
console.log("✅ Verified: Config A and Config B produce distinct cart line keys");

// Test Line Merging Simulation
let cartItems = [
  { id: idA, product, quantity: 2, selectedModifiers: configA, configuredUnitPrice: priceA },
  { id: idB, product, quantity: 1, selectedModifiers: configB, configuredUnitPrice: priceB },
];
assert.strictEqual(cartItems.length, 2);

// User edits Line B to have the exact same selections as Line A
const newConfigForB = [...configA];
const targetNewId = generateCartItemId(product.id, newConfigForB);
const targetNewPrice = calculateConfiguredPrice(product.price, newConfigForB);
const editQuantity = 3; // user also changed quantity to 3

const existingTargetIndex = cartItems.findIndex((it) => it.id === targetNewId && it.id !== idB);
assert.ok(existingTargetIndex > -1, "Should find matching existing target line");

const merged = cartItems
  .filter((it) => it.id !== idB)
  .map((it) =>
    it.id === targetNewId
      ? {
          ...it,
          quantity: it.quantity + editQuantity, // 2 + 3 = 5
          configuredUnitPrice: targetNewPrice,
          selectedModifiers: newConfigForB,
        }
      : it
  );

assert.strictEqual(merged.length, 1, "Duplicate lines must be merged into 1 line");
assert.strictEqual(merged[0].id, idA);
assert.strictEqual(merged[0].quantity, 5, "Quantities must be summed: 2 + 3 = 5");
assert.strictEqual(merged[0].configuredUnitPrice, 55);
console.log("✅ Verified: Editing line B into line A configuration cleanly merges quantities to 5 without duplicates");

console.log("\n🎉 ALL CART IDENTITY AND MERGING LOGIC TESTS PASSED!\n");
