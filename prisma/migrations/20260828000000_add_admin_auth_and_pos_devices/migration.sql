-- AlterTable Product: add prepTimeMinutes and prepStation
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "prepTimeMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "prepStation" TEXT DEFAULT 'KITCHEN';

-- AlterTable Order: add estimated prep times
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "estimatedPrepMinutes" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "estimatedReadyAt" TIMESTAMP(3);

-- AlterTable OrderItem: add configuredUnitPrice
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "configuredUnitPrice" DOUBLE PRECISION;

-- AlterTable RestaurantSettings: add congestion buffers
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "congestionBufferMinutes" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "maxCongestionBufferMinutes" INTEGER NOT NULL DEFAULT 20;

-- CreateTable Device
CREATE TABLE IF NOT EXISTS "Device" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'POS',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "restaurantId" TEXT NOT NULL DEFAULT 'default',
    "credentialHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable DeviceRegistrationCode
CREATE TABLE IF NOT EXISTS "DeviceRegistrationCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL DEFAULT 'POS',
    "restaurantId" TEXT NOT NULL DEFAULT 'default',
    "replaceDeviceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceRegistrationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable AdminUser
CREATE TABLE IF NOT EXISTS "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "adminAccessPath" TEXT NOT NULL DEFAULT 'lovekitchen',
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable AdminOtp
CREATE TABLE IF NOT EXISTS "AdminOtp" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetEmail" TEXT,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable AdminSession
CREATE TABLE IF NOT EXISTS "AdminSession" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable AdminAuditLog
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable AdminRateLimit
CREATE TABLE IF NOT EXISTS "AdminRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Device_publicId_key" ON "Device"("publicId");
CREATE INDEX IF NOT EXISTS "Device_restaurantId_type_status_idx" ON "Device"("restaurantId", "type", "status");
CREATE INDEX IF NOT EXISTS "Device_status_idx" ON "Device"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceRegistrationCode_codeHash_key" ON "DeviceRegistrationCode"("codeHash");
CREATE INDEX IF NOT EXISTS "DeviceRegistrationCode_expiresAt_idx" ON "DeviceRegistrationCode"("expiresAt");
CREATE INDEX IF NOT EXISTS "DeviceRegistrationCode_replaceDeviceId_idx" ON "DeviceRegistrationCode"("replaceDeviceId");
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_email_key" ON "AdminUser"("email");
CREATE INDEX IF NOT EXISTS "AdminUser_adminAccessPath_idx" ON "AdminUser"("adminAccessPath");
CREATE INDEX IF NOT EXISTS "AdminOtp_adminId_type_idx" ON "AdminOtp"("adminId", "type");
CREATE INDEX IF NOT EXISTS "AdminOtp_expiresAt_idx" ON "AdminOtp"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "AdminSession_adminId_idx" ON "AdminSession"("adminId");
CREATE INDEX IF NOT EXISTS "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminId_idx" ON "AdminAuditLog"("adminId");
CREATE INDEX IF NOT EXISTS "AdminRateLimit_resetAt_idx" ON "AdminRateLimit"("resetAt");

-- AddForeignKey safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeviceRegistrationCode_replaceDeviceId_fkey') THEN
        ALTER TABLE "DeviceRegistrationCode" ADD CONSTRAINT "DeviceRegistrationCode_replaceDeviceId_fkey" FOREIGN KEY ("replaceDeviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminOtp_adminId_fkey') THEN
        ALTER TABLE "AdminOtp" ADD CONSTRAINT "AdminOtp_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminSession_adminId_fkey') THEN
        ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminAuditLog_adminId_fkey') THEN
        ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
