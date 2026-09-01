import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const base = "http://localhost:3000";
const prisma = new PrismaClient();
const results = [];

function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log("PASS", name, detail ? `(${detail})` : "");
}

function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.error("FAIL", name, detail ? `(${detail})` : "");
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
  clone(newName) {
    const copy = new Jar(newName);
    for (const [k, v] of this.cookies.entries()) {
      copy.cookies.set(k, v);
    }
    return copy;
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
  const redirectMode = options.redirect || "manual";
  const res = await fetch(base + path, {
    method: options.method || "GET",
    headers,
    body,
    signal: options.signal,
    redirect: redirectMode,
  });
  options.jar?.store(res);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return {
    res,
    status: res.status,
    location: res.headers.get("location"),
    text,
    json,
    setCookie: options.jar?.lastSetCookie || [],
  };
}

function normalizeRegistrationCode(code) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashRegistrationCode(code) {
  return crypto.createHash("sha256").update(`registration:${normalizeRegistrationCode(code)}`).digest("hex");
}

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
    customerName: `Multi-POS Tester ${label}`,
    customerPhone: "+212661000000",
    customerAddress: null,
    orderType: "PICKUP",
    allergies: "multi-pos allergy test",
    notes: "multi-pos verification order",
    idempotencyKey: `multi-pos-${label}-${crypto.randomUUID()}`,
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
  assert(response.status === 200 && response.json?.success, `${jar.name} admin login`, `status ${response.status}`);
}

