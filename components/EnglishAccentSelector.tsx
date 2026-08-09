"use client";

import { useEffect, useState } from "react";

export type EnglishAccent = "US" | "UK" | "AU";

const STORAGE_KEY = "vocab-flow-english-accent";

const VOICES: Record<EnglishAccent, string> = {
  US: "en-US-Wavenet-D",
  UK: "en-GB-Wavenet-B",
  AU: "en-AU-Wavenet-B",
};

const isEnglishAccent = (value: string | null): value is EnglishAccent =>
  value === "US" || value === "UK" || value === "AU";

export const getSelectedEnglishAccent = (): EnglishAccent => {
  if (typeof window === "undefined") return "US";
  const storedAccent = window.localStorage.getItem(STORAGE_KEY);
  return isEnglishAccent(storedAccent) ? storedAccent : "US";
};

export const getSelectedEnglishVoice = () => VOICES[getSelectedEnglishAccent()];

export default function EnglishAccentSelector({ className = "" }: { className?: string }) {
  const [accent, setAccent] = useState<EnglishAccent>("US");

  useEffect(() => {
    setAccent(getSelectedEnglishAccent());
  }, []);

  return (
    <label
      className={`inline-flex items-center rounded-full border border-[#d7ddea] bg-white/95 px-2.5 py-1.5 shadow-[0_5px_16px_rgba(15,42,95,0.12)] backdrop-blur ${className}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <span className="mr-1.5 text-[10px] font-bold text-[#8a94a6]">발음</span>
      <select
        value={accent}
        aria-label="영어 발음 선택"
        onChange={(event) => {
          const nextAccent = event.target.value as EnglishAccent;
          setAccent(nextAccent);
          window.localStorage.setItem(STORAGE_KEY, nextAccent);
        }}
        className="cursor-pointer appearance-none bg-transparent pr-3 text-[11px] font-bold text-[#0f2a5f] outline-none"
      >
        <option value="US">미국식</option>
        <option value="UK">영국식</option>
        <option value="AU">호주식</option>
      </select>
      <span className="pointer-events-none -ml-1 text-[8px] text-[#8a94a6]">▼</span>
    </label>
  );
}
