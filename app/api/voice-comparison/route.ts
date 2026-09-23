import { NextResponse } from "next/server";
import { POST as googleTts } from "../tts/route";
import { COMPARISON_VOICES } from "@/lib/voiceComparison";
import { azureStatus, synthesizeAzure } from "@/lib/azureTtsServer";

export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({ azureReady: (await azureStatus()).ready }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: Request) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "요청을 읽을 수 없습니다." }, { status: 400 }); }
  const candidate = COMPARISON_VOICES.find(item => item.id === body?.id);
  if (!candidate || typeof body?.text !== "string" || !body.text.trim() || body.text.length > 600) {
    return NextResponse.json({ error: "비교할 음성과 600자 이내의 문장을 선택해 주세요." }, { status: 400 });
  }
  if (candidate.provider === "google") {
    return googleTts(new Request(req.url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body.text, voice: candidate.voice, speakingRate: 1 }),
    }));
  }
  if (!(await azureStatus()).ready) return NextResponse.json({ error: "Azure 연결이 아직 준비되지 않았습니다." }, { status: 503 });
  try {
    const audio = await synthesizeAzure(body.text.trim(), candidate.voice);
    return new NextResponse(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    // Comparison must not label Google fallback audio as an Azure voice.
    return NextResponse.json({ error: "Azure 생성 한도 또는 연결 상태를 확인해 주세요. 단어장에서는 Google로 전환됩니다." }, { status: 409 });
  }
}
