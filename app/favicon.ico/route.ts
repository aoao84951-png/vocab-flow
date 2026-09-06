import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/icon.png?v=5", request.url));
}
