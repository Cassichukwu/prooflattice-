import { NextRequest, NextResponse } from "next/server";

const BYREAL_BASE = "https://api2.byreal.io";

export async function GET(request: NextRequest) {
  const { pathname, search } = new URL(request.url);
  const byreal_path = pathname.replace("/api/byreal-proxy", "");
  
  try {
    const res = await fetch(`${BYREAL_BASE}${byreal_path}${search}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Byreal API error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { pathname } = new URL(request.url);
  const byreal_path = pathname.replace("/api/byreal-proxy", "");
  const body = await request.json();

  try {
    const res = await fetch(`${BYREAL_BASE}${byreal_path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Byreal API error" }, { status: 500 });
  }
}