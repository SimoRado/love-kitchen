import { PrismaClient } from "@prisma/client";

// Re-instantiate PrismaClient with latest generated schema models
export const prisma = new PrismaClient({
  log: ["error"],
});
