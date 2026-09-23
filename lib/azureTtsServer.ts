import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { AZURE_MONTHLY_LIMIT, azureSpeech, reservedCharacters } from "@/lib/azureVoices";

export type AzureReason = "not_connected" | "limit" | "accounting" | "unavailable";
export class AzureFallback extends Error {
  reason: AzureReason;
  constructor(reason: AzureReason) { super(reason); this.reason = reason; }
}
const database = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new AzureFallback("not_connected");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
};
const configured = () => Boolean(process.env.AZURE_SPEECH_KEY && /^[a-z0-9-]+$/.test(process.env.AZURE_SPEECH_REGION ?? "") && process.env.AZURE_SPEECH_TIER === "F0" && process.env.SUPABASE_SERVICE_ROLE_KEY);
export async function azureStatus() {
  const month = new Date().toISOString().slice(0, 7);
  const base = { month, limit: AZURE_MONTHLY_LIMIT, timezone: "UTC", used: null as number | null, ready: false };
  if (!configured()) return base;
  try {
    const db = database();
    const { data, error } = await db.from("azure_tts_usage").select("used").eq("month", `${month}-01`).maybeSingle();
    const cache = await db.from("azure_tts_audio").select("cache_key").limit(0);
    if (error || cache.error) return base;
    return { ...base, used: data?.used ?? 0, ready: true };
  } catch { return base; }
}
export async function synthesizeAzure(text: string, voice: string): Promise<Buffer> {
  if (!configured()) throw new AzureFallback("not_connected");
  const ssml = azureSpeech(text, voice);
  const key = createHash("sha256").update(`azure-native-v1:${ssml}`).digest("hex");
  const db = database();
  const cached = await db.from("azure_tts_audio").select("audio_base64").eq("cache_key", key).maybeSingle();
  if (cached.error) throw new AzureFallback("accounting");
  if (cached.data) return Buffer.from(cached.data.audio_base64, "base64");
  const reservation = await db.rpc("reserve_azure_tts", { p_characters: reservedCharacters(ssml) });
  if (reservation.error) throw new AzureFallback("accounting");
  if (reservation.data !== true) throw new AzureFallback("limit");
  // Never refund uncertain/failed requests: Azure may already have synthesized them.
  // Reserve BEFORE the network call; a ledger outage must never bypass the cap.
  let response: Response;
  try {
    response = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST", signal: AbortSignal.timeout(25000),
      headers: { "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3" },
      body: ssml,
    });
  } catch { throw new AzureFallback("unavailable"); }
  if (!response.ok) throw new AzureFallback("unavailable");
  let audio: Buffer;
  try { audio = Buffer.from(await response.arrayBuffer()); }
  catch { throw new AzureFallback("unavailable"); }
  if (!audio.length) throw new AzureFallback("unavailable");
  await db.from("azure_tts_audio").upsert({ cache_key: key, audio_base64: audio.toString("base64") });
  return audio;
}
