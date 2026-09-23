import { NextResponse } from "next/server";
import { AZURE_VOICES } from "@/lib/azureVoices";
import { AzureFallback, azureStatus, synthesizeAzure } from "@/lib/azureTtsServer";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json(await azureStatus(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: Request) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }
  if (typeof body?.text !== "string" || !body.text.trim() || body.text.length > 6000 || !AZURE_VOICES.some(v => v.id === body?.voice)) {
    return NextResponse.json({ error: "음성과 6,000자 이내의 문장을 확인해 주세요." }, { status: 400 });
  }
  try {
    const audio = await synthesizeAzure(body.text.trim(), body.voice);
    return new NextResponse(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ fallback: e instanceof AzureFallback ? e.reason : "accounting" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
}
