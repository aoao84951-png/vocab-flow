import { buildTtsInput } from "@/lib/ttsInput";
import { NextResponse } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";

export const runtime = "nodejs";

const normalizePrivateKey = (key?: string) => {
  if (!key) return undefined;

  return key
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
};

const client = new textToSpeech.TextToSpeechClient({
  projectId: process.env.GOOGLE_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
  },
});

const getLanguageCode = (voice: string) => {
  if (voice.startsWith("ko-KR")) return "ko-KR";
  if (voice.startsWith("en-AU")) return "en-AU";
  if (voice.startsWith("en-GB")) return "en-GB";
  return "en-US";
};

export async function POST(req: Request) {
  try {
    const { text, voice, speakingRate = 0.92 } = await req.json();

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "읽을 텍스트가 없습니다." },
        { status: 400 }
      );
    }

    if (typeof voice !== "string" || !voice.trim()) {
      return NextResponse.json(
        { error: "음성 정보가 없습니다." },
        { status: 400 }
      );
    }

    if (typeof speakingRate !== "number" || !Number.isFinite(speakingRate) || speakingRate < 0.5 || speakingRate > 1.5) {
      return NextResponse.json({ error: "지원하지 않는 재생 속도입니다." }, { status: 400 });
    }

    const [response] = await client.synthesizeSpeech({
      input: buildTtsInput(text, voice),
      voice: {
        languageCode: getLanguageCode(voice),
        name: voice,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate,
        pitch: 0,
      },
    });

    if (!response.audioContent) {
      return NextResponse.json(
        { error: "오디오 생성에 실패했습니다." },
        { status: 500 }
      );
    }

    const audioBuffer = Buffer.from(response.audioContent as Uint8Array);

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("TTS Error:", error);

    return NextResponse.json(
      { error: "TTS Error" },
      { status: 500 }
    );
  }
}
