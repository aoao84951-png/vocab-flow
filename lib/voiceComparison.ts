export const COMPARISON_TEXT = "But I probably won't finish before we open our doors at 10, if that's alright.";
export const COMPARISON_VOICES = [
  { id: "us-wavenet", region: "미국", provider: "google", label: "Google 남성 · WaveNet", gender: "남성", voice: "en-US-Wavenet-D" },
  { id: "us-neural2", region: "미국", provider: "google", label: "Google 여성 · Neural2", gender: "여성", voice: "en-US-Neural2-F" },
  { id: "us-azure", region: "미국", provider: "azure", label: "Azure Guy", gender: "남성", sampleUrl: "https://ai.azure.com/speechassetscache/ttsvoice/Masterpieces/en-US-Guy-General-audio.wav", voice: "en-US-GuyNeural" },
  { id: "us-azure-female", region: "미국", provider: "azure", label: "Azure Ava Multilingual", gender: "여성", sampleUrl: null, voice: "en-US-AvaMultilingualNeural" },
  { id: "uk-wavenet", region: "영국", provider: "google", label: "Google 남성 · WaveNet", gender: "남성", voice: "en-GB-Wavenet-B" },
  { id: "uk-neural2", region: "영국", provider: "google", label: "Google 여성 · Neural2", gender: "여성", voice: "en-GB-Neural2-A" },
  { id: "uk-azure", region: "영국", provider: "azure", label: "Azure Ryan", gender: "남성", sampleUrl: "https://ai.azure.com/speechassetscache/ttsvoice/Masterpieces/en-GB-Ryan-General-Audio.wav", voice: "en-GB-RyanNeural" },
  { id: "uk-azure-female", region: "영국", provider: "azure", label: "Azure Libby", gender: "여성", sampleUrl: null, voice: "en-GB-LibbyNeural" },
  { id: "au-wavenet", region: "호주", provider: "google", label: "Google 남성 · WaveNet", gender: "남성", voice: "en-AU-Wavenet-B" },
  { id: "au-neural2", region: "호주", provider: "google", label: "Google 여성 · Neural2", gender: "여성", voice: "en-AU-Neural2-A" },
  { id: "au-azure", region: "호주", provider: "azure", label: "Azure William", gender: "남성", sampleUrl: "https://ai.azure.com/speechassetscache/ttsvoice/Masterpieces/en-AU-William-General-Audio.wav", voice: "en-AU-WilliamNeural" },
  { id: "au-azure-female", region: "호주", provider: "azure", label: "Azure Natasha", gender: "여성", sampleUrl: null, voice: "en-AU-NatashaNeural" },
] as const;
