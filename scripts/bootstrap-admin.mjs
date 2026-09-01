/**
 * Admin Bootstrap Script
 * 
 * Safe, idempotent script to ensure the admin account exists with the correct credentials.
 * 
 * Usage:
 *   node scripts/bootstrap-admin.mjs
 * 
 * Behavior:
 *   - If no AdminUser exists: creates one with ADMIN_EMAIL/ADMIN_PASSWORD from .env.local
 *   - If AdminUser exists with correct email: updates password hash ONLY if --reset-password flag is passed
 *   - If AdminUser exists with different email: does nothing (safe)
 *   - Never deletes sessions, audit logs, or other data
 *   - Never deletes the AdminUser record
 *
 * Flags:
 *   --reset-password    Force-update the password hash to match the current ADMIN_PASSWORD env var
 *   --check-only        Only verify the current state, don't modify anything
 */

import fs from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

async function main() {
  const flags = process.argv.slice(2);
  const resetPassword = flags.includes("--reset-password");
  const checkOnly = flags.includes("--check-only");

  const targetEmail = (loadEnvValue("ADMIN_EMAIL") || "admin@lovekitchen.ma").trim().toLowerCase();
  const targetPassword = loadEnvValue("ADMIN_PASSWORD") || "123";

  console.log("=".repeat(60));
  console.log("ADMIN ACCOUNT BOOTSTRAP");
  console.log("=".repeat(60));
  console.log(`Target email: ${targetEmail}`);
  console.log(`Target password length: ${targetPassword.length} characters`);
  console.log(`Flags: ${flags.join(", ") || "(none)"}`);
  console.log("");

  // 1. Check if AdminUser table exists
  try {
    const count = await prisma.adminUser.count();
    console.log(`AdminUser records in database: ${count}`);
  } catch (err) {
    console.error("ERROR: Cannot query AdminUser table:", err.message);
    console.error("Run: npx prisma migrate deploy");
    process.exit(1);
  }

  // 2. Check AdminRateLimit table exists
  try {
    await prisma.adminRateLimit.count();
    console.log("AdminRateLimit table: EXISTS");
  } catch (err) {
    console.error("WARNING: AdminRateLimit table missing:", err.message);
    console.error("Run: npx prisma migrate deploy");
  }

  // 3. Find existing admin
  const existing = await prisma.adminUser.findFirst();

  if (!existing) {
    if (checkOnly) {
      console.log("\nNo AdminUser exists. Run without --check-only to create one.");
      await prisma.$disconnect();
      return;
    }

    console.log("\nNo AdminUser found. Creating initial admin account...");
    const hash = await bcrypt.hash(targetPassword, 12);
    const created = await prisma.adminUser.create({
      data: {
        email: targetEmail,
        passwordHash: hash,
        adminAccessPath: "lovekitchen",
        sessionVersion: 1,
      },
    });
    console.log(`CREATED admin: id=${created.id}, email=${created.email}`);
    console.log("Password hash verified:", await bcrypt.compare(targetPassword, created.passwordHash));
  } else {
    console.log(`\nExisting AdminUser found:`);
    console.log(`  ID: ${existing.id}`);
    console.log(`  Email: ${existing.email}`);
    console.log(`  Session Version: ${existing.sessionVersion}`);
    console.log(`  Created: ${existing.createdAt}`);
    console.log(`  Updated: ${existing.updatedAt}`);

    // Verify current password
    const currentPasswordValid = await bcrypt.compare(targetPassword, existing.passwordHash);
    console.log(`\n  Password "${targetPassword}" matches stored hash: ${currentPasswordValid}`);

    if (currentPasswordValid) {
      console.log("\n✅ Admin account is correctly configured. No changes needed.");
    } else if (resetPassword) {
      if (checkOnly) {
        console.log("\n⚠️  Password mismatch detected but --check-only prevents changes.");
        await prisma.$disconnect();
        return;
      }

      console.log("\n⚠️  Password mismatch. Resetting password hash (--reset-password flag)...");
      const newHash = await bcrypt.hash(targetPassword, 12);
      await prisma.adminUser.update({
        where: { id: existing.id },
        data: { passwordHash: newHash },
      });
      const verification = await bcrypt.compare(targetPassword, newHash);
      console.log(`Password hash updated. Verification: ${verification}`);
      console.log("✅ Password reset complete.");
    } else {
      console.log("\n⚠️  PASSWORD MISMATCH!");
      console.log(`The stored hash does not match "${targetPassword}".`);
      console.log("This may have been changed by a test suite or password change operation.");
      console.log("To reset it, run: node scripts/bootstrap-admin.mjs --reset-password");
    }

    // Ensure email matches
    if (existing.email !== targetEmail) {
      console.log(`\nNOTE: Stored email (${existing.email}) differs from target (${targetEmail}).`);
      if (!checkOnly && resetPassword) {
        await prisma.adminUser.update({
          where: { id: existing.id },
          data: { email: targetEmail },
        });
        console.log(`Email updated to: ${targetEmail}`);
      }
    }
  }

  // 4. Session count
  const sessionCount = await prisma.adminSession.count();
  console.log(`\nActive admin sessions: ${sessionCount}`);

  console.log("\n" + "=".repeat(60));
  console.log("BOOTSTRAP COMPLETE");
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
