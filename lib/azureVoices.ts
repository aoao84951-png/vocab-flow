export const AZURE_VOICES = [
  { id: "en-US-GuyNeural", name: "Guy · 남성", region: "미국" },
  { id: "en-US-AvaMultilingualNeural", name: "Ava Multilingual · 여성", region: "미국" },
  { id: "en-GB-RyanNeural", name: "Ryan · 남성", region: "영국" },
  { id: "en-GB-LibbyNeural", name: "Libby · 여성", region: "영국" },
  { id: "en-AU-WilliamNeural", name: "William · 남성", region: "호주" },
  { id: "en-AU-NatashaNeural", name: "Natasha · 여성", region: "호주" },
] as const;
export const AZURE_MONTHLY_LIMIT = 500000;
export function azureSpeech(text: string, voice: string) {
  if (!AZURE_VOICES.some(v => v.id === voice)) throw new Error("Unknown Azure voice");
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // Override only comma silence; preserve punctuation, number parsing and voice pace.
  // Keep comma-free SSML identical so existing cached words remain reusable.
  const hasComma = /[,，]/u.test(text);
  const namespace = hasComma ? ' xmlns:mstts="http://www.w3.org/2001/mstts"' : "";
  const commaSilence = hasComma ? '<mstts:silence type="Comma-exact" value="100ms"/>' : "";
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"${namespace} xml:lang="${voice.slice(0, 5)}"><voice name="${voice}">${commaSilence}${escaped}</voice></speak>`;
}
export function reservedCharacters(ssml: string) {
  // Intentionally over-count markup/entities and CJK (which Azure counts double).
  // This is a conservative application budget, not Azure's billing meter.
  return Array.from(ssml).reduce((sum, char) => sum + (/[\u3400-\u9fff\uf900-\ufaff]/u.test(char) ? 2 : 1), 0);
}
