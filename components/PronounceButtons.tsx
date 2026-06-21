"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";

interface PronounceButtonsProps {
  text: string;
  className?: string;
}

type Accent = "US" | "UK";

const VOICES: Record<Accent, string> = {
  US: "en-US-Wavenet-D",
  UK: "en-GB-Wavenet-B",
};

const CACHE_NAME = "vocab-flow-tts-cache-v1";

const normalizeText = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const makeCacheKey = async (text: string, voice: string) => {
  const source = `${voice}::${text}`;

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoded = new TextEncoder().encode(source);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    return `/tts-cache/${toHex(hashBuffer)}.mp3`;
  }

  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(i);
    hash |= 0;
  }

  return `/tts-cache/${voice}-${Math.abs(hash)}.mp3`;
};

const playBlob = (blob: Blob) => {
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);

  audio.onended = () => URL.revokeObjectURL(audioUrl);
  audio.onerror = () => URL.revokeObjectURL(audioUrl);

  void audio.play();
};

const fetchTtsAudio = async (text: string, voice: string) => {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    throw new Error("TTS 요청에 실패했습니다.");
  }

  return response.blob();
};

const getCachedAudio = async (cacheKey: string) => {
  if (typeof window === "undefined" || !("caches" in window)) {
    return null;
  }

  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(cacheKey);

  if (!cachedResponse) return null;

  return cachedResponse.blob();
};

const saveAudioToCache = async (cacheKey: string, blob: Blob) => {
  if (typeof window === "undefined" || !("caches" in window)) {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    cacheKey,
    new Response(blob, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    })
  );
};

export default function PronounceButtons({
  text,
  className = "",
}: PronounceButtonsProps) {
  const [loadingAccent, setLoadingAccent] = useState<Accent | null>(null);

  const cleanedText = normalizeText(text);

  if (!cleanedText) return null;

  const speak = async (accent: Accent) => {
    try {
      setLoadingAccent(accent);

      const voice = VOICES[accent];
      const cacheKey = await makeCacheKey(cleanedText, voice);
      const cachedAudio = await getCachedAudio(cacheKey);

      if (cachedAudio) {
        playBlob(cachedAudio);
        return;
      }

      const audioBlob = await fetchTtsAudio(cleanedText, voice);
      await saveAudioToCache(cacheKey, audioBlob);
      playBlob(audioBlob);
    } catch (error) {
      console.error(error);
      alert("발음 오디오를 불러오지 못했습니다.");
    } finally {
      setLoadingAccent(null);
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title="American Pronunciation"
        aria-label="American Pronunciation"
        disabled={loadingAccent !== null}
        onClick={() => speak("US")}
        className="flex h-7 items-center gap-1 rounded-full border border-[#d7ddea] px-2 text-[11px] font-semibold text-[#0f2a5f] transition hover:bg-[#f5f8ff] active:scale-95 disabled:cursor-wait disabled:opacity-60"
      >
        <Volume2 size={12} />
        {loadingAccent === "US" ? "..." : "US"}
      </button>

      <button
        type="button"
        title="British Pronunciation"
        aria-label="British Pronunciation"
        disabled={loadingAccent !== null}
        onClick={() => speak("UK")}
        className="flex h-7 items-center gap-1 rounded-full border border-[#d7ddea] px-2 text-[11px] font-semibold text-[#0f2a5f] transition hover:bg-[#f5f8ff] active:scale-95 disabled:cursor-wait disabled:opacity-60"
      >
        <Volume2 size={12} />
        {loadingAccent === "UK" ? "..." : "UK"}
      </button>
    </div>
  );
}
