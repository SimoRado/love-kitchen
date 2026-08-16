import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authenticated = await getAdminSessionFromRequest(request);
  return NextResponse.json({
    success: true,
    authenticated,
  });
}
