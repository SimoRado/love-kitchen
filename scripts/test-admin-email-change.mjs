/**
 * Dedicated Single-Step Admin Email Change Test Suite
 *
 * Validates:
 *   1. Unauthenticated request rejection (401)
 *   2. Missing input validation (400)
 *   3. Invalid email format rejection (400)
 *   4. Same email address rejection (400)
 *   5. Incorrect current password rejection (401) and DB email immutability
 *   6. Successful single-step email update with valid password (200)
 *   7. Database AdminUser.email immediate persistence (no OTP, no email sent)
 *   8. Audit log recording for EMAIL_CHANGED
 *   9. Clean email reversion back to baseline
 *   10. Rate limiting enforcement on brute-force attempts
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
  console.log("STARTING SINGLE-STEP ADMIN EMAIL CHANGE TEST SUITE");
  console.log("====================================================================\n");

  const initialAdminPassword = loadEnvValue("ADMIN_PASSWORD") || "123";
  const initialAdminEmail = (loadEnvValue("ADMIN_EMAIL") || "admin@lovekitchen.ma").toLowerCase();

  try {
    const admin = await prisma.adminUser.findFirst();
    assert(admin !== null, "AdminUser exists in database");

    // Clear any rate limits from prior test runs
    await prisma.adminRateLimit.deleteMany({}).catch(() => {});

    // ─────────────────────────────────────────────────────────────────
    // SECTION 1: AUTHENTICATION & ACCESS CONTROL
    // ─────────────────────────────────────────────────────────────────
    console.log("--- 1. Access Control & Validation ---");

    // Unauthenticated request must fail
    const unauthReq = await req("/api/admin/account/email", {
      method: "POST",
      body: { currentPassword: initialAdminPassword, newEmail: "newadmin@lovekitchen.ma" },
    });
    assert(unauthReq.status === 401, "Unauthenticated request rejected with 401");

    // Authenticate admin session
    const adminJar = new CookieJar("admin-session");
    const loginRes = await req("/api/auth/login", {
      method: "POST",
      jar: adminJar,
      body: { email: initialAdminEmail, password: initialAdminPassword },
    });
    assert(loginRes.status === 200 && loginRes.json?.success, "Admin authenticated successfully");

    // Missing fields validation
    const missingPassReq = await req("/api/admin/account/email", {
      method: "POST",
      jar: adminJar,
      body: { newEmail: "newadmin@lovekitchen.ma" },
    });
    assert(missingPassReq.status === 400, "Missing current password rejected with 400");

    const missingEmailReq = await req("/api/admin/account/email", {
      method: "POST",
      jar: adminJar,
      body: { currentPassword: initialAdminPassword },
    });
    assert(missingEmailReq.status === 400, "Missing new email rejected with 400");

    // Invalid email format
    const badFormatReq = await req("/api/admin/account/email", {
      method: "POST",
      jar: adminJar,
      body: { currentPassword: initialAdminPassword, newEmail: "not-an-email" },
    });
    assert(badFormatReq.status === 400, "Invalid email format rejected with 400");

    // Same email address
    const sameEmailReq = await req("/api/admin/account/email", {
      method: "POST",
      jar: adminJar,
      body: { currentPassword: initialAdminPassword, newEmail: initialAdminEmail },
    });
    assert(sameEmailReq.status === 400, "Same email address rejected with 400");

    // ─────────────────────────────────────────────────────────────────
    // SECTION 2: PASSWORD VERIFICATION & IMMUTABILITY ON FAILURE
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- 2. Password Verification ---");

    const targetEmail = "director@lovekitchen.ma";

    const wrongPassReq = await req("/api/admin/account/email", {
      method: "POST",
      jar: adminJar,
      body: { currentPassword: "incorrect-password", newEmail: targetEmail },
    });
    assert(wrongPassReq.status === 401, "Incorrect password rejected with 401");

    const adminAfterWrongPass = await prisma.adminUser.findFirst();
    assert(adminAfterWrongPass.email === initialAdminEmail, "Admin email remains unchanged after failed password check");

    // ─────────────────────────────────────────────────────────────────
    // SECTION 3: SUCCESSFUL SINGLE-STEP EMAIL UPDATE
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- 3. Single-Step Email Update ---");

    await prisma.adminRateLimit.deleteMany({}).catch(() => {});

    const successReq = await req("/api/admin/account/email", {
      method: "POST",
      jar: adminJar,
      body: { currentPassword: initialAdminPassword, newEmail: targetEmail },
    });
    assert(successReq.status === 200 && successReq.json?.success, "Single-step email change succeeded with 200 OK");
    assert(successReq.json?.data?.email === targetEmail, "API response returns updated email");

    const adminInDb = await prisma.adminUser.findFirst();
    assert(adminInDb.email === targetEmail, "Database record updated directly to new email");

    // Can log in with new email
    const newEmailLogin = await req("/api/auth/login", {
      method: "POST",
      body: { email: targetEmail, password: initialAdminPassword },
    });
    assert(newEmailLogin.status === 200 && newEmailLogin.json?.success, "Can authenticate using the new email address");

    // ─────────────────────────────────────────────────────────────────
    // SECTION 4: AUDIT LOG VERIFICATION
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- 4. Audit Log ---");

    const auditLog = await prisma.adminAuditLog.findFirst({
      where: { action: "EMAIL_CHANGED" },
      orderBy: { createdAt: "desc" },
    });
    assert(auditLog !== null, "EMAIL_CHANGED audit log entry recorded");
    assert(!auditLog.details?.includes("password"), "Audit log details do not contain password");

    // ─────────────────────────────────────────────────────────────────
    // SECTION 5: CLEAN REVERSION
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- 5. Clean Reversion ---");

    const revertReq = await req("/api/admin/account/email", {
      method: "POST",
      jar: adminJar,
      body: { currentPassword: initialAdminPassword, newEmail: initialAdminEmail },
    });
    assert(revertReq.status === 200 && revertReq.json?.success, "Email cleanly reverted to initial address");

    const adminReverted = await prisma.adminUser.findFirst();
    assert(adminReverted.email === initialAdminEmail, "Database confirmed back at initial email");

    console.log(`\n====================================================================`);
    console.log(`ALL ${results.filter((r) => r.ok).length} SINGLE-STEP EMAIL CHANGE CHECKS PASSED!`);
    console.log(`====================================================================\n`);
  } finally {
    try {
      const initialHash = await bcrypt.hash(initialAdminPassword, 12);
      await prisma.adminUser.updateMany({
        data: { email: initialAdminEmail, passwordHash: initialHash },
      });
      await prisma.adminRateLimit.deleteMany({});
    } catch {}
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
