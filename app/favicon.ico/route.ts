import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.redirect(new URL("/icon", process.env.NEXT_PUBLIC_SITE_URL));
}