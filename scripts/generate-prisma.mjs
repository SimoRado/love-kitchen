import { execSync } from "node:child_process";
import fs from "node:fs";

console.log("Generating Prisma client definitions...");

const schemaContent = fs.readFileSync("prisma/schema.prisma", "utf-8");
const tempSchema = schemaContent.replace(
  'provider = "prisma-client-js"',
  'provider = "prisma-client-js"\n  output = "../temp_prisma"'
);
fs.writeFileSync("prisma/temp_schema.prisma", tempSchema);

execSync("npx prisma generate --schema=prisma/temp_schema.prisma", { stdio: "inherit" });

fs.copyFileSync("temp_prisma/index.js", "node_modules/.prisma/client/index.js");
fs.copyFileSync("temp_prisma/index.d.ts", "node_modules/.prisma/client/index.d.ts");
fs.copyFileSync("temp_prisma/index-browser.js", "node_modules/.prisma/client/index-browser.js");
fs.copyFileSync("temp_prisma/schema.prisma", "node_modules/.prisma/client/schema.prisma");

fs.rmSync("temp_prisma", { recursive: true, force: true });
fs.rmSync("prisma/temp_schema.prisma", { force: true });

console.log("✅ Prisma client definitions successfully synchronized!");
