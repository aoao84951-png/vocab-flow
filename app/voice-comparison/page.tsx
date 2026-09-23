"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COMPARISON_TEXT, COMPARISON_VOICES } from "@/lib/voiceComparison";

type Playback = { controller: AbortController; audio: HTMLAudioElement; url?: string };
function dispose(playback: Playback | null) {
  if (!playback) return;
  playback.controller.abort();
  playback.audio.onended = null;
  playback.audio.onerror = null;
  playback.audio.pause();
  playback.audio.removeAttribute("src");
  playback.audio.load();
  if (playback.url) URL.revokeObjectURL(playback.url);
}
export default function VoiceComparison() {
  const [text, setText] = useState(COMPARISON_TEXT);
  const [region, setRegion] = useState("미국");
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [azureReady, setAzureReady] = useState(false);
  const [favorite, setFavorite] = useState<string | null>(null);
  const playback = useRef<Playback | null>(null);
  const cache = useRef(new Map<string, Blob>());
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/voice-comparison", { signal: controller.signal }).then(r => r.json()).then(data => setAzureReady(data.azureReady === true)).catch(() => {});
    const stopHidden = () => { if (document.hidden) { dispose(playback.current); playback.current = null; setActive(null); setLoading(false); } };
    document.addEventListener("visibilitychange", stopHidden);
    return () => { controller.abort(); document.removeEventListener("visibilitychange", stopHidden); dispose(playback.current); playback.current = null; };
  }, []);
  const stop = () => { dispose(playback.current); playback.current = null; setActive(null); setLoading(false); };
  const play = async (id: string) => {
    const voice = COMPARISON_VOICES.find(item => item.id === id);
    if (!voice) return;
    const same = active === id;
    stop(); setError("");
    if (same) return;
    const current: Playback = { controller: new AbortController(), audio: new Audio() };
    playback.current = current;
    setActive(id); setLoading(true);
    const key = JSON.stringify([id, text.trim()]);
    try {
      if (voice.provider === "azure" && !azureReady) {
        current.audio.src = voice.sampleUrl;
        current.audio.onended = () => { if (playback.current === current) stop(); };
        current.audio.onerror = () => { if (playback.current === current) { stop(); setError("공식 샘플을 불러오지 못했어요. 아래 Azure 공식 갤러리에서도 들을 수 있어요."); } };
        await current.audio.play();
        if (playback.current === current) setLoading(false);
        return;
      }
      let blob = cache.current.get(key);
      if (!blob) {
        const response = await fetch("/api/voice-comparison", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, text: text.trim() }), signal: current.controller.signal });
        if (!response.ok) throw new Error("음성을 불러오지 못했어요. 잠시 후 다시 눌러 주세요.");
        blob = await response.blob();
        if (cache.current.size >= 24) cache.current.clear();
        cache.current.set(key, blob);
      }
      if (playback.current !== current) return;
      current.url = URL.createObjectURL(blob);
      current.audio.src = current.url;
      current.audio.onended = () => { if (playback.current === current) stop(); };
      current.audio.onerror = () => { if (playback.current === current) { stop(); setError("재생에 실패했어요. 다시 눌러 주세요."); } };
      await current.audio.play();
      if (playback.current === current) setLoading(false);
    } catch (e) {
      if (playback.current !== current) return;
      stop(); setError(e instanceof Error ? e.message : "재생에 실패했어요.");
    }
  };
  return <main className="mx-auto w-full max-w-2xl px-5 py-8 text-[#303236]">
    <Link href="/" className="text-sm text-[#587fa3]">← 단어장으로</Link>
    <h1 className="mt-6 text-2xl font-bold">목소리 비교</h1>
    <p className="mt-2 text-sm leading-relaxed text-[#596275]">Google은 아래 예문을 기본 속도 1.0으로 읽어요. 모델 이름만 비교하지 않고, 기존 남성과 다른 여성 목소리를 함께 준비했어요.</p>
    <label className="mt-6 block text-sm font-bold" htmlFor="comparison-text">비교할 예문</label>
    <textarea id="comparison-text" maxLength={600} rows={4} value={text} onChange={e => { stop(); setError(""); setText(e.target.value); setFavorite(null); }} className="mt-2 w-full rounded-2xl border border-[#ddeaf3] p-4 text-base outline-none focus:border-[#587fa3]" />
    <div className="mt-4 flex gap-2" role="group" aria-label="발음 지역">
      {["미국", "영국", "호주"].map(value => <button key={value} type="button" aria-pressed={region === value} onClick={() => { stop(); setError(""); setRegion(value); }} className={`flex-1 rounded-xl py-3 text-sm font-bold ${region === value ? "bg-[#dceefa]" : "bg-[#f4f7fa] text-[#596275]"}`}>{value}식</button>)}
    </div>
    <div className="mt-5 space-y-3">
      {COMPARISON_VOICES.filter(v => v.region === region).map(voice => {
        const available = voice.provider === "google" || azureReady;
        return <section key={voice.id} className="rounded-2xl border border-[#ddeaf3] p-4">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">{voice.label}</h2><p className="mt-1 text-xs text-[#596275]">{voice.region}식 · {voice.gender} · {available ? "내 예문 / 기본 속도" : "공식 샘플 / 다른 문장"}</p></div>
            <button type="button" disabled={available && !text.trim()} onClick={() => void play(voice.id)} aria-label={`${voice.label} ${active === voice.id ? "중지" : "듣기"}`} className="min-w-20 rounded-xl bg-[#eff7fc] px-4 py-3 text-sm font-bold disabled:opacity-40">{active === voice.id ? loading ? "취소" : "중지" : available ? "듣기" : "샘플 듣기"}</button></div>
          {active === voice.id && loading && <p role="status" className="mt-2 text-xs text-[#596275]">음성을 준비하고 있어요…</p>}
          {!available ? <div className="mt-3 space-y-2 text-xs leading-relaxed text-[#596275]">
            <p>로그인 없이 Microsoft 공식 샘플을 들어보세요. 위에 입력한 예문이 아닌 별도 샘플이며, 원래 속도 그대로 재생됩니다.</p>
            <div className="flex flex-wrap gap-3">
              <a href="https://speech.microsoft.com/portal/voicegallery" target="_blank" rel="noreferrer" onClick={stop} className="text-[#587fa3] underline">Azure 공식 갤러리</a>
              <a href="https://speech.microsoft.com/portal/audiocontentcreation" target="_blank" rel="noreferrer" onClick={stop} className="text-[#587fa3] underline">내 예문으로 듣기 · Azure 로그인</a>
            </div>
            <details><summary className="cursor-pointer">로그인과 앱 연결은 어떻게 하나요?</summary>
              <p className="mt-2">위 링크에서 Microsoft 계정으로 로그인한 뒤 Azure Speech 리소스를 선택하면 직접 문장을 넣어 생성할 수 있어요. 리소스가 없다면 생성 과정이 필요합니다. 이 단어장 안에서 생성하려면 별도로 서버 연결이 필요하며, 로그인만으로 자동 연결되지는 않아요. 키는 채팅에 보내지 마세요.</p>
            </details>
          </div> : <button type="button" aria-pressed={favorite === voice.id} onClick={() => setFavorite(voice.id)} className="mt-3 text-xs text-[#587fa3]">{favorite === voice.id ? "✓ 비교 후보로 표시했어요" : "이 목소리가 더 좋아요"}</button>}
        </section>;
      })}
    </div>
    {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
    <p className="mt-6 text-xs leading-relaxed text-[#8a94a6]">여기는 비교용 화면이에요. 단어장의 기존 발음 설정은 바뀌지 않아요. 마음에 드는 지역과 목소리를 알려주시면 적용할 수 있어요.</p>
  </main>;
}
