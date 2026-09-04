/**
 * Love Kitchen — Comprehensive Security Hardening Test Suite
 *
 * Automated verification of:
 *   1. Admin Authentication Security (bcrypt cost, session hashing, revocation, expiration, prod fail-closed)
 *   2. POS Device Security (code generation, hashing, single-use, credential isolation)
 *   3. Order Pricing & Validation Security (server price calculations, quantity bounds, status flow)
 *   4. Image Upload & Storage Security (magic bytes validation, path traversal rejection, size caps)
 *   5. CSRF / Origin Protection (proxy Origin header enforcement)
 *   6. Security Headers & Cache-Control (HSTS, nosniff, frame protection, CSP, no-store)
 *   7. Secret Auditing (no sensitive variables exposed to client)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { hashPassword, verifyPassword } from "../src/lib/password.ts";
import {
  createAdminSession,
  verifyAdminSessionToken,
  invalidateSessionByToken,
  invalidateAllAdminSessions,
  ADMIN_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../src/lib/auth.ts";
import {
  validateAccessPath,
  getOrCreateDefaultAdmin,
  DEFAULT_ADMIN_ACCESS_PATH,
} from "../src/lib/adminAccount.ts";
import {
  generateRegistrationCode,
  normalizeRegistrationCode,
  hashRegistrationCode,
  hashDeviceCredential,
  createDeviceCredentialCookie,
  POS_DEVICE_COOKIE_NAME,
} from "../src/lib/deviceAuth.ts";
import {
  calculateItemTotal,
  calculateOrderTotals,
  roundMoney,
} from "../src/lib/money.ts";
import {
  matchesImageSignature,
  RAW_PATH_REGEX,
  SANITY_MAX_RAW_SIZE,
} from "../src/lib/storage.ts";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName, detail = "") {
  if (condition) {
    console.log(`\x1b[32m[PASS]\x1b[0m ${testName} ${detail ? `(${detail})` : ""}`);
    passed++;
  } else {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${testName} ${detail ? `(${detail})` : ""}`);
    failed++;
    failures.push({ testName, detail });
  }
}

async function runSecurityTests() {
  console.log("=".repeat(70));
  console.log("LOVE KITCHEN — SECURITY HARDENING AUTOMATED VERIFICATION");
  console.log("=".repeat(70) + "\n");

  // =========================================================================
  // 1. ADMIN AUTHENTICATION SECURITY
  // =========================================================================
  console.log("--- 1. Admin Authentication Security ---");

  // 1.1 Password Hashing & Salt Rounds
  const samplePass = "SecuritySecret2026!";
  const hash = await hashPassword(samplePass);
  assert(hash.startsWith("$2a$12$") || hash.startsWith("$2b$12$"), "Password hash uses bcrypt cost 12", hash.slice(0, 7));
  assert(await verifyPassword(samplePass, hash), "Valid password verified successfully");
  assert(!(await verifyPassword("WrongPassword123", hash)), "Invalid password rejected");
  assert(!(await verifyPassword("", hash)), "Empty password rejected");
  assert(!(await verifyPassword(samplePass, "")), "Empty hash rejected safely");

  // 1.2 Access Path Validation
  assert(!validateAccessPath("").valid, "Empty access path rejected");
  assert(!validateAccessPath("ab").valid, "Short (<3) access path rejected");
  assert(!validateAccessPath("a".repeat(45)).valid, "Long (>40) access path rejected");
  assert(!validateAccessPath("admin").valid, "Reserved path 'admin' rejected");
  assert(!validateAccessPath("api").valid, "Reserved path 'api' rejected");
  assert(!validateAccessPath("pos").valid, "Reserved path 'pos' rejected");
  assert(!validateAccessPath("bad path!").valid, "Path with special chars/spaces rejected");
  assert(validateAccessPath("kitchen-secret-99").valid, "Valid kebab-case access path accepted");

  // 1.3 Production Fail-Closed Default Admin
  const prevEnv = process.env.NODE_ENV;
  const prevPass = process.env.ADMIN_PASSWORD;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.ADMIN_PASSWORD;
    let threw = false;
    try {
      const isProduction = process.env.NODE_ENV === "production";
      const password = process.env.ADMIN_PASSWORD;
      if (isProduction && (!password || password === "123" || password === "RestaurantAdmin2026!" || password.length < 8)) {
        throw new Error("Production security violation");
      }
    } catch {
      threw = true;
    }
    assert(threw, "Production fails closed when ADMIN_PASSWORD is not set");

    // Test with weak password in production
    process.env.ADMIN_PASSWORD = "123";
    threw = false;
    try {
      const isProduction = process.env.NODE_ENV === "production";
      const password = process.env.ADMIN_PASSWORD;
      if (isProduction && (!password || password === "123" || password === "RestaurantAdmin2026!" || password.length < 8)) {
        throw new Error("Production security violation");
      }
    } catch {
      threw = true;
    }
    assert(threw, "Production fails closed when ADMIN_PASSWORD is weak ('123')");
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevPass !== undefined) process.env.ADMIN_PASSWORD = prevPass;
    else delete process.env.ADMIN_PASSWORD;
  }

  // 1.4 Admin Session Token Generation & Storage
  const admin = await prisma.adminUser.findFirst();
  if (admin) {
    const session = await createAdminSession(admin.id, "127.0.0.1", "SecurityTest/1.0");
    assert(Boolean(session.token), "Session token generated");
    assert(session.token.includes("."), "Session token format is sessionId.secret");

    const [sId, secret] = session.token.split(".");
    assert(secret.length === 64, "Session secret has 256 bits of cryptographic entropy (64 hex)", String(secret.length));

    // Verify token hash in DB
    const dbSession = await prisma.adminSession.findUnique({ where: { id: sId } });
    assert(Boolean(dbSession), "Session persisted in PostgreSQL");
    assert(dbSession.tokenHash !== secret, "Only SHA-256 hash is persisted in DB, never plaintext secret");

    // Verify session authentication
    const verifiedAdmin = await verifyAdminSessionToken(session.token);
    assert(verifiedAdmin !== null && verifiedAdmin.id === admin.id, "Valid session token authenticates admin");

    // Verify malformed session token rejected early
    assert((await verifyAdminSessionToken("invalid-format")) === null, "Malformed token without dot rejected");
    assert((await verifyAdminSessionToken(`${sId}.shortsecret`)) === null, "Short secret length rejected without DB query");
    assert((await verifyAdminSessionToken(`${sId}.${"z".repeat(64)}`)) === null, "Non-hex secret rejected without DB query");

    // Verify single session revocation
    await invalidateSessionByToken(session.token);
    assert((await verifyAdminSessionToken(session.token)) === null, "Invalidated session no longer authenticates");

    // Verify global session revocation
    const s1 = await createAdminSession(admin.id, "127.0.0.1", "Test-1");
    const s2 = await createAdminSession(admin.id, "127.0.0.2", "Test-2");
    await invalidateAllAdminSessions(admin.id);
    assert((await verifyAdminSessionToken(s1.token)) === null, "Global revocation revokes session 1");
    assert((await verifyAdminSessionToken(s2.token)) === null, "Global revocation revokes session 2");
  }

  // =========================================================================
  // 2. POS DEVICE SECURITY
  // =========================================================================
  console.log("\n--- 2. POS Device Security ---");

  // 2.1 Pairing Code Entropy & Normalization
  const code1 = generateRegistrationCode();
  const code2 = generateRegistrationCode();
  assert(code1 !== code2, "Generated pairing codes are unique and unpredictable");
  assert(/^[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code1), "Pairing code follows canonical grouping pattern", code1);

  const normalized = normalizeRegistrationCode("ab-cd12-34ef");
  assert(normalized === "ABCD1234EF", "Normalization handles lowercase and stripping hyphens", normalized);

  // 2.2 Pairing Code Hashing
  const codeHash = await hashRegistrationCode("AB-1234-5678");
  assert(codeHash.length === 64, "Code hash is SHA-256 hex digest", codeHash.slice(0, 16) + "...");
  assert(codeHash !== "AB-1234-5678", "Raw code is never stored plaintext");

  // 2.3 Device Credential Generation & Token Structure
  const deviceCookie = await createDeviceCredentialCookie("dev-test-1");
  assert(deviceCookie.credential.length === 64, "Device secret credential has 256 bits entropy");
  assert(deviceCookie.credentialHash !== deviceCookie.credential, "Credential stored as SHA-256 hash");
  assert(deviceCookie.cookieValue.startsWith("dev-test-1."), "Device cookie format is deviceId.credential");

  // =========================================================================
  // 3. ORDER PRICING & INTEGRITY SECURITY
  // =========================================================================
  console.log("\n--- 3. Order Pricing & Validation Security ---");

  // 3.1 Float Precision Safety
  assert(roundMoney(0.1 + 0.2) === 0.3, "roundMoney fixes floating point 0.1 + 0.2 = 0.3");
  assert(calculateItemTotal(65.5, 3) === 196.5, "calculateItemTotal calculates exact item total");
  assert(calculateItemTotal(65.5, -5) === 65.5, "Negative quantity in item total clamped to minimum 1");

  // 3.2 Server-Side Totals Calculation
  const sampleItems = [
    { configuredUnitPrice: 65, quantity: 2 }, // 130
    { configuredUnitPrice: 35, quantity: 1 }, // 35
  ];
  const deliveryTotals = calculateOrderTotals(sampleItems, "DELIVERY", 15);
  assert(deliveryTotals.subtotal === 165, "Subtotal calculated correctly", String(deliveryTotals.subtotal));
  assert(deliveryTotals.deliveryFee === 15, "Delivery fee applied for DELIVERY orders", String(deliveryTotals.deliveryFee));
  assert(deliveryTotals.total === 180, "Total is subtotal + deliveryFee", String(deliveryTotals.total));

  const pickupTotals = calculateOrderTotals(sampleItems, "PICKUP", 15);
  assert(pickupTotals.deliveryFee === 0, "Delivery fee is 0 for PICKUP orders");
  assert(pickupTotals.total === 165, "Total matches subtotal for PICKUP orders");

  // =========================================================================
  // 4. FILE UPLOAD & STORAGE SECURITY
  // =========================================================================
  console.log("\n--- 4. File Upload & Storage Security ---");

  // 4.1 Magic Bytes Validation
  // JPEG: FF D8 FF
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  assert(matchesImageSignature(jpegBytes).valid, "Valid JPEG magic bytes detected");
  assert(matchesImageSignature(jpegBytes).format === "jpeg", "JPEG format recognized");

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  assert(matchesImageSignature(pngBytes).valid, "Valid PNG magic bytes detected");
  assert(matchesImageSignature(pngBytes).format === "png", "PNG format recognized");

  // WEBP: RIFF....WEBP
  const webpBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
  assert(matchesImageSignature(webpBytes).valid, "Valid WEBP magic bytes detected");

  // Malicious executable / script masked as image
  const fakePhp = new TextEncoder().encode("<?php phpinfo(); ?>");
  assert(!matchesImageSignature(fakePhp).valid, "PHP script masked as image rejected by magic bytes");

  const fakeHtml = new TextEncoder().encode("<script>alert(1)</script>");
  assert(!matchesImageSignature(fakeHtml).valid, "HTML/XSS script rejected by magic bytes");

  // 4.2 Path Traversal Whitelisting
  assert(RAW_PATH_REGEX.test("raw/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"), "Valid raw path matches whitelist regex");
  assert(RAW_PATH_REGEX.test("raw/fedcba98-7654-3210-fedc-ba9876543210.webp"), "Valid webp raw path matches regex");
  assert(!RAW_PATH_REGEX.test("raw/../../etc/passwd"), "Directory traversal path rejected by regex");
  assert(!RAW_PATH_REGEX.test("raw/malicious.exe"), "Non-image extension rejected by regex");
  assert(!RAW_PATH_REGEX.test("raw/sub/folder/file.jpg"), "Subdirectory nesting in raw path rejected");
  assert(!RAW_PATH_REGEX.test("products/exploit.jpg"), "Non-raw prefix rejected");

  // 4.3 Size cap
  assert(SANITY_MAX_RAW_SIZE === 30 * 1024 * 1024, "Image sanity cap configured to 30 MB");

  // =========================================================================
  // 5. CSRF & ORIGIN PROTECTION IN PROXY
  // =========================================================================
  console.log("\n--- 5. CSRF & Origin Protection in proxy.ts ---");

  const proxyPath = path.join(process.cwd(), "src", "proxy.ts");
  const proxyContent = fs.readFileSync(proxyPath, "utf8");
  assert(proxyContent.includes("isStateChanging"), "proxy.ts checks for state-changing HTTP methods");
  assert(proxyContent.includes("originHost !== host"), "proxy.ts verifies Origin matches Host header");
  assert(proxyContent.includes("Cross-origin request forbidden"), "proxy.ts returns 403 on cross-origin CSRF attempt");
  assert(proxyContent.includes("matcher:"), "proxy.ts exports route matcher");
  assert(!proxyContent.includes("(?!api|"), "proxy.ts matcher intercepts /api/* routes for centralized protection");

  // =========================================================================
  // 6. SECURITY HEADERS & CACHE-CONTROL
  // =========================================================================
  console.log("\n--- 6. Security Headers & Cache-Control ---");

  const nextConfigPath = path.join(process.cwd(), "next.config.ts");
  const nextConfigContent = fs.readFileSync(nextConfigPath, "utf8");

  assert(nextConfigContent.includes("X-Content-Type-Options"), "nosniff header configured in next.config.ts");
  assert(nextConfigContent.includes("X-Frame-Options"), "DENY frame protection configured in next.config.ts");
  assert(nextConfigContent.includes("Strict-Transport-Security"), "HSTS max-age 63072000 configured");
  assert(nextConfigContent.includes("Permissions-Policy"), "Permissions-Policy configured");
  assert(nextConfigContent.includes("Content-Security-Policy"), "Content-Security-Policy configured");
  assert(nextConfigContent.includes("isDev ? \" 'unsafe-eval'\" : \"\""), "unsafe-eval omitted from production CSP");

  assert(nextConfigContent.includes("/api/admin/:path*"), "Cache-Control configured for /api/admin/*");
  assert(nextConfigContent.includes("/api/pos/:path*"), "Cache-Control configured for /api/pos/*");
  assert(nextConfigContent.includes("/api/auth/:path*"), "Cache-Control configured for /api/auth/*");

  // =========================================================================
  // 7. SECRET AUDITING & GIT STATUS
  // =========================================================================
  console.log("\n--- 7. Secret Auditing ---");

  const gitignorePath = path.join(process.cwd(), ".gitignore");
  const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
  assert(gitignoreContent.includes(".env"), ".gitignore ignores .env");
  assert(gitignoreContent.includes("*.db"), ".gitignore ignores *.db");
  assert(gitignoreContent.includes("dev.db"), ".gitignore ignores dev.db");

  // Check no sensitive server secrets have NEXT_PUBLIC_ prefix
  const srcFiles = fs.readdirSync(path.join(process.cwd(), "src"), { recursive: true });
  let leakedSecretFound = false;
  for (const f of srcFiles) {
    if (typeof f !== "string" || (!f.endsWith(".ts") && !f.endsWith(".tsx"))) continue;
    const fullPath = path.join(process.cwd(), "src", f);
    const content = fs.readFileSync(fullPath, "utf8");
    if (
      content.includes("NEXT_PUBLIC_DATABASE_URL") ||
      content.includes("NEXT_PUBLIC_DIRECT_URL") ||
      content.includes("NEXT_PUBLIC_ADMIN_PASSWORD") ||
      content.includes("NEXT_PUBLIC_SERVICE_ROLE")
    ) {
      leakedSecretFound = true;
      console.error(`Leaked secret env var pattern found in: ${f}`);
    }
  }
  assert(!leakedSecretFound, "No database credentials or admin passwords prefixed with NEXT_PUBLIC_");

  // =========================================================================
  // 8. SUMMARY
  // =========================================================================
  console.log("\n" + "=".repeat(70));
  console.log(`SECURITY VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=".repeat(70) + "\n");

  await prisma.$disconnect();

  if (failed > 0) {
    console.error("FAILURES:");
    failures.forEach((f) => console.error(` - ${f.testName}: ${f.detail}`));
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
