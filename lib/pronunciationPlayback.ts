// Every pronunciation request belongs to the currently displayed word.
let scope = new AbortController();

export function getPronunciationSignal() {
  return scope.signal;
}

export function stopPronunciation() {
  scope.abort();
  scope = new AbortController();
}

export async function playPronunciationBlob(blob: Blob, signal: AbortSignal) {
  signal.throwIfAborted();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    signal.removeEventListener("abort", stop);
    audio.onended = null;
    audio.onerror = null;
    audio.onpause = null;
    URL.revokeObjectURL(url);
  };
  const stop = () => {
    audio.pause();
    audio.currentTime = 0;
    cleanup();
  };
  signal.addEventListener("abort", stop, { once: true });
  audio.onended = cleanup;
  audio.onerror = cleanup;
  audio.onpause = cleanup;
  try {
    await audio.play();
  } catch (error) {
    cleanup();
    throw error;
  }
}
