/**
 * Dedicated Admin Authentication Test Suite
 *
 * Tests the complete admin login lifecycle:
 *   1. Database table existence (AdminUser, AdminRateLimit, AdminSession)
 *   2. AdminUser record integrity
 *   3. Password hash verification
 *   4. Login with valid credentials
 *   5. Login with invalid credentials
 *   6. Session persistence (cookie re-use)
 *   7. Logout + session invalidation
 *   8. Clean browser → /admin → /admin/login
 *   9. POS cookie does NOT override admin session
 *   10. Stale POS cookie does NOT redirect /admin to /admin/pos
 *   11. Rate limiting does not crash authentication (no 500)
 *   12. Migration status verification
 */

import fs from "node:fs";
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
}

async function req(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.jar?.header()) headers.Cookie = options.jar.header();
  let body = options.body;
  if (body !== undefined && typeof body !== "string") {
    body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(BASE_URL + path, {
    method: options.method || "GET",
    headers,
    body,
    redirect: options.redirect || "manual",
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

async function main() {
  console.log("====================================================================");
  console.log("ADMIN AUTHENTICATION TEST SUITE");
  console.log("====================================================================\n");

  const adminPassword = loadEnvValue("ADMIN_PASSWORD") || "123";
  const adminEmail = (loadEnvValue("ADMIN_EMAIL") || "admin@lovekitchen.ma").toLowerCase();

  // ─────────────────────────────────────────────────────────────────
  // SECTION 1: DATABASE TABLE VERIFICATION
  // ─────────────────────────────────────────────────────────────────
  console.log("--- 1. Database Table Verification ---");

  try {
    await prisma.adminUser.count();
    pass("AdminUser table exists");
  } catch (e) {
    fail("AdminUser table exists", e.message);
  }

  try {
    await prisma.adminSession.count();
    pass("AdminSession table exists");
  } catch (e) {
    fail("AdminSession table exists", e.message);
  }

  try {
    await prisma.adminRateLimit.count();
    pass("AdminRateLimit table exists");
  } catch (e) {
    fail("AdminRateLimit table exists", e.message);
  }

  try {
    await prisma.adminAuditLog.count();
    pass("AdminAuditLog table exists");
  } catch (e) {
    fail("AdminAuditLog table exists", e.message);
  }

  // ─────────────────────────────────────────────────────────────────
  // SECTION 2: ADMIN USER RECORD INTEGRITY
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- 2. AdminUser Record Integrity ---");

  const admin = await prisma.adminUser.findFirst();
  assert(admin !== null, "AdminUser record exists in database");
  assert(admin.email === adminEmail, "AdminUser email matches expected", `stored=${admin.email}, expected=${adminEmail}`);
  assert(admin.passwordHash && admin.passwordHash.startsWith("$2"), "Password hash is bcrypt format");

  const passwordValid = await bcrypt.compare(adminPassword, admin.passwordHash);
  assert(passwordValid, `Password "${adminPassword}" matches stored bcrypt hash`);

  // ─────────────────────────────────────────────────────────────────
  // SECTION 3: LOGIN WITH VALID CREDENTIALS
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- 3. Login With Valid Credentials ---");

  // Clear any rate limits that might block us
  await prisma.adminRateLimit.deleteMany({}).catch(() => {});

  const loginJar = new CookieJar("admin-browser");
  const loginRes = await req("/api/auth/login", {
    method: "POST",
    jar: loginJar,
    body: { email: adminEmail, password: adminPassword },
  });
  assert(loginRes.status === 200 && loginRes.json?.success, "POST /api/auth/login succeeds with valid credentials", `status=${loginRes.status}`);
  assert(loginJar.cookies.has("resto_admin_session"), "resto_admin_session cookie was issued");

  // Verify cookie properties
  const setCookieHeader = loginRes.setCookie.find(c => c.includes("resto_admin_session"));
  assert(setCookieHeader, "Set-Cookie header contains resto_admin_session");
  assert(/httponly/i.test(setCookieHeader), "resto_admin_session is HttpOnly");
  assert(/max-age=2592000/i.test(setCookieHeader), "resto_admin_session has 30-day persistent lifetime");

  // ─────────────────────────────────────────────────────────────────
  // SECTION 4: LOGIN WITH INVALID CREDENTIALS
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- 4. Login With Invalid Credentials ---");

  const badPassRes = await req("/api/auth/login", {
    method: "POST",
    body: { email: adminEmail, password: "wrong-password-12345" },
  });
  assert(badPassRes.status === 401, "Invalid password returns 401", `status=${badPassRes.status}`);

  const badEmailRes = await req("/api/auth/login", {
    method: "POST",
    body: { email: "nobody@example.com", password: adminPassword },
  });
  assert(badEmailRes.status === 401, "Non-existent email returns 401", `status=${badEmailRes.status}`);

  const noPasswordRes = await req("/api/auth/login", {
    method: "POST",
    body: { email: adminEmail },
  });
  assert(noPasswordRes.status === 400, "Missing password returns 400", `status=${noPasswordRes.status}`);

  // API must NEVER return 500 merely because rate-limit subsystem is unavailable
  assert(badPassRes.status !== 500, "Invalid credentials do NOT produce 500 error");

  // ─────────────────────────────────────────────────────────────────
  // SECTION 5: AUTHENTICATED SESSION ACCESS
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- 5. Authenticated Session Access ---");

  const meRes = await req("/api/auth/me", { jar: loginJar });
  assert(meRes.status === 200 && meRes.json?.success, "GET /api/auth/me returns authenticated profile");
  assert(meRes.json?.data?.email === adminEmail, "Profile email matches admin");

  const adminDashboard = await req("/admin", { jar: loginJar });
  assert(adminDashboard.status === 200, "Authenticated admin accesses /admin (200 OK)");

  const adminProducts = await req("/admin/products", { jar: loginJar });
  assert(adminProducts.status === 200, "Authenticated admin accesses /admin/products (200 OK)");

  const adminSettings = await req("/admin/settings", { jar: loginJar });
  assert(adminSettings.status === 200, "Authenticated admin accesses /admin/settings (200 OK)");

  const adminDevices = await req("/admin/devices", { jar: loginJar });
  assert(adminDevices.status === 200, "Authenticated admin accesses /admin/devices (200 OK)");

  const adminSecurity = await req("/admin/security", { jar: loginJar });
  assert(adminSecurity.status === 200, "Authenticated admin accesses /admin/security (200 OK)");

  // Authenticated admin visiting /admin/login redirects to /admin
  const alreadyLoggedIn = await req("/admin/login", { jar: loginJar });
  assert(alreadyLoggedIn.status === 307 && alreadyLoggedIn.location?.includes("/admin"), "Authenticated admin on /admin/login redirects to /admin");

  // ─────────────────────────────────────────────────────────────────
  // SECTION 6: SESSION PERSISTENCE (SIMULATED BROWSER RESTART)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- 6. Session Persistence ---");

  // Simulate browser restart: create new jar with same cookie
  const restartJar = new CookieJar("admin-browser-restarted");
  const sessionCookie = loginJar.cookies.get("resto_admin_session");
  restartJar.cookies.set("resto_admin_session", sessionCookie);

  const restartMe = await req("/api/auth/me", { jar: restartJar });
  assert(restartMe.status === 200 && restartMe.json?.success, "Session persists after simulated browser restart");

  const restartDashboard = await req("/admin", { jar: restartJar });
  assert(restartDashboard.status === 200, "Admin dashboard accessible after simulated browser restart");

  // ─────────────────────────────────────────────────────────────────
  // SECTION 7: MULTI-COMPUTER LOGIN
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- 7. Multi-Computer Login ---");

  const computer2Jar = new CookieJar("admin-computer-2");
  const comp2LoginRes = await req("/api/auth/login", {
    method: "POST",
    jar: computer2Jar,
    body: { email: adminEmail, password: adminPassword },
  });
  assert(comp2LoginRes.status === 200 && comp2LoginRes.json?.success, "Second computer logs in independently");

  // Both sessions remain valid
  const comp1Check = await req("/api/auth/me", { jar: loginJar });
  const comp2Check = await req("/api/auth/me", { jar: computer2Jar });
  assert(comp1Check.status === 200 && comp2Check.status === 200, "Both computer sessions active simultaneously");

  // ─────────────────────────────────────────────────────────────────
  // SECTION 8: LOGOUT
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- 8. Logout ---");

  const logoutRes = await req("/api/auth/logout", { method: "POST", jar: loginJar });
  assert(logoutRes.status === 200, "Logout returns 200");
  assert(!loginJar.cookies.has("resto_admin_session"), "resto_admin_session cookie cleared on logout");

  const postLogoutMe = await req("/api/auth/me", { jar: loginJar });
  assert(postLogoutMe.status === 401, "Session invalid after logout");

  const postLogoutAdmin = await req("/admin", { jar: loginJar });
  assert(postLogoutAdmin.status === 307 && postLogoutAdmin.location?.includes("/admin/login"), "Post-logout /admin redirects to /admin/login");

  // Computer 2 still works (logout only affects current session)
  const comp2StillOk = await req("/api/auth/me", { jar: computer2Jar });
  assert(comp2StillOk.status === 200, "Other computer session unaffected by this computer's logout");

  // ─────────────────────────────────────────────────────────────────
  // SECTION 9: CLEAN BROWSER ROUTING
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- 9. Clean Browser Routing ---");

  const cleanJar = new CookieJar("clean-browser");

  const cleanAdmin = await req("/admin", { jar: cleanJar });
  assert(cleanAdmin.status === 307 && cleanAdmin.location?.includes("/admin/login"), "Clean browser: /admin → /admin/login (NOT /admin/pos)");

  const cleanProducts = await req("/admin/products", { jar: cleanJar });
  assert(cleanProducts.status === 307 && cleanProducts.location?.includes("/admin/login"), "Clean browser: /admin/products → /admin/login");

  const cleanLogin = await req("/admin/login", { jar: cleanJar });
  assert(cleanLogin.status === 200, "Clean browser: /admin/login → 200 login page");

  const cleanPos = await req("/admin/pos", { jar: cleanJar });
  assert(cleanPos.status === 200, "Clean browser: /admin/pos → 200 POS registration");

  // ─────────────────────────────────────────────────────────────────
  // SECTION 10: STALE POS COOKIE DOES NOT HIJACK /admin
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- 10. Stale POS Cookie Isolation ---");

  const staleJar = new CookieJar("stale-pos-browser");
  staleJar.cookies.set("resto_pos_device", "NONEXISTENT-DEVICE.fakecredential123456");

  const staleToAdmin = await req("/admin", { jar: staleJar });
  assert(staleToAdmin.status === 307 && staleToAdmin.location?.includes("/admin/login"), "Stale POS cookie: /admin → /admin/login (NOT /admin/pos)");

  const staleToLogin = await req("/admin/login", { jar: staleJar });
  assert(staleToLogin.status === 200, "Stale POS cookie: /admin/login → 200 login page");

  // ─────────────────────────────────────────────────────────────────
  // SECTION 11: VALID ADMIN + POS COOKIE COEXISTENCE
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- 11. Admin + POS Cookie Coexistence ---");

  // Log in again on a fresh jar
  const dualJar = new CookieJar("dual-cookie-browser");
  await req("/api/auth/login", {
    method: "POST",
    jar: dualJar,
    body: { email: adminEmail, password: adminPassword },
  });
  assert(dualJar.cookies.has("resto_admin_session"), "Dual test: admin session present");

  // Simulate adding a stale POS cookie (not registered, just a leftover)
  dualJar.cookies.set("resto_pos_device", "FAKE-DEVICE.fakecredential");

  const dualAdmin = await req("/admin", { jar: dualJar });
  assert(dualAdmin.status === 200, "Admin session + stale POS cookie: /admin → 200 Admin dashboard (admin wins)");

  const dualMe = await req("/api/auth/me", { jar: dualJar });
  assert(dualMe.status === 200 && dualMe.json?.success, "Admin session + stale POS cookie: /api/auth/me still authenticated");

  // ─────────────────────────────────────────────────────────────────
  // SECTION 12: RATE LIMITING NON-DESTRUCTIVE
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- 12. Rate Limiting ---");

  // Clear rate limits and try a few bad logins
  await prisma.adminRateLimit.deleteMany({}).catch(() => {});

  for (let i = 0; i < 3; i++) {
    await req("/api/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: "wrong" },
    });
  }

  // After 3 failed attempts, a valid login should still work (threshold is 5)
  const validAfterFails = await req("/api/auth/login", {
    method: "POST",
    body: { email: adminEmail, password: adminPassword },
  });
  assert(validAfterFails.status === 200 && validAfterFails.json?.success, "Valid login succeeds after failed attempts (below threshold)");

  console.log(`\n====================================================================`);
  console.log(`ALL ${results.filter(r => r.ok).length} ADMIN AUTHENTICATION CHECKS PASSED!`);
  console.log(`====================================================================\n`);

  // Clean up test sessions
  await prisma.adminRateLimit.deleteMany({}).catch(() => {});
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("\nTest execution failed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
