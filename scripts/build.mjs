import { execSync } from "node:child_process";
import fs from "node:fs";

// Load .env / .env.local if present locally
for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
      }
    }
  }
}

// Ensure DIRECT_URL fallback for Prisma schema validation and migrations
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL
    .replace(":6543", ":5432")
    .replace("?pgbouncer=true", "")
    .replace("&pgbouncer=true", "");
}

if (!process.env.DATABASE_URL && process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = "postgresql://postgres:postgres@localhost:5432/postgres";
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";
}

console.log("==> Running prisma migrate deploy...");
try {
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
} catch (err) {
  console.warn("⚠️ Warning: prisma migrate deploy failed:", err.message);
}

console.log("==> Running next build...");
execSync("npx next build", { stdio: "inherit", env: process.env });
