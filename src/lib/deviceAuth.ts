import { Device } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/auth";

export const POS_DEVICE_COOKIE_NAME = "resto_pos_device";
export const DEVICE_TYPES = ["POS", "KITCHEN", "ADMIN"] as const;
export const DEVICE_STATUSES = ["ACTIVE", "INACTIVE", "DISABLED", "REVOKED"] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number];
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const POS_ALLOWED_ADMIN_ROLES = new Set(["OWNER", "ADMIN", "MANAGER", "STAFF"]);
export const DEVICE_MANAGEMENT_ROLES = new Set(["OWNER", "ADMIN"]);

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(digest);
}

function timingSafeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function randomToken(bytes = 32): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function normalizeRegistrationCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function hashRegistrationCode(code: string): Promise<string> {
  return sha256(`registration:${normalizeRegistrationCode(code)}`);
}

export async function hashDeviceCredential(credential: string): Promise<string> {
  return sha256(`device:${credential}`);
}

export function generateRegistrationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint8Array(10);
  crypto.getRandomValues(values);
  const raw = Array.from(values).map((value) => alphabet[value % alphabet.length]).join("");
  return `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6, 10)}`;
}

export function createPublicDeviceId(type: DeviceType): string {
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  return `${type}-${suffix}`;
}

export async function createDeviceCredentialCookie(deviceId: string) {
  const credential = randomToken();
  const credentialHash = await hashDeviceCredential(credential);
  return {
    credential,
    credentialHash,
    cookieValue: `${deviceId}.${credential}`,
  };
}

export async function getDeviceFromRequest(request: NextRequest): Promise<Device | null> {
  const cookie = request.cookies.get(POS_DEVICE_COOKIE_NAME)?.value;
  if (!cookie) return null;

  const separatorIndex = cookie.indexOf(".");
  if (separatorIndex < 1) return null;

  const deviceId = cookie.slice(0, separatorIndex);
  const credential = cookie.slice(separatorIndex + 1);
  if (!deviceId || !credential || credential.length !== 64 || !/^[0-9a-f]{64}$/i.test(credential)) {
    return null;
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || device.status !== "ACTIVE") return null;

  const receivedHash = await hashDeviceCredential(credential);
  if (!timingSafeStringEqual(receivedHash, device.credentialHash)) return null;

  await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  return device;
}

export async function getCurrentStaffRole(request: NextRequest): Promise<string | null> {
  const isAdmin = await getAdminSessionFromRequest(request);
  return isAdmin ? "OWNER" : null;
}

export async function requirePosAccess(request: NextRequest): Promise<{ device: Device; role: string } | NextResponse> {
  const [device, adminRole] = await Promise.all([
    getDeviceFromRequest(request),
    getCurrentStaffRole(request),
  ]);

  if (!device) {
    return NextResponse.json({ success: false, error: "Registered active POS device required." }, { status: 403 });
  }

  // Role is "ADMIN" if an authenticated admin is operating, otherwise "POS"
  const role = adminRole && POS_ALLOWED_ADMIN_ROLES.has(adminRole) ? adminRole : "POS";

  return { device, role };
}

export async function requireDeviceManagementAccess(request: NextRequest): Promise<NextResponse | null> {
  const isAdmin = await getAdminSessionFromRequest(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: "Owner/admin access required." }, { status: 403 });
  }
  return null;
}

export function setDeviceCookie(response: NextResponse, cookieValue: string) {
  response.cookies.set({
    name: POS_DEVICE_COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}

export function clearDeviceCookie(response: NextResponse) {
  response.cookies.set({
    name: POS_DEVICE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}