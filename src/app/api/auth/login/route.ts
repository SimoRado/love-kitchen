import { NextRequest, NextResponse } from "next/server";
import {
  validateAdminPassword,
  createAdminSessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 }
      );
    }

    const isValid = validateAdminPassword(password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid admin password" },
        { status: 401 }
      );
    }

    const token = await createAdminSessionToken();

    const response = NextResponse.json({
      success: true,
      message: "Admin authenticated successfully",
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication service error. Check server configuration." },
      { status: 500 }
    );
  }
}
