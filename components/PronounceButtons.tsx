"use client";

import { plainText } from "@/lib/richText";
import { useState } from "react";
import type { ReactNode } from "react";
import { getSelectedEnglishVoice } from "./EnglishAccentSelector";

interface PronounceButtonsProps {
  text: string;
  children?: ReactNode;
  className?: string;
}

const CACHE_NAME = "vocab-flow-tts-cache-v2";

const normalizeText = (value: string) =>
  plainText(value)
    .replace(/\[\[(.*?)\]\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const getVoice = (text: string) =>
  /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text) ? "ko-KR-Wavenet-A" : getSelectedEnglishVoice();

export const isTtsTextHit = (root: Element, clientX: number, clientY: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (node.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(node);

      if (
        Array.from(range.getClientRects()).some(
          (rect) =>
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom,
        )
      ) {
        return true;
      }
    }

    node = walker.nextNode();
  }

  return false;
};

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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) throw new Error("TTS 요청에 실패했습니다.");
  return response.blob();
};

const getCachedAudio = async (cacheKey: string) => {
  if (typeof window === "undefined" || !("caches" in window)) return null;
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(cacheKey);
  return cachedResponse ? cachedResponse.blob() : null;
};

const saveAudioToCache = async (cacheKey: string, blob: Blob) => {
  if (typeof window === "undefined" || !("caches" in window)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(cacheKey, new Response(blob, { headers: { "Content-Type": "audio/mpeg" } }));
};

export default function PronounceButtons({
  text,
  children,
  className = "",
}: PronounceButtonsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const cleanedText = normalizeText(text);

  if (!cleanedText) return null;

  const speak = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      const voice = getVoice(cleanedText);
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
      setIsLoading(false);
    }
  };

  return (
    <span
      role="button"
      data-tts-trigger="true"
      tabIndex={0}
      title="눌러서 듣기"
      aria-label={`${cleanedText} 듣기`}
      aria-busy={isLoading}
      onClick={(event) => {
        if (!isTtsTextHit(event.currentTarget, event.clientX, event.clientY)) return;
        event.stopPropagation();
        void speak();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        void speak();
      }}
      className={`inline-block cursor-pointer ${isLoading ? "opacity-60" : ""} ${className}`}
    >
      {children ?? cleanedText}
    </span>
  );
}
