-- DropForeignKey
ALTER TABLE "AdminOtp" DROP CONSTRAINT IF EXISTS "AdminOtp_adminId_fkey";

-- DropTable
DROP TABLE IF EXISTS "AdminOtp";
