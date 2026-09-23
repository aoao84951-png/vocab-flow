export const COMPARISON_TEXT = "But I probably won't finish before we open our doors at 10, if that's alright.";
export const COMPARISON_VOICES = [
  { id: "us-wavenet", region: "미국", provider: "google", label: "Google WaveNet", voice: "en-US-Wavenet-D" },
  { id: "us-neural2", region: "미국", provider: "google", label: "Google Neural2", voice: "en-US-Neural2-D" },
  { id: "us-azure", region: "미국", provider: "azure", label: "Azure Guy", voice: "en-US-GuyNeural" },
  { id: "uk-wavenet", region: "영국", provider: "google", label: "Google WaveNet", voice: "en-GB-Wavenet-B" },
  { id: "uk-neural2", region: "영국", provider: "google", label: "Google Neural2", voice: "en-GB-Neural2-B" },
  { id: "uk-azure", region: "영국", provider: "azure", label: "Azure Ryan", voice: "en-GB-RyanNeural" },
  { id: "au-wavenet", region: "호주", provider: "google", label: "Google WaveNet", voice: "en-AU-Wavenet-B" },
  { id: "au-neural2", region: "호주", provider: "google", label: "Google Neural2", voice: "en-AU-Neural2-B" },
  { id: "au-azure", region: "호주", provider: "azure", label: "Azure William", voice: "en-AU-WilliamNeural" },
] as const;
