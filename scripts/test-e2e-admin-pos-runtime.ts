import { prisma } from "../src/lib/prisma";
import { getOrCreateDefaultAdmin } from "../src/lib/adminAccount";

interface CookieOpts {
  adminSession?: string;
  posDevice?: string;
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function makeReq(path: string, options: RequestInit & { cookies?: CookieOpts } = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (options.cookies) {
    const cs = [];
    if (options.cookies.adminSession) cs.push(`resto_admin_session=${options.cookies.adminSession}`);
    if (options.cookies.posDevice) cs.push(`resto_pos_device=${options.cookies.posDevice}`);
    if (cs.length > 0) {
      headers.set("cookie", cs.join("; "));
    }
  }
  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

async function runE2ETests() {
  console.log("==========================================================");
  console.log("EXECUTING E2E HTTP SECURITY VERIFICATION");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  try {
    const admin = await getOrCreateDefaultAdmin();
    console.log(`Starting with Admin: ${admin.email} (Access Path: /${admin.adminAccessPath})`);

    // 1. Admin Login Endpoint
    console.log("\n--- 1. Admin Login ---");
    const badLogin = await makeReq("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: admin.email, password: "WrongPassword123!" }),
    });
    assert(badLogin.status === 401, "Invalid password returns 401");

    const goodLogin = await makeReq("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: admin.email, password: "RestaurantAdmin2026!" }),
    });
    assert(goodLogin.status === 200, "Valid email + password returns 200");

    const cookieHeader = goodLogin.headers.get("set-cookie") || "";
    const match = cookieHeader.match(/resto_admin_session=([^;]+)/);
    const adminSessionToken = match ? match[1] : "";
    assert(Boolean(adminSessionToken), `resto_admin_session HTTP-only cookie set`);

    // 2. Admin Profile & Authorization
    console.log("\n--- 2. Admin Profile & Authorization ---");
    const unauthMe = await makeReq("/api/auth/me");
    assert(unauthMe.status === 401, "Unauthenticated /api/auth/me returns 401");

    const authMe = await makeReq("/api/auth/me", {
      cookies: { adminSession: adminSessionToken },
    });
    assert(authMe.status === 200, "Logged-in admin can access /api/auth/me");
    const meData = await authMe.json();
    assert(meData.data.email === admin.email, `Admin profile email matches: ${meData.data.email}`);

    // 3. POS Device Isolation & Blocking
    console.log("\n--- 3. POS Terminal Isolation ---");
    const posDevice = await prisma.device.upsert({
      where: { deviceIdentifier: "POS-TEST-TERMINAL" },
      create: {
        deviceIdentifier: "POS-TEST-TERMINAL",
        name: "POS TEST TERMINAL",
        status: "REGISTERED",
        credentialToken: "pos_test_credential_token",
      },
      update: {
        status: "REGISTERED",
        credentialToken: "pos_test_credential_token",
      },
    });

    const posAdminLogin = await makeReq("/api/auth/login", {
      method: "POST",
      cookies: { posDevice: posDevice.credentialToken },
      body: JSON.stringify({ email: admin.email, password: "RestaurantAdmin2026!" }),
    });
    assert(
      posAdminLogin.status === 403,
      "POS device attempting to login as admin is blocked with 403 Forbidden"
    );

    const posAdminMe = await makeReq("/api/auth/me", {
      cookies: { posDevice: posDevice.credentialToken },
    });
    assert(
      posAdminMe.status === 401,
      "POS device cannot access admin apis (returns 401)"
    );

    // 4. Active Sessions Management
    console.log("\n--- 4. Active Sessions Management ---");
    const sessionsReq = await makeReq("/api/admin/account/sessions", {
      cookies: { adminSession: adminSessionToken },
    });
    assert(sessionsReq.status === 200, "Query active sessions succeeds");
    const sessionsData = await sessionsReq.json();
    assert(Array.isArray(sessionsData.data), `Active sessions listed: ${sessionsData.data.length} session(s)`);

    // 5. Security Audit Logs API
    console.log("\n--- 5. Security Audit Logs API ---");
    const logsReq = await makeReq("/api/admin/account/audit-logs", {
      cookies: { adminSession: adminSessionToken },
    });
    assert(logsReq.status === 200, "Query security audit logs succeeds");
    const logsData = await logsReq.json();
    assert(Array.isArray(logsData.data), `Security audit logs returned: ${logsData.data.length} logs`);

    // 6. Logout
    console.log("\n--- 6. Admin Logout ---");
    const logoutReq = await makeReq("/api/auth/logout", {
      method: "POST",
      cookies: { adminSession: adminSessionToken },
    });
    assert(logoutReq.status === 200, "Logout succeeds");

    const postLogoutMe = await makeReq("/api/auth/me", {
      cookies: { adminSession: adminSessionToken },
    });
    assert(postLogoutMe.status === 401, "Revoked session token cannot be used after logout (401)");

    console.log(`\n==========================================================`);
    console.log(`E2E HTTP SECURITY TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log(`==========================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Error during E2E test execution:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runE2ETests();
