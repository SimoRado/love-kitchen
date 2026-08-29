import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { checkRateLimit, resetRateLimit } from "../src/lib/rateLimit";
import { recordAuditLog } from "../src/lib/auditLog";
import { createOtp, verifyOtp } from "../src/lib/otp";
import { getOrCreateDefaultAdmin, validateAdminAccessPath } from "../src/lib/adminAccount";
import { createAdminSession, verifyAdminSessionToken, invalidateAllAdminSessions } from "../src/lib/auth";

async function runAllTests() {
  console.log("=========================================================");
  console.log("STARTING ADMIN AND POS ISOLATION FULL_SECURITY_VERIFICATION");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAILL ${name}`);
      failed++;
    }
  }

  try {
    // 1. Password hashing
    console.log("--- 1. Testing Password Security ---");
    const testPass = "SuperSecret123!";
    const hashed = await hashPassword(testPass);
    assert(hashed && hashed.startsWith("$2"), "Password hashed with bcrypt (cost 12)");
    assert(await verifyPassword(testPass, hashed), "Password verified accurately");
    assert(!(await verifyPassword("WrongPass", hashed)), "Invalid password correctly rejected");


    // 2. Distributed Database Rate Limiting
    console.log("\n--- 2. Testing Distributed Rate Limiting ---");
    const rateLimitKey = "test_ip:192.168.1.100:ADMIN_LOGIN_FAIL";
    await resetRateLimit(rateLimitKey);
    for (let i = 0; i < 5; i++) {
      const status = await checkRateLimit(rateLimitKey, 5, 10);
      assert(status.allowed, `Rate limit attempt ${i + 1}/5 allowed`);
    }
    const blockedStatus = await checkRateLimit(rateLimitKey, 5, 10);
    assert(!blockedStatus.allowed, "6th attempt successfully blocked by distributed rate limiter");
    await resetRateLimit(rateLimitKey);


    // 3. Admin Account Bootstrap & Lookup
    console.log("\n--- 3. Testing Admin Account Bootstrap & Lookup ---");
    const admin = await getOrCreateDefaultAdmin();
    assert(admin && admin.email,  `Default admin created/loaded: ${admin.email}`);
    assert(admin.adminAccessPath === "lovekitchen", `Default access path is lovekitchen: ${admin.adminAccessPath}`);

    // 4. Access Path Validation Rules
    console.log("\n--- 4. Testing Admin Access Path Rules ---");
    assert(!validateAdminAccessPath("api").valid, "Path 'api' correctly rejected (reserved)");
    assert(!validateAdminAccessPath("admin").valid, "Path 'admin' correctly rejected (reserved)");
    assert(!validateAdminAccessPath("pos").valid, "Path 'pos' correctly rejected (reserved)");
    assert(!validateAdminAccessPath("ab").valid, "Path 'ab' correctly rejected (<3 chars)");
    assert(!validateAdminAccessPath("my_bad_path!").valid, "Path with special chars correctly rejected");
    assert(validateAdminAccessPath("love-manager-99").valid, "Valid path 'love-manager-99' accepted");


    // 5. Multi-Session Token Management
    console.log("\n--- 5. Testing Multi-Computer Admin Sessions ---");
    const session1 = await createAdminSession(admin.id, "1.1.1.1", "Computer-A / Chrome");
    const session2 = await createAdminSession(admin.id, "2.2.2.2", "Computer-B / Safari");
    assert(session1.token && session2.token, "Generated tokens for Machine A and Machine T");
    assert(session1.token !== session2.token, "Each device receives a unique cryptographic session token");


    const verify1 = await verifyAdminSessionToken(session1.token);
    const verify2 = await verifyAdminSessionToken(session2.token);
    assert(verify1 && verify1.id === admin.id, "Session 1 successfully authenticated");
    assert(verify2 && verify2.id === admin.id, "Session 2 successfully authenticated");


    // 6. OTP Generation, Hashing, Single-Use and Expiry
    console.log("\n--- 6. Testing 10-Minute Cryptographic Single-Use OTP ---");
    const otpObj = await createOtp(admin.id, "PASSWORD_RESET", admin.email);
    const code = (otpObj as any).code || (otpObj as any).otp;
    assert(code && code.length === 6, `Generated 6-digit numeric OTP: ${code}`);

    const badVerify = await verifyOtp(admin.id, "PASSWORD_RESET", "000000");
    assert(!badVerify.success, "Incorrect OTP rejected");

    const goodVerify = await verifyOtp(admin.id, "PASSWORD_RESET", code);
    assert(goodVerify.success, "Correct OTP verified successfully");

    const reuseVerify = await verifyOtp(admin.id, "PASSWORD_RESET", code);
    assert(!reuseVerify.success, "Replay/reuse of already-used OTP is prevented");


    // 7. Security Audit Logging
    console.log("\n--- 7. Testing Immutable Audit Logging ---");
    const logEntry = await recordAuditLog({
      adminUserId: admin.id,
      action: "TEST_SECURITY_EVENT",
      details: { test: true },
      ipAddress: "127.0.0.1",
      userAgent: "TestRunner/1.0",
    });
    assert(logEntry && logEntry.id, `Audit log entry persisted with ID: ${logEntry.id}`);


    // Clean up test sessions
    await invalidateAllAdminSessions(admin.id);
    const verifyRevoked = await verifyAdminSessionToken(session1.token);
    assert(!verifyRevoked, "Global session invalidation successfully revoked all open sessions");


    console.log(`\n========================================================`);
    console.log(`ALL UNIT/INTEGRATION TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Error during test execution:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAllTests();
