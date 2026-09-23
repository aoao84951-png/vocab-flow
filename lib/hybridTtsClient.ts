import { AZURE_VOICES } from "@/lib/azureVoices";
export const HYBRID_MODE_KEY = "vocab-flow-hybrid-tts";
export const azurePreferenceKey = (googleVoice: string) => `vocab-flow-azure-${googleVoice.slice(0, 5)}`;
const pending = new Map<string, Promise<Blob | null>>();
const notices = new Set<string>();
export async function loadHybridAudio(text: string, googleVoice: string, isActive = () => true): Promise<Blob | null> {
  if (!googleVoice.startsWith("en-")) return null;
  let voice: string;
  try {
    if (localStorage.getItem(HYBRID_MODE_KEY) !== "azure") return null;
    const selected = localStorage.getItem(azurePreferenceKey(googleVoice));
    voice = AZURE_VOICES.find(v => v.id === selected && v.id.slice(0, 5) === googleVoice.slice(0, 5))?.id
      ?? AZURE_VOICES.find(v => v.id.slice(0, 5) === googleVoice.slice(0, 5))!.id;
  } catch { return null; }
  const key = JSON.stringify([text, voice]);
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    let response: Response;
    try {
      response = await fetch("/api/hybrid-tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
      if (response.ok) {
        window.dispatchEvent(new Event("hybrid-usage-change"));
        return await response.blob();
      }
    } catch { response = Response.json({ fallback: "unavailable" }); }
    const reason = await response.json().then(data => data.fallback ?? "unavailable").catch(() => "unavailable");
    const notice = `${new Date().toISOString().slice(0, 7)}:${reason}`;
    if (isActive() && !notices.has(notice)) {
      notices.add(notice);
      window.alert(reason === "limit"
        ? "이번 달 Azure 무료 음성 생성 보호 한도에 도달했어요. 현재 Google 음성으로 재생합니다. 저장된 Azure 음성은 계속 들을 수 있어요."
        : reason === "not_connected"
          ? "Azure 무료 연결이 아직 준비되지 않았어요. 현재 Google 음성으로 재생합니다."
          : "Azure 사용량 확인 또는 음성 생성이 원활하지 않아 현재 Google 음성으로 재생합니다.");
    }
    window.dispatchEvent(new Event("hybrid-usage-change"));
    return null;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
