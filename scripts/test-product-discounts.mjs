import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function roundMoney(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function hasActiveDiscount(discountPercent) {
  if (discountPercent === null || discountPercent === undefined) return false;
  const pct = Number(discountPercent);
  return Number.isFinite(pct) && pct > 0 && pct <= 100;
}

function getEffectiveProductPrice(price, discountPercent) {
  const basePrice = roundMoney(price);
  if (!hasActiveDiscount(discountPercent)) return basePrice;
  const pct = Math.floor(Number(discountPercent));
  if (pct >= 100) return 0;
  return roundMoney(basePrice * (1 - pct / 100));
}

function calculateDiscountSavings(price, discountPercent) {
  const basePrice = roundMoney(price);
  const effectivePrice = getEffectiveProductPrice(price, discountPercent);
  return roundMoney(Math.max(0, basePrice - effectivePrice));
}

function calculateItemTotal(unitPrice, quantity) {
  const qty = Math.max(1, Math.floor(quantity) || 1);
  return roundMoney(roundMoney(unitPrice) * qty);
}

function calculateConfiguredPrice(basePrice, selectedModifiers = []) {
  const modifierDeltaSum = selectedModifiers.reduce((acc, m) => acc + (Number(m.priceDelta) || 0), 0);
  return roundMoney(basePrice + modifierDeltaSum);
}

async function runTests() {
  console.log('========================================================');
  console.log('   LOVE KITCHEN — PRODUCT DISCOUNT FEATURE TEST SUITE   ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. PURE PRICING & MONEY LOGIC
  console.log('--- 1. PURE PRICING & MONEY LOGIC ---');
  assert(getEffectiveProductPrice(100, null) === 100, 'null discount returns original price (100 -> 100)');
  assert(getEffectiveProductPrice(100, undefined) === 100, 'undefined discount returns original price (100 -> 100)');
  assert(getEffectiveProductPrice(100, 0) === 100, '0% discount returns original price (100 -> 100)');
  assert(hasActiveDiscount(0) === false, 'hasActiveDiscount(0) is false');
  assert(hasActiveDiscount(null) === false, 'hasActiveDiscount(null) is false');
  assert(hasActiveDiscount(undefined) === false, 'hasActiveDiscount(undefined) is false');

  assert(getEffectiveProductPrice(100, 10) === 90, '10% discount on 100 DH -> 90 DH');
  assert(calculateDiscountSavings(100, 10) === 10, '10% savings on 100 DH -> 10 DH');

  assert(getEffectiveProductPrice(100, 15) === 85, '15% discount on 100 DH -> 85 DH');
  assert(calculateDiscountSavings(100, 15) === 15, '15% savings on 100 DH -> 15 DH');

  assert(getEffectiveProductPrice(100, 25) === 75, '25% discount on 100 DH -> 75 DH');
  assert(calculateDiscountSavings(100, 25) === 25, '25% savings on 100 DH -> 25 DH');

  assert(getEffectiveProductPrice(100, 50) === 50, '50% discount on 100 DH -> 50 DH');
  assert(getEffectiveProductPrice(100, 99) === 1, '99% discount on 100 DH -> 1 DH');
  assert(getEffectiveProductPrice(100, 100) === 0, '100% discount on 100 DH -> 0 DH');
  assert(calculateDiscountSavings(100, 100) === 100, '100% savings on 100 DH -> 100 DH');

  // Decimal price rounding safety
  const decimalPrice = 99.99;
  const decimalDiscounted = getEffectiveProductPrice(decimalPrice, 15);
  assert(decimalDiscounted === 84.99, '99.99 DH @ 15% discount -> 84.99 DH');
  assert(calculateDiscountSavings(decimalPrice, 15) === 15.00, '99.99 DH @ 15% savings -> 15.00 DH');

  // Invalid values
  assert(hasActiveDiscount(-5) === false, 'Negative discount (-5) is not active');
  assert(getEffectiveProductPrice(100, -5) === 100, 'Negative discount returns original price');
  assert(hasActiveDiscount(150) === false, '>100 discount (150) is not active');
  assert(hasActiveDiscount(NaN) === false, 'NaN discount is not active');

  // 2. CART QUANTITY & MODIFIERS MATH
  console.log('\n--- 2. CART QUANTITY & MODIFIER MATH ---');
  const basePrice85 = getEffectiveProductPrice(100, 15); // 85 DH
  assert(calculateItemTotal(basePrice85, 1) === 85, 'Cart Qty 1 @ 85 DH -> 85 DH');
  assert(calculateItemTotal(basePrice85, 2) === 170, 'Cart Qty 2 @ 85 DH -> 170 DH');
  assert(calculateItemTotal(basePrice85, 3) === 255, 'Cart Qty 3 @ 85 DH -> 255 DH');

  const modifiers = [
    { name: 'Extra Cheese', priceDelta: 8 },
    { name: 'Special Sauce', priceDelta: 4 }
  ];
  const configuredPrice = calculateConfiguredPrice(basePrice85, modifiers);
  assert(configuredPrice === 97, 'Discounted base (85 DH) + modifiers (12 DH) = 97 DH unit price');
  assert(calculateItemTotal(configuredPrice, 2) === 194, 'Configured item Qty 2 @ 97 DH -> 194 DH');

  // 3. DATABASE SCHEMA & EXISTING PRODUCTS INTEGRITY
  console.log('\n--- 3. DATABASE SCHEMA & EXISTING DATA INTEGRITY ---');
  const existingProducts = await prisma.product.findMany({ take: 5 });
  assert(existingProducts.length > 0, 'Database contains products to inspect');

  for (const prod of existingProducts) {
    assert(typeof prod.price === 'number' && prod.price > 0, `Product "${prod.name}" retains positive original price (${prod.price} DH)`);
    assert(prod.discountPercent === 0 || prod.discountPercent === null, `Existing product "${prod.name}" default discountPercent is 0 or null (${prod.discountPercent})`);
    assert(getEffectiveProductPrice(prod.price, prod.discountPercent) === prod.price, `Effective price matches original price for "${prod.name}"`);
  }

  // 4. PRODUCT DISCOUNT CRUD & PERSISTENCE
  console.log('\n--- 4. PRODUCT DISCOUNT CRUD & PERSISTENCE ---');
  const category = await prisma.category.findFirst();
  if (!category) throw new Error('No category found in database for test');

  const testProduct = await prisma.product.create({
    data: {
      name: 'Test Discount Burger',
      price: 120,
      discountPercent: 15,
      categoryId: category.id,
      available: true,
      prepTimeMinutes: 10
    }
  });

  assert(testProduct.id !== undefined, 'Test product created with id');
  assert(testProduct.price === 120, 'Test product original price is 120 DH');
  assert(testProduct.discountPercent === 15, 'Test product discountPercent is 15%');
  assert(getEffectiveProductPrice(testProduct.price, testProduct.discountPercent) === 102, 'Effective price is 102 DH (120 - 15%)');

  const updatedProduct = await prisma.product.update({
    where: { id: testProduct.id },
    data: { discountPercent: 25 }
  });
  assert(updatedProduct.discountPercent === 25, 'Updated discountPercent to 25%');
  assert(getEffectiveProductPrice(updatedProduct.price, updatedProduct.discountPercent) === 90, 'Effective price updated to 90 DH (120 - 25%)');
  assert(updatedProduct.price === 120, 'Original price remains strictly unchanged at 120 DH');

  const clearedProduct = await prisma.product.update({
    where: { id: testProduct.id },
    data: { discountPercent: 0 }
  });
  assert(clearedProduct.discountPercent === 0, 'Discount removed (set to 0)');
  assert(getEffectiveProductPrice(clearedProduct.price, clearedProduct.discountPercent) === 120, 'Effective price returns to original price 120 DH');

  // 5. SERVER-SIDE ORDER PRICE AUTHORITY & HISTORICAL SNAPSHOT
  console.log('\n--- 5. ORDER PRICE AUTHORITY & HISTORICAL SNAPSHOT ---');
  await prisma.product.update({
    where: { id: testProduct.id },
    data: { discountPercent: 20 }
  });

  const effectivePrice = getEffectiveProductPrice(120, 20); // 96 DH
  const orderNumber = 'TEST-DISC-' + Date.now();

  const testOrder = await prisma.order.create({
    data: {
      orderNumber,
      customerName: 'Discount Tester',
      customerPhone: '+212600000000',
      orderType: 'PICKUP',
      status: 'PENDING',
      subtotal: effectivePrice * 2,
      deliveryFee: 0,
      total: effectivePrice * 2,
      items: {
        create: [
          {
            product: { connect: { id: testProduct.id } },
            productName: testProduct.name,
            price: effectivePrice,
            configuredUnitPrice: effectivePrice,
            quantity: 2
          }
        ]
      }
    },
    include: { items: true }
  });

  assert(testOrder.subtotal === 192, 'Authoritative order subtotal is 192 DH');
  assert(testOrder.items[0].price === 96, 'OrderItem.price snapshot stores effective base price 96 DH');
  assert(testOrder.items[0].configuredUnitPrice === 96, 'OrderItem.configuredUnitPrice stores 96 DH');

  await prisma.product.update({
    where: { id: testProduct.id },
    data: { discountPercent: 0 }
  });

  const fetchedOrder = await prisma.order.findUnique({
    where: { id: testOrder.id },
    include: { items: true }
  });

  assert(fetchedOrder.items[0].price === 96, 'Historical OrderItem.price remains snapshot 96 DH after discount removal');
  assert(fetchedOrder.subtotal === 192, 'Historical order subtotal remains unchanged at 192 DH');

  // CLEANUP
  console.log('\n--- CLEANUP ---');
  await prisma.orderItem.deleteMany({ where: { orderId: testOrder.id } });
  await prisma.order.delete({ where: { id: testOrder.id } });
  await prisma.product.delete({ where: { id: testProduct.id } });
  console.log('  Cleaned up test orders and test products.');

  await prisma.$disconnect();

  console.log('\n========================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  prisma.$disconnect();
  process.exit(1);
});
