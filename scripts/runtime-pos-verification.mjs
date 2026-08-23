import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const base = "http://localhost:3000";
const prisma = new PrismaClient();
const results = [];

function pass(name, detail = "") { results.push({ ok: true, name, detail }); console.log("PASS", name, detail); }
function fail(name, detail = "") { results.push({ ok: false, name, detail }); console.error("FAIL", name, detail); throw new Error(`${name}: ${detail}`); }
function assert(condition, name, detail = "") { if (!condition) fail(name, detail); pass(name, detail); }

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
  constructor(name) { this.name = name; this.cookies = new Map(); this.lastSetCookie = []; }
  store(res) {
    const values = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
    this.lastSetCookie = values;
    for (const header of values) {
      const first = header.split(";")[0];
      const eq = first.indexOf("=");
      if (eq > 0) this.cookies.set(first.slice(0, eq), first.slice(eq + 1));
    }
  }
  header() { return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; "); }
}

async function req(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.jar?.header()) headers.Cookie = options.jar.header();
  let body = options.body;
  if (body !== undefined && typeof body !== "string") {
    body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(base + path, { method: options.method || "GET", headers, body, signal: options.signal });
  options.jar?.store(res);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { res, status: res.status, text, json, setCookie: options.jar?.lastSetCookie || [] };
}

function normalizeRegistrationCode(code) { return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function hashRegistrationCode(code) { return crypto.createHash("sha256").update(`registration:${normalizeRegistrationCode(code)}`).digest("hex"); }
function pickProduct(products) {
  for (const product of products) {
    if (!product.available) continue;
    const selected = [];
    let unit = Number(product.price);
    let possible = true;
    for (const group of product.modifierGroups || []) {
      if (!group.active) continue;
      const activeOptions = (group.options || []).filter((option) => option.active);
      const minimum = group.required ? Math.max(1, group.minSelections || 0) : group.minSelections || 0;
      if (activeOptions.length < minimum) { possible = false; break; }
      for (const option of activeOptions.slice(0, minimum)) {
        selected.push(option.id);
        unit += Number(option.priceDelta || 0);
      }
    }
    if (possible) return { product, selected, unit: Math.round(unit * 100) / 100 };
  }
  return null;
}

async function createCustomerOrder(label, productPick, quantity = 2) {
  const payload = {
    customerName: `Runtime Tester ${label}`,
    customerPhone: "+212661000000",
    customerAddress: null,
    orderType: "PICKUP",
    allergies: "runtime allergy check",
    notes: "runtime verification order",
    idempotencyKey: `runtime-${label}-${crypto.randomUUID()}`,
    total: 1,
    productName: "tampered client product",
    items: [{ productId: productPick.product.id, quantity, selectedModifierOptionIds: productPick.selected }],
  };
  const response = await req("/api/orders", { method: "POST", body: payload });
  assert(response.status === 201 && response.json?.success, `Customer order created (${label})`, response.text.slice(0, 120));
  return response.json.data;
}

async function adminLogin(jar, password) {
  const response = await req("/api/auth/login", { method: "POST", jar, body: { password } });
  assert(response.status === 200 && response.json?.success, `${jar.name} admin/staff login`, `status ${response.status}`);
}

async function makeRegistrationCode(adminJar, name, replaceDeviceId = null) {
  const response = await req("/api/devices", { method: "POST", jar: adminJar, body: { name, type: "POS", replaceDeviceId } });
  assert(response.status === 201 && response.json?.data?.code, `Registration code generated for ${name}`, `expires ${response.json?.data?.expiresAt}`);
  return response.json.data;
}

async function registerDevice(jar, code, expectedOk = true) {
  const response = await req("/api/pos/register", { method: "POST", jar, body: { code } });
  if (expectedOk) {
    assert(response.status === 200 && response.json?.data?.device?.status === "ACTIVE", `${jar.name} registered POS device`, `device ${response.json?.data?.device?.publicId}`);
    assert(response.setCookie.some((value) => /resto_pos_device=.*HttpOnly/i.test(value)), `${jar.name} received HTTP-only device credential`);
    return response.json.data.device;
  }
  assert(response.status >= 400, `${jar.name} registration rejected`, `status ${response.status}`);
  return null;
}

async function runSseRealtimeTest(posJar, productPick) {
  const ac = new AbortController();
  const sseResponse = await fetch(base + "/api/pos/events", { headers: { Cookie: posJar.header() }, signal: ac.signal });
  assert(sseResponse.status === 200, "Registered POS SSE connection opens", `status ${sseResponse.status}`);
  const reader = sseResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let connected = false;
  let targetOrder = null;

  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for SSE order-created")), 10000));
  const eventWait = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) throw new Error("SSE stream ended before event");
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = raw.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
        const dataLine = raw.split("\n").find((line) => line.startsWith("data:"));
        const data = dataLine ? JSON.parse(dataLine.slice(5).trim()) : null;
        if (event === "connected") connected = true;
        if (connected && !targetOrder) targetOrder = await createCustomerOrder("sse", productPick, 1);
        if (event === "order-created" && data?.order?.orderNumber === targetOrder?.orderNumber) return targetOrder;
      }
    }
  })();

  try {
    const order = await Promise.race([eventWait, timeout]);
    pass("Real-time POS received new order without refresh", order.orderNumber);
    return order;
  } finally {
    ac.abort();
  }
}

