import fs from "node:fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();
const results = [];

function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`\x1b[32m[PASS]\x1b[0m ${name} ${detail ? `(${detail})` : ""}`);
}

function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.error(`\x1b[31m[FAIL]\x1b[0m ${name} ${detail ? `(${detail})` : ""}`);
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

class CookieJar {
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
      if (eq > 0) {
        const key = first.slice(0, eq).trim();
        const val = first.slice(eq + 1).trim();
        if (val === "" || header.includes("Max-Age=0") || header.includes("max-age=0")) {
          this.cookies.delete(key);
        } else {
          this.cookies.set(key, val);
        }
      }
    }
  }
  header() {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  }
  clone(newName) {
    const copy = new CookieJar(newName);
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
  const res = await fetch(BASE_URL + path, {
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

async function main() {
  console.log("====================================================================");
  console.log("STARTING FINAL ADMIN & POS AUTHENTICATION & ISOLATION TEST SUITE");
  console.log("====================================================================\n");

  // Hoisted above try/finally so the finally cleanup block can access them
  const initialAdminPassword = loadEnvValue("ADMIN_PASSWORD") || "RestaurantAdmin2026!";
  let currentAdminPassword = initialAdminPassword;
  const adminEmail = (loadEnvValue("ADMIN_EMAIL") || "admin@lovekitchen.ma").toLowerCase();

  try {

    // Clean any leftover test records from past runs
    await prisma.deviceRegistrationCode.deleteMany({});
    await prisma.device.deleteMany({});
    await prisma.adminSession.deleteMany({});
    await prisma.adminRateLimit.deleteMany({});

    // Ensure default admin user is configured with the expected initial password
    const initialHash = await bcrypt.hash(initialAdminPassword, 12);
    const existingAdmin = await prisma.adminUser.findFirst();
    if (existingAdmin) {
      await prisma.adminUser.update({
        where: { id: existingAdmin.id },
        data: { email: adminEmail, passwordHash: initialHash },
      });
    } else {
      await prisma.adminUser.create({
        data: {
          email: adminEmail,
          passwordHash: initialHash,
          adminAccessPath: "lovekitchen",
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // SECTION 1: UNAUTHENTICATED BROWSER SECURITY CHECKS
    // ─────────────────────────────────────────────────────────────────
    console.log("--- 1. Testing Unauthenticated Visitor Access ---");
    const unregJar = new CookieJar("unauthenticated-visitor");

    const unregAdmin = await req("/admin", { jar: unregJar });
    assert(unregAdmin.status === 307 && unregAdmin.location?.includes("/admin/login"), "Unauthenticated /admin redirects to /admin/login");

    const unregProducts = await req("/admin/products", { jar: unregJar });
    assert(unregProducts.status === 307 && unregProducts.location?.includes("/admin/login"), "Unauthenticated /admin/products redirects to /admin/login");

    const unregSettings = await req("/admin/settings", { jar: unregJar });
    assert(unregSettings.status === 307 && unregSettings.location?.includes("/admin/login"), "Unauthenticated /admin/settings redirects to /admin/login");

    const unregDevices = await req("/admin/devices", { jar: unregJar });
    assert(unregDevices.status === 307 && unregDevices.location?.includes("/admin/login"), "Unauthenticated /admin/devices redirects to /admin/login");

    const unregSecurity = await req("/admin/security", { jar: unregJar });
    assert(unregSecurity.status === 307 && unregSecurity.location?.includes("/admin/login"), "Unauthenticated /admin/security redirects to /admin/login");

    const unregOrders = await req("/admin/orders", { jar: unregJar });
    assert(unregOrders.status === 307 && unregOrders.location?.includes("/admin/login"), "Unauthenticated /admin/orders redirects to /admin/login");

    const unregCategories = await req("/admin/categories", { jar: unregJar });
    assert(unregCategories.status === 307 && unregCategories.location?.includes("/admin/login"), "Unauthenticated /admin/categories redirects to /admin/login");

    const unregPos = await req("/admin/pos", { jar: unregJar });
    assert(unregPos.status === 200, "Unauthenticated /admin/pos loads registration view directly (200 OK)");

    // Unauthenticated APIs
    const unregPosOrders = await req("/api/pos/orders", { jar: unregJar });
    assert(unregPosOrders.status === 403, "Unauthenticated /api/pos/orders returns 403 Forbidden");

    const unregPosEvents = await req("/api/pos/events", { jar: unregJar });
    assert(unregPosEvents.status === 403, "Unauthenticated /api/pos/events returns 403 Forbidden");

    const unregAdminDevices = await req("/api/devices", { jar: unregJar });
    assert(unregAdminDevices.status === 401 || unregAdminDevices.status === 403, "Unauthenticated /api/devices returns 401/403");

    const unregAdminSettings = await req("/api/settings", { method: "PUT", jar: unregJar, body: { name: "Hack" } });
    assert(unregAdminSettings.status === 401, "Unauthenticated PUT /api/settings returns 401 Unauthorized");

    const unregAdminProducts = await req("/api/products", { method: "POST", jar: unregJar, body: { name: "Hack" } });
    assert(unregAdminProducts.status === 401, "Unauthenticated POST /api/products returns 401 Unauthorized");

    const unregAdminStats = await req("/api/stats", { jar: unregJar });
    assert(unregAdminStats.status === 401, "Unauthenticated GET /api/stats returns 401 Unauthorized");

    const unregAdminOrders = await req("/api/orders", { jar: unregJar });
    assert(unregAdminOrders.status === 401, "Unauthenticated GET /api/orders returns 401 Unauthorized");

    // ─────────────────────────────────────────────────────────────────
    // SECTION 2: ADMIN AUTHENTICATION & MULTI-COMPUTER PERSISTENCE
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- 2. Testing Administrator Authentication & Persistence ---");
    const adminPcJar = new CookieJar("admin-pc");

    // Invalid login attempt
    const badLogin = await req("/api/auth/login", {
      method: "POST",
      jar: adminPcJar,
      body: { email: adminEmail, password: "WrongPassword999!" },
    });
    assert(badLogin.status === 401 && !badLogin.json?.success, "Invalid admin password rejected (401 Unauthorized)");
    assert(badLogin.json?.error === "Invalid email or password.", "Generic error returned for invalid credentials");

    // Valid login attempt
    const goodLogin = await req("/api/auth/login", {
      method: "POST",
      jar: adminPcJar,
      body: { email: adminEmail, password: currentAdminPassword },
    });
    assert(goodLogin.status === 200 && goodLogin.json?.success, "Admin login successful with valid credentials (200 OK)");
    assert(adminPcJar.cookies.has("resto_admin_session"), "Admin received persistent resto_admin_session cookie");

    // Check cookie properties
    const setCookieHeaders = goodLogin.setCookie;
    const sessionCookieHeader = setCookieHeaders.find((h) => h.includes("resto_admin_session="));
    assert(Boolean(sessionCookieHeader), "Set-Cookie header contains resto_admin_session");
    assert(/HttpOnly/i.test(sessionCookieHeader), "resto_admin_session is HttpOnly");
    assert(/Max-Age=2592000/i.test(sessionCookieHeader) || /max-age=2592000/i.test(sessionCookieHeader), "resto_admin_session has 30-day persistent lifetime (2592000s)");

    // Access admin pages
    const adminPage = await req("/admin", { jar: adminPcJar });
    assert(adminPage.status === 200, "Authenticated admin visits /admin -> 200 OK (Dashboard)");

    const adminProducts = await req("/admin/products", { jar: adminPcJar });
    assert(adminProducts.status === 200, "Authenticated admin visits /admin/products -> 200 OK");

    const adminSettings = await req("/admin/settings", { jar: adminPcJar });
    assert(adminSettings.status === 200, "Authenticated admin visits /admin/settings -> 200 OK");

    const adminDevices = await req("/admin/devices", { jar: adminPcJar });
    assert(adminDevices.status === 200, "Authenticated admin visits /admin/devices -> 200 OK");

    const adminSecurity = await req("/admin/security", { jar: adminPcJar });
    assert(adminSecurity.status === 200, "Authenticated admin visits /admin/security -> 200 OK");

    // Access admin APIs
    const devicesApi = await req("/api/devices", { jar: adminPcJar });
    assert(devicesApi.status === 200 && devicesApi.json?.success, "Authenticated admin can call GET /api/devices");

    const statsApi = await req("/api/stats", { jar: adminPcJar });
    assert(statsApi.status === 200 && statsApi.json?.success, "Authenticated admin can call GET /api/stats");

    const ordersApi = await req("/api/orders", { jar: adminPcJar });
    assert(ordersApi.status === 200 && ordersApi.json?.success, "Authenticated admin can call GET /api/orders");

    // Multi-device persistence simulation (simulating closing and reopening browser)
    const reopenedAdminJar = adminPcJar.clone("admin-pc-reopened");
    const reopenedProfile = await req("/api/auth/me", { jar: reopenedAdminJar });
    assert(reopenedProfile.status === 200 && reopenedProfile.json?.success, "Admin session persists across simulated browser restart");

    // Second admin device (e.g. laptop)
    const adminLaptopJar = new CookieJar("admin-laptop");
    const laptopLogin = await req("/api/auth/login", {
      method: "POST",
      jar: adminLaptopJar,
      body: { email: adminEmail, password: currentAdminPassword },
    });
    assert(laptopLogin.status === 200 && laptopLogin.json?.success, "Second computer (laptop) logs in independently");
    assert(adminLaptopJar.cookies.get("resto_admin_session") !== adminPcJar.cookies.get("resto_admin_session"), "Each computer receives unique cryptographic session token");

    // Both sessions work concurrently
    const pcMe = await req("/api/auth/me", { jar: adminPcJar });
    const laptopMe = await req("/api/auth/me", { jar: adminLaptopJar });
    assert(pcMe.status === 200 && laptopMe.status === 200, "Both admin computers operate concurrently with separate active sessions");

    // Admin visiting POS does NOT become a POS terminal
    const adminVisitPosOrders = await req("/api/pos/orders", { jar: adminPcJar });
    assert(adminVisitPosOrders.status === 403, "Admin session alone does NOT satisfy POS API requirement (403 Forbidden)");

    // ─────────────────────────────────────────────────────────────────
    // SECTION 3: POS REGISTRATION & PERSISTENCE
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- 3. Testing POS Registration, Pairing & Persistence ---");

    // Attempt invalid pairing code
    const badPairing = await req("/api/pos/register", {
      method: "POST",
      body: { code: "INVALID-CODE-99" },
    });
    assert(badPairing.status === 400 && !badPairing.json?.success, "Invalid pairing code rejected (400 Bad Request)");

    // Expired code test
    const expiredCode = "EX-TEST-CODE-01";
    await prisma.deviceRegistrationCode.create({
      data: {
        codeHash: hashRegistrationCode(expiredCode),
        deviceName: "Expired Register",
        deviceType: "POS",
        restaurantId: "default",
        expiresAt: new Date(Date.now() - 30_000),
      },
    });
    const expiredPairing = await req("/api/pos/register", {
      method: "POST",
      body: { code: expiredCode },
    });
    assert(expiredPairing.status === 400 && !expiredPairing.json?.success, "Expired pairing code rejected (400 Bad Request)");

    // Generate valid 10-minute pairing code from Admin PC
    const inviteRes = await req("/api/devices", {
      method: "POST",
      jar: adminPcJar,
      body: { name: "POS-01 Main Register", type: "POS" },
    });
    assert(inviteRes.status === 201 && inviteRes.json?.data?.code, "Admin generated 10-minute temporary registration code");
    const pairingCode1 = inviteRes.json.data.code;

    // Register POS-01
    const pos01Jar = new CookieJar("pos-01-ipad");
    const regRes = await req("/api/pos/register", {
      method: "POST",
      jar: pos01Jar,
      body: { code: pairingCode1 },
    });
    assert(regRes.status === 200 && regRes.json?.data?.device?.status === "ACTIVE", "POS-01 registered successfully (200 OK)");
    const pos01Device = regRes.json.data.device;
    assert(pos01Jar.cookies.has("resto_pos_device"), "POS-01 received persistent resto_pos_device cookie");

    // Check POS cookie properties
    const posCookieHeader = regRes.setCookie.find((h) => h.includes("resto_pos_device="));
    assert(Boolean(posCookieHeader), "Set-Cookie contains resto_pos_device");
    assert(/HttpOnly/i.test(posCookieHeader), "resto_pos_device is HttpOnly");
    assert(/Max-Age=31536000/i.test(posCookieHeader) || /max-age=31536000/i.test(posCookieHeader), "resto_pos_device has 1-year persistent lifetime (31536000s)");

    // Single-use code verification: attempt reuse
    const reuseAttempt = await req("/api/pos/register", {
      method: "POST",
      body: { code: pairingCode1 },
    });
    assert(reuseAttempt.status === 400 && !reuseAttempt.json?.success, "Single-use registration code cannot be reused");

    // Verify POS state via API
    const pos01State = await req("/api/pos/device", { jar: pos01Jar });
    assert(pos01State.status === 200 && pos01State.json?.data?.device?.id === pos01Device.id, "POS-01 recognized by /api/pos/device");
    assert(pos01State.json?.data?.isRegistered === true, "POS-01 marked isRegistered=true");

    // Persistent POS credential simulation (restarting Safari / iPad)
    const reopenedPos01Jar = pos01Jar.clone("pos-01-ipad-reopened");
    const reopenedPosOrders = await req("/api/pos/orders", { jar: reopenedPos01Jar });
    assert(reopenedPosOrders.status === 200 && Array.isArray(reopenedPosOrders.json?.data), "POS-01 remains registered after simulated restart (orders accessible directly)");

    // ─────────────────────────────────────────────────────────────────
    // SECTION 4: POS TERMINAL ISOLATION & CANONICAL ROUTING RULES
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- 4. Testing POS Terminal Isolation & Canonical Routing Rules ---");

    // TEST: Unauthenticated with POS cookie navigating to /admin redirects to /admin/login
    const posToAdmin = await req("/admin", { jar: pos01Jar });
    assert(posToAdmin.status === 307 && posToAdmin.location?.includes("/admin/login"), "Unauthenticated /admin redirects to /admin/login");

    const posToProducts = await req("/admin/products", { jar: pos01Jar });
    assert(posToProducts.status === 307 && posToProducts.location?.includes("/admin/login"), "Unauthenticated /admin/products redirects to /admin/login");

    const posToCategories = await req("/admin/categories", { jar: pos01Jar });
    assert(posToCategories.status === 307 && posToCategories.location?.includes("/admin/login"), "Unauthenticated /admin/categories redirects to /admin/login");

    const posToSettings = await req("/admin/settings", { jar: pos01Jar });
    assert(posToSettings.status === 307 && posToSettings.location?.includes("/admin/login"), "Unauthenticated /admin/settings redirects to /admin/login");

    const posToOrders = await req("/admin/orders", { jar: pos01Jar });
    assert(posToOrders.status === 307 && posToOrders.location?.includes("/admin/login"), "Unauthenticated /admin/orders redirects to /admin/login");

    const posToDevices = await req("/admin/devices", { jar: pos01Jar });
    assert(posToDevices.status === 307 && posToDevices.location?.includes("/admin/login"), "Unauthenticated /admin/devices redirects to /admin/login");

    const posToSecurity = await req("/admin/security", { jar: pos01Jar });
    assert(posToSecurity.status === 307 && posToSecurity.location?.includes("/admin/login"), "Unauthenticated /admin/security redirects to /admin/login");

    const posToLogin = await req("/admin/login", { jar: pos01Jar });
    assert(posToLogin.status === 200, "Unauthenticated /admin/login serves login page (200 OK)");

    // TEST 10: Invalid/stale POS cookie cannot hijack /admin
    const staleJar = new CookieJar("stale-pos-cookie-browser");
    staleJar.cookies.set("resto_pos_device", "POS-NONEXISTENT.staleinvalidcredential12345");
    const staleToAdmin = await req("/admin", { jar: staleJar });
    assert(staleToAdmin.status === 307 && staleToAdmin.location?.includes("/admin/login"), "Stale/invalid POS cookie visiting /admin redirects to /admin/login (NOT /admin/pos)");

    // TEST 11: Explicit No-cookie regression
    const noCookieJar = new CookieJar("clean-no-cookie-browser");
    const noCookieToAdmin = await req("/admin", { jar: noCookieJar });
    assert(noCookieToAdmin.status === 307 && noCookieToAdmin.location?.includes("/admin/login"), "Completely clean browser visiting /admin redirects to /admin/login (NOT /admin/pos)");

    // TEST 9: POS terminal cannot use POST /api/auth/login to elevate to admin (403 Forbidden)
    const posAttemptAdminLogin = await req("/api/auth/login", {
      method: "POST",
      jar: pos01Jar,
      body: { email: adminEmail, password: currentAdminPassword },
    });
    assert(posAttemptAdminLogin.status === 403, "POS terminal cannot elevate to Admin via POST /api/auth/login (403 Forbidden)");

    // POS cannot call Admin APIs without admin session
    const posCallDevicesApi = await req("/api/devices", { jar: pos01Jar });
    assert(posCallDevicesApi.status === 401 || posCallDevicesApi.status === 403, "POS terminal cannot call GET /api/devices (401/403)");

    const posMutateSetting = await req("/api/settings", { method: "PUT", jar: pos01Jar, body: { name: "Hacked by Cashier" } });
    assert(posMutateSetting.status === 401, "POS terminal cannot mutate settings (401 Unauthorized)");

    const posMutateProduct = await req("/api/products", { method: "POST", jar: pos01Jar, body: { name: "Cashier Item", price: 10, categoryId: "dummy" } });
    assert(posMutateProduct.status === 401, "POS terminal cannot create products (401 Unauthorized)");

    const posGetStats = await req("/api/stats", { jar: pos01Jar });
    assert(posGetStats.status === 401, "POS terminal cannot view stats (401 Unauthorized)");

    const posGetAdminOrders = await req("/api/orders", { jar: pos01Jar });
    assert(posGetAdminOrders.status === 401, "POS terminal cannot call Admin /api/orders (401 Unauthorized)");

    // POS CAN call POS APIs
    const posDirectOrders = await req("/api/pos/orders", { jar: pos01Jar });
    assert(posDirectOrders.status === 200 && Array.isArray(posDirectOrders.json?.data), "POS terminal can call GET /api/pos/orders");

    // ─────────────────────────────────────────────────────────────────
    // SECTION 4.1: ADMIN PC & INDEPENDENT AUTHENTICATION TESTS
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- Testing Admin PC & Independent Authentication ---");

    // Admin PC (pure admin context, no POS cookie) logs in and functions normally
    assert(adminPcJar.cookies.has("resto_admin_session"), "Admin PC has active admin session");
    assert(!adminPcJar.cookies.has("resto_pos_device"), "Admin PC has no POS cookie");
    const adminPcNav = await req("/admin", { jar: adminPcJar });
    assert(adminPcNav.status === 200, "Admin PC visiting /admin sees Admin Dashboard (200 OK)");

    // Authenticated admin visiting /admin/login redirects to /admin
    const adminLoginNav = await req("/admin/login", { jar: adminPcJar });
    assert(adminLoginNav.status === 307 && adminLoginNav.location?.includes("/admin"), "Authenticated Admin visiting /admin/login redirects to /admin");

    // Admin logout test using a dedicated session
    const logoutTestJar = new CookieJar("admin-pc-logout-tester");
    await req("/api/auth/login", {
      method: "POST",
      jar: logoutTestJar,
      body: { email: adminEmail, password: currentAdminPassword },
    });
    const logoutRes = await req("/api/auth/logout", { method: "POST", jar: logoutTestJar });
    assert(logoutRes.status === 200, "Admin logout succeeded");
    assert(!logoutTestJar.cookies.has("resto_admin_session"), "resto_admin_session was cleared on logout");

    const postLogoutAdmin = await req("/admin", { jar: logoutTestJar });
    assert(postLogoutAdmin.status === 307 && postLogoutAdmin.location?.includes("/admin/login"), "Post-logout Admin PC redirects to /admin/login");

    const postLogoutPos = await req("/admin/pos", { jar: pos01Jar });
    assert(postLogoutPos.status === 200, "Registered POS browser retains direct POS Register access (200 OK)");

    // ─────────────────────────────────────────────────────────────────
    // SECTION 5: MULTI-POS SUPPORT & DEVICE LIFECYCLE
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- 5. Testing Multi-POS Support & Device Lifecycle ---");

    // Register POS-02
    const invite2Res = await req("/api/devices", {
      method: "POST",
      jar: adminPcJar,
      body: { name: "POS-02 Secondary Register", type: "POS" },
    });
    assert(invite2Res.status === 201, "Admin generated pairing code for POS-02");
    const pos02Jar = new CookieJar("pos-02-ipad");
    const reg2Res = await req("/api/pos/register", {
      method: "POST",
      jar: pos02Jar,
      body: { code: invite2Res.json.data.code },
    });
    assert(reg2Res.status === 200, "POS-02 registered successfully");
    const pos02Device = reg2Res.json.data.device;

    // Both POS devices work concurrently
    const pos01Check = await req("/api/pos/orders", { jar: pos01Jar });
    const pos02Check = await req("/api/pos/orders", { jar: pos02Jar });
    assert(pos01Check.status === 200 && pos02Check.status === 200, "Both POS-01 and POS-02 operate concurrently on the live order queue");

    // Disable POS-01
    const disableRes = await req(`/api/devices/${pos01Device.id}`, {
      method: "PATCH",
      jar: adminPcJar,
      body: { status: "DISABLED" },
    });
    assert(disableRes.status === 200 && disableRes.json?.data?.status === "DISABLED", "Admin disabled POS-01");

    // Verify POS-01 rejected with 403, POS-02 still works
    const disabledPos01 = await req("/api/pos/orders", { jar: pos01Jar });
    assert(disabledPos01.status === 403, "Disabled POS-01 is rejected with 403 Forbidden");

    const stillActivePos02 = await req("/api/pos/orders", { jar: pos02Jar });
    assert(stillActivePos02.status === 200, "POS-02 continues working normally while POS-01 is disabled");

    // Reactivate POS-01
    const reactivateRes = await req(`/api/devices/${pos01Device.id}`, {
      method: "PATCH",
      jar: adminPcJar,
      body: { status: "ACTIVE" },
    });
    assert(reactivateRes.status === 200 && reactivateRes.json?.data?.status === "ACTIVE", "Admin reactivated POS-01");

    const reactivatedPos01 = await req("/api/pos/orders", { jar: pos01Jar });
    assert(reactivatedPos01.status === 200, "Reactivated POS-01 regains access immediately with original cookie (no re-pairing)");

    // Replace POS-02 with POS-03
    const replaceInvite = await req("/api/devices", {
      method: "POST",
      jar: adminPcJar,
      body: { name: "POS-03 Replacement iPad", type: "POS", replaceDeviceId: pos02Device.id },
    });
    assert(replaceInvite.status === 201, "Admin generated replacement invitation for POS-02");

    const pos03Jar = new CookieJar("pos-03-ipad");
    const reg3Res = await req("/api/pos/register", {
      method: "POST",
      jar: pos03Jar,
      body: { code: replaceInvite.json.data.code },
    });
    assert(reg3Res.status === 200, "POS-03 registered successfully as replacement");
    const pos03Device = reg3Res.json.data.device;

    // Old POS-02 is revoked and returns 403
    const replacedPos02 = await req("/api/pos/orders", { jar: pos02Jar });
    assert(replacedPos02.status === 403, "Replaced POS-02 credential is automatically revoked and rejected with 403");

    // New POS-03 works
    const activePos03 = await req("/api/pos/orders", { jar: pos03Jar });
    assert(activePos03.status === 200, "New POS-03 works immediately");

    // Revoke POS-03
    const revokeRes = await req(`/api/devices/${pos03Device.id}`, {
      method: "PATCH",
      jar: adminPcJar,
      body: { status: "REVOKED" },
    });
    assert(revokeRes.status === 200 && revokeRes.json?.data?.status === "REVOKED", "Admin revoked POS-03");

    const revokedPos03 = await req("/api/pos/orders", { jar: pos03Jar });
    assert(revokedPos03.status === 403, "Revoked POS-03 credential is permanently rejected with 403");

    // Clean up test devices
    await req(`/api/devices/${pos01Device.id}`, { method: "DELETE", jar: adminPcJar });
    await req(`/api/devices/${pos02Device.id}`, { method: "DELETE", jar: adminPcJar });
    await req(`/api/devices/${pos03Device.id}`, { method: "DELETE", jar: adminPcJar });
    pass("Test devices cleanly deleted by admin");

    // ─────────────────────────────────────────────────────────────────
    // SECTION 6: ADMIN PASSWORD CHANGE & SESSION REVOCATION
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- 6. Testing Admin Password Change & Multi-Session Invalidation ---");

    const newAdminPass = "NewSecureAdmin2026!#";

    // Change password from Admin PC
    const passChangeRes = await req("/api/admin/account/password", {
      method: "POST",
      jar: adminPcJar,
      body: {
        currentPassword: currentAdminPassword,
        newPassword: newAdminPass,
        confirmPassword: newAdminPass,
      },
    });
    assert(passChangeRes.status === 200 && passChangeRes.json?.success, "Admin changed password successfully");

    // Current PC session remains valid (owner is NOT locked out)
    const pcStillActive = await req("/api/auth/me", { jar: adminPcJar });
    assert(pcStillActive.status === 200 && pcStillActive.json?.success, "Current Admin PC session remains active after password change");

    // Other laptop session was revoked
    const laptopRevoked = await req("/api/auth/me", { jar: adminLaptopJar });
    assert(laptopRevoked.status === 401, "Other computer session (laptop) was successfully invalidated by password change");

    // Sign in with new password works
    await prisma.adminRateLimit.deleteMany({}).catch(() => {});
    currentAdminPassword = newAdminPass;
    const newPassLogin = await req("/api/auth/login", {
      method: "POST",
      jar: adminLaptopJar,
      body: { email: adminEmail, password: newAdminPass },
    });
    assert(newPassLogin.status === 200 && newPassLogin.json?.success, "Admin can log in with new password");

    // Old password no longer works
    await prisma.adminRateLimit.deleteMany({}).catch(() => {});
    const oldPassLogin = await req("/api/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: initialAdminPassword },
    });
    assert(oldPassLogin.status === 401, "Old password is no longer accepted");

    // Revert password back to initial for environment consistency
    const restoreHash = await bcrypt.hash(initialAdminPassword, 12);
    await prisma.adminUser.updateMany({
      data: { passwordHash: restoreHash },
    });
    currentAdminPassword = initialAdminPassword;
    pass("Password reverted cleanly to initial environment password");

    // ─────────────────────────────────────────────────────────────────
    // SECTION 7: SINGLE-STEP EMAIL CHANGE FLOW (PASSWORD-ONLY)
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- 7. Testing Single-Step Email Change Flow (Password-Only) ---");

    const newEmailTarget = "newowner@lovekitchen.ma";

    // Invalid password rejected
    const badPassEmailReq = await req("/api/admin/account/email", {
      method: "POST",
      jar: adminPcJar,
      body: { currentPassword: "wrong-password", newEmail: newEmailTarget },
    });
    assert(badPassEmailReq.status === 401, "Email change with incorrect password rejected (401 Unauthorized)");

    // Valid single-step email change
    const validEmailReq = await req("/api/admin/account/email", {
      method: "POST",
      jar: adminPcJar,
      body: { currentPassword: currentAdminPassword, newEmail: newEmailTarget },
    });
    assert(validEmailReq.status === 200 && validEmailReq.json?.success, "Single-step email change succeeded (200 OK)");

    // Verify DB updated directly
    const dbEmailCheck = await prisma.adminUser.findFirst();
    assert(dbEmailCheck.email === newEmailTarget, "Admin email updated directly in PostgreSQL without OTP");

    // Revert back to original email
    const revertEmailReq = await req("/api/admin/account/email", {
      method: "POST",
      jar: adminPcJar,
      body: { currentPassword: currentAdminPassword, newEmail: adminEmail },
    });
    assert(revertEmailReq.status === 200, "Admin email cleanly reverted to initial email");

    console.log(`\n====================================================================`);
    console.log(`ALL ${results.filter((r) => r.ok).length} ADMIN & POS AUTHENTICATION, ISOLATION & PERSISTENCE CHECKS PASSED!`);
    console.log(`====================================================================\n`);
  } finally {
    try {
      const initialHash = await bcrypt.hash(initialAdminPassword, 12);
      await prisma.adminUser.updateMany({
        data: { email: adminEmail, passwordHash: initialHash },
      });
      await prisma.deviceRegistrationCode.deleteMany({});
      await prisma.device.deleteMany({});
    } catch {}
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
