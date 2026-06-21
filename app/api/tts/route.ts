import { NextResponse } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";

export const runtime = "nodejs";

const client = new textToSpeech.TextToSpeechClient({
  projectId: process.env.GOOGLE_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

const getLanguageCode = (voice: string) => {
  if (voice.startsWith("en-GB")) return "en-GB";
  return "en-US";
};

export async function POST(req: Request) {
  try {
    const { text, voice } = await req.json();

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

    const [response] = await client.synthesizeSpeech({
      input: {
        text: text.replace(/\s+/g, " ").trim(),
      },
      voice: {
        languageCode: getLanguageCode(voice),
        name: voice,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.92,
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
