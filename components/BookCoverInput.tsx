"use client";

import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";

// Keep the thumbnail small because books are synced together in the existing JSON document.
async function readCover(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일을 선택해 주세요.");
  if (file.size > 20 * 1024 * 1024) throw new Error("20MB 이하의 이미지를 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const ratio = Math.min(1, 360 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 읽지 못했어요. 다시 선택해 주세요.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch (error) {
    if (error instanceof Error && error.message.includes("다시")) throw error;
    throw new Error("이 이미지를 열 수 없어요. JPG 또는 PNG로 다시 선택해 주세요.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function BookCoverInput({ value, onChange, onBusyChange }: {
  value: string;
  onChange: (value: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  return <div className="space-y-2">
    <p className="text-sm text-[#737b88]">책 표지 <span className="text-xs text-[#939ba5]">선택</span></p>
    <div className="flex items-center gap-3">
      {value && <NextImage unoptimized width={56} height={80} src={value} alt="선택한 책 표지" className="h-20 w-14 rounded-md object-contain" />}
      <div className="min-w-0 space-y-2">
        <label className={`relative inline-flex focus-within:outline-2 focus-within:outline-[#a9cbe1] min-h-11 items-center rounded-xl border border-[#dce8f0] bg-white px-4 text-sm text-[#587b96] ${busy ? "opacity-50" : "cursor-pointer"}`}>
          {busy ? "이미지 준비 중…" : value ? "표지 바꾸기" : "표지 선택"}
          <input aria-label="책 표지 선택" type="file" accept="image/*" disabled={busy} className="absolute inset-0 w-full cursor-pointer opacity-0" onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const token = ++request.current;
            setBusy(true); onBusyChange?.(true); setError("");
            try {
              const data = await readCover(file);
              if (request.current === token) onChange(data);
            } catch (error) {
              if (request.current === token) setError(error instanceof Error ? error.message : "이미지를 읽지 못했어요.");
            } finally {
              if (request.current === token) { setBusy(false); onBusyChange?.(false); }
            }
          }} />
        </label>
        {value && <button type="button" disabled={busy} onClick={() => onChange("")} className="ml-2 min-h-11 px-2 text-sm text-[#87939e]">표지 없애기</button>}
        {!value && <p className="text-xs text-[#87939e]">표지가 없어도 제목만으로 보여요.</p>}
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-[#b36565]">{error}</p>}
  </div>;
}
