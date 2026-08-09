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

const normalizeText = (text: string) => {
  return text.replace(/\s+/g, " ").trim();
};

const escapeSsml = (text: string) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const hasEnglishParentheses = (text: string) => {
  return /\(([A-Za-z][A-Za-z\s'-]*)\)/.test(text);
};

const removeEnglishParentheses = (text: string) => {
  return text
    .replace(/\s*\(([A-Za-z][A-Za-z\s'-]*)\)\s*/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
};

const includeEnglishParentheses = (text: string) => {
  return text
    .replace(/\(([A-Za-z][A-Za-z\s'-]*)\)/g, "$1")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
};

const buildTtsInput = (text: string) => {
  const normalized = normalizeText(text);

  if (!hasEnglishParentheses(normalized)) {
    return {
      text: normalized,
    };
  }

  const withoutParentheses = removeEnglishParentheses(normalized);
  const withParentheses = includeEnglishParentheses(normalized);

  if (!withoutParentheses || !withParentheses || withoutParentheses === withParentheses) {
    return {
      text: normalized,
    };
  }

  return {
    ssml: `<speak><s>${escapeSsml(withoutParentheses)}</s><break time="500ms"/><s>${escapeSsml(withParentheses)}</s></speak>`,
  };
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
      input: buildTtsInput(text),
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
