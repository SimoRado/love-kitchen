import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const base = "http://localhost:3000";
const prisma = new PrismaClient();
const results = [];

function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log("PASS:", name, detail ? `(${detail})` : "");
}

function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.error("FAIL:", name, detail ? `(${detail})` : "");
  throw new Error(`${name}: ${detail}`);
}

function assert(condition, name, detail = "") {
  if (!condition) fail(name, detail);
  pass(name, detail);
}

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

class Jar {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
    this.lastSetCookie = [];
  }
  store(res) {
    const values = typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
    this.lastSetCookie = values;
    for (const header of values) {
      const first = header.split(";")[0];
      const eq = first.indexOf("=");
      if (eq > 0) this.cookies.set(first.slice(0, eq), first.slice(eq + 1));
    }
  }
  header() {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function req(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.jar?.header()) headers.Cookie = options.jar.header();
  let body = options.body;
  if (body !== undefined && typeof body !== "string") {
    body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(base + path, {
    method: options.method || "GET",
    headers,
    body,
    signal: options.signal,
  });
  options.jar?.store(res);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { res, status: res.status, text, json, setCookie: options.jar?.lastSetCookie || [] };
}

async function adminLogin(jar, password) {
  const response = await req("/api/auth/login", { method: "POST", jar, body: { password } });
  assert(response.status === 200 && response.json?.success, `${jar.name} admin/staff login`);
}

async function makeRegistrationCode(adminJar, name) {
  const response = await req("/api/devices", { method: "POST", jar: adminJar, body: { name, type: "POS" } });
  assert(response.status === 201 && response.json?.data?.code, `Registration code generated for ${name}`);
  return response.json.data;
}

async function registerDevice(jar, code) {
  const response = await req("/api/pos/register", { method: "POST", jar, body: { code } });
  assert(response.status === 200 && response.json?.data?.device?.status === "ACTIVE", `${jar.name} registered POS device`);
  return response.json.data.device;
}

async function main() {
  try {
    const adminPassword = loadEnvValue("ADMIN_PASSWORD");
    assert(Boolean(adminPassword), "Admin password loaded");

    // 1. Fetch available products with modifiers
    const productsRes = await req("/api/products");
    assert(productsRes.status === 200 && productsRes.json?.success, "Products fetched");
    const products = productsRes.json.data;

    const simpleProduct = products.find((p) => p.available && (!p.modifierGroups || p.modifierGroups.length === 0));
    const customizableProduct = products.find((p) => p.available && p.modifierGroups && p.modifierGroups.some((g) => g.active && g.options.some((o) => o.active)));

    assert(Boolean(simpleProduct), "Found simple menu item without modifiers", simpleProduct?.name);
    assert(Boolean(customizableProduct), "Found customizable menu item with modifiers", customizableProduct?.name);

    // 2. Setup POS device & session
    const adminJar = new Jar("admin");
    await adminLogin(adminJar, adminPassword);

    const codeData = await makeRegistrationCode(adminJar, "Verification iPad Terminal");
    const posJar = new Jar("pos-terminal");
    await registerDevice(posJar, codeData.code);
    await adminLogin(posJar, adminPassword);

    // 3. Test POS Manual Order Creation (POST /api/pos/orders) - Simple Item
    const simpleOrderPayload = {
      customerName: "Walk-in Table 4",
      customerPhone: "0612345678",
      orderType: "PICKUP",
      notes: "Please pack for takeaway",
      items: [
        { productId: simpleProduct.id, quantity: 3, selectedModifierOptionIds: [] },
      ],
      initialStatus: "CONFIRMED",
    };

    const simpleOrderRes = await req("/api/pos/orders", {
      method: "POST",
      jar: posJar,
      body: simpleOrderPayload,
    });

    assert(simpleOrderRes.status === 201 && simpleOrderRes.json?.success, "POS created manual order (simple item)", simpleOrderRes.json?.data?.orderNumber);
    const createdSimpleOrder = simpleOrderRes.json.data;
    const expectedSimpleTotal = Math.round(Number(simpleProduct.price) * 3 * 100) / 100;
    assert(createdSimpleOrder.total === expectedSimpleTotal, "POS manual order total computed accurately", `expected ${expectedSimpleTotal}, got ${createdSimpleOrder.total}`);
    assert(createdSimpleOrder.status === "CONFIRMED", "POS manual order initial status is CONFIRMED");

    // 4. Test POS Manual Order Creation - Customizable Item with modifiers
    const selectedOptionIds = [];
    let expectedUnitWithMod = Number(customizableProduct.price);
    for (const group of customizableProduct.modifierGroups || []) {
      if (!group.active) continue;
      const activeOptions = (group.options || []).filter((o) => o.active);
      const min = group.required ? Math.max(1, group.minSelections || 0) : group.minSelections || 0;
      for (const opt of activeOptions.slice(0, min)) {
        selectedOptionIds.push(opt.id);
        expectedUnitWithMod += Number(opt.priceDelta || 0);
      }
    }
    expectedUnitWithMod = Math.round(expectedUnitWithMod * 100) / 100;
    const expectedModTotal = Math.round(expectedUnitWithMod * 2 * 100) / 100;

    const modOrderPayload = {
      customerName: "VIP Customer",
      customerPhone: "0699887766",
      orderType: "PICKUP",
      allergies: "No nuts",
      notes: "Extra napkins",
      items: [
        {
          productId: customizableProduct.id,
          quantity: 2,
          selectedModifierOptionIds: selectedOptionIds,
        },
      ],
      initialStatus: "CONFIRMED",
    };

    const modOrderRes = await req("/api/pos/orders", {
      method: "POST",
      jar: posJar,
      body: modOrderPayload,
    });

    assert(modOrderRes.status === 201 && modOrderRes.json?.success, "POS created manual order with customizations", modOrderRes.json?.data?.orderNumber);
    const createdModOrder = modOrderRes.json.data;
    assert(createdModOrder.total === expectedModTotal, "POS customizable item total accurately calculated server-side", `expected ${expectedModTotal}, got ${createdModOrder.total}`);
    assert(createdModOrder.items[0].modifiers.length === 1, "Modifier recorded on order item", createdModOrder.items[0].modifiers[0].modifierOptionName);

    // 5. Test POS Order Lifecycle Transitions: CONFIRMED -> PREPARING -> READY -> COMPLETED
    const prepRes = await req(`/api/pos/orders/${createdModOrder.id}`, {
      method: "PATCH",
      jar: posJar,
      body: { status: "PREPARING" },
    });
    assert(prepRes.status === 200 && prepRes.json?.data?.status === "PREPARING", "Order moved to PREPARING");

    const readyRes = await req(`/api/pos/orders/${createdModOrder.id}`, {
      method: "PATCH",
      jar: posJar,
      body: { status: "READY" },
    });
    assert(readyRes.status === 200 && readyRes.json?.data?.status === "READY", "Order moved to READY");

    const completeRes = await req(`/api/pos/orders/${createdModOrder.id}`, {
      method: "PATCH",
      jar: posJar,
      body: { status: "COMPLETED" },
    });
    assert(completeRes.status === 200 && completeRes.json?.data?.status === "COMPLETED", "Order moved to COMPLETED");

    // 6. Test POS Scope Filter: Active vs History
    const activeOrdersRes = await req("/api/pos/orders", { jar: posJar });
    assert(activeOrdersRes.status === 200, "Active POS orders retrieved");
    const activeList = activeOrdersRes.json.data;
    assert(!activeList.some((o) => o.id === createdModOrder.id), "Completed order is NOT in active queue");

    const historyOrdersRes = await req("/api/pos/orders?scope=history", { jar: posJar });
    assert(historyOrdersRes.status === 200, "History POS orders retrieved");
    const historyList = historyOrdersRes.json.data;
    assert(historyList.some((o) => o.id === createdModOrder.id), "Completed order is present in History view");

    const allOrdersRes = await req("/api/pos/orders?scope=all", { jar: posJar });
    assert(allOrdersRes.status === 200 && allOrdersRes.json?.data.length >= historyList.length, "All scope returns both active and history tickets");

    // 7. Test Rejection / Cancellation on simple order
    const cancelRes = await req(`/api/pos/orders/${createdSimpleOrder.id}`, {
      method: "PATCH",
      jar: posJar,
      body: { status: "CANCELLED" },
    });
    assert(cancelRes.status === 200 && cancelRes.json?.data?.status === "CANCELLED", "Order rejected / cancelled");

    console.log(`\n========================================`);
    console.log(`ALL ${results.length} POS MANUAL & LIFECYCLE CHECKS PASSED!`);
    console.log(`========================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
