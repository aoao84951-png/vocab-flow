import { NextResponse } from "next/server";
import { POST as googleTts } from "../tts/route";
import { COMPARISON_VOICES } from "@/lib/voiceComparison";
import { buildTtsInput } from "@/lib/ttsInput";

export const runtime = "nodejs";
const azureReady = () => Boolean(process.env.AZURE_SPEECH_KEY && /^[a-z0-9-]+$/.test(process.env.AZURE_SPEECH_REGION ?? ""));
export async function GET() {
  return NextResponse.json({ azureReady: azureReady() }, { headers: { "Cache-Control": "no-store" } });
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
  if (!azureReady()) return NextResponse.json({ error: "Azure 연결이 아직 준비되지 않았습니다." }, { status: 503 });
  const input = buildTtsInput(body.text, candidate.voice);
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const speech = input.ssml ? input.ssml.slice(7, -8) : escape(input.text ?? "");
  const locale = candidate.voice.slice(0, 5);
  try {
    const response = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST", signal: AbortSignal.timeout(25000),
      headers: { "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3" },
      body: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}"><voice name="${candidate.voice}"><prosody rate="0%">${speech}</prosody></voice></speak>`,
    });
    if (!response.ok) throw new Error(`Azure synthesis status ${response.status}`);
    return new NextResponse(await response.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Azure 음성을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
