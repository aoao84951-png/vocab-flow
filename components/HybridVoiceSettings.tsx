"use client";
import { useEffect, useState } from "react";
import { AZURE_VOICES } from "@/lib/azureVoices";
import { HYBRID_MODE_KEY, azurePreferenceKey } from "@/lib/hybridTtsClient";
type Status = { ready: boolean; month: string; used: number | null; limit: number };
export default function HybridVoiceSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [mode, setMode] = useState("google");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      try {
        setMode(localStorage.getItem(HYBRID_MODE_KEY) === "azure" ? "azure" : "google");
        setSelected(Object.fromEntries(["en-US", "en-GB", "en-AU"].map(locale => [locale, localStorage.getItem(azurePreferenceKey(locale)) ?? ""])));
      } catch { /* Storage unavailable: keep defaults. */ }
      fetch("/api/hybrid-tts").then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => { if (alive) setStatus(data); })
        .catch(() => { if (alive) setStatus(null); });
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("hybrid-usage-change", refresh);
    return () => { alive = false; window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); window.removeEventListener("hybrid-usage-change", refresh); };
  }, []);
  const save = (key: string, value: string) => {
    try { localStorage.setItem(key, value); setError(""); return true; }
    catch { setError("브라우저 저장이 차단되어 설정을 저장하지 못했어요."); return false; }
  };
  return <section className="mt-6 rounded-2xl border border-[#ddeaf3] bg-[#f8fbfe] p-4">
    <h2 className="font-bold">단어장 음성 · 월 사용량</h2>
    <label className="mt-3 block text-sm">재생 방식
      <select value={mode} onChange={e => { if (save(HYBRID_MODE_KEY, e.target.value)) setMode(e.target.value); }} className="mt-2 block w-full rounded-lg border border-slate-200 bg-white p-2">
        <option value="google">현재 Google 음성 사용</option>
        <option value="azure" disabled={!status?.ready && mode !== "azure"}>Azure 우선 · 한도 도달 시 Google</option>
      </select>
    </label>
    <p className="mt-3 text-sm" role="status">{status?.ready ? `${status.month} 사용량(보수적 집계): ${(status.used ?? 0).toLocaleString()} / ${status.limit.toLocaleString()}자` : "Azure 무료 연결 준비 중 · 지금은 Google로 들을 수 있어요."}</p>
    {status?.ready && <progress className="mt-2 w-full" value={status.used ?? 0} max={status.limit} aria-label="이번 달 Azure 사용량" />}
    <p className="mt-2 text-xs leading-relaxed text-slate-500">매월 1일 UTC 기준으로 새 사용량이 시작돼요. 저장된 Azure 음성 재생은 차감하지 않아요. 실제 청구량보다 넉넉하게 계산하며, 사용량 확인 실패 시에도 Google로 전환해요.</p>
    <div className="mt-4 space-y-3">{["en-US", "en-GB", "en-AU"].map(locale => {
      const voices = AZURE_VOICES.filter(v => v.id.startsWith(locale));
      return <label key={locale} className="block text-sm">{voices[0].region} Azure 목소리
        <select className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2" value={selected[locale] || voices[0].id} onChange={e => { if (save(azurePreferenceKey(locale), e.target.value)) setSelected({ ...selected, [locale]: e.target.value }); }}>
          {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </label>;
    })}</div>
    {!status?.ready && <p className="mt-3 text-xs leading-relaxed text-slate-500"><a className="underline text-[#587fa3]" href="https://portal.azure.com" target="_blank" rel="noreferrer">Azure 포털 열기</a> → 단어장 전용 Speech 리소스를 Free F0로 만든 뒤 서버에 연결해야 해요. 인증키는 채팅에 보내지 마세요.</p>}
    <p className="mt-3 text-xs text-slate-500">지역은 단어장의 기존 발음 메뉴를 따라가요. Google 음성과 한국어 발음은 기존 설정을 유지해요. Google 자체 무료 한도는 별도예요.</p>
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
  </section>;
}