try {
  const adminPassword = loadEnvValue("ADMIN_PASSWORD");
  assert(Boolean(adminPassword), "Admin password loaded from env");

  const homepage = await req("/");
  assert(homepage.status === 200, "Customer homepage loads");
  const categories = await req("/api/categories");
  assert(categories.status === 200 && categories.json?.success && categories.json.data.length > 0, "Customer categories load", `${categories.json?.data?.length} categories`);
  const productsResponse = await req("/api/products");
  assert(productsResponse.status === 200 && productsResponse.json?.success, "Customer products load");
  const pick = pickProduct(productsResponse.json.data);
  assert(Boolean(pick), "Existing orderable product selected", pick?.product?.name);

  const settings = await req("/api/settings");
  assert(settings.json?.data?.isOpenOverride === true || settings.status === 200, "Runtime settings available", `delivery fee ${settings.json?.data?.deliveryFee}`);

  const adminJar = new Jar("admin-browser");
  await adminLogin(adminJar, adminPassword);
  const adminDevicesBefore = await req("/api/devices", { jar: adminJar });
  assert(adminDevicesBefore.status === 200 && Array.isArray(adminDevicesBefore.json?.data), "Authenticated admin can list devices");

  await registerDevice(new Jar("invalid-code-browser"), "NO-SUCH-CODE", false);
  const expiredCode = `EX-${crypto.randomUUID().slice(0, 4).toUpperCase()}-OLD`;
  await prisma.deviceRegistrationCode.create({ data: { codeHash: hashRegistrationCode(expiredCode), deviceName: "Expired Test iPad", deviceType: "POS", restaurantId: "default", expiresAt: new Date(Date.now() - 60_000) } });
  await registerDevice(new Jar("expired-code-browser"), expiredCode, false);

  const firstCode = await makeRegistrationCode(adminJar, "Runtime Main iPad");
  assert(new Date(firstCode.expiresAt).getTime() - Date.now() <= 10 * 60 * 1000 + 5000, "Registration code is configured for about 10 minutes");
  const oldPosJar = new Jar("old-pos-browser");
  const oldDevice = await registerDevice(oldPosJar, firstCode.code, true);
  await registerDevice(new Jar("reuse-code-browser"), firstCode.code, false);

  const oldDeviceState = await req("/api/pos/device", { jar: oldPosJar });
  assert(oldDeviceState.status === 200 && oldDeviceState.json?.data?.device?.id === oldDevice.id, "Registered POS device is recognized by /api/pos/device");
  const oldDbDevice = await prisma.device.findUnique({ where: { id: oldDevice.id } });
  const deviceCookie = oldPosJar.cookies.get("resto_pos_device") || "";
  assert(Boolean(oldDbDevice?.credentialHash) && oldDbDevice.credentialHash.length === 64, "Device credential is stored as SHA-256 hash");
  assert(!deviceCookie.includes(oldDbDevice.credentialHash), "Raw device credential is not the stored hash");
  const adminDevicesPayload = await req("/api/devices", { jar: adminJar });
  assert(!JSON.stringify(adminDevicesPayload.json).includes("credentialHash"), "Device secrets are not returned by admin device API");

  const unregisteredDeviceState = await req("/api/pos/device", { jar: new Jar("unregistered-device-state-browser") });
  assert(unregisteredDeviceState.status === 200 && unregisteredDeviceState.json?.data?.device === null, "Unregistered browser can only see empty POS device state");
  const unregisteredOrders = await req("/api/pos/orders", { jar: new Jar("unregistered-browser") });
  assert(unregisteredOrders.status === 403, "Unregistered browser cannot read POS orders", `status ${unregisteredOrders.status}`);
  const unauthenticatedRegisteredOrders = await req("/api/pos/orders", { jar: oldPosJar });
  assert(unauthenticatedRegisteredOrders.status === 401, "Registered device without staff login cannot read POS orders", `status ${unauthenticatedRegisteredOrders.status}`);
  const deviceOnlyAdmin = await req("/api/devices", { jar: oldPosJar });
  assert(deviceOnlyAdmin.status === 403, "Registered device alone cannot manage devices", `status ${deviceOnlyAdmin.status}`);

  await adminLogin(oldPosJar, adminPassword);
  const order = await createCustomerOrder("initial", pick, 2);
  const expectedSubtotal = Math.round(pick.unit * 2 * 100) / 100;
  assert(order.subtotal === expectedSubtotal && order.total === expectedSubtotal, "Server ignored tampered client total and calculated pickup total", `expected ${expectedSubtotal}, got ${order.total}`);
  const storedOrder = await prisma.order.findUnique({ where: { id: order.id }, include: { items: { include: { modifiers: true } } } });
  assert(Boolean(storedOrder) && storedOrder.total === expectedSubtotal, "Order stored correctly in database", storedOrder?.orderNumber);

  const posOrders = await req("/api/pos/orders", { jar: oldPosJar });
  assert(posOrders.status === 200 && posOrders.json.data.some((item) => item.id === order.id), "Registered and signed-in POS can retrieve existing orders");
  const unregisteredPatch = await req(`/api/pos/orders/${order.id}`, { method: "PATCH", jar: new Jar("unregistered-patch-browser"), body: { status: "PREPARING" } });
  assert(unregisteredPatch.status === 403, "Unregistered browser cannot mutate POS order status", `status ${unregisteredPatch.status}`);

  const realtimeOrder = await runSseRealtimeTest(oldPosJar, pick);
  const invalidStatus = await req(`/api/pos/orders/${realtimeOrder.id}`, { method: "PATCH", jar: oldPosJar, body: { status: "NOT_REAL" } });
  assert(invalidStatus.status === 400, "Invalid POS status is rejected");
  for (const status of ["CONFIRMED", "PREPARING", "READY", "COMPLETED"]) {
    const update = await req(`/api/pos/orders/${realtimeOrder.id}`, { method: "PATCH", jar: oldPosJar, body: { status } });
    assert(update.status === 200 && update.json?.data?.status === status, `POS updates order to ${status}`);
    const fromDb = await prisma.order.findUnique({ where: { id: realtimeOrder.id } });
    assert(fromDb?.status === status, `Database persisted ${status}`);
  }

  const revoke = await req(`/api/devices/${oldDevice.id}`, { method: "PATCH", jar: adminJar, body: { status: "REVOKED" } });
  assert(revoke.status === 200 && revoke.json?.data?.status === "REVOKED", "Admin revoked registered POS device");
  const revokedAccess = await req("/api/pos/orders", { jar: oldPosJar });
  assert(revokedAccess.status === 403, "Revoked device credential can no longer call POS API", `status ${revokedAccess.status}`);

  const replaceOldCode = await makeRegistrationCode(adminJar, "Runtime Replace Old iPad");
  const replaceOldJar = new Jar("replace-old-browser");
  const replaceOldDevice = await registerDevice(replaceOldJar, replaceOldCode.code, true);
  await adminLogin(replaceOldJar, adminPassword);
  const beforeReplaceAccess = await req("/api/pos/orders", { jar: replaceOldJar });
  assert(beforeReplaceAccess.status === 200, "Device to be replaced works before replacement");

  const replacementCode = await makeRegistrationCode(adminJar, "Runtime Replacement iPad", replaceOldDevice.id);
  const replacementJar = new Jar("replacement-browser");
  const replacementDevice = await registerDevice(replacementJar, replacementCode.code, true);
  const oldAfterReplace = await prisma.device.findUnique({ where: { id: replaceOldDevice.id } });
  const newAfterReplace = await prisma.device.findUnique({ where: { id: replacementDevice.id } });
  assert(oldAfterReplace?.status === "REVOKED", "Replacement flow revoked old device");
  assert(newAfterReplace?.status === "ACTIVE", "Replacement flow activated new device");
  await adminLogin(replacementJar, adminPassword);
  const replacementAccess = await req("/api/pos/orders", { jar: replacementJar });
  assert(replacementAccess.status === 200, "Replacement device can access POS after staff login");
  const replacedOldAccess = await req("/api/pos/orders", { jar: replaceOldJar });
  assert(replacedOldAccess.status === 403, "Old replaced device can no longer access POS");

  const orderSource = fs.readFileSync("src/app/api/orders/route.ts", "utf8");
  assert(orderSource.includes("calculateOrderTotals") && !orderSource.includes("input.total"), "Order API does not trust client total");
  for (const file of ["src/app/api/pos/orders/route.ts", "src/app/api/pos/orders/[id]/route.ts", "src/app/api/pos/events/route.ts"]) {
    assert(fs.readFileSync(file, "utf8").includes("requirePosAccess"), `${file} enforces server-side POS authorization`);
  }
  assert(fs.readFileSync("src/app/api/pos/register/route.ts", "utf8").includes("hashRegistrationCode"), "Registration route hashes and validates codes server-side");
  assert(fs.readFileSync("src/lib/printingService.ts", "utf8").includes("printOrder"), "Printing abstraction remains a placeholder");
  assert(fs.readFileSync("src/lib/paymentService.ts", "utf8").includes("PaymentState"), "Payment abstraction exposes future payment states");
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  assert(schema.includes("model Device") && schema.includes("credentialHash") && schema.includes("model DeviceRegistrationCode") && schema.includes("expiresAt") && schema.includes("@@index([expiresAt])"), "Prisma schema includes device models, hashed credential field, expiry, and indexes");

  console.log(`SUMMARY ${results.filter((r) => r.ok).length} checks passed`);
} finally {
  await prisma.$disconnect();
}