async function makeRegistrationCode(adminJar, name, replaceDeviceId = null) {
  const response = await req("/api/devices", { method: "POST", jar: adminJar, body: { name, type: "POS", replaceDeviceId } });
  assert(response.status === 201 && response.json?.data?.code, `Registration code generated for ${name}`, `expires ${response.json?.data?.expiresAt}`);
  assert(response.json?.data?.qrPayload === undefined, `QR payload is NOT included in API response for ${name}`);
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

async function main() {
  let originalSettings = null;
  try {
    const adminPassword = loadEnvValue("ADMIN_PASSWORD");
    assert(Boolean(adminPassword), "Admin password loaded from env");

    originalSettings = await prisma.restaurantSettings.findUnique({ where: { id: "default" } });
    await prisma.restaurantSettings.update({
      where: { id: "default" },
      data: { isOpenOverride: true },
    });

    // Clean any leftover test records
    await prisma.deviceRegistrationCode.deleteMany({});
    await prisma.device.deleteMany({});

    // 1. Customer storefront checks
    const homepage = await req("/");
    assert(homepage.status === 200, "Customer homepage loads");
    const categories = await req("/api/categories");
    assert(categories.status === 200 && categories.json?.success && categories.json.data.length > 0, "Customer categories load", `${categories.json?.data?.length} categories`);
    const productsResponse = await req("/api/products");
    assert(productsResponse.status === 200 && productsResponse.json?.success, "Customer products load");
    const pick = pickProduct(productsResponse.json.data);
    assert(Boolean(pick), "Existing orderable product selected", pick?.product?.name);

    const settings = await req("/api/settings");
    assert(settings.json?.data?.isOpenOverride === true || settings.status === 200, "Runtime settings available");

    // 2. Unregistered browser security checks
    const unregJar = new Jar("unregistered-browser");
    const unregAdmin = await req("/admin", { jar: unregJar });
    assert(unregAdmin.status === 307 && unregAdmin.location?.includes("/admin/login"), "Unregistered browser visiting /admin redirects to /admin/login");

    const unregProducts = await req("/admin/products", { jar: unregJar });
    assert(unregProducts.status === 307 && unregProducts.location?.includes("/admin/login"), "Unregistered browser visiting /admin/products redirects to /admin/login");

    const unregSettings = await req("/admin/settings", { jar: unregJar });
    assert(unregSettings.status === 307 && unregSettings.location?.includes("/admin/login"), "Unregistered browser visiting /admin/settings redirects to /admin/login");

    const unregDevices = await req("/admin/devices", { jar: unregJar });
    assert(unregDevices.status === 307 && unregDevices.location?.includes("/admin/login"), "Unregistered browser visiting /admin/devices redirects to /admin/login");

    const unregPos = await req("/admin/pos", { jar: unregJar });
    assert(unregPos.status === 200, "Unregistered browser visiting /admin/pos loads pairing screen (200 OK)");

    const unregPosOrders = await req("/api/pos/orders", { jar: unregJar });
    assert(unregPosOrders.status === 403, "Unregistered browser cannot access /api/pos/orders (403 Forbidden)");

    const unregPosEvents = await req("/api/pos/events", { jar: unregJar });
    assert(unregPosEvents.status === 403, "Unregistered browser cannot access /api/pos/events (403 Forbidden)");

    // 3. Admin Authentication & Device Management
    const adminJar = new Jar("admin-browser");
    await adminLogin(adminJar, adminPassword);
    const adminDevicesBefore = await req("/api/devices", { jar: adminJar });
    assert(adminDevicesBefore.status === 200 && Array.isArray(adminDevicesBefore.json?.data), "Authenticated admin can list devices");

    // 4. Pairing Security: Invalid, Expired, Single-use
    await registerDevice(new Jar("invalid-code-browser"), "NO-SUCH-CODE", false);
    const expiredCode = `EX-${crypto.randomUUID().slice(0, 4).toUpperCase()}-OLD`;
    await prisma.deviceRegistrationCode.create({
      data: {
        codeHash: hashRegistrationCode(expiredCode),
        deviceName: "Expired Test iPad",
        deviceType: "POS",
        restaurantId: "default",
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    await registerDevice(new Jar("expired-code-browser"), expiredCode, false);

    // 5. Create Invitation & Register POS-01 (Main Register)
    const invitation1 = await makeRegistrationCode(adminJar, "POS-01 Main Register");
    assert(new Date(invitation1.expiresAt).getTime() - Date.now() <= 10 * 60 * 1000 + 5000, "Registration code is configured for 10 minutes");

    const pos01Jar = new Jar("pos-01-browser");
    const pos01Device = await registerDevice(pos01Jar, invitation1.code, true);

    // Single-use check: Second device attempting to use invitation1 must fail
    await registerDevice(new Jar("reuse-code-browser"), invitation1.code, false);

    // Verify POS-01 recognized & credential hashed
    const pos01DeviceState = await req("/api/pos/device", { jar: pos01Jar });
    assert(pos01DeviceState.status === 200 && pos01DeviceState.json?.data?.device?.id === pos01Device.id, "POS-01 device recognized by /api/pos/device");
    assert(pos01DeviceState.json?.data?.isRegistered === true, "POS-01 device marked as registered");
    const pos01Db = await prisma.device.findUnique({ where: { id: pos01Device.id } });
    assert(Boolean(pos01Db?.credentialHash) && pos01Db.credentialHash.length === 64, "Device credential is stored as SHA-256 hash");

    // 6. POS Terminal Role Hardening Checks: POS-01 cannot access Admin Routes or APIs
    const pos01ToAdmin = await req("/admin", { jar: pos01Jar });
    assert(pos01ToAdmin.status === 307 && pos01ToAdmin.location?.includes("/admin/login"), "Registered POS-01 navigating to /admin is redirected to /admin/login");

    const pos01ToProducts = await req("/admin/products", { jar: pos01Jar });
    assert(pos01ToProducts.status === 307 && pos01ToProducts.location?.includes("/admin/login"), "Registered POS-01 navigating to /admin/products is redirected to /admin/login");

    const pos01ToSettings = await req("/admin/settings", { jar: pos01Jar });
    assert(pos01ToSettings.status === 307 && pos01ToSettings.location?.includes("/admin/login"), "Registered POS-01 navigating to /admin/settings is redirected to /admin/login");

    const pos01ToDevices = await req("/admin/devices", { jar: pos01Jar });
    assert(pos01ToDevices.status === 307 && pos01ToDevices.location?.includes("/admin/login"), "Registered POS-01 navigating to /admin/devices is redirected to /admin/login");

    const pos01ToLogin = await req("/admin/login", { jar: pos01Jar });
    assert(pos01ToLogin.status === 200, "Registered POS-01 navigating to /admin/login loads login view directly (200 OK)");

    const pos01CallAdminApi = await req("/api/devices", { jar: pos01Jar });
    assert(pos01CallAdminApi.status === 403 || pos01CallAdminApi.status === 401, "Registered POS-01 cannot call admin API /api/devices (401/403)");

    const pos01MutateSetting = await req("/api/settings", { method: "PUT", jar: pos01Jar, body: { restaurantName: "Hacked" } });
    assert(pos01MutateSetting.status === 401, "Registered POS-01 cannot mutate settings (401 Unauthorized)");

    // 7. POS Terminal Isolation: POS browser attempting admin login is blocked (403 Forbidden)
    const posAdminLoginAttempt = await req("/api/auth/login", {
      method: "POST",
      jar: pos01Jar,
      body: { password: adminPassword },
    });
    assert(posAdminLoginAttempt.status === 403, "Registered POS browser cannot elevate to Admin via POST /api/auth/login (403 Forbidden)");

    // 7. POS-01 can directly access POS orders WITHOUT staff login
    const pos01OrdersDirect = await req("/api/pos/orders", { jar: pos01Jar });
    assert(pos01OrdersDirect.status === 200, "Registered POS-01 accesses /api/pos/orders directly via device credential", `status: ${pos01OrdersDirect.status}, text: ${pos01OrdersDirect.text}`);

    // 8. Create Invitation & Register POS-02 (Secondary Register) - MULTI-POS CONCURRENCY
    const invitation2 = await makeRegistrationCode(adminJar, "POS-02 Secondary Register");
    const pos02Jar = new Jar("pos-02-browser");
    const pos02Device = await registerDevice(pos02Jar, invitation2.code, true);
    assert(pos02Device.id !== pos01Device.id, "POS-02 has independent unique device ID", pos02Device.publicId);

    const pos02OrdersDirect = await req("/api/pos/orders", { jar: pos02Jar });
    assert(pos02OrdersDirect.status === 200, "POS-02 accesses /api/pos/orders directly via its device credential");

    // 9. Real-Time Order Broadcast: Customer places order -> BOTH POS-01 and POS-02 receive event
    const ac1 = new AbortController();
    const ac2 = new AbortController();

    const sse1 = await fetch(base + "/api/pos/events", { headers: { Cookie: pos01Jar.header() }, signal: ac1.signal });
    const sse2 = await fetch(base + "/api/pos/events", { headers: { Cookie: pos02Jar.header() }, signal: ac2.signal });
    assert(sse1.status === 200, "POS-01 SSE connection active");
    assert(sse2.status === 200, "POS-02 SSE connection active");

    const reader1 = sse1.body.getReader();
    const reader2 = sse2.body.getReader();
    const decoder = new TextDecoder();

    let buf1 = "";
    let buf2 = "";
    let orderCreated = null;

    async function waitForEvent(reader, bufRef, targetType) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) throw new Error("SSE stream terminated");
        bufRef.val += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = bufRef.val.indexOf("\n\n")) >= 0) {
          const raw = bufRef.val.slice(0, boundary);
          bufRef.val = bufRef.val.slice(boundary + 2);
          const eventLine = raw.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
          const eventType = eventLine?.slice(6).trim();
          const data = dataLine ? JSON.parse(dataLine.slice(5).trim()) : null;
          if (eventType === targetType) return data;
        }
      }
    }

    const ref1 = { val: buf1 };
    const ref2 = { val: buf2 };

    await Promise.all([
      waitForEvent(reader1, ref1, "connected"),
      waitForEvent(reader2, ref2, "connected"),
    ]);

    orderCreated = await createCustomerOrder("multi-stream", pick, 2);

    const [data1, data2] = await Promise.all([
      waitForEvent(reader1, ref1, "order-created"),
      waitForEvent(reader2, ref2, "order-created"),
    ]);

    assert(data1?.order?.orderNumber === orderCreated.orderNumber, "POS-01 received real-time order-created event", data1?.order?.orderNumber);
    assert(data2?.order?.orderNumber === orderCreated.orderNumber, "POS-02 received real-time order-created event simultaneously", data2?.order?.orderNumber);

    // 10. POS-01 updates order to CONFIRMED -> POS-02 receives order-updated event
    const statusPromise1 = waitForEvent(reader1, ref1, "order-updated");
    const statusPromise2 = waitForEvent(reader2, ref2, "order-updated");

    const patchRes = await req(`/api/pos/orders/${orderCreated.id}`, {
      method: "PATCH",
      jar: pos01Jar,
      body: { status: "CONFIRMED" },
    });
    assert(patchRes.status === 200 && patchRes.json?.data?.status === "CONFIRMED", "POS-01 updated canonical order status to CONFIRMED");

    const [update1, update2] = await Promise.all([statusPromise1, statusPromise2]);
    assert(update1?.order?.status === "CONFIRMED", "POS-01 received updated status confirmation");
    assert(update2?.order?.status === "CONFIRMED", "POS-02 received status update from POS-01 in real time");

    ac1.abort();
    ac2.abort();

    // 11. Disable POS-01 -> POS-01 rejected with 403, POS-02 continues working normally
    const disableRes = await req(`/api/devices/${pos01Device.id}`, {
      method: "PATCH",
      jar: adminJar,
      body: { status: "DISABLED" },
    });
    assert(disableRes.status === 200 && disableRes.json?.data?.status === "DISABLED", "Admin disabled POS-01");

    const disabledAccess = await req("/api/pos/orders", { jar: pos01Jar });
    assert(disabledAccess.status === 403, "Disabled POS-01 is rejected with 403");

    const pos02ActiveAccess = await req("/api/pos/orders", { jar: pos02Jar });
    assert(pos02ActiveAccess.status === 200, "POS-02 continues working normally while POS-01 is disabled");

    // 12. Re-activate POS-01 -> POS-01 can access again without re-registering
    const activateRes = await req(`/api/devices/${pos01Device.id}`, {
      method: "PATCH",
      jar: adminJar,
      body: { status: "ACTIVE" },
    });
    assert(activateRes.status === 200 && activateRes.json?.data?.status === "ACTIVE", "Admin reactivated POS-01");

    const reactivatedAccess = await req("/api/pos/orders", { jar: pos01Jar });
    assert(reactivatedAccess.status === 200, "Reactivated POS-01 accesses orders successfully");

    // 13. Replace POS-02 with POS-03
    const replaceInvitation = await makeRegistrationCode(adminJar, "POS-03 Replacement iPad", pos02Device.id);
    const pos03Jar = new Jar("pos-03-browser");
    const pos03Device = await registerDevice(pos03Jar, replaceInvitation.code, true);

    const oldPos02Db = await prisma.device.findUnique({ where: { id: pos02Device.id } });
    assert(oldPos02Db?.status === "REVOKED", "Old POS-02 automatically marked REVOKED upon replacement");

    const pos02RevokedAccess = await req("/api/pos/orders", { jar: pos02Jar });
    assert(pos02RevokedAccess.status === 403, "Old POS-02 credential rejected with 403");

    const pos03Access = await req("/api/pos/orders", { jar: pos03Jar });
    assert(pos03Access.status === 200, "New POS-03 works and accesses POS API directly");

    // POS-01 is unaffected by POS-02 replacement
    const pos01StillActive = await req("/api/pos/orders", { jar: pos01Jar });
    assert(pos01StillActive.status === 200, "POS-01 remains active and unaffected by replacement of POS-02");

    // 14. Persistent POS Credential Simulation: Cookie survives page reload / restart simulation
    const restartSimJar = new Jar("pos-01-reopened");
    for (const [k, v] of pos01Jar.cookies.entries()) {
      restartSimJar.cookies.set(k, v);
    }
    const reopenedAccess = await req("/api/pos/orders", { jar: restartSimJar });
    assert(reopenedAccess.status === 200, "POS-01 credential persists across browser restarts and allows direct access");

    // 15. Clean up Test Devices (Admin DELETE)
    const del1 = await req(`/api/devices/${pos01Device.id}`, { method: "DELETE", jar: adminJar });
    assert(del1.status === 200, "Admin deleted POS-01 test device");
    const del2 = await req(`/api/devices/${pos02Device.id}`, { method: "DELETE", jar: adminJar });
    assert(del2.status === 200, "Admin deleted POS-02 test device");
    const del3 = await req(`/api/devices/${pos03Device.id}`, { method: "DELETE", jar: adminJar });
    assert(del3.status === 200, "Admin deleted POS-03 test device");

    // 16. Architectural & Cleanliness Checks
    assert(!fs.existsSync("src/lib/qr.ts"), "Deprecated src/lib/qr.ts has been removed");
    const devicesPageSrc = fs.readFileSync("src/app/admin/devices/page.tsx", "utf8");
    assert(!devicesPageSrc.includes("generateQRSvg") && !devicesPageSrc.includes("qrSvgMarkup"), "Devices page contains no QR SVG generation");
    const posPageSrc = fs.readFileSync("src/app/admin/pos/page.tsx", "utf8");
    assert(!posPageSrc.includes("BarcodeDetector") && !posPageSrc.includes("startQrScanner") && !posPageSrc.includes("getUserMedia"), "POS page contains no camera or QR scanning logic");
    const posHeaderSrc = fs.readFileSync("src/components/pos/PosHeader.tsx", "utf8");
    assert(!posHeaderSrc.includes("/admin\"") && !posHeaderSrc.includes("Admin Portal"), "PosHeader contains no Admin Portal link");
    const posSidebarSrc = fs.readFileSync("src/components/pos/PosSidebarHeader.tsx", "utf8");
    assert(!posSidebarSrc.includes("/admin\"") && !posSidebarSrc.includes("Admin Portal"), "PosSidebarHeader contains no Admin Portal link");

    console.log(`\n========================================`);
    console.log(`SUMMARY: ALL ${results.filter((r) => r.ok).length} POS ISOLATION, SECURITY & MULTI-POS CHECKS PASSED!`);
    console.log(`========================================\n`);
  } finally {
    if (originalSettings) {
      await prisma.restaurantSettings.update({
        where: { id: "default" },
        data: { isOpenOverride: originalSettings.isOpenOverride },
      }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

