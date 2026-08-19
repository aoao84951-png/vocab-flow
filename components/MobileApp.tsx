"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, PointerEvent, ReactNode, SetStateAction } from "react";
import { supabase } from "@/app/lib/supabase";
import EnglishAccentSelector, { getSelectedEnglishVoice } from "./EnglishAccentSelector";

type Meaning = {
  pos: string;
  items: string[];
  numbered: boolean;
};

type StudyPointExample = {
  en: string;
  ko: string;
};

type StudyPointVariantMeaning = {
  pos: string;
  items: string[];
  numbered?: boolean;
};

type StudyPointVariant = {
  word: string;
  meanings: StudyPointVariantMeaning[];
  related?: string;
};

type StudyPoint = {
  category: string;
  expression: string;
  description: string;
  related: string;
  exampleEn: string;
  exampleKo: string;
  examples?: StudyPointExample[];
  variants?: StudyPointVariant[];
};

type LinkedTerm = {
  text: string;
  meaningRef?: string;
  meaningLabel?: string;
};

type RelatedWord = {
  text: string;
  meaningRef?: {
    pos: string;
    index: number;
  } | null;
};

type Word = {
  id: string;
  word: string;
  meanings: Meaning[];
  examples: { en: string; ko: string }[];
  synonyms: (string | LinkedTerm)[];
  antonyms: (string | LinkedTerm)[];
  studyPoints?: StudyPoint[];
  memorized?: boolean;
  highlightColor?: "red" | "blue" | "yellow" | "green" | "purple" | "";
  importanceStars?: 0 | 1 | 2 | 3;
  createdAt?: string;
};

type Day = {
  id: string;
  title: string;
  words: Word[];
};

type Folder = {
  id: string;
  title: string;
  desc?: string;
  folders: Folder[];
  days: Day[];
};

type StarIconProps = {
  active?: boolean;
  size?: number;
};

function StarIcon({ active = true, size = 15 }: StarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`shrink-0 transition-all ${
        active
          ? "text-[#ef4444] drop-shadow-[0_2px_5px_rgba(239,68,68,0.18)]"
          : "text-[#c7ceda]"
      }`}
    >
      <path
        d="M12 3.15 14.67 8.84 20.9 9.6 16.32 13.9 17.52 20.08 12 17.02 6.48 20.08 7.68 13.9 3.1 9.6 9.33 8.84 12 3.15Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ImportanceStarsProps = {
  count?: number;
  size?: number;
};

function ImportanceStars({ count, size = 15 }: ImportanceStarsProps) {
  const safeCount = Math.min(3, Math.max(0, count ?? 0));
  if (!safeCount) return null;

  return (
    <span className="inline-flex items-center gap-[2px]" aria-label={`중요도 ${safeCount}단계`}>
      {Array.from({ length: safeCount }).map((_, index) => (
        <StarIcon key={index} size={size} />
      ))}
    </span>
  );
}

type Book = Folder;


const applyBracketHighlightToHtml = (html: string) => {
  if (!html) return "";

  return html
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith("<") && part.endsWith(">")) return part;

      return part.replace(/\[\[(.*?)\]\]/g, '<strong class="font-bold text-[#d92d20]">$1</strong>');
    })
    .join("");
};

const cleanEditorHtml = (html: string) => {
  const cleaned = html
    .replace(/\u200B/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/<br\s*\/?>(\s*)/gi, "");

  const div = document.createElement("div");
  div.innerHTML = cleaned;

  if (!div.textContent?.trim()) return "";

  div.querySelectorAll<HTMLElement>("*").forEach((el) => {
    el.removeAttribute("class");

    const color = el.style.color;
    const backgroundColor = el.style.backgroundColor;

    el.removeAttribute("style");

    if (color) el.style.color = color;
    if (backgroundColor) el.style.backgroundColor = backgroundColor;
  });

  return div.innerHTML.trim();
};

const resetEditorIfEmpty = (el: HTMLDivElement) => {
  const normalizedText = (el.textContent ?? "").replace(/\u200B/g, "").trim();

  if (!normalizedText) {
    el.innerHTML = "";
  }
};

type MobileAccent = "EN" | "KO";

const MOBILE_TTS_CACHE_NAME = "vocab-flow-tts-cache-v2";

const normalizeMobileTtsText = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\[\[(.*?)\]\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const isSpeakableText = (value: string) => {
  const text = normalizeMobileTtsText(value);

  if (!text) return false;
  return /[A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
};

const isMobileTtsTextHit = (root: Element, clientX: number, clientY: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (node.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(node);

      if (
        Array.from(range.getClientRects()).some(
          (rect) =>
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom,
        )
      ) {
        return true;
      }
    }

    node = walker.nextNode();
  }

  return false;
};

const mobileTtsToHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const makeMobileTtsCacheKey = async (text: string, voice: string) => {
  const source = `${voice}::${text}`;

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoded = new TextEncoder().encode(source);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    return `/tts-cache/${mobileTtsToHex(hashBuffer)}.mp3`;
  }

  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(i);
    hash |= 0;
  }

  return `/tts-cache/${voice}-${Math.abs(hash)}.mp3`;
};

type MobileTtsPlayback = {
  audio: HTMLAudioElement | null;
  delayTimer: number | null;
  abortHandlers: Set<() => void>;
  cancelled: boolean;
  stop: () => void;
};

let activeMobileTtsPlayback: MobileTtsPlayback | null = null;

const createMobileTtsAbortError = () => {
  const error = new Error("발음 재생이 중지되었습니다.");
  error.name = "AbortError";
  return error;
};

const stopActiveMobileTtsPlayback = () => {
  activeMobileTtsPlayback?.stop();
};

const playMobileTtsBlob = (blob: Blob, playback: MobileTtsPlayback) =>
  new Promise<void>((resolve, reject) => {
    if (playback.cancelled) {
      reject(createMobileTtsAbortError());
      return;
    }

    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    playback.audio = audio;

    let settled = false;

    const abortAudio = () => {
      audio.pause();
      finish(() => reject(createMobileTtsAbortError()));
    };

    const cleanup = () => {
      URL.revokeObjectURL(audioUrl);
      playback.abortHandlers.delete(abortAudio);
      if (playback.audio === audio) playback.audio = null;
    };

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    playback.abortHandlers.add(abortAudio);

    audio.onended = () => {
      finish(resolve);
    };

    audio.onerror = () => {
      finish(() => reject(new Error("오디오 재생에 실패했습니다.")));
    };

    void audio.play().catch((error) => {
      finish(() => reject(error));
    });

    if (playback.cancelled) {
      abortAudio();
    }
  });

const fetchMobileTtsAudio = async (text: string, voice: string) => {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    throw new Error("TTS 요청에 실패했습니다.");
  }

  return response.blob();
};

const getMobileCachedTtsAudio = async (cacheKey: string) => {
  if (typeof window === "undefined" || !("caches" in window)) {
    return null;
  }

  const cache = await caches.open(MOBILE_TTS_CACHE_NAME);
  const cachedResponse = await cache.match(cacheKey);

  if (!cachedResponse) return null;

  return cachedResponse.blob();
};

const saveMobileTtsAudioToCache = async (cacheKey: string, blob: Blob) => {
  if (typeof window === "undefined" || !("caches" in window)) {
    return;
  }

  const cache = await caches.open(MOBILE_TTS_CACHE_NAME);
  await cache.put(
    cacheKey,
    new Response(blob, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    })
  );
};

function MobilePronounceButton({
  text,
  children,
  className = "",
}: {
  text: string;
  children?: ReactNode;
  className?: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<MobileTtsPlayback | null>(null);
  const cleanedText = normalizeMobileTtsText(text);

  useEffect(() => {
    return () => {
      playbackRef.current?.stop();
    };
  }, []);

  if (!isSpeakableText(cleanedText)) return null;

  const loadAccentAudio = async (accent: MobileAccent, playback: MobileTtsPlayback) => {
    if (playback.cancelled) throw createMobileTtsAbortError();

    const voice = accent === "KO" ? "ko-KR-Wavenet-A" : getSelectedEnglishVoice();
    const cacheKey = await makeMobileTtsCacheKey(cleanedText, voice);
    const cachedAudio = await getMobileCachedTtsAudio(cacheKey);

    if (playback.cancelled) throw createMobileTtsAbortError();

    if (cachedAudio) {
      return cachedAudio;
    }

    const audioBlob = await fetchMobileTtsAudio(cleanedText, voice);

    if (playback.cancelled) throw createMobileTtsAbortError();

    await saveMobileTtsAudioToCache(cacheKey, audioBlob);
    return audioBlob;
  };

  const playPronunciation = async () => {
    if (playbackRef.current && !playbackRef.current.cancelled) {
      playbackRef.current.stop();
      return;
    }

    stopActiveMobileTtsPlayback();

    const playback: MobileTtsPlayback = {
      audio: null,
      delayTimer: null,
      abortHandlers: new Set(),
      cancelled: false,
      stop: () => {
        if (playback.cancelled) return;

        playback.cancelled = true;
        playback.abortHandlers.forEach((abort) => abort());
        playback.abortHandlers.clear();
        playback.audio?.pause();
        playback.audio = null;

        if (playback.delayTimer) {
          window.clearTimeout(playback.delayTimer);
          playback.delayTimer = null;
        }

        if (playbackRef.current === playback) {
          playbackRef.current = null;
          setIsPlaying(false);
        }

        if (activeMobileTtsPlayback === playback) {
          activeMobileTtsPlayback = null;
        }
      },
    };

    playbackRef.current = playback;
    activeMobileTtsPlayback = playback;

    try {
      setIsPlaying(true);
      const accent: MobileAccent = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(cleanedText) ? "KO" : "EN";
      const audioBlob = await loadAccentAudio(accent, playback);

      if (playback.cancelled) throw createMobileTtsAbortError();

      await playMobileTtsBlob(audioBlob, playback);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error(error);
        alert("발음 오디오를 불러오지 못했습니다.");
      }
    } finally {
      if (playbackRef.current === playback) {
        playbackRef.current = null;
        setIsPlaying(false);
      }

      if (activeMobileTtsPlayback === playback) {
        activeMobileTtsPlayback = null;
      }
    }
  };

  return (
    <span
      role="button"
      data-tts-trigger="true"
      tabIndex={0}
      title={isPlaying ? "발음 멈추기" : "눌러서 듣기"}
      aria-label={isPlaying ? `${cleanedText} 발음 멈추기` : `${cleanedText} 듣기`}
      onClick={(e) => {
        if (!isMobileTtsTextHit(e.currentTarget, e.clientX, e.clientY)) return;
        e.stopPropagation();
        void playPronunciation();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        void playPronunciation();
      }}
      className={`inline-block cursor-pointer ${isPlaying ? "opacity-60" : ""} ${className}`}
    >
      {children ?? cleanedText}
    </span>
  );
}


export default function MobileApp() {
  const [books, setBooks] = useState<Book[]>([]);
  const [step, setStep] = useState<
    | "book"
    | "day"
    | "wordList"
    | "study"
    | "addBook"
    | "editBook"
    | "addFolder"
    | "addDay"
    | "editDay"
    | "moveDay"
    | "addWord"
    | "editWord"
    | "editFolder"
    | "moveFolder"
  >("book");

  const [selectedBookId, setSelectedBookId] = useState("");
  const [folderPath, setFolderPath] = useState<string[]>([]);
  const [selectedDayId, setSelectedDayId] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookDropdownOpen, setBookDropdownOpen] = useState(false);
  const [menuExpandedFolderIds, setMenuExpandedFolderIds] = useState<string[]>([]);
  const [actionWordIndex, setActionWordIndex] = useState<number | null>(null);
  const [actionDayId, setActionDayId] = useState<string | null>(null);
  const [actionFolderId, setActionFolderId] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const [swipedIndex, setSwipedIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const studyTapStart = useRef<{ x: number; y: number } | null>(null);
  const studySwipeStart = useRef<{ x: number; y: number; width: number; pointerId: number } | null>(null);
  const studySwipeWidth = useRef(0);
  const studySwipeMoved = useRef(false);
  const studySwipeDirection = useRef<"horizontal" | "vertical" | null>(null);
  const studySwipeLastPoint = useRef<{ x: number; time: number } | null>(null);
  const studySwipeVelocityX = useRef(0);
  const [studySwipeDragX, setStudySwipeDragX] = useState(0);
  const studySwipeDragXRef = useRef(0);
  const [studySwipeAnimating, setStudySwipeAnimating] = useState(false);
  const folderLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressFolder = useRef(false);
  const dayLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressDay = useRef(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [wordSortOrder, setWordSortOrder] = useState<"latest" | "oldest">("oldest");
  const [wordViewMode, setWordViewMode] = useState<"all" | "unmemorized">("all");
  const [showListMeanings, setShowListMeanings] = useState(true);

  const SWIPE_WIDTH = 145;

  const getSwipeX = (index: number) => {
    if (draggingIndex === index) return Math.max(0, Math.min(dragX, SWIPE_WIDTH));
    return swipedIndex === index ? SWIPE_WIDTH : 0;
  };

  const isHistoryMoving = useRef(false);
  const isFirstHistoryState = useRef(true);

  const getCurrentFolder = (
    folders: Folder[],
    path: string[]
  ): Folder | undefined => {
    let current: Folder | undefined;
  
    for (const id of path) {
      const list = current ? current.folders : folders;
      current = list.find((folder) => folder.id === id);
  
      if (!current) return undefined;
    }
  
    return current;
  };
  
  const activeFolder = getCurrentFolder(books, folderPath);
  const selectedBook = books.find((book) => book.id === selectedBookId);
  const currentFolderTitle = activeFolder?.title || selectedBook?.title || "";
  const selectedDay = activeFolder?.days.find((day) => day.id === selectedDayId);
  const words = selectedDay?.words ?? [];
  const currentWord = words[wordIndex];

  const sortedWords = selectedDay
  ? selectedDay.words
      .map((word, originalIndex) => ({ word, originalIndex }))
      .sort((a, b) => {
        if (wordSortOrder === "oldest") return a.originalIndex - b.originalIndex;
        return b.originalIndex - a.originalIndex;
      })
  : [];

  const visibleSortedWords = sortedWords.filter(({ word }) =>
    wordViewMode === "all" ? true : !word.memorized
  );


  const studyIndexes = words
    .map((word, originalIndex) => ({ word, originalIndex }))
    .filter(({ word }) => (wordViewMode === "all" ? true : !word.memorized));

  useEffect(() => {
    // A browser history entry represents a screen in the app hierarchy, not
    // every word viewed while staying on the study screen.
    const navigationKey = JSON.stringify({
      step,
      selectedBookId,
      folderPath,
      selectedDayId,
    });
    const state = {
      step,
      selectedBookId,
      folderPath,
      selectedDayId,
      wordIndex,
      navigationKey,
    };
  
    if (isHistoryMoving.current) {
      isHistoryMoving.current = false;
      return;
    }
  
    if (isFirstHistoryState.current) {
      window.history.replaceState(state, "", window.location.href);
      isFirstHistoryState.current = false;
      return;
    }

    if (window.history.state?.navigationKey === navigationKey) {
      window.history.replaceState(state, "", window.location.href);
      return;
    }

    window.history.pushState(state, "", window.location.href);
  }, [step, selectedBookId, folderPath, selectedDayId, wordIndex]);
  
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
  
      if (!state) return;
  
      isHistoryMoving.current = true;
  
      setStep(state.step);
      setSelectedBookId(state.selectedBookId || "");
      setFolderPath(state.folderPath || []);
      setSelectedDayId(state.selectedDayId || "");
      setWordIndex(state.wordIndex || 0);
      setShowMeaning(false);
      setMenuOpen(false);
      setBookDropdownOpen(false);
      setActionWordIndex(null);
      setActionDayId(null);
    };
  
    window.addEventListener("popstate", handlePopState);
  
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const savedState = sessionStorage.getItem("vocab-flow-state");
  
    if (savedState) {
      const parsed = JSON.parse(savedState);
  
      setStep(parsed.step || "book");
      setSelectedBookId(parsed.selectedBookId || "");
      setFolderPath(parsed.folderPath || []);
      setSelectedDayId(parsed.selectedDayId || "");
      setWordIndex(parsed.wordIndex || 0);
    }
  
    fetchBooks();
  }, []);
  
  useEffect(() => {
    sessionStorage.setItem(
      "vocab-flow-state",
      JSON.stringify({
        step,
        selectedBookId,
        folderPath,
        selectedDayId,
        wordIndex,
      })
    );
  }, [step, selectedBookId, folderPath, selectedDayId, wordIndex]);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  
    setIsStandalone(standalone);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevHtmlOverscrollY = html.style.overscrollBehaviorY;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevBodyOverscrollY = body.style.overscrollBehaviorY;

    let startY = 0;

    const getScrollableParent = (target: EventTarget | null) => {
      let element = target instanceof Element ? target : null;

      while (element && element !== body && element !== html) {
        const style = window.getComputedStyle(element);
        const overflowY = style.overflowY;
        const canScrollY =
          (overflowY === "auto" || overflowY === "scroll") &&
          element.scrollHeight > element.clientHeight;

        if (canScrollY) return element;

        element = element.parentElement;
      }

      const pageScroller = document.scrollingElement as HTMLElement | null;
      if (pageScroller && pageScroller.scrollHeight > pageScroller.clientHeight) {
        return pageScroller;
      }

      return null;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      startY = event.touches[0].clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;

      const currentY = event.touches[0].clientY;
      const deltaY = currentY - startY;
      const scrollable = getScrollableParent(event.target);

      if (!scrollable) {
        return;
      }

      const atTop = scrollable.scrollTop <= 0;
      const atBottom =
        scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;

      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        event.preventDefault();
      }
    };

    html.style.overscrollBehavior = "none";
    html.style.overscrollBehaviorY = "none";
    body.style.overscrollBehavior = "none";
    body.style.overscrollBehaviorY = "none";

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      html.style.overscrollBehavior = prevHtmlOverscroll;
      html.style.overscrollBehaviorY = prevHtmlOverscrollY;
      body.style.overscrollBehavior = prevBodyOverscroll;
      body.style.overscrollBehaviorY = prevBodyOverscrollY;
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);
  
  function normalizeFolders(folders: any[]): Folder[] {
    return (folders || []).map((folder) => ({
      id: folder.id || crypto.randomUUID(),
      title: folder.title || "",
      desc: folder.desc || "",
      folders: normalizeFolders(folder.folders || []),
      days: folder.days || [],
    }));
  }

  async function fetchBooks() {
    const { data, error } = await supabase
      .from("vocab_data")
      .select("*")
      .limit(1)
      .maybeSingle();
  
    if (error) {
      console.error(error);
      return;
    }
  
    if (data?.data) {
      setBooks(normalizeFolders(data.data));
    }
  }
  
  async function saveBooks(
    next: Book[] | ((prev: Book[]) => Book[])
  ) {
    const nextBooks =
      typeof next === "function" ? next(books) : next;
  
    setBooks(nextBooks);
  
    const { data: existing, error: selectError } = await supabase
      .from("vocab_data")
      .select("id")
      .limit(1)
      .maybeSingle();
  
    if (selectError) {
      console.error(selectError);
      return;
    }
  
    if (existing?.id) {
      const { error } = await supabase
        .from("vocab_data")
        .update({ data: nextBooks })
        .eq("id", existing.id);
  
      if (error) console.error(error);
    } else {
      const { error } = await supabase
        .from("vocab_data")
        .insert({ data: nextBooks });
  
      if (error) console.error(error);
    }
  }

  const goHome = () => {
    setSelectedBookId("");
    setFolderPath([]);
    setSelectedDayId("");
    setWordIndex(0);
    setShowMeaning(false);
    setMenuOpen(false);
    setBookDropdownOpen(false);
    setActionWordIndex(null);
    setActionDayId(null);
    setStep("book");
  };

  const goDay = (book: Book) => {
    setSelectedBookId(book.id);
    setFolderPath([book.id]);
    setSelectedDayId("");
    setWordIndex(0);
    setShowMeaning(false);
    setBookDropdownOpen(false);
    setMenuOpen(false);
    setStep("day");
  };

  const goWordList = (dayId: string) => {
    setSelectedDayId(dayId);
    setWordIndex(0);
    setShowMeaning(false);
    setMenuOpen(false);
    setBookDropdownOpen(false);
    setActionWordIndex(null);
    setActionDayId(null);
    setStep("wordList");
  };


  const goBackFromDay = () => {
    setSelectedDayId("");
    setWordIndex(0);
    setShowMeaning(false);
    setMenuOpen(false);
    setBookDropdownOpen(false);
    setActionWordIndex(null);
    setActionDayId(null);

    if (folderPath.length > 2) {
      setFolderPath((prev) => prev.slice(0, -1));
      setStep("day");
      return;
    }

    goHome();
  };

  const startStudy = (index: number) => {
    setWordIndex(index);
    setShowMeaning(false);
    setActionWordIndex(null);
    setStep("study");
  };

  const nextWord = () => {
    const currentPos = visibleSortedWords.findIndex((item) => item.originalIndex === wordIndex);
    const safePos = currentPos === -1 ? 0 : currentPos;
    const next = visibleSortedWords[Math.min(safePos + 1, visibleSortedWords.length - 1)];

    if (next) setWordIndex(next.originalIndex);
  };

  const prevWord = () => {
    const currentPos = visibleSortedWords.findIndex((item) => item.originalIndex === wordIndex);
    const safePos = currentPos === -1 ? 0 : currentPos;
    const prev = visibleSortedWords[Math.max(safePos - 1, 0)];

    if (prev) setWordIndex(prev.originalIndex);
  };

  const getAdjacentStudyWord = (direction: "prev" | "next") => {
    const currentPos = visibleSortedWords.findIndex((item) => item.originalIndex === wordIndex);
    if (currentPos === -1) return null;

    const adjacentPos = direction === "prev" ? currentPos - 1 : currentPos + 1;
    if (adjacentPos < 0 || adjacentPos >= visibleSortedWords.length) return null;

    return visibleSortedWords[adjacentPos];
  };

  const updateStudySwipeDragX = (value: number) => {
    studySwipeDragXRef.current = value;
    setStudySwipeDragX(value);
  };

  const resetStudySwipeState = () => {
    studyTapStart.current = null;
    studySwipeStart.current = null;
    studySwipeMoved.current = false;
    studySwipeDirection.current = null;
    studySwipeLastPoint.current = null;
    studySwipeVelocityX.current = 0;
  };

  const handleStudyPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const ttsTrigger = target.closest("[data-tts-trigger='true']");

    if (
      (ttsTrigger && isMobileTtsTextHit(ttsTrigger, e.clientX, e.clientY)) ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("select")
    ) {
      resetStudySwipeState();
      return;
    }

    const width = e.currentTarget.getBoundingClientRect().width;

    studyTapStart.current = { x: e.clientX, y: e.clientY };
    studySwipeWidth.current = width;
    studySwipeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width,
      pointerId: e.pointerId,
    };
    studySwipeMoved.current = false;
    studySwipeDirection.current = null;
    studySwipeLastPoint.current = { x: e.clientX, time: performance.now() };
    studySwipeVelocityX.current = 0;
    setStudySwipeAnimating(false);
  };

  const handleStudyPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!studySwipeStart.current || e.pointerId !== studySwipeStart.current.pointerId) return;

    const deltaX = e.clientX - studySwipeStart.current.x;
    const deltaY = e.clientY - studySwipeStart.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const now = performance.now();
    const lastPoint = studySwipeLastPoint.current;

    if (lastPoint) {
      const elapsed = Math.max(1, now - lastPoint.time);
      studySwipeVelocityX.current = (e.clientX - lastPoint.x) / elapsed;
    }
    studySwipeLastPoint.current = { x: e.clientX, time: now };

    if (!studySwipeDirection.current) {
      if (absX < 8 && absY < 8) return;

      if (absX >= 10 && absX > absY * 1.15) {
        studySwipeDirection.current = "horizontal";
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      } else if (absY >= 8 && absY > absX * 0.85) {
        studySwipeDirection.current = "vertical";
        updateStudySwipeDragX(0);
        return;
      } else {
        return;
      }
    }

    if (studySwipeDirection.current !== "horizontal") return;

    e.preventDefault();
    e.stopPropagation();

    const hasPrev = Boolean(getAdjacentStudyWord("prev"));
    const hasNext = Boolean(getAdjacentStudyWord("next"));
    const limitedDeltaX = Math.max(
      -studySwipeStart.current.width,
      Math.min(deltaX, studySwipeStart.current.width)
    );

    if ((limitedDeltaX > 0 && !hasPrev) || (limitedDeltaX < 0 && !hasNext)) {
      updateStudySwipeDragX(limitedDeltaX * 0.14);
    } else {
      updateStudySwipeDragX(limitedDeltaX);
    }

    studySwipeMoved.current = true;
  };
  
  const handleStudyPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!studyTapStart.current) return;
  
    const movedX = Math.abs(e.clientX - studyTapStart.current.x);
    const movedY = Math.abs(e.clientY - studyTapStart.current.y);

    if (
      studySwipeMoved.current &&
      studySwipeStart.current &&
      studySwipeDirection.current === "horizontal"
    ) {
      const width = studySwipeStart.current.width;
      const threshold = Math.max(46, width * 0.16);
      const dragX = studySwipeDragXRef.current;
      const velocityX = studySwipeVelocityX.current;
      const direction = dragX > 0 ? "prev" : "next";
      const isFastSwipe = Math.abs(velocityX) >= 0.45 && Math.sign(velocityX) === Math.sign(dragX);
      const adjacent = getAdjacentStudyWord(direction);

      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      resetStudySwipeState();
      setStudySwipeAnimating(true);

      if (adjacent && (Math.abs(dragX) >= threshold || isFastSwipe)) {
        updateStudySwipeDragX(direction === "prev" ? width : -width);
        window.setTimeout(() => {
          setStudySwipeAnimating(false);
          updateStudySwipeDragX(0);
          setWordIndex(adjacent.originalIndex);
        }, 260);
      } else {
        updateStudySwipeDragX(0);
        window.setTimeout(() => {
          setStudySwipeAnimating(false);
        }, 260);
      }

      return;
    }
  
    if (movedX > 10 || movedY > 10) {
      resetStudySwipeState();
      updateStudySwipeDragX(0);
      return;
    }
  
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
  
    if (y < 58) {
      resetStudySwipeState();
      return;
    }
  
    const third = rect.width / 3;
  
    if (x < third) {
      prevWord();
    } else if (x > third * 2) {
      nextWord();
    } else {
      setShowMeaning((prev) => !prev);
    }
  
    resetStudySwipeState();
  };

  const handleStudyPointerCancel = (e?: PointerEvent<HTMLDivElement>) => {
    if (e && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    resetStudySwipeState();
    setStudySwipeAnimating(true);
    updateStudySwipeDragX(0);
    window.setTimeout(() => setStudySwipeAnimating(false), 260);
  };

  const renderStudyPane = (displayWord: Word, displayWordIndex: number) => (
    <>
                <section
                  className={`relative mt-3 flex h-[155px] shrink-0 items-center justify-center rounded-[22px] border ${
                    displayWord.importanceStars
                      ? "border-[#b9c9ed] bg-[#f8fbff] shadow-[0_8px_22px_rgba(15,42,95,0.12)]"
                      : "border-[#dce2ee] bg-white"
                  }`}
                >
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleImportant(displayWordIndex);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90"
                    aria-label={`중요도 ${displayWord.importanceStars ?? 0}단계`}
                    title="누를 때마다 중요도 1 → 2 → 3 → 해제로 변경"
                  >
                    <span className="relative flex h-7 w-7 items-center justify-center">
                      <StarIcon active={Boolean(displayWord.importanceStars)} size={22} />
                      {displayWord.importanceStars ? (
                        <span className="absolute -right-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#0f2a5f] px-[3px] text-[8px] font-black leading-none text-white">
                          {displayWord.importanceStars}
                        </span>
                      ) : null}
                    </span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMemorized(displayWordIndex);
                    }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                      displayWord.memorized
                        ? "border-[#0f2a5f] bg-[#0f2a5f] shadow-[0_6px_14px_rgba(15,42,95,0.22)]"
                        : "border-[#dce2ee] bg-[#f8fafc]"
                    }`}
                    aria-label="암기완료"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5.5 12.5L10 17L18.8 7.5"
                        stroke={displayWord.memorized ? "white" : "#9aa3b2"}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                <MobilePronounceButton
                  text={displayWord.word}
                  className={`w-full min-w-0 px-6 text-center font-bold leading-tight tracking-tight ${
                    displayWord.word.includes(" ")
                      ? "break-words text-[34px]"
                      : displayWord.word.length >= 18
                      ? "whitespace-nowrap text-[clamp(26px,8.2vw,34px)]"
                      : displayWord.word.length >= 13
                      ? "whitespace-nowrap text-[clamp(32px,9.6vw,40px)]"
                      : "whitespace-nowrap text-[44px]"
                  } ${
                    displayWord.memorized
                      ? "text-[#b0b7c3]"
                      : "text-[#0f2a5f]"
                  }`}
                >
                  {displayWord.word}
                </MobilePronounceButton>
                </section>

                <section
                  className={`relative z-[2] mt-4 min-h-0 flex-1 overflow-hidden transition-opacity duration-200 ${
                    showMeaning
                      ? displayWord.memorized
                        ? "pointer-events-auto opacity-45"
                        : "pointer-events-auto opacity-100"
                      : "pointer-events-none opacity-0"
                  }`}
                >
                  <div
                    className="h-full overflow-y-auto overscroll-contain px-3 pb-4 [touch-action:pan-y]"
                  >
                    <div className="py-4">
                      <div className="flex flex-col items-center gap-2">
                        {displayWord.meanings.map((group) => {
                          const shouldCenterStackedNumberedMeanings =
                            group.numbered &&
                            group.items.length > 1 &&
                            group.items.join("").length >= 38;

                          return shouldCenterStackedNumberedMeanings ? (
                            <div
                              key={`${group.pos}-${group.items.join("")}`}
                              className="flex w-full justify-center"
                            >
                              <div className="grid w-fit max-w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-[7px]">
                                <span className="mt-[2px] inline-flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-[5px] bg-[#0f2a5f] text-[11px] font-bold text-white">
                                  {group.pos}
                                </span>

                                <div className="relative -top-[2px] flex min-w-0 justify-center">
                                  <div className="inline-flex max-w-full flex-col items-start gap-y-1 text-left">
                                    {group.items.map((item, index) => (
                                      <span
                                        key={`${item}-${index}`}
                                        className="inline-flex max-w-full items-start gap-[3px]"
                                      >
                                        <span className="mt-[4px] inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-[#9aa3b2] text-[9px] font-bold text-white">
                                          {index + 1}
                                        </span>
                                        <MobilePronounceButton text={item} className="min-w-0 break-keep">
                                          {item}
                                        </MobilePronounceButton>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              key={`${group.pos}-${group.items.join("")}`}
                              className="w-full max-w-full text-center"
                            >
                              <span className="mr-[7px] inline-flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-[5px] bg-[#0f2a5f] text-[11px] font-bold text-white align-top">
                                {group.pos}
                              </span>

                              {group.numbered ? (
                                <span className="relative -top-[2px] inline max-w-full">
                                  {group.items.map((item, index) => (
                                    <span
                                      key={`${item}-${index}`}
                                      className="mr-[7px] inline-flex max-w-full items-start gap-[3px] text-left align-top last:mr-0"
                                    >
                                      <span className="mt-[4px] inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-[#9aa3b2] text-[9px] font-bold text-white">
                                        {index + 1}
                                      </span>
                                      <MobilePronounceButton text={item} className="min-w-0 break-keep">
                                        {item}
                                      </MobilePronounceButton>
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <MobilePronounceButton text={group.items.join(", ")} className="relative -top-[2px] inline break-keep text-center">
                                  {group.items.join(", ")}
                                </MobilePronounceButton>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {(displayWord.examples.length > 0 ||
                      displayWord.synonyms.length > 0 ||
                      displayWord.antonyms.length > 0 ||
                      (displayWord.studyPoints ?? []).length > 0) && (
                      <div className="mx-1 border-t border-[#e6ebf3]" />
                    )}

                    {displayWord.examples.length > 0 && (
                      <Block title="예문">
                        <div className="max-h-[190px] space-y-3 overflow-y-auto pr-1">
                          {displayWord.examples.map((ex, i) => (
                            <div key={`${ex.en}-${i}`} className="pl-[2px]">
                              {ex.en && (
                                <div className="flex items-start gap-2">
                                  <MobilePronounceButton text={ex.en} className="min-w-0 flex-1 text-[14px] leading-relaxed">
                                    <HighlightedText text={ex.en} keyword={displayWord.word} />
                                  </MobilePronounceButton>
                                </div>
                              )}
                              {ex.ko && (
                                <MobilePronounceButton text={ex.ko} className="mt-0.5 block text-[12px] leading-relaxed text-[#8a94a6]">
                                  {ex.ko}
                                </MobilePronounceButton>
                              )}
                            </div>
                          ))}
                        </div>
                      </Block>
                    )}

                    {displayWord.synonyms.length > 0 && (
                      <Block title="동의어">
                        <ChipList items={displayWord.synonyms} meanings={displayWord.meanings} />
                      </Block>
                    )}

                    {displayWord.antonyms.length > 0 && (
                      <Block title="반의어">
                        <ChipList items={displayWord.antonyms} meanings={displayWord.meanings} tone="red" />
                      </Block>
                    )}
                    {(displayWord.studyPoints ?? []).length > 0 && (
                      <Block>
                        <div className="space-y-3">
                          {(displayWord.studyPoints ?? []).map((point, index) => (
                            <div key={index} className="rounded-2xl bg-[#f5f6fa] px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-[#e7ecf5] px-2 py-1 text-[11px] font-bold text-[#0f2a5f]">
                                  {point.category}
                                </span>

                                {point.expression && (
                                    <MobilePronounceButton text={point.expression} className="text-[14px] font-bold text-[#111827]">
                                      <HighlightedText text={point.expression} keyword="" />
                                    </MobilePronounceButton>
                                )}
                              </div>

                              {point.description && (
                                <MobilePronounceButton text={point.description} className="mt-2 block pl-[7px] whitespace-pre-wrap text-[13px] leading-relaxed text-[#596275]">
                                  <span dangerouslySetInnerHTML={{ __html: applyBracketHighlightToHtml(point.description) }} />
                                </MobilePronounceButton>
                              )}

                              {(point.variants ?? []).length > 0 && (
                                <div className="mt-3 ml-[0px] space-y-2">
                                  {(point.variants ?? []).map((variant, variantIndex) => (
                                    <div
                                      key={`${variant.word}-${variantIndex}`}
                                      className="rounded-xl border border-[#e4e8f0] bg-white px-3 py-2"
                                    >
                                      {variant.word && (
                                        <div className="mb-1.5 flex items-center gap-2">
                                          <MobilePronounceButton text={variant.word} className="min-w-0 flex-1 text-[14px] font-bold text-[#111827]">
                                            <HighlightedText text={variant.word} keyword="" />
                                          </MobilePronounceButton>
                                        </div>
                                      )}

                                      <div className="space-y-1">
                                        {(variant.meanings ?? []).map((meaning, meaningIndex) => (
                                          <div
                                            key={`${meaning.pos}-${meaningIndex}`}
                                            className="flex items-start gap-1.5"
                                          >
                                            <span className="mt-[1px] inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-[4px] bg-[#0f2a5f] text-[9px] font-bold text-white">
                                              {meaning.pos}
                                            </span>

                                            <div className="mt-[0.6px] min-w-0 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[12px] leading-[1.5] text-[#596275]">
                                              {(meaning.items ?? []).map((item, itemIndex) => (
                                                <span
                                                  key={`${item}-${itemIndex}`}
                                                  className="inline-flex items-center gap-0.5"
                                                >
                                                  {meaning.numbered && (
                                                    <span className="inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#9aa3b2] px-[3px] text-[8px] font-bold text-white">
                                                      {itemIndex + 1}
                                                    </span>
                                                  )}
                                                  <MobilePronounceButton text={item}>
                                                    <HighlightedText text={item} keyword="" />
                                                  </MobilePronounceButton>
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      {variant.related && (
                                        <div className="mt-2 flex items-baseline gap-1.5 pl-[1px]">
                                          <span className="text-[13px] font-bold leading-none text-[#4b6cb7]">
                                            =
                                          </span>

                                          <MobilePronounceButton text={variant.related} className="relative -top-[3px] min-w-0 text-[12px] font-bold leading-[1.5] tracking-[-0.01em] text-[#4b6cb7]">
                                            <HighlightedText text={variant.related} keyword="" />
                                          </MobilePronounceButton>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {(() => {
                                const pointExamples =
                                  point.examples?.length
                                    ? point.examples
                                    : point.exampleEn || point.exampleKo
                                    ? [{ en: point.exampleEn, ko: point.exampleKo }]
                                    : [];

                                if (pointExamples.length === 0) return null;

                                return (
                                  <div className="mt-3 ml-[6px] space-y-3">
                                    {pointExamples.map((example, exampleIndex) => (
                                      <div
                                        key={`${example.en}-${exampleIndex}`}
                                        className="border-l-2 border-[#d7ddea] pl-3"
                                      >
                                        {example.en && (
                                          <div className="flex items-start gap-2">
                                            <MobilePronounceButton text={example.en} className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#596275]">
                                            <span
                                              className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#596275]"
                                              dangerouslySetInnerHTML={{ __html: applyBracketHighlightToHtml(example.en) }}
                                            />
                                            </MobilePronounceButton>
                                          </div>
                                        )}

                                        {example.ko && (
                                          <MobilePronounceButton
                                            text={example.ko}
                                            className={`${example.en ? "mt-1" : ""} block text-[12px] leading-relaxed text-[#8a94a6]`}
                                          >
                                            <HighlightedText text={example.ko} keyword="" />
                                          </MobilePronounceButton>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      </Block>
                    )}
                  </div>
                </section>
    </>
  );

  const deleteWord = (targetIndex: number) => {
    if (!confirm("이 단어를 삭제할까?")) return;
  
    saveBooks((prev) =>
      deleteWordFromPath(prev, folderPath, selectedDayId, targetIndex)
    );
  
    setWordIndex(0);
    setShowMeaning(false);
    setActionWordIndex(null);
    setStep("wordList");
  };

  const toggleMemorized = (targetIndex: number) => {
    saveBooks((prev) =>
      updateWordInPath(prev, folderPath, selectedDayId, targetIndex, (word) => ({
        ...word,
        memorized: !word.memorized,
      }))
    );
  };

  const toggleImportant = (targetIndex: number) => {
    saveBooks((prev) =>
      updateWordInPath(prev, folderPath, selectedDayId, targetIndex, (word) => {
        const current = Math.min(3, Math.max(0, word.importanceStars ?? 0));
        const next = current >= 3 ? 0 : ((current + 1) as 1 | 2 | 3);

        return {
          ...word,
          importanceStars: next,
        };
      })
    );
  };

  const changeWordColor = (
    targetIndex: number,
    color: Word["highlightColor"]
  ) => {
    saveBooks((prev) =>
      updateWordInPath(prev, folderPath, selectedDayId, targetIndex, (word) => ({
        ...word,
        highlightColor: word.highlightColor === color ? "" : color,
      }))
    );
  
    setSwipedIndex(null);
  };

  const deleteDay = (targetDayId: string) => {
    if (!confirm("이 Day를 삭제할까? 안에 있는 단어도 같이 삭제돼.")) return;
  
    saveBooks((prev) =>
      deleteDayFromPath(prev, folderPath, targetDayId)
    );
  
    if (selectedDayId === targetDayId) {
      setSelectedDayId("");
      setWordIndex(0);
      setShowMeaning(false);
      setStep("day");
    }
  
    setActionDayId(null);
  };

  const addFolderToPath = (
    folders: Folder[],
    path: string[],
    newFolder: Folder
  ): Folder[] => {
    if (path.length === 0) return [...folders, newFolder];
  
    return folders.map((folder) =>
      folder.id === path[0]
        ? {
            ...folder,
            folders: addFolderToPath(
              folder.folders,
              path.slice(1),
              newFolder
            ),
          }
        : folder
    );
  };
  
  const addDayToPath = (
    folders: Folder[],
    path: string[],
    newDay: Day
  ): Folder[] => {
    return folders.map((folder) =>
      folder.id === path[0]
        ? path.length === 1
          ? {
              ...folder,
              days: [...folder.days, newDay],
            }
          : {
              ...folder,
              folders: addDayToPath(
                folder.folders,
                path.slice(1),
                newDay
              ),
            }
        : folder
    );
  };

  const addWordToPath = (
    folders: Folder[],
    path: string[],
    dayId: string,
    newWord: Word
  ): Folder[] => {
    return folders.map((folder) =>
      folder.id === path[0]
        ? path.length === 1
          ? {
              ...folder,
              days: folder.days.map((day) =>
                day.id === dayId
                  ? { ...day, words: [...day.words, newWord] }
                  : day
              ),
            }
          : {
              ...folder,
              folders: addWordToPath(
                folder.folders,
                path.slice(1),
                dayId,
                newWord
              ),
            }
        : folder
    );
  };

  const deleteWordFromPath = (
    folders: Folder[],
    path: string[],
    dayId: string,
    targetIndex: number
  ): Folder[] => {
    return folders.map((folder) =>
      folder.id === path[0]
        ? path.length === 1
          ? {
              ...folder,
              days: folder.days.map((day) =>
                day.id === dayId
                  ? { ...day, words: day.words.filter((_, i) => i !== targetIndex) }
                  : day
              ),
            }
          : {
              ...folder,
              folders: deleteWordFromPath(folder.folders, path.slice(1), dayId, targetIndex),
            }
        : folder
    );
  };

  const updateWordInPath = (
    folders: Folder[],
    path: string[],
    dayId: string,
    targetIndex: number,
    updater: (word: Word) => Word
  ): Folder[] => {
    return folders.map((folder) =>
      folder.id === path[0]
        ? path.length === 1
          ? {
              ...folder,
              days: folder.days.map((day) =>
                day.id === dayId
                  ? {
                      ...day,
                      words: day.words.map((word, i) =>
                        i === targetIndex ? updater(word) : word
                      ),
                    }
                  : day
              ),
            }
          : {
              ...folder,
              folders: updateWordInPath(folder.folders, path.slice(1), dayId, targetIndex, updater),
            }
        : folder
    );
  };

  const deleteDayFromPath = (
    folders: Folder[],
    path: string[],
    targetDayId: string
  ): Folder[] => {
    return folders.map((folder) =>
      folder.id === path[0]
        ? path.length === 1
          ? {
              ...folder,
              days: folder.days.filter((day) => day.id !== targetDayId),
            }
          : {
              ...folder,
              folders: deleteDayFromPath(folder.folders, path.slice(1), targetDayId),
            }
        : folder
    );
  };

  const editDayTitleFromPath = (
    folders: Folder[],
    path: string[],
    targetDayId: string,
    title: string
  ): Folder[] => {
    return folders.map((folder) =>
      folder.id === path[0]
        ? path.length === 1
          ? {
              ...folder,
              days: folder.days.map((day) =>
                day.id === targetDayId ? { ...day, title } : day
              ),
            }
          : {
              ...folder,
              folders: editDayTitleFromPath(
                folder.folders,
                path.slice(1),
                targetDayId,
                title
              ),
            }
        : folder
    );
  };

  const deleteFolderFromPath = (
    folders: Folder[],
    targetFolderId: string
  ): Folder[] => {
    return folders
      .filter((folder) => folder.id !== targetFolderId)
      .map((folder) => ({
        ...folder,
        folders: deleteFolderFromPath(
          folder.folders,
          targetFolderId
        ),
      }));
  };

  const editFolderInPath = (
    folders: Folder[],
    targetFolderId: string,
    updater: (folder: Folder) => Folder
  ): Folder[] => {
    return folders.map((folder) =>
      folder.id === targetFolderId
        ? updater(folder)
        : {
            ...folder,
            folders: editFolderInPath(folder.folders, targetFolderId, updater),
          }
    );
  };
  
  const findFolderById = (
    folders: Folder[],
    targetFolderId: string
  ): Folder | undefined => {
    for (const folder of folders) {
      if (folder.id === targetFolderId) return folder;
  
      const found = findFolderById(folder.folders, targetFolderId);
      if (found) return found;
    }
  
    return undefined;
  };

  const findFolderPathById = (
    folders: Folder[],
    targetFolderId: string,
    path: string[] = []
  ): string[] | null => {
    for (const folder of folders) {
      const nextPath = [...path, folder.id];
  
      if (folder.id === targetFolderId) return nextPath;
  
      const found = findFolderPathById(folder.folders, targetFolderId, nextPath);
      if (found) return found;
    }
  
    return null;
  };

  const toggleMenuFolder = (folderId: string) => {
    setMenuExpandedFolderIds((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  const moveFolderOrder = (
    folders: Folder[],
    targetFolderId: string,
    direction: "up" | "down"
  ): Folder[] => {
    const index = folders.findIndex((folder) => folder.id === targetFolderId);
  
    if (index !== -1) {
      const nextIndex = direction === "up" ? index - 1 : index + 1;
  
      if (nextIndex < 0 || nextIndex >= folders.length) return folders;
  
      const copied = [...folders];
      [copied[index], copied[nextIndex]] = [copied[nextIndex], copied[index]];
  
      return copied;
    }
  
    return folders.map((folder) => ({
      ...folder,
      folders: moveFolderOrder(folder.folders, targetFolderId, direction),
    }));
  };
  
  const moveDayOrderFromPath = (
    folders: Folder[],
    path: string[],
    targetDayId: string,
    direction: "up" | "down"
  ): Folder[] => {
    return folders.map((folder) =>
      folder.id === path[0]
        ? path.length === 1
          ? {
              ...folder,
              days: (() => {
                const index = folder.days.findIndex((day) => day.id === targetDayId);
                if (index === -1) return folder.days;
  
                const nextIndex = direction === "up" ? index - 1 : index + 1;
                if (nextIndex < 0 || nextIndex >= folder.days.length) return folder.days;
  
                const copied = [...folder.days];
                [copied[index], copied[nextIndex]] = [copied[nextIndex], copied[index]];
  
                return copied;
              })(),
            }
          : {
              ...folder,
              folders: moveDayOrderFromPath(
                folder.folders,
                path.slice(1),
                targetDayId,
                direction
              ),
            }
        : folder
    );
  };

  const moveFolderToFolder = (
    folders: Folder[],
    movingFolderId: string,
    targetFolderId: string | null
  ): Folder[] => {
    let movingFolder: Folder | null = null;
  
    const removeFolder = (list: Folder[]): Folder[] =>
      list
        .filter((folder) => {
          if (folder.id === movingFolderId) {
            movingFolder = folder;
            return false;
          }
          return true;
        })
        .map((folder) => ({
          ...folder,
          folders: removeFolder(folder.folders),
        }));
  
    const removed = removeFolder(folders);
    if (!movingFolder) return folders;
  
    if (targetFolderId === null) {
      return [...removed, movingFolder];
    }
  
    const insertFolder = (list: Folder[]): Folder[] =>
      list.map((folder) =>
        folder.id === targetFolderId
          ? { ...folder, folders: [...folder.folders, movingFolder!] }
          : { ...folder, folders: insertFolder(folder.folders) }
      );
  
    return insertFolder(removed);
  };


  const moveDayToFolder = (
    folders: Folder[],
    movingDayId: string,
    targetFolderId: string
  ): Folder[] => {
    let movingDay: Day | null = null;

    const removeDay = (list: Folder[]): Folder[] =>
      list.map((folder) => {
        const nextDays = folder.days.filter((day) => {
          if (day.id === movingDayId) {
            movingDay = day;
            return false;
          }
          return true;
        });

        return {
          ...folder,
          days: nextDays,
          folders: removeDay(folder.folders),
        };
      });

    const removed = removeDay(folders);
    if (!movingDay) return folders;

    const insertDay = (list: Folder[]): Folder[] =>
      list.map((folder) =>
        folder.id === targetFolderId
          ? { ...folder, days: [...folder.days, movingDay!] }
          : { ...folder, folders: insertDay(folder.folders) }
      );

    return insertDay(removed);
  };

  const editWordInPath = (
    folders: Folder[],
    path: string[],
    fromDayId: string,
    toDayId: string,
    targetIndex: number,
    editedWord: Word
  ): Folder[] => {
    return folders.map((folder) =>
      folder.id === path[0]
        ? path.length === 1
          ? {
              ...folder,
              days: folder.days.map((day) => {
                if (day.id === fromDayId && day.id === toDayId) {
                  return {
                    ...day,
                    words: day.words.map((word, i) =>
                      i === targetIndex ? editedWord : word
                    ),
                  };
                }
  
                if (day.id === fromDayId) {
                  return {
                    ...day,
                    words: day.words.filter((_, i) => i !== targetIndex),
                  };
                }
  
                if (day.id === toDayId) {
                  return {
                    ...day,
                    words: [...day.words, editedWord],
                  };
                }
  
                return day;
              }),
            }
          : {
              ...folder,
              folders: editWordInPath(
                folder.folders,
                path.slice(1),
                fromDayId,
                toDayId,
                targetIndex,
                editedWord
              ),
            }
        : folder
    );
  };

  const toggleFolderOpen = (folderId: string) => {
    setExpandedFolderIds((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  const movingFolder = actionFolderId
  ? findFolderById(books, actionFolderId)
  : undefined;

const getDescendantIds = (folder?: Folder): string[] => {
  if (!folder) return [];

  return folder.folders.flatMap((child) => [
    child.id,
    ...getDescendantIds(child),
  ]);
};

const disabledMoveIds = getDescendantIds(movingFolder);

const getDayProgress = (day: Day) => {
  const total = day.words.length;
  const memorized = day.words.filter((word) => word.memorized).length;
  const percent = total === 0 ? 0 : Math.round((memorized / total) * 100);

  return (
    <>
      {percent}
      <span className="ml-[1px]">%</span>
      {" ("}
      {memorized}
      <span className="mx-[1px]">/</span>
      {total}
      )
    </>
  );
};

  
  return (
    <main className="min-h-[100svh] bg-white text-[#111827]">
      <section className="mx-auto min-h-[100svh] w-full max-w-[430px] bg-white">
      {isStandalone && (
        <button
          onClick={() => window.location.reload()}
          className="fixed bottom-16 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-[#e4e8f0] bg-white/90 shadow-[0_6px_18px_rgba(15,23,42,0.08)] backdrop-blur transition active:scale-95"
          aria-label="새로고침"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 11A8 8 0 1 0 17.7 16.7"
              stroke="#0f2a5f"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            <path
              d="M20 4V11H13"
              stroke="#0f2a5f"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {step === "book" && (
        <div className="min-h-dvh bg-white px-5 pt-8 pb-6">
          <div>
            <p className="text-[12px] font-semibold text-[#8a94a6]">
              VOCAB FLOW
            </p>

            <div className="mt-2 flex items-center justify-between">
              <h1 className="text-[28px] font-bold tracking-tight text-[#0f2a5f]">
                단어장
              </h1>

              <button
                onClick={() => setStep("addBook")}
                className="h-[38px] rounded-full bg-[#0f2a5f] px-5 text-[12px] font-bold text-white"
              >
                + 추가
              </button>
            </div>
          </div>

          <div className="mt-7">
            {books.length === 0 ? (
              <Empty text="아직 단어장이 없어. 먼저 단어장을 추가해줘." />
            ) : (
              books.map((book) => {
                const isOpen = expandedFolderIds.includes(book.id);

                return (
                  <div key={book.id}>
                    <button
                      onClick={() => {
                        if (didLongPressFolder.current) {
                          didLongPressFolder.current = false;
                          return;
                        }
                        toggleFolderOpen(book.id);
                      }}
                      onPointerDown={() => {
                        didLongPressFolder.current = false;
                        folderLongPressTimer.current = setTimeout(() => {
                          didLongPressFolder.current = true;
                          setSelectedBookId(book.id);
                          setActionFolderId(book.id);
                        }, 450);
                      }}
                      onPointerUp={() => {
                        if (folderLongPressTimer.current) {
                          clearTimeout(folderLongPressTimer.current);
                          folderLongPressTimer.current = null;
                        }
                      }}
                      onPointerCancel={() => {
                        if (folderLongPressTimer.current) {
                          clearTimeout(folderLongPressTimer.current);
                          folderLongPressTimer.current = null;
                        }
                      }}
                      onPointerLeave={() => {
                        if (folderLongPressTimer.current) {
                          clearTimeout(folderLongPressTimer.current);
                          folderLongPressTimer.current = null;
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedBookId(book.id);
                        setActionFolderId(book.id);
                      }}
                      className={`flex h-[56px] w-full touch-none select-none items-center text-left active:bg-[#fafafa] ${
                        isOpen ? "border-b border-[#e5e7eb]" : ""
                      }`}
                    >
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`"${book.title}" 안에 하위 폴더를 추가할까?`)) {
                            setSelectedBookId(book.id);
                            setFolderPath([book.id]);
                            setStep("addFolder");
                          }
                        }}
                        className="mr-3 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border border-[#9ca3af] text-[15px] font-light leading-none text-[#8a8f98] active:scale-95"
                      >
                        +
                      </span>

                      <div className="min-w-0 flex-1">
                        <span className="truncate text-[16px] font-medium tracking-[-0.03em] text-[#303236]">
                          {book.title}
                        </span>
                      </div>

                      <span className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center text-[#9aa3b2]">
                        <ChevronToggle open={isOpen} />
                      </span>
                    </button>

                    {isOpen &&
                      book.folders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => {
                            if (didLongPressFolder.current) {
                              didLongPressFolder.current = false;
                              return;
                            }

                            setSelectedBookId(book.id);
                            setFolderPath([book.id, folder.id]);
                            setSelectedDayId("");
                            setWordIndex(0);
                            setShowMeaning(false);
                            setStep("day");
                          }}
                          onPointerDown={() => {
                            didLongPressFolder.current = false;

                            folderLongPressTimer.current = setTimeout(() => {
                              didLongPressFolder.current = true;
                              setActionFolderId(folder.id);
                            }, 450);
                          }}
                          onPointerUp={() => {
                            if (folderLongPressTimer.current) {
                              clearTimeout(folderLongPressTimer.current);
                              folderLongPressTimer.current = null;
                            }
                          }}
                          onPointerCancel={() => {
                            if (folderLongPressTimer.current) {
                              clearTimeout(folderLongPressTimer.current);
                              folderLongPressTimer.current = null;
                            }
                          }}
                          onPointerLeave={() => {
                            if (folderLongPressTimer.current) {
                              clearTimeout(folderLongPressTimer.current);
                              folderLongPressTimer.current = null;
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setActionFolderId(folder.id);
                          }}
                          className="flex h-[50px] w-full touch-none select-none items-center border-b border-[#e5e7eb] pl-[42px] text-left active:bg-[#fafafa]"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="truncate text-[16px] font-normal tracking-[-0.03em] text-[#666a70]">
                              {folder.title}
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

        {step === "day" && activeFolder && (
          <div className="min-h-dvh px-5 pt-7 pb-6">
            <div className="flex items-center justify-between">
            <BackButton
              onClick={goBackFromDay}
              label="뒤로"
            />

              <button onClick={goHome} className="mr-1.5 text-[#8a94a6]" aria-label="홈">
                <HomeIcon />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <h1 className="text-[28px] font-bold tracking-tight text-[#0f2a5f]">
                {activeFolder.title}
              </h1>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("addFolder")}
                  className="rounded-full bg-[#eef2f8] px-4 py-2 text-[12px] font-bold text-[#0f2a5f]"
                >
                  + Folder
                </button>

                <button
                  onClick={() => setStep("addDay")}
                  className="rounded-full bg-[#0f2a5f] px-4 py-2 text-[12px] font-bold text-white"
                >
                  + Day
                </button>
              </div>
            </div>

            <div className="mt-7 space-y-2">
              {activeFolder.folders.length > 0 && (
                <FolderTreeRows
                  folders={activeFolder.folders}
                  basePath={folderPath}
                  expandedIds={expandedFolderIds}
                  onToggle={toggleFolderOpen}
                  onSelect={(path) => {
                    setFolderPath(path);
                    setSelectedDayId("");
                    setWordIndex(0);
                    setShowMeaning(false);
                  }}
                  onOpenAction={setActionFolderId}
                  longPressTimer={folderLongPressTimer}
                  didLongPress={didLongPressFolder}
                />
              )}

              {activeFolder.days.map((day) => (
                <button
                  key={day.id}
                  onClick={() => {
                    if (didLongPressDay.current) {
                      didLongPressDay.current = false;
                      return;
                    }

                    goWordList(day.id);
                  }}
                  onPointerDown={() => {
                    didLongPressDay.current = false;

                    dayLongPressTimer.current = setTimeout(() => {
                      didLongPressDay.current = true;
                      setActionDayId(day.id);
                    }, 450);
                  }}
                  onPointerUp={() => {
                    if (dayLongPressTimer.current) {
                      clearTimeout(dayLongPressTimer.current);
                      dayLongPressTimer.current = null;
                    }
                  }}
                  onPointerCancel={() => {
                    if (dayLongPressTimer.current) {
                      clearTimeout(dayLongPressTimer.current);
                      dayLongPressTimer.current = null;
                    }
                  }}
                  onPointerLeave={() => {
                    if (dayLongPressTimer.current) {
                      clearTimeout(dayLongPressTimer.current);
                      dayLongPressTimer.current = null;
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setActionDayId(day.id);
                  }}
                  className="flex h-[46px] w-full touch-none select-none items-center bg-white pl-1 pr-1 text-left active:bg-[#f7f8fb]"
                >
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.03em] text-[#303236]">
                        {day.title}
                      </p>

                      <span
                        className="shrink-0 translate-y-[1px] text-[10px] font-semibold leading-none tracking-[-0.02em] text-[#c4c6cc]"
                        style={{
                          fontFamily:
                            '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", sans-serif',
                        }}
                      >
                        {getDayProgress(day)}
                      </span>
                    </div>

                    </div>

                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionDayId(day.id);
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f6fa] text-[#8a94a6]"
                    >
                      ⋯
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "wordList" && selectedBook && selectedDay && (
          <div className="min-h-dvh px-5 pt-7 pb-6">
            <div className="flex items-center justify-between">
              <BackButton onClick={() => setStep("day")} label="Day 목록" />

              <button onClick={goHome} className="mr-1.5 text-[#8a94a6]" aria-label="홈">
                <HomeIcon />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight text-[#0f2a5f]">
                  {selectedDay.title}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative h-8 w-8 shrink-0">
                  <select
                    value={wordSortOrder}
                    onChange={(e) => setWordSortOrder(e.target.value as "latest" | "oldest")}
                    className="absolute inset-0 z-10 h-8 w-8 cursor-pointer appearance-none opacity-0"
                    aria-label="정렬"
                  >
                    <option value="latest">최신순</option>
                    <option value="oldest">오래된순</option>
                  </select>

                  <div className="pointer-events-none flex h-8 w-8 items-center justify-center text-[#8a94a6]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M4 8H20" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
                      <circle cx="9" cy="8" r="2.7" fill="white" stroke="currentColor" strokeWidth="2.3" />
                      <path d="M4 16H20" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
                      <circle cx="15" cy="16" r="2.7" fill="white" stroke="currentColor" strokeWidth="2.3" />
                    </svg>
                  </div>
                </div>

                <button
                  onClick={() => setStep("addWord")}
                  className="rounded-full bg-[#0f2a5f] px-4 py-2 text-[12px] font-bold text-white"
                >
                  + 단어
                </button>
              </div>
            </div>

            <div className="mt-4 flex rounded-full bg-[#f5f6fa] p-1">
              <button
                onClick={() => setWordViewMode("all")}
                className={`h-8 flex-1 rounded-full text-[12px] font-bold ${
                  wordViewMode === "all"
                    ? "bg-white text-[#0f2a5f] shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
                    : "text-[#8a94a6]"
                }`}
              >
                전체보기
              </button>

              <button
                onClick={() => setWordViewMode("unmemorized")}
                className={`h-8 flex-1 rounded-full text-[12px] font-bold ${
                  wordViewMode === "unmemorized"
                    ? "bg-white text-[#0f2a5f] shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
                    : "text-[#8a94a6]"
                }`}
              >
                미암기만
              </button>
            </div>

            <button
              onClick={() => setShowListMeanings((prev) => !prev)}
              className="mt-2 h-8 w-full rounded-full bg-[#f5f6fa] text-[12px] font-bold text-[#596275]"
            >
              {showListMeanings ? "뜻 숨기기" : "뜻 보기"}
            </button>

            <div className="mt-7 space-y-2">
              {visibleSortedWords.length === 0 ? (
                <Empty text="이 Day에는 아직 단어가 없어." />
              ) : (
                visibleSortedWords.map(({ word: item, originalIndex }) => (
                  <div
                    key={item.id}
                    className={`relative overflow-hidden rounded-[18px] ${
                      item.importanceStars ? "bg-[#edf3ff] ring-1 ring-[#b9c9ed]" : "bg-[#f1f3f6]"
                    } ${item.memorized ? "opacity-45" : ""}`}
                  >
                    <div className="absolute inset-y-0 left-0 flex w-[145px] items-center justify-center gap-10 bg-[#eef0f3]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          changeWordColor(originalIndex, "blue");
                        }}
                        className="h-[11px] w-[11px] rounded-full border border-white bg-[#3b82f6] shadow-[0_1px_3px_rgba(15,23,42,0.18)]"
                        aria-label="파란색 표시"
                      />

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          changeWordColor(originalIndex, "red");
                        }}
                        className="h-[11px] w-[11px] rounded-full border border-white bg-[#ef4444] shadow-[0_1px_3px_rgba(15,23,42,0.18)]"
                        aria-label="빨간색 표시"
                      />
                    </div>
                
                    <button
                      onClick={() => startStudy(originalIndex)}
                      onTouchStart={(e) => {
                        touchStartX.current = e.touches[0].clientX;
                        setDraggingIndex(originalIndex);
                
                        const base = swipedIndex === originalIndex ? SWIPE_WIDTH : 0;
                        setDragX(base);
                      }}
                      onTouchMove={(e) => {
                        if (touchStartX.current === null) return;
                
                        const diff = e.touches[0].clientX - touchStartX.current;
                        const base = swipedIndex === originalIndex ? SWIPE_WIDTH : 0;
                
                        setDragX(Math.max(0, Math.min(base + diff, SWIPE_WIDTH)));
                      }}
                      onTouchEnd={() => {
                        if (dragX > SWIPE_WIDTH / 2) {
                          setSwipedIndex(originalIndex);
                        } else {
                          setSwipedIndex(null);
                        }
                
                        setDraggingIndex(null);
                        setDragX(0);
                        touchStartX.current = null;
                      }}
                      className={`relative z-10 w-full rounded-[18px] border px-4 py-4 text-left shadow-[0_3px_10px_rgba(15,23,42,0.04)] transition-transform active:scale-[0.99] ${
                        item.importanceStars
                          ? "border-[#b9c9ed] bg-[#f8fbff] shadow-[0_5px_16px_rgba(15,42,95,0.10)]"
                          : "border-[#e4e8f0] bg-white"
                      }`}
                      style={{ transform: `translateX(${getSwipeX(originalIndex)}px)` }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                        {item.importanceStars ? (
                          <span className="mb-1 inline-flex items-center">
                            <ImportanceStars count={item.importanceStars} size={13} />
                          </span>
                        ) : null}
                        <p
                          className={`truncate text-[17px] font-bold ${
                            item.highlightColor === "red"
                              ? "text-[#ef4444]"
                              : item.highlightColor === "blue"
                              ? "text-[#2563eb]"
                              : "text-[#0f2a5f]"
                          }`}
                        >
                          {item.word}
                        </p>

                        {showListMeanings && (
                          <div className="mt-2 space-y-1">
                            {(item.meanings ?? []).length > 0 ? (
                              (item.meanings ?? []).map((group, groupIndex) => (
                                <div
                                  key={`${group.pos}-${groupIndex}`}
                                  className="relative flex items-start gap-1.5"
                                >
                            
                                  <span
                                    className="mt-[1px] inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-[4px] bg-[#0f2a5f] text-[9px] font-bold text-white"
                                  >
                                    {group.pos}
                                  </span>
                            
                                  <div
                                    className="mt-[0px] min-w-0 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[12px] leading-[1.5] text-[#596275]"
                                  >
                                    {(group.items ?? []).map((meaning, index) => (
                                      <span key={`${meaning}-${index}`} className="inline-flex items-center gap-0.5">
                                        {group.numbered && (
                                          <span
                                            className="inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#9aa3b2] px-[3px] text-[8px] font-bold text-white"
                                          >
                                            {index + 1}
                                          </span>
                                        )}
                                        <span>{meaning}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-[#8a94a6]">뜻 없음</p>
                            )}
                          </div>
                        )}
                        </div>
                
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionWordIndex(originalIndex);
                          }}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f6fa] text-[#8a94a6]"
                        >
                          ⋯
                        </span>
                      </div>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

          {step === "study" && selectedBook && selectedDay && (
            <div
              className="fixed inset-0 flex h-[100svh] flex-col overflow-hidden bg-white px-4 pt-4 pb-6 [overscroll-behavior:none] [touch-action:pan-y]"
              onPointerDown={handleStudyPointerDown}
              onPointerMove={handleStudyPointerMove}
              onPointerUp={handleStudyPointerUp}
              onPointerCancel={handleStudyPointerCancel}
            >
            <EnglishAccentSelector className="fixed left-3 top-[62px] z-40" />
            <header
              onClick={(e) => e.stopPropagation()}
              className="flex h-10 shrink-0 items-center justify-between"
            >
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMenuOpen(true)}
                  className="h-9 w-9 text-[20px] text-[#0f2a5f]"
                  aria-label="메뉴"
                >
                  ☰
                </button>

                <button
                  onClick={() => setStep("wordList")}
                  className="flex h-9 w-9 items-center justify-center pt-[2px] text-[#0f2a5f]"
                  aria-label="뒤로가기"
                >
                  <ChevronLeft />
                </button>
              </div>

              <p className="max-w-[160px] truncate text-center text-[11px] text-[#596275]">
                {currentFolderTitle} 〉 {selectedDay.title} 〉{" "}
                {`${visibleSortedWords.length ? visibleSortedWords.findIndex((item) => item.originalIndex === wordIndex) + 1 : 0} / ${visibleSortedWords.length}`}
              </p>

              <div className="flex items-center gap-1">

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setWordViewMode((prev) =>
                    prev === "all" ? "unmemorized" : "all"
                  );
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f6fa] text-[#596275] active:scale-95"
                aria-label="보기 변경"
              >
                {wordViewMode === "all" ? (
                  // 전체보기 아이콘 (눈 + 빗금)
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 12C6.5 7.5 9.5 5 12 5C14.5 5 17.5 7.5 20 12C17.5 16.5 14.5 19 12 19C9.5 19 6.5 16.5 4 12Z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="2.5"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M5 19L19 5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  // 미암기만 아이콘 (눈)
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 12C6.5 7.5 9.5 5 12 5C14.5 5 17.5 7.5 20 12C17.5 16.5 14.5 19 12 19C9.5 19 6.5 16.5 4 12Z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="2.5"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
            

              <button
                onClick={() => setStep("editWord")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#0f2a5f] active:scale-95"
                aria-label="수정"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4.5 19.5L8.8 18.6L18.9 8.5C19.5 7.9 19.5 6.9 18.9 6.3L17.7 5.1C17.1 4.5 16.1 4.5 15.5 5.1L5.4 15.2L4.5 19.5Z"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14.4 6.2L17.8 9.6"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <button
                onClick={() => deleteWord(wordIndex)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#cf231c] active:scale-95"
                aria-label="삭제"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  {/* 손잡이 */}
                  <rect
                    x="9"
                    y="3.8"
                    width="6"
                    height="2.2"
                    rx="1.1"
                    fill="currentColor"
                  />

                  {/* 뚜껑 */}
                  <rect
                    x="4"
                    y="6.2"
                    width="16"
                    height="2.4"
                    rx="1.2"
                    fill="currentColor"
                  />

                  {/* 몸통 */}
                  <path
                    d="M7.3 9.2H16.7L15.9 19C15.82 19.95 15.03 20.7 14.08 20.7H9.92C8.97 20.7 8.18 19.95 8.1 19L7.3 9.2Z"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinejoin="round"
                    fill="white"
                  />

                  {/* 내부선 */}
                  <rect
                    x="9.5"
                    y="11.4"
                    width="1.9"
                    height="5.8"
                    rx="0.95"
                    fill="currentColor"
                  />

                  <rect
                    x="12.6"
                    y="11.4"
                    width="1.9"
                    height="5.8"
                    rx="0.95"
                    fill="currentColor"
                  />
                </svg>
              </button>
              </div>
            </header>

            {!currentWord ? (
              <Empty text="이 Day에는 아직 단어가 없어." />
            ) : (
              <div className="relative min-h-0 flex-1 overflow-hidden">
                {(() => {
                  const swipeWidth = studySwipeStart.current?.width || studySwipeWidth.current || 0;
                  const preview =
                    studySwipeDragX > 0
                      ? getAdjacentStudyWord("prev")
                      : studySwipeDragX < 0
                      ? getAdjacentStudyWord("next")
                      : null;

                  return (
                    <>
                      {preview && (
                        <div
                          className={`pointer-events-none absolute inset-0 flex flex-col will-change-transform ${
                            studySwipeAnimating ? "transition-transform duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]" : ""
                          }`}
                          style={{
                            transform: `translateX(${
                              studySwipeDragX > 0
                                ? studySwipeDragX - (swipeWidth)
                                : studySwipeDragX + (swipeWidth)
                            }px)`,
                          }}
                        >
                          {renderStudyPane(preview.word, preview.originalIndex)}
                        </div>
                      )}

                      <div
                        className={`absolute inset-0 flex flex-col will-change-transform ${
                          studySwipeAnimating ? "transition-transform duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]" : ""
                        }`}
                        style={{ transform: `translateX(${studySwipeDragX}px)` }}
                      >
                        {renderStudyPane(currentWord, wordIndex)}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {step === "addFolder" && activeFolder && (
          <AddFolder
            onBack={() => setStep("day")}
            onSave={(folder) => {
              saveBooks((prev) => addFolderToPath(prev, folderPath, folder));
              setStep("day");
            }}
          />
        )}

        {step === "addBook" && (
          <AddFolder
            titleText="추가"
            labelText="이름"
            placeholder="TOEIC / START TOEIC"
            onBack={() => setStep("book")}
            onSave={(folder) => {
              saveBooks((prev) => [...prev, folder]);
              setStep("book");
            }}
          />
        )}

        {step === "editBook" && selectedBook && (
          <AddBook
            initialBook={selectedBook}
            onBack={() => setStep("book")}
            onDelete={() => {
              if (!confirm("이 단어장을 삭제할까?")) return;

              saveBooks((prev) => prev.filter((book) => book.id !== selectedBook.id));
              goHome();
            }}
            onSave={(editedBook) => {
              saveBooks((prev) =>
                prev.map((book) =>
                  book.id === selectedBook.id
                    ? { ...book, title: editedBook.title, desc: editedBook.desc }
                    : book
                )
              );
              setStep("book");
            }}
          />
        )}

        {step === "addDay" && activeFolder && (
          <AddDay
            defaultTitle={`DAY ${activeFolder.days.length + 1}`}
            onBack={() => setStep("day")}
            onSave={(title) => {
              saveBooks((prev) =>
                addDayToPath(prev, folderPath, {
                  id: crypto.randomUUID(),
                  title,
                  words: [],
                })
              );

              setStep("day");
            }}
          />
        )}

        {step === "editDay" && activeFolder && actionDayId && (
          <AddDay
            titleText="Day 수정"
            defaultTitle={
              activeFolder.days.find((day) => day.id === actionDayId)?.title || ""
            }
            onBack={() => {
              setActionDayId(null);
              setStep("day");
            }}
            onSave={(title) => {
              saveBooks((prev) =>
                editDayTitleFromPath(prev, folderPath, actionDayId, title)
              );

              setActionDayId(null);
              setStep("day");
            }}
          />
        )}

        {step === "addWord" && activeFolder && (
          <AddWord
            key={`add-word-${selectedDayId}-${selectedDay?.words.length ?? 0}`}
            book={activeFolder}
            defaultDayId={selectedDayId || activeFolder.days[0]?.id || ""}
            onBack={() => setStep(selectedDayId ? "wordList" : "day")}
            onSave={(dayId, word) => {
              saveBooks((prev) =>
                addWordToPath(prev, folderPath, dayId, word)
              );

              setSelectedDayId(dayId);
              setWordIndex(0);
              setShowMeaning(false);
              setStep("addWord");
            }}
          />
        )}

        {step === "editWord" && activeFolder && currentWord && (
          <AddWord
            book={activeFolder}
            defaultDayId={selectedDayId}
            initialWord={currentWord}
            onBack={() => setStep("study")}
            onSave={(dayId, editedWord) => {
              const movedToOtherDay = dayId !== selectedDayId;

              saveBooks((prev) =>
                editWordInPath(
                  prev,
                  folderPath,
                  selectedDayId,
                  dayId,
                  wordIndex,
                  editedWord
                )
              );

              setSelectedDayId(dayId);
              setWordIndex(wordIndex);
              setShowMeaning(false);
              setStep(movedToOtherDay ? "wordList" : "study");
            }}
          />
        )}

        {step === "editFolder" && actionFolderId && (
          <AddFolder
            titleText="폴더 수정"
            labelText="폴더 이름"
            placeholder="폴더 이름"
            initialFolder={findFolderById(books, actionFolderId)}
            onBack={() => setStep(folderPath.length ? "day" : "book")}
            onSave={(editedFolder) => {
              saveBooks((prev) =>
                editFolderInPath(prev, actionFolderId, (folder) => ({
                  ...folder,
                  title: editedFolder.title,
                  days: editedFolder.days.length ? editedFolder.days : folder.days,
                }))
              );

              setActionFolderId(null);
              setStep(folderPath.length ? "day" : "book");
            }}
          />
        )}

        {step === "moveFolder" && actionFolderId && (
          <div className="min-h-dvh px-5 pt-7 pb-6">
            <BackButton
              onClick={() => {
                setActionFolderId(null);
                setStep(folderPath.length ? "day" : "book");
              }}
              label="뒤로"
            />

            <h1 className="mt-5 text-[28px] font-bold text-[#0f2a5f]">
              폴더 이동
            </h1>

            <div className="mt-7 space-y-2">
            <button
              disabled={books.some((book) => book.id === actionFolderId)}
              onClick={() => {
                saveBooks((prev) => moveFolderToFolder(prev, actionFolderId, null));

                setActionFolderId(null);
                setSelectedBookId("");
                setFolderPath([]);
                setSelectedDayId("");
                setWordIndex(0);
                setShowMeaning(false);
                setStep("book");
              }}
              className={`w-full rounded-2xl border border-[#dce2ee] bg-[#f8fafc] px-4 py-4 text-left text-[14px] font-bold text-[#0f2a5f] ${
                books.some((book) => book.id === actionFolderId) ? "opacity-35" : ""
              }`}
            >
              최상위로 이동
            </button>
              {books.map((book) => (
                <MoveFolderList
                  key={book.id}
                  folder={book}
                  currentId={actionFolderId}
                  disabledIds={disabledMoveIds}
                  onSelect={(targetId) => {
                    saveBooks((prev) =>
                      moveFolderToFolder(prev, actionFolderId, targetId)
                    );
                
                    setActionFolderId(null);
                    setSelectedBookId("");
                    setFolderPath([]);
                    setSelectedDayId("");
                    setWordIndex(0);
                    setShowMeaning(false);
                    setStep("book");
                  }}
                />
              ))}
            </div>
          </div>
        )}


        {step === "moveDay" && actionDayId && (
          <div className="min-h-dvh px-5 pt-7 pb-6">
            <BackButton
              onClick={() => {
                setActionDayId(null);
                setStep("day");
              }}
              label="뒤로"
            />

            <h1 className="mt-5 text-[28px] font-bold text-[#0f2a5f]">
              Day 이동
            </h1>

            <p className="mt-2 text-[13px] leading-[1.6] text-[#8a94a6]">
              이동할 폴더를 선택해줘. 상위 폴더, 하위 폴더 모두 가능해.
            </p>

            <div className="mt-7 space-y-2">
              {books.map((book) => (
                <MoveFolderList
                  key={book.id}
                  folder={book}
                  currentId=""
                  onSelect={(targetId) => {
                    const targetPath = findFolderPathById(books, targetId);
                    if (!targetPath) return;

                    saveBooks((prev) =>
                      moveDayToFolder(prev, actionDayId, targetId)
                    );

                    setSelectedBookId(targetPath[0]);
                    setFolderPath(targetPath);
                    setSelectedDayId(actionDayId);
                    setWordIndex(0);
                    setShowMeaning(false);
                    setActionDayId(null);
                    setStep("day");
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {menuOpen && selectedBook && activeFolder && (
          <div className="fixed inset-0 z-20 bg-black/25">
            <aside className="h-full w-[82%] max-w-[340px] overflow-y-auto bg-white px-5 pt-6 pb-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <button onClick={() => setMenuOpen(false)} className="text-[13px] text-[#8a94a6]">
                  닫기 ✕
                </button>

                <button
                  onClick={goHome}
                  className="mr-1.5 text-[#8a94a6]"
                  aria-label="홈"
                >
                  <HomeIcon />
                </button>
              </div>

              <div className="relative">
                <p className="mb-3 text-[11px] font-bold text-[#8a94a6]">단어장 변경</p>

                <button
                  onClick={() => setBookDropdownOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#0f2a5f] bg-[#f8fbff] px-4 py-3 text-left text-[13px] font-bold text-[#0f2a5f]"
                >
                  <span className="truncate">{currentFolderTitle || selectedBook.title}</span>
                  <span className="text-[12px]">{bookDropdownOpen ? "⌃" : "⌄"}</span>
                </button>

                {bookDropdownOpen && (
                  <div className="absolute left-0 right-0 top-[68px] z-30 rounded-[22px] border border-[#e6e9f0] bg-white/95 p-2 shadow-[0_18px_55px_rgba(15,23,42,0.16)] backdrop-blur">
                    <div className="max-h-[270px] overflow-y-auto py-1">
                      {books.map((book) => (
                        <MenuFolderTree
                          key={book.id}
                          folder={book}
                          path={[book.id]}
                          depth={0}
                          selectedPath={folderPath}
                          expandedIds={menuExpandedFolderIds}
                          onToggle={toggleMenuFolder}
                          onSelect={(path) => {
                            setSelectedBookId(path[0]);
                            setFolderPath(path);
                            setSelectedDayId("");
                            setWordIndex(0);
                            setShowMeaning(false);
                            setBookDropdownOpen(false);
                            setMenuOpen(false);
                            setStep("day");
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-7">
                <p className="mb-3 text-[11px] font-bold text-[#8a94a6]">Day 변경</p>

                <div className="space-y-2">
                  {activeFolder.folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => {
                        setFolderPath((prev) => [...prev, folder.id]);
                      }}
                      className="w-full rounded-[16px] border border-[#e4e8f0] bg-[#f8fafc] px-3 py-4 text-left"
                    >
                      <p className="text-[17px] font-bold text-[#111827]">
                        {folder.title}
                      </p>

                      <p className="mt-1 text-[10px] text-[#a3abb8]">
                        {folder.folders.length > 0 && `하위 폴더 ${folder.folders.length}개`}
                        {folder.folders.length > 0 && folder.days.length > 0 && " · "}
                        {folder.days.length > 0 && `Day ${folder.days.length}개`}
                      </p>
                    </button>
                  ))}

                  {activeFolder.days.map((day) => (
                    <button
                      key={day.id}
                      onClick={() => {
                        setSelectedDayId(day.id);
                        setWordIndex(0);
                        setShowMeaning(false);
                        setMenuOpen(false);
                        setBookDropdownOpen(false);
                        setStep("wordList");
                      }}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-[13px] ${
                        day.id === selectedDayId
                          ? "border-[#0f2a5f] bg-[#f8fbff] font-bold text-[#0f2a5f]"
                          : "border-[#e3e7ef] text-[#596275]"
                      }`}
                    >
                      {day.title}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        {actionWordIndex !== null && selectedDay && (
          <div
            onClick={() => setActionWordIndex(null)}
            className="fixed inset-0 z-30 flex items-end bg-black/25"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="mx-auto w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
            >
              <p className="text-[16px] font-bold text-[#111827]">
                {selectedDay.words[actionWordIndex]?.word}
              </p>

              <div className="mt-5 space-y-2">
                <button
                  onClick={() => {
                    setWordIndex(actionWordIndex);
                    setActionWordIndex(null);
                    setStep("editWord");
                  }}
                  className="h-12 w-full rounded-2xl bg-[#eef2f8] text-[13px] font-bold text-[#0f2a5f]"
                >
                  수정
                </button>

                <button
                  onClick={() => deleteWord(actionWordIndex)}
                  className="h-12 w-full rounded-2xl bg-[#fdeeee] text-[13px] font-bold text-[#b42318]"
                >
                  삭제
                </button>

                <button
                  onClick={() => setActionWordIndex(null)}
                  className="h-12 w-full rounded-2xl border border-[#dce2ee] text-[13px] text-[#596275]"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {actionDayId !== null &&
          actionDayId !== "__sort__" &&
          activeFolder &&
          step !== "editDay" &&
          step !== "moveDay" && (
          <div
            onClick={() => setActionDayId(null)}
            className="fixed inset-0 z-30 flex items-end bg-black/25"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="mx-auto w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
            >

              <div className="flex select-none items-center justify-between">
                <p className="translate-x-[8px] text-[16px] font-bold tracking-[-0.03em] text-[#111827]">
                  {activeFolder?.days.find((day) => day.id === actionDayId)?.title}
                </p>

                <div className="relative h-9 w-9">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value === "up") {
                        saveBooks((prev) =>
                          moveDayOrderFromPath(prev, folderPath, actionDayId, "up")
                        );
                      }

                      if (e.target.value === "down") {
                        saveBooks((prev) =>
                          moveDayOrderFromPath(prev, folderPath, actionDayId, "down")
                        );
                      }

                      setActionDayId(null);
                      e.target.value = "";
                    }}
                    className="absolute inset-0 z-10 h-9 w-9 cursor-pointer appearance-none opacity-0"
                    aria-label="Day 순서 변경"
                  >
                    <option value="" disabled>
                      순서 변경
                    </option>
                    <option value="up">위로 올리기</option>
                    <option value="down">아래로 내리기</option>
                  </select>

                  <div
                    className="pointer-events-none flex h-7 w-7 translate-y-[3px] items-center justify-center text-[13px] font-bold leading-none text-[#8a94a6]"
                    style={{
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI Symbol", "Apple Symbols", sans-serif',
                    }}
                  >
                    ⇅
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  onClick={() => {
                    setStep("editDay");
                  }}
                  className="h-12 w-full rounded-2xl bg-[#eef2f8] text-[13px] font-bold text-[#0f2a5f]"
                >
                  Day 수정
                </button>

                <button
                  onClick={() => {
                    setStep("moveDay");
                  }}
                  className="h-12 w-full rounded-2xl bg-[#eef2f8] text-[13px] font-bold text-[#0f2a5f]"
                >
                  Day 이동
                </button>

                <button
                  onClick={() => deleteDay(actionDayId)}
                  className="h-12 w-full rounded-2xl bg-[#fdeeee] text-[13px] font-bold text-[#b42318]"
                >
                  Day 삭제
                </button>

                <button
                  onClick={() => setActionDayId(null)}
                  className="h-12 w-full rounded-2xl border border-[#dce2ee] text-[13px] text-[#596275]"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
        {actionFolderId !== null && step !== "moveFolder" && step !== "editFolder" && (
          <div
            onClick={() => setActionFolderId(null)}
            className="fixed inset-0 z-30 flex items-end bg-black/25"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="mx-auto w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
            >

            <div className="flex select-none items-center justify-between">
              <p className="translate-x-[8px] text-[16px] font-bold tracking-[-0.03em] text-[#111827]">
                {findFolderById(books, actionFolderId)?.title}
              </p>

              <div className="relative h-9 w-9">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value === "up") {
                      saveBooks((prev) => moveFolderOrder(prev, actionFolderId, "up"));
                    }

                    if (e.target.value === "down") {
                      saveBooks((prev) => moveFolderOrder(prev, actionFolderId, "down"));
                    }

                    setActionFolderId(null);
                    e.target.value = "";
                  }}
                  className="absolute inset-0 z-10 h-9 w-9 cursor-pointer appearance-none opacity-0"
                  aria-label="폴더 순서 변경"
                >
                  <option value="" disabled>
                    순서 변경
                  </option>
                  <option value="up">위로 올리기</option>
                  <option value="down">아래로 내리기</option>
                </select>

                <div
                  className="pointer-events-none flex h-7 w-7 translate-y-[3px] items-center justify-center text-[13px] font-bold leading-none text-[#8a94a6]"
                  style={{
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI Symbol", "Apple Symbols", sans-serif',
                  }}
                >
                  ⇅
                </div>
              </div>
            </div>

              <div className="mt-5 space-y-2">
                <button
                  onClick={() => {
                    const path = findFolderPathById(books, actionFolderId);
                    if (!path) return;

                    setFolderPath(path);
                    setActionFolderId(null);
                    setStep("addFolder");
                  }}
                  className="h-12 w-full rounded-2xl bg-[#eef2f8] text-[13px] font-bold text-[#0f2a5f]"
                >
                  하위 폴더 추가
                </button>

                <button
                  onClick={() => {
                    setStep("editFolder");
                  }}
                  className="h-12 w-full rounded-2xl bg-[#eef2f8] text-[13px] font-bold text-[#0f2a5f]"
                >
                  폴더 수정
                </button>

                <button
                  onClick={() => {
                    setStep("moveFolder");
                  }}
                  className="h-12 w-full rounded-2xl bg-[#eef2f8] text-[13px] font-bold text-[#0f2a5f]"
                >
                  폴더 이동
                </button>

                <button
                  onClick={() => {
                    if (!confirm("폴더를 삭제할까?")) return;

                    saveBooks((prev) =>
                      deleteFolderFromPath(
                        prev,
                        actionFolderId
                      )
                    );

                    setActionFolderId(null);
                  }}
                  className="h-12 w-full rounded-2xl bg-[#fdeeee] text-[13px] font-bold text-[#b42318]"
                >
                  폴더 삭제
                </button>

                <button
                  onClick={() => setActionFolderId(null)}
                  className="h-12 w-full rounded-2xl border border-[#dce2ee]"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}


function AddBook({
  initialBook,
  onBack,
  onSave,
  onDelete,
}: {
  initialBook?: Book;
  onBack: () => void;
  onSave: (book: Book) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initialBook?.title || "");
  const [desc, setDesc] = useState(initialBook?.desc || "");
  const [dayCount, setDayCount] = useState(initialBook?.days.length || 10);

  return (
    <div className="min-h-dvh px-5 pt-7 pb-6">
      <BackButton onClick={onBack} label="뒤로" />

      <h1 className="mt-5 text-[28px] font-bold text-[#0f2a5f]">
        {initialBook ? "단어장 수정" : "단어장 추가"}
      </h1>

      <div className="mt-7 space-y-4">
        <Input label="단어장 이름" value={title} onChange={setTitle} placeholder="START TOEIC" />
        <Input label="설명" value={desc} onChange={setDesc} placeholder="기초 토익 단어장" />

        {!initialBook && (
          <Input
            label="Day 개수"
            value={String(dayCount)}
            onChange={(v) => setDayCount(Number(v) || 1)}
            type="number"
          />
        )}

        <button
          onClick={() => {
            if (!title.trim()) return alert("단어장 이름을 입력해줘.");

            onSave({
              id: initialBook?.id || crypto.randomUUID(),
              title: title.trim(),
              desc: desc.trim(),
              folders: initialBook?.folders || [],
              days:
                initialBook?.days ||
                Array.from({ length: dayCount }, (_, i) => ({
                  id: crypto.randomUUID(),
                  title: `DAY ${i + 1}`,
                  words: [],
                })),
            });
          }}
          className="h-12 w-full rounded-full bg-[#0f2a5f] text-[13px] font-bold text-white"
        >
          저장
        </button>

        {initialBook && onDelete && (
          <button
            onClick={onDelete}
            className="h-12 w-full rounded-full bg-[#fdeeee] text-[13px] font-bold text-[#b42318]"
          >
            단어장 삭제
          </button>
        )}
      </div>
    </div>
  );
}

function AddFolder({
  titleText = "폴더 추가",
  labelText = "폴더 이름",
  placeholder = "START TOEIC",
  initialFolder,
  onBack,
  onSave,
}: {
  titleText?: string;
  labelText?: string;
  placeholder?: string;
  initialFolder?: Folder;
  onBack: () => void;
  onSave: (folder: Folder) => void;
}) {
  const [title, setTitle] = useState(initialFolder?.title || "");
  const [dayCount, setDayCount] = useState("");

  return (
    <div className="min-h-dvh px-5 pt-7 pb-6">
      <BackButton onClick={onBack} label="뒤로" />

      <h1 className="mt-5 text-[28px] font-bold text-[#0f2a5f]">
        {titleText}
      </h1>

      <div className="mt-7 space-y-4">
        <Input
          label={labelText}
          value={title}
          onChange={setTitle}
          placeholder={placeholder}
        />

        <Input
          label="Day 개수"
          value={dayCount}
          onChange={setDayCount}
          placeholder="비워두면 폴더만 생성"
          type="number"
        />

        <button
          onClick={() => {
            if (!title.trim()) return alert("이름을 입력해줘.");

            const count = Number(dayCount);

            onSave({
              id: initialFolder?.id || crypto.randomUUID(),
              title: title.trim(),
              desc: "",
              folders: initialFolder?.folders || [],
              days:
                dayCount.trim() && count > 0
                  ? Array.from({ length: count }, (_, i) => ({
                      id: crypto.randomUUID(),
                      title: `DAY ${i + 1}`,
                      words: [],
                    }))
                  : initialFolder?.days || [],
            });
          }}
          className="h-12 w-full rounded-full bg-[#0f2a5f] text-[13px] font-bold text-white"
        >
          저장
        </button>
      </div>
    </div>
  );
}

function AddDay({
  titleText = "Day 추가",
  defaultTitle,
  onBack,
  onSave,
}: {
  titleText?: string;
  defaultTitle: string;
  onBack: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);

  return (
    <div className="min-h-dvh px-5 pt-7 pb-6">
      <BackButton onClick={onBack} label="뒤로" />

      <h1 className="mt-5 text-[28px] font-bold text-[#0f2a5f]">{titleText}</h1>

      <div className="mt-7 space-y-4">
        <Input label="Day 이름" value={title} onChange={setTitle} placeholder="Day 11" />

        <button
          onClick={() => {
            if (!title.trim()) return alert("Day 이름을 입력해줘.");
            onSave(title.trim());
          }}
          className="h-12 w-full rounded-full bg-[#0f2a5f] text-[13px] font-bold text-white"
        >
          저장
        </button>
      </div>
    </div>
  );
}

function AddWord({
  book,
  defaultDayId,
  initialWord,
  onBack,
  onSave,
}: {
  book: Book;
  defaultDayId: string;
  initialWord?: Word;
  onBack: () => void;
  onSave: (dayId: string, word: Word) => void;
}) {
  const [dayId, setDayId] = useState(defaultDayId || book.days[0]?.id || "");
  const [word, setWord] = useState(initialWord?.word || "");
  const [meanings, setMeanings] = useState<Meaning[]>(
    initialWord?.meanings?.length
      ? initialWord.meanings
      : [{ pos: "동", items: [""], numbered: false }]
  );

  const [examples, setExamples] = useState<{ en: string; ko: string }[]>(
    initialWord?.examples?.length ? initialWord.examples : [{ en: "", ko: "" }]
  );

  const toLinkedTerms = (items?: (string | LinkedTerm)[]): LinkedTerm[] => {
    if (!items?.length) return [{ text: "", meaningRef: "", meaningLabel: "" }];
  
    const grouped = new Map<string, LinkedTerm>();
  
    items.forEach((item) => {
      const next =
        typeof item === "string"
          ? { text: item, meaningRef: "", meaningLabel: "" }
          : {
              text: item.text ?? "",
              meaningRef: item.meaningRef ?? "",
              meaningLabel: item.meaningLabel ?? "",
            };
  
      const key = `${next.meaningRef || ""}__${next.meaningLabel || ""}`;
  
      if (grouped.has(key)) {
        const prev = grouped.get(key)!;
        grouped.set(key, {
          ...prev,
          text: [prev.text, next.text].filter(Boolean).join(", "),
        });
      } else {
        grouped.set(key, next);
      }
    });
  
    return Array.from(grouped.values()).filter((item) => item.text);
  };
  
  const [synonyms, setSynonyms] = useState<LinkedTerm[]>(
    toLinkedTerms(initialWord?.synonyms)
  );
  
  const [antonyms, setAntonyms] = useState<LinkedTerm[]>(
    toLinkedTerms(initialWord?.antonyms)
  );

  const [studyPoints, setStudyPoints] = useState<StudyPoint[]>(
    initialWord?.studyPoints?.length
      ? initialWord.studyPoints.map((point) => ({
          category: point.category ?? "기타",
          expression: point.expression ?? "",
          description: point.description ?? "",
          related: point.related ?? "",
          exampleEn: point.exampleEn ?? "",
          exampleKo: point.exampleKo ?? "",
          examples: point.examples?.length
            ? point.examples.map((example) => ({
                en: example.en ?? "",
                ko: example.ko ?? "",
              }))
            : point.exampleEn || point.exampleKo
            ? [{ en: point.exampleEn ?? "", ko: point.exampleKo ?? "" }]
            : [{ en: "", ko: "" }],
          variants: point.variants?.length
            ? point.variants.map((variant, variantIndex) => ({
                word: variant.word ?? "",
                meanings: variant.meanings?.length
                  ? variant.meanings.map((meaning) => ({
                      pos: meaning.pos ?? "명",
                      items: meaning.items?.length ? meaning.items : [""],
                      numbered: meaning.numbered ?? false,
                    }))
                  : [{ pos: "명", items: [""], numbered: false }],
                related: variant.related ?? (variantIndex === 0 ? point.related ?? "" : ""),
              }))
            : point.related
            ? [{ word: "", meanings: [{ pos: "명", items: [""], numbered: false }], related: point.related }]
            : [],
        }))
      : []
  );

  const studyDescriptionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const studyExampleEnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const savedSelectionRef = useRef<Range | null>(null);
  const [customColors, setCustomColors] = useState<string[]>([]);
  const COLOR_STORAGE_KEY = "vocab-custom-colors-v1";

  useEffect(() => {
    const saved = localStorage.getItem(COLOR_STORAGE_KEY);
    if (!saved) return;

    try {
      setCustomColors(JSON.parse(saved));
    } catch {
      localStorage.removeItem(COLOR_STORAGE_KEY);
    }
  }, []);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    const range = savedSelectionRef.current;

    if (!selection || !range) return;

    selection.removeAllRanges();
    selection.addRange(range);
  };

  const saveCustomColors = (next: string[]) => {
    setCustomColors(next);
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(next));
  };

  const runCommand = (command: string, value?: string) => {
    restoreSelection();
    document.execCommand(command, false, value);
    savedSelectionRef.current = null;
  };

  const STUDY_CATEGORIES = [
    "문법/용법",
    "표현/패턴",
    "전치사",
    "숙어",
    "혼동주의",
    "시험포인트",
    "기타",
  ];

  const addMeaningGroup = () => {
    setMeanings((prev) => [...prev, { pos: "명", items: [""], numbered: false }]);
  };

  const updateMeaningGroup = (groupIndex: number, next: Partial<Meaning>) => {
    setMeanings((prev) =>
      prev.map((group, i) => (i === groupIndex ? { ...group, ...next } : group))
    );
  };

  const updateMeaningItem = (groupIndex: number, itemIndex: number, value: string) => {
    setMeanings((prev) =>
      prev.map((group, i) =>
        i === groupIndex
          ? {
              ...group,
              items: group.items.map((item, j) => (j === itemIndex ? value : item)),
            }
          : group
      )
    );
  };

  const removeMeaningItem = (groupIndex: number, itemIndex: number) => {
    setMeanings((prev) =>
      prev.map((group, i) =>
        i === groupIndex
          ? {
              ...group,
              items:
                group.items.length > 1
                  ? group.items.filter((_, j) => j !== itemIndex)
                  : [""],
            }
          : group
      )
    );
  };

  const addMeaningItem = (groupIndex: number) => {
    setMeanings((prev) =>
      prev.map((group, i) =>
        i === groupIndex ? { ...group, items: [...group.items, ""] } : group
      )
    );
  };

  const removeMeaningGroup = (groupIndex: number) => {
    setMeanings((prev) => prev.filter((_, i) => i !== groupIndex));
  };

  const addExample = () => {
    setExamples((prev) => [...prev, { en: "", ko: "" }]);
  };

  const updateExample = (index: number, key: "en" | "ko", value: string) => {
    setExamples((prev) =>
      prev.map((example, i) => (i === index ? { ...example, [key]: value } : example))
    );
  };

  const removeExample = (index: number) => {
    setExamples((prev) => prev.filter((_, i) => i !== index));
  };

  const addStudyPoint = () => {
    setStudyPoints((prev) => [
      ...prev,
      {
        category: "기타",
        expression: "",
        description: "",
        related: "",
        exampleEn: "",
        exampleKo: "",
        examples: [{ en: "", ko: "" }],
        variants: [],
      },
    ]);
  };

  const updateStudyPoint = (index: number, key: keyof StudyPoint, value: string) => {
    setStudyPoints((prev) =>
      prev.map((point, i) => (i === index ? { ...point, [key]: value } : point))
    );
  };

  const addStudyPointExample = (pointIndex: number) => {
    setStudyPoints((prev) =>
      prev.map((point, i) =>
        i === pointIndex
          ? {
              ...point,
              examples: [
                ...(point.examples?.length
                  ? point.examples
                  : [{ en: point.exampleEn, ko: point.exampleKo }]),
                { en: "", ko: "" },
              ],
            }
          : point
      )
    );
  };

  const updateStudyPointExample = (
    pointIndex: number,
    exampleIndex: number,
    key: keyof StudyPointExample,
    value: string
  ) => {
    setStudyPoints((prev) =>
      prev.map((point, i) => {
        if (i !== pointIndex) return point;

        const examples = point.examples?.length
          ? point.examples
          : [{ en: point.exampleEn, ko: point.exampleKo }];

        return {
          ...point,
          examples: examples.map((example, j) =>
            j === exampleIndex ? { ...example, [key]: value } : example
          ),
        };
      })
    );
  };

  const removeStudyPointExample = (pointIndex: number, exampleIndex: number) => {
    setStudyPoints((prev) =>
      prev.map((point, i) => {
        if (i !== pointIndex) return point;

        const examples = point.examples?.length
          ? point.examples
          : [{ en: point.exampleEn, ko: point.exampleKo }];

        return {
          ...point,
          examples:
            examples.length > 1
              ? examples.filter((_, j) => j !== exampleIndex)
              : [{ en: "", ko: "" }],
        };
      })
    );
  };

  const addStudyPointVariant = (pointIndex: number) => {
    setStudyPoints((prev) =>
      prev.map((point, i) =>
        i === pointIndex
          ? {
              ...point,
              variants: [
                ...(point.variants ?? []),
                { word: "", meanings: [{ pos: "명", items: [""], numbered: false }], related: "" },
              ],
            }
          : point
      )
    );
  };

  const updateStudyPointVariantWord = (pointIndex: number, variantIndex: number, value: string) => {
    setStudyPoints((prev) =>
      prev.map((point, i) =>
        i === pointIndex
          ? {
              ...point,
              variants: (point.variants ?? []).map((variant, j) =>
                j === variantIndex ? { ...variant, word: value } : variant
              ),
            }
          : point
      )
    );
  };

  const updateStudyPointVariantRelated = (pointIndex: number, variantIndex: number, value: string) => {
    setStudyPoints((prev) =>
      prev.map((point, i) =>
        i === pointIndex
          ? {
              ...point,
              variants: (point.variants ?? []).map((variant, j) =>
                j === variantIndex ? { ...variant, related: value } : variant
              ),
            }
          : point
      )
    );
  };

  const updateStudyPointVariantMeaning = (
    pointIndex: number,
    variantIndex: number,
    meaningIndex: number,
    next: Partial<StudyPointVariantMeaning>
  ) => {
    setStudyPoints((prev) =>
      prev.map((point, i) =>
        i === pointIndex
          ? {
              ...point,
              variants: (point.variants ?? []).map((variant, j) =>
                j === variantIndex
                  ? {
                      ...variant,
                      meanings: variant.meanings.map((meaning, k) =>
                        k === meaningIndex ? { ...meaning, ...next } : meaning
                      ),
                    }
                  : variant
              ),
            }
          : point
      )
    );
  };

  const updateStudyPointVariantMeaningItem = (
    pointIndex: number,
    variantIndex: number,
    meaningIndex: number,
    itemIndex: number,
    value: string
  ) => {
    setStudyPoints((prev) =>
      prev.map((point, i) =>
        i === pointIndex
          ? {
              ...point,
              variants: (point.variants ?? []).map((variant, j) =>
                j === variantIndex
                  ? {
                      ...variant,
                      meanings: variant.meanings.map((meaning, k) =>
                        k === meaningIndex
                          ? {
                              ...meaning,
                              items: meaning.items.map((item, l) =>
                                l === itemIndex ? value : item
                              ),
                            }
                          : meaning
                      ),
                    }
                  : variant
              ),
            }
          : point
      )
    );
  };

  const addStudyPointVariantMeaning = (pointIndex: number, variantIndex: number) => {
    setStudyPoints((prev) =>
      prev.map((point, i) =>
        i === pointIndex
          ? {
              ...point,
              variants: (point.variants ?? []).map((variant, j) =>
                j === variantIndex
                  ? {
                      ...variant,
                      meanings: [
                        ...variant.meanings,
                        { pos: "명", items: [""], numbered: false },
                      ],
                    }
                  : variant
              ),
            }
          : point
      )
    );
  };

  const removeStudyPointVariantMeaning = (
    pointIndex: number,
    variantIndex: number,
    meaningIndex: number
  ) => {
    setStudyPoints((prev) =>
      prev.map((point, i) =>
        i === pointIndex
          ? {
              ...point,
              variants: (point.variants ?? []).map((variant, j) => {
                if (j !== variantIndex) return variant;
                return {
                  ...variant,
                  meanings:
                    variant.meanings.length > 1
                      ? variant.meanings.filter((_, k) => k !== meaningIndex)
                      : [{ pos: "명", items: [""], numbered: false }],
                };
              }),
            }
          : point
      )
    );
  };

  const addStudyPointVariantMeaningItem = (
    pointIndex: number,
    variantIndex: number,
    meaningIndex: number
  ) => {
    setStudyPoints((prev) =>
      prev.map((point, i) =>
        i === pointIndex
          ? {
              ...point,
              variants: (point.variants ?? []).map((variant, j) =>
                j === variantIndex
                  ? {
                      ...variant,
                      meanings: variant.meanings.map((meaning, k) =>
                        k === meaningIndex
                          ? { ...meaning, items: [...meaning.items, ""], numbered: true }
                          : meaning
                      ),
                    }
                  : variant
              ),
            }
          : point
      )
    );
  };

  const removeStudyPointVariantMeaningItem = (
    pointIndex: number,
    variantIndex: number,
    meaningIndex: number,
    itemIndex: number
  ) => {
    setStudyPoints((prev) =>
      prev.map((point, i) =>
        i === pointIndex
          ? {
              ...point,
              variants: (point.variants ?? []).map((variant, j) =>
                j === variantIndex
                  ? {
                      ...variant,
                      meanings: variant.meanings.map((meaning, k) =>
                        k === meaningIndex
                          ? {
                              ...meaning,
                              items:
                                meaning.items.length > 1
                                  ? meaning.items.filter((_, l) => l !== itemIndex)
                                  : [""],
                              numbered: meaning.items.length > 2 ? meaning.numbered : false,
                            }
                          : meaning
                      ),
                    }
                  : variant
              ),
            }
          : point
      )
    );
  };

  const removeStudyPointVariant = (pointIndex: number, variantIndex: number) => {
    setStudyPoints((prev) =>
      prev.map((point, i) =>
        i === pointIndex
          ? {
              ...point,
              variants: (point.variants ?? []).filter((_, j) => j !== variantIndex),
            }
          : point
      )
    );
  };

  const removeStudyPoint = (index: number) => {
    setStudyPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const meaningOptions = meanings.flatMap((group, groupIndex) =>
    group.items.map((item, itemIndex) => ({
      value: `${groupIndex}:${itemIndex}`,
      label: group.numbered
        ? `${group.pos} ${itemIndex + 1}`
        : group.pos,
      text: item,
    }))
  );
  
  const cleanLinkedTerms = (items: LinkedTerm[]) =>
    items
      .map((item) => ({
        text: item.text.trim(),
        meaningRef: item.meaningRef || "",
        meaningLabel: item.meaningLabel || "",
      }))
      .filter((item) => item.text);

  return (
    <div className="min-h-dvh px-5 pt-7 pb-6">
      <BackButton onClick={onBack} label="뒤로" />

      <h1 className="mt-5 text-[28px] font-bold text-[#0f2a5f]">
        {initialWord ? "단어 수정" : "단어 추가"}
      </h1>

      <div className="mt-7 space-y-5">
        <label className="block">
          <p className="mb-2 pl-1.5 text-[12px] font-bold text-[#596275]">Day</p>

          <div className="relative">
            <select
              value={dayId}
              onChange={(e) => setDayId(e.target.value)}
              className="h-12 w-full appearance-none rounded-2xl border border-[#dce2ee] px-4 pr-11 text-[14px] outline-none"
            >
              {book.days.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.title}
                </option>
              ))}
            </select>

            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8a94a6]">
              <ChevronDownIcon />
            </span>
          </div>
        </label>

        <Input label="영어 단어" value={word} onChange={setWord} placeholder="prioritize" />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="pl-1.5 text-[12px] font-bold text-[#596275]">뜻</p>
            <button
              onClick={addMeaningGroup}
              className="rounded-full bg-[#eef2f8] px-3 py-1.5 text-[11px] font-bold text-[#0f2a5f]"
            >
              + 품사 추가
            </button>
          </div>

          <div className="space-y-3">
            {meanings.map((group, groupIndex) => (
              <div key={groupIndex} className="rounded-2xl border border-[#dce2ee] p-4">
                <div className="flex gap-2">
                  <div className="relative w-[66px] shrink-0">
                    <select
                      value={group.pos}
                      onChange={(e) =>
                        updateMeaningGroup(groupIndex, { pos: e.target.value })
                      }
                      className="h-10 w-full appearance-none rounded-xl border border-[#dce2ee] pl-5 pr-7 text-[13px] outline-none"
                    >
                      <option value="동">동</option>
                      <option value="명">명</option>
                      <option value="형">형</option>
                      <option value="부">부</option>
                      <option value="전">전</option>
                      <option value="접">접</option>
                      <option value="대">대</option>
                      <option value="감">감</option>
                      <option value="숙">숙</option>
                      <option value="구">구</option>
                      <option value="한">한</option>
                    </select>

                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#8a94a6]">
                      <ChevronDownIcon />
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      updateMeaningGroup(groupIndex, {
                        numbered: !group.numbered,
                      })
                    }
                    className={`h-10 flex-1 rounded-xl border text-[12px] font-bold ${
                      group.numbered
                        ? "border-[#0f2a5f] bg-[#eef2f8] text-[#0f2a5f]"
                        : "border-[#dce2ee] text-[#8a94a6]"
                    }`}
                  >
                    <span className="tracking-[0.08em]">① ②</span>
                    <span className="ml-1">표시 {group.numbered ? "ON" : "OFF"}</span>
                  </button>

                  <button
                    onClick={() => removeMeaningGroup(groupIndex)}
                    className="h-10 w-10 rounded-xl border border-[#dce2ee] text-[13px] text-[#8a94a6]"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {group.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="relative">
                      <input
                        value={item}
                        onChange={(e) => updateMeaningItem(groupIndex, itemIndex, e.target.value)}
                        placeholder={group.numbered ? `${itemIndex + 1}번째 뜻` : "뜻 입력"}
                        className="h-11 w-full rounded-xl border border-[#dce2ee] px-3 pr-10 text-[13px] outline-none"
                      />

                      <button
                        onClick={() => removeMeaningItem(groupIndex, itemIndex)}
                        className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#f5f6fa] text-[15px] text-[#8a94a6]"
                        aria-label="뜻 삭제"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => addMeaningItem(groupIndex)}
                  className="mt-3 h-9 w-full rounded-full bg-[#f5f6fa] text-[12px] font-bold text-[#596275]"
                >
                  + 뜻 추가
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="pl-1.5 text-[12px] font-bold text-[#596275]">예시문장</p>
            <button
              onClick={addExample}
              className="rounded-full bg-[#eef2f8] px-3 py-1.5 text-[11px] font-bold text-[#0f2a5f]"
            >
              + 예문 추가
            </button>
          </div>

          <div className="space-y-3">
            {examples.map((example, index) => (
              <div key={index} className="rounded-2xl border border-[#dce2ee] p-4">
                <div className="mb-2 flex items-center justify-between">
                <p className="pl-1.5 text-[12px] font-bold text-[#8a94a6]">
                  예문 {index + 1}
                </p>
                  <button
                    onClick={() => removeExample(index)}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f5f6fa] text-[15px] text-[#8a94a6]"
                  >
                    ×
                  </button>
                </div>

                <input
                  value={example.en}
                  onChange={(e) => updateExample(index, "en", e.target.value)}
                  placeholder="영어 예문"
                  className="h-11 w-full rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                />

                <input
                  value={example.ko}
                  onChange={(e) => updateExample(index, "ko", e.target.value)}
                  placeholder="한국어 해석"
                  className="mt-2 h-11 w-full rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        <LinkedTermEditor
          title="동의어"
          items={synonyms}
          meaningOptions={meaningOptions}
          placeholder="rank, emphasize, focus on"
          onChangeAll={setSynonyms}
        />

        <LinkedTermEditor
          title="반의어"
          items={antonyms}
          meaningOptions={meaningOptions}
          placeholder="ignore, neglect"
          onChangeAll={setAntonyms}
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="pl-1.5 text-[12px] font-bold text-[#596275]">학습 포인트</p>

            <button
              onClick={addStudyPoint}
              className="rounded-full bg-[#eef2f8] px-3 py-1.5 text-[11px] font-bold text-[#0f2a5f]"
            >
              + 포인트 추가
            </button>
          </div>

          <div className="space-y-3">
            {studyPoints.map((point, index) => (
              <div key={index} className="rounded-2xl border border-[#dce2ee] p-4">
                <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={STUDY_CATEGORIES.includes(point.category) ? point.category : "직접입력"}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateStudyPoint(index, "category", value === "직접입력" ? "" : value);
                    }}
                    className="h-10 w-full appearance-none rounded-xl border border-[#dce2ee] px-3 pr-9 text-[13px] outline-none"
                  >
                    {STUDY_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                    <option value="직접입력">직접입력</option>
                  </select>

                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8a94a6]">
                    <ChevronDownIcon />
                  </span>
                </div>

                  <button
                    onClick={() => removeStudyPoint(index)}
                    className="h-10 w-10 rounded-xl border border-[#dce2ee] text-[13px] text-[#8a94a6]"
                  >
                    ×
                  </button>
                </div>

                {!STUDY_CATEGORIES.includes(point.category) && (
                  <input
                    value={point.category}
                    onChange={(e) => updateStudyPoint(index, "category", e.target.value)}
                    placeholder="유형 직접입력"
                    className="mt-3 h-10 w-full rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                  />
                )}

                <input
                  value={point.expression}
                  onChange={(e) => updateStudyPoint(index, "expression", e.target.value)}
                  placeholder="제목"
                  className="mt-3 h-11 w-full rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                />

                <div className="mt-2">
                  <EditorToolbar
                    runCommand={runCommand}
                    customColors={customColors}
                    saveCustomColors={saveCustomColors}
                    saveSelection={saveSelection}
                  />
                  <EditorBox
                    setRef={(el) => {
                      studyDescriptionRefs.current[index] = el;
                    }}
                    defaultHtml={point.description}
                    placeholder="설명"
                    onBlur={(html) => updateStudyPoint(index, "description", html)}
                  />
                </div>

                <div className="mt-3 rounded-2xl bg-[#f8fafc] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="pl-1 text-[11px] font-bold text-[#596275]">변형/파생어</p>

                    <button
                      type="button"
                      onClick={() => addStudyPointVariant(index)}
                      className="rounded-full bg-[#eef2f8] px-3 py-1.5 text-[11px] font-bold text-[#0f2a5f]"
                    >
                      + 단어 추가
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(point.variants ?? []).map((variant, variantIndex) => (
                      <div key={variantIndex} className="rounded-xl border border-[#dce2ee] bg-white p-3">
                        <div className="flex gap-2">
                          <input
                            value={variant.word}
                            onChange={(e) =>
                              updateStudyPointVariantWord(index, variantIndex, e.target.value)
                            }
                            placeholder="변형 단어 예: advanced, advance"
                            className="h-10 min-w-0 flex-1 rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => removeStudyPointVariant(index, variantIndex)}
                            className="h-10 w-10 rounded-xl border border-[#dce2ee] text-[13px] text-[#8a94a6]"
                          >
                            ×
                          </button>
                        </div>

                        <div className="mt-3 space-y-3">
                          {variant.meanings.map((meaning, meaningIndex) => (
                            <div key={meaningIndex} className="rounded-xl bg-[#f5f6fa] p-3">
                              <div className="flex gap-2">
                                <div className="relative w-[66px] shrink-0">
                                  <select
                                    value={meaning.pos}
                                    onChange={(e) =>
                                      updateStudyPointVariantMeaning(index, variantIndex, meaningIndex, {
                                        pos: e.target.value,
                                      })
                                    }
                                    className="h-10 w-full appearance-none rounded-xl border border-[#dce2ee] pl-5 pr-7 text-[13px] outline-none"
                                  >
                                    <option value="동">동</option>
                                    <option value="명">명</option>
                                    <option value="형">형</option>
                                    <option value="부">부</option>
                                    <option value="전">전</option>
                                    <option value="접">접</option>
                                    <option value="대">대</option>
                                    <option value="감">감</option>
                                    <option value="숙">숙</option>
                                    <option value="구">구</option>
                                    <option value="한">한</option>
                                  </select>

                                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#8a94a6]">
                                    <ChevronDownIcon />
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateStudyPointVariantMeaning(index, variantIndex, meaningIndex, {
                                      numbered: !meaning.numbered,
                                    })
                                  }
                                  className={`h-10 flex-1 rounded-xl border text-[12px] font-bold ${
                                    meaning.numbered
                                      ? "border-[#0f2a5f] bg-[#eef2f8] text-[#0f2a5f]"
                                      : "border-[#dce2ee] text-[#8a94a6]"
                                  }`}
                                >
                                  <span className="tracking-[0.08em]">① ②</span>
                                  <span className="ml-1">표시 {meaning.numbered ? "ON" : "OFF"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeStudyPointVariantMeaning(index, variantIndex, meaningIndex)
                                  }
                                  className="h-10 w-10 rounded-xl border border-[#dce2ee] text-[13px] text-[#8a94a6]"
                                >
                                  ×
                                </button>
                              </div>

                              <div className="mt-2 space-y-2">
                                {meaning.items.map((item, itemIndex) => (
                                  <div key={itemIndex} className="flex gap-2">
                                    <input
                                      value={item}
                                      onChange={(e) =>
                                        updateStudyPointVariantMeaningItem(
                                          index,
                                          variantIndex,
                                          meaningIndex,
                                          itemIndex,
                                          e.target.value
                                        )
                                      }
                                      placeholder="뜻"
                                      className="h-10 min-w-0 flex-1 rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                                    />

                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeStudyPointVariantMeaningItem(
                                          index,
                                          variantIndex,
                                          meaningIndex,
                                          itemIndex
                                        )
                                      }
                                      className="h-10 w-10 rounded-xl border border-[#dce2ee] text-[13px] text-[#8a94a6]"
                                    >
                                      −
                                    </button>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() =>
                                    addStudyPointVariantMeaningItem(index, variantIndex, meaningIndex)
                                  }
                                  className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#0f2a5f]"
                                >
                                  + 뜻 추가
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <input
                          value={variant.related ?? ""}
                          onChange={(e) => updateStudyPointVariantRelated(index, variantIndex, e.target.value)}
                          placeholder="유의어/동의어 예: on request, reply to, react to"
                          className="mt-3 h-10 w-full rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                        />

                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => addStudyPointVariantMeaning(index, variantIndex)}
                            className="rounded-full bg-[#eef2f8] px-3 py-1.5 text-[11px] font-bold text-[#0f2a5f]"
                          >
                            + 품사 추가
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="pl-1 text-[11px] font-bold text-[#596275]">예시</p>

                    <button
                      type="button"
                      onClick={() => addStudyPointExample(index)}
                      className="rounded-full bg-[#eef2f8] px-3 py-1.5 text-[11px] font-bold text-[#0f2a5f]"
                    >
                      + 예시 추가
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(point.examples?.length
                      ? point.examples
                      : [{ en: point.exampleEn, ko: point.exampleKo }]
                    ).map((example, exampleIndex) => (
                      <div
                        key={exampleIndex}
                        className="rounded-xl border border-[#dce2ee] bg-white p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <p className="pl-1 text-[11px] font-bold text-[#8a94a6]">
                            예시 {exampleIndex + 1}
                          </p>

                          <button
                            type="button"
                            onClick={() => removeStudyPointExample(index, exampleIndex)}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f5f6fa] text-[15px] text-[#8a94a6]"
                            aria-label="예시 삭제"
                          >
                            ×
                          </button>
                        </div>

                        <div>
                          <EditorToolbar
                            runCommand={runCommand}
                            customColors={customColors}
                            saveCustomColors={saveCustomColors}
                            saveSelection={saveSelection}
                          />
                          <InlineEditorBox
                            setRef={(el) => {
                              studyExampleEnRefs.current[`${index}-${exampleIndex}`] = el;
                            }}
                            defaultHtml={example.en}
                            placeholder="영어 예시"
                          />
                        </div>

                        <input
                          value={example.ko}
                          onChange={(e) =>
                            updateStudyPointExample(index, exampleIndex, "ko", e.target.value)
                          }
                          placeholder="한국어 해석"
                          className="mt-2 h-11 w-full rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            if (!word.trim()) return alert("영어 단어를 입력해줘.");
            if (!dayId) return alert("Day를 선택해줘.");

            const cleanedMeanings = meanings
              .map((group) => ({
                ...group,
                items: group.items.map((item) => item.trim()).filter(Boolean),
              }))
              .filter((group) => group.items.length > 0);

            const cleanedExamples = examples
              .map((example) => ({
                en: example.en.trim(),
                ko: example.ko.trim(),
              }))
              .filter((example) => example.en || example.ko);

              const cleanedStudyPoints = studyPoints
                .map((point, index) => {
                  const category = (point.category ?? "").trim();
                  const expression = (point.expression ?? "").trim();
                  const description = cleanEditorHtml(
                    studyDescriptionRefs.current[index]?.innerHTML ?? point.description ?? ""
                  );
                  const related = "";
                  const examples = (point.examples?.length
                    ? point.examples
                    : [{ en: point.exampleEn ?? "", ko: point.exampleKo ?? "" }]
                  )
                    .map((example, exampleIndex) => ({
                      en: cleanEditorHtml(
                        studyExampleEnRefs.current[`${index}-${exampleIndex}`]?.innerHTML ??
                          example.en ??
                          ""
                      ),
                      ko: (example.ko ?? "").trim(),
                    }))
                    .filter((example) => example.en || example.ko);
                  const exampleEn = examples[0]?.en ?? "";
                  const exampleKo = examples[0]?.ko ?? "";
                  const variants = (point.variants ?? [])
                    .map((variant) => {
                      const meanings = (variant.meanings ?? [])
                        .map((meaning) => ({
                          pos: (meaning.pos ?? "").trim(),
                          items: (meaning.items ?? []).map((item) => item.trim()).filter(Boolean),
                          numbered: meaning.numbered ?? false,
                        }))
                        .filter((meaning) => meaning.pos && meaning.items.length > 0);

                      return {
                        word: (variant.word ?? "").trim(),
                        meanings,
                        related: (variant.related ?? "").trim(),
                      };
                    })
                    .filter((variant) => variant.word || variant.meanings.length > 0 || variant.related);

                  const hasContent =
                    expression || description || related || variants.length > 0 || examples.length > 0;

                  return {
                    category: category || (hasContent ? "기타" : ""),
                    expression,
                    description,
                    related,
                    exampleEn,
                    exampleKo,
                    examples,
                    variants,
                  };
                })
                .filter(
                  (point) =>
                    point.category ||
                    point.expression ||
                    point.description ||
                    point.related ||
                    point.exampleEn ||
                    point.exampleKo ||
                    (point.variants?.length ?? 0) > 0
                );
            
            onSave(dayId, {
              id: initialWord?.id || crypto.randomUUID(),
              word: word.trim(),
              meanings: cleanedMeanings,
              examples: cleanedExamples,
              synonyms: cleanLinkedTerms(synonyms),
              antonyms: cleanLinkedTerms(antonyms),
              studyPoints: cleanedStudyPoints,
              memorized: initialWord?.memorized ?? false,
              highlightColor: initialWord?.highlightColor || "",
              importanceStars: initialWord?.importanceStars ?? 0,
              createdAt: initialWord?.createdAt || new Date().toISOString(),
            });
          }}
          className="h-12 w-full rounded-full bg-[#0f2a5f] text-[13px] font-bold text-white"
        >
          저장
        </button>
      </div>
    </div>
  );
}

function splitComma(value: string): RelatedWord[] {
  return value
    .split(",")
    .map((v: string) => v.trim())
    .filter(Boolean)
    .map((text) => ({
      text,
      meaningRef: null,
    }));
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-[13px] text-[#8a94a6]">
      <ChevronLeft />
      <span>{label}</span>
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <p className="mb-2 pl-1.5 text-[12px] font-bold text-[#596275]">
        {label}
      </p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-[#dce2ee] px-4 text-[14px] outline-none"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <p className="mb-2 pl-1.5 text-[12px] font-bold text-[#596275]">{label}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="max-h-[92px] w-full resize-none overflow-y-auto rounded-2xl border border-[#dce2ee] px-4 py-3 text-[14px] outline-none"
      />
    </label>
  );
}

function LinkedTermEditor({
  title,
  items,
  meaningOptions,
  placeholder,
  onChangeAll,
}: {
  title: string;
  items: LinkedTerm[];
  meaningOptions: { value: string; label: string; text: string }[];
  placeholder: string;
  onChangeAll: Dispatch<SetStateAction<LinkedTerm[]>>;
}) {
  const safeItems = items.length
    ? items
    : [{ text: "", meaningRef: "", meaningLabel: "" }];

  const updateItem = (index: number, next: Partial<LinkedTerm>) => {
    onChangeAll((prev) => {
      const list = prev.length ? prev : [{ text: "", meaningRef: "", meaningLabel: "" }];

      return list.map((item, i) =>
        i === index ? { ...item, ...next } : item
      );
    });
  };

  const addItem = () => {
    onChangeAll((prev) => [
      ...prev,
      { text: "", meaningRef: "", meaningLabel: "" },
    ]);
  };

  const removeItem = (index: number) => {
    onChangeAll((prev) => {
      if (prev.length <= 1) return [{ text: "", meaningRef: "", meaningLabel: "" }];
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="pl-1.5 text-[12px] font-bold text-[#596275]">{title}</p>

        <button
          onClick={addItem}
          className="rounded-full bg-[#eef2f8] px-3 py-1.5 text-[11px] font-bold text-[#0f2a5f]"
        >
          + 추가
        </button>
      </div>

      <div className="space-y-3">
        {safeItems.map((item, index) => (
          <div key={index} className="rounded-2xl border border-[#dce2ee] p-4">
            <div className="flex gap-2">
              <div className="relative w-[100px] shrink-0">
                <select
                  value={item.meaningRef || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const option = meaningOptions.find((opt) => opt.value === value);

                    updateItem(index, {
                      meaningRef: value,
                      meaningLabel: option?.label || "",
                    });
                  }}
                  className="h-11 w-full appearance-none rounded-xl border border-[#dce2ee] px-3 pr-8 text-[12px] outline-none"
                >
                  <option value="">연결 없음</option>

                  {meaningOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#8a94a6]">
                  <ChevronDownIcon />
                </span>
              </div>

              <div className="relative min-w-0 flex-1">
                <input
                  value={item.text}
                  onChange={(e) => updateItem(index, { text: e.target.value })}
                  placeholder={placeholder}
                  className="h-11 w-full rounded-xl border border-[#dce2ee] px-3 pr-12 text-[13px] outline-none"
                />

                <button
                  onClick={() => removeItem(index)}
                  className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#f5f6fa] text-[15px] text-[#8a94a6]"
                  aria-label={`${title} 삭제`}
                >
                  ×
                </button>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="mt-8 rounded-[22px] border border-dashed border-[#dce2ee] p-8 text-center text-[13px] text-[#8a94a6]">
      {text}
    </div>
  );
}

function Block({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="py-3">
      {title && (
        <p
        className={`mb-2 text-[12px] font-bold tracking-[-0.01em] text-[#8a94a6] ${
          title === "반의어" ? "pl-[1px]" : ""
        }`}
      >
        {title}
      </p>
      )}

      <div>{children}</div>
    </div>
  );
}

function ChipList({
  items,
  meanings,
  tone = "blue",
}: {
  items: (string | LinkedTerm)[];
  meanings: Meaning[];
  tone?: "blue" | "red";
}) {
  const circledNums = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];

  const formatLabel = (label?: string, ref?: string) => {
    if (!label) return "";
  
    const [pos, num] = label.split(" ");
  
    if (!ref) return pos;
  
    const [groupIndex] = ref.split(":").map(Number);
    const group = meanings[groupIndex];
  
    if (!group?.numbered) return pos;
  
    const displayNum = circledNums[Number(num) - 1] || num;
    return num ? `${pos} ${displayNum}` : pos;
  };

  const groups = items.reduce<Record<string, string[]>>((acc, item) => {
    const text = typeof item === "string" ? item : item.text;
    const label =
      typeof item === "string"
        ? ""
        : formatLabel(item.meaningLabel, item.meaningRef);
  
    const words = text
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean);
  
    if (!acc[label]) acc[label] = [];
    acc[label].push(...words);
  
    return acc;
  }, {});

  const wordChipClass =
    tone === "red"
      ? "rounded-full bg-[#fdeeee] px-3 py-1 text-[12px] leading-none text-[#b42318]"
      : "rounded-full bg-[#eef2f8] px-3 py-1 text-[12px] leading-none text-[#0f2a5f]";

  const labelClass =
    tone === "red"
      ? "inline-flex h-[18px] shrink-0 items-center justify-center rounded-[8px] bg-[#b42318] px-1.5 text-[10px] font-bold leading-none text-white"
      : "inline-flex h-[18px] shrink-0 items-center justify-center rounded-[8px] bg-[#4b6cb7] px-1.5 text-[10px] font-bold leading-none text-white";

  return (
    <div className="space-y-2">
      {Object.entries(groups).map(([label, words]) => (
        <div key={label || words.join("-")} className="flex flex-wrap items-center gap-2">
          {label && <span className={labelClass}>{label}</span>}

          {words.map((word, index) => (
            <MobilePronounceButton
              key={`${word}-${index}`}
              text={word}
              className={wordChipClass}
            >
              {word}
            </MobilePronounceButton>
          ))}
        </div>
      ))}
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 6L9 12L15 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 10.5L12 4L20 10.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 10V20H17.5V10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HighlightedText({ text, keyword }: { text: string; keyword: string }) {
  if (!text) return null;

  const chunks = text.split(/(\[\[.*?\]\])/g);
  const escapedKeyword = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const autoRegex = escapedKeyword
    ? new RegExp(`\\b(${escapedKeyword}(?:s|es|ed|ing)?)\\b`, "gi")
    : null;

  return (
    <>
      {chunks.map((chunk, chunkIndex) => {
        if (chunk.startsWith("[[") && chunk.endsWith("]]")) {
          return (
            <strong key={chunkIndex} className="font-bold text-[#d92d20]">
              {chunk.slice(2, -2)}
            </strong>
          );
        }

        if (!autoRegex) return <span key={chunkIndex}>{chunk}</span>;

        return (
          <span key={chunkIndex}>
            {chunk.split(autoRegex).map((part, index) => {
              const checkRegex = new RegExp(`^${escapedKeyword}(?:s|es|ed|ing)?$`, "i");

              return checkRegex.test(part) ? (
                <strong key={index} className="font-bold text-[#d92d20]">
                  {part}
                </strong>
              ) : (
                <span key={index}>{part}</span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

function MoveFolderList({
  folder,
  currentId,
  onSelect,
  disabledIds = [],
}: {
  folder: Folder;
  currentId: string;
  onSelect: (id: string) => void;
  disabledIds?: string[];
}) {
  if (folder.id === currentId) return null;

  const disabled = disabledIds.includes(folder.id);

  return (
    <div className="space-y-2">
      <button
        disabled={disabled}
        onClick={() => onSelect(folder.id)}
        className={`w-full rounded-2xl border border-[#dce2ee] px-4 py-4 text-left ${
          disabled ? "opacity-35" : ""
        }`}
      >
        {folder.title}
      </button>

      {folder.folders.length > 0 && (
        <div className="ml-4 space-y-2">
          {folder.folders.map((child) => (
            <MoveFolderList
              key={child.id}
              folder={child}
              currentId={currentId}
              disabledIds={disabledIds}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EditorBox({
  setRef,
  defaultHtml,
  placeholder,
  onBlur,
}: {
  setRef: (el: HTMLDivElement | null) => void;
  defaultHtml: string;
  placeholder: string;
  onBlur?: (html: string) => void;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!innerRef.current) return;
    innerRef.current.innerHTML = defaultHtml;
  }, [defaultHtml]);

  return (
    <div
      ref={(el) => {
        innerRef.current = el;
        setRef(el);
      }}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={(e) => resetEditorIfEmpty(e.currentTarget)}
      onBlur={(e) => {
        resetEditorIfEmpty(e.currentTarget);
        onBlur?.(cleanEditorHtml(e.currentTarget.innerHTML));
      }}
      className="min-h-[96px] w-full whitespace-pre-wrap rounded-b-xl border border-t-0 border-[#dce2ee] bg-white px-3 py-3 text-[13px] leading-[1.8] text-[#303236] outline-none empty:before:text-[#a3abb8] empty:before:content-[attr(data-placeholder)]"
    />
  );
}

function InlineEditorBox({
  setRef,
  defaultHtml,
  placeholder,
}: {
  setRef: (el: HTMLDivElement | null) => void;
  defaultHtml: string;
  placeholder: string;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!innerRef.current) return;
    innerRef.current.innerHTML = defaultHtml;
  }, [defaultHtml]);

  return (
    <div
      ref={(el) => {
        innerRef.current = el;
        setRef(el);
      }}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={(e) => resetEditorIfEmpty(e.currentTarget)}
      className="min-h-[44px] w-full whitespace-pre-wrap rounded-b-xl border border-t-0 border-[#dce2ee] bg-white px-3 py-3 text-[13px] leading-[1.5] text-[#303236] outline-none empty:before:text-[#a3abb8] empty:before:content-[attr(data-placeholder)]"
    />
  );
}

function EditorToolbar({
  runCommand,
  customColors,
  saveCustomColors,
  saveSelection,
}: {
  runCommand: (command: string, value?: string) => void;
  customColors: string[];
  saveCustomColors: (colors: string[]) => void;
  saveSelection: () => void;
}) {
  const [textPaletteOpen, setTextPaletteOpen] = useState(false);
  const [highlightPaletteOpen, setHighlightPaletteOpen] = useState(false);
  const baseColors = ["#e45f5f", "#4778c7", "#f1d466", "#83bd95", "#b79add"];

  const addCustomColor = (color: string) => {
    const next = color.trim();

    if (!/^#[0-9a-fA-F]{6}$/.test(next)) {
      alert("#000000 형식으로 입력해줘.");
      return;
    }

    if (customColors.includes(next)) return;
    saveCustomColors([...customColors, next]);
  };

  const deleteCustomColor = (color: string) => {
    if (!confirm("이 색상을 삭제할까?")) return;
    saveCustomColors(customColors.filter((item) => item !== color));
  };

  return (
    <div className="relative flex min-h-8 flex-wrap items-center gap-1 rounded-t-xl border border-[#dce2ee] bg-[#f8fafc] px-2 py-1.5">
      <ToolIcon onClick={() => runCommand("bold")}>B</ToolIcon>
      <ToolIcon onClick={() => runCommand("underline")}>
        <span className="underline">U</span>
      </ToolIcon>
      <ToolIcon onClick={() => runCommand("italic")}>
        <span className="italic">I</span>
      </ToolIcon>
      <ToolIcon onClick={() => runCommand("strikeThrough")}>
        <span className="line-through">S</span>
      </ToolIcon>

      <span className="mx-0.5 h-4 w-px bg-[#d7ddea]" />

      <div className="relative">
        <ToolIcon
          onClick={() => {
            saveSelection();
            setTextPaletteOpen((prev) => !prev);
            setHighlightPaletteOpen(false);
          }}
        >
          <span className="font-black text-[#22c55e]">C</span>
        </ToolIcon>

        {textPaletteOpen && (
          <ColorPalette
            baseColors={baseColors}
            customColors={customColors}
            onNone={() => runCommand("foreColor", "#303236")}
            onPick={(color) => runCommand("foreColor", color)}
            onAdd={addCustomColor}
            onDelete={deleteCustomColor}
            onClose={() => setTextPaletteOpen(false)}
          />
        )}
      </div>

      <div className="relative">
        <ToolIcon
          onClick={() => {
            saveSelection();
            setHighlightPaletteOpen((prev) => !prev);
            setTextPaletteOpen(false);
          }}
        >
          <span className="rounded-[3px] bg-[#22c55e] px-1 font-black text-white">C</span>
        </ToolIcon>

        {highlightPaletteOpen && (
          <ColorPalette
            baseColors={baseColors}
            customColors={customColors}
            onNone={() => runCommand("backColor", "transparent")}
            onPick={(color) => runCommand("backColor", color)}
            onAdd={addCustomColor}
            onDelete={deleteCustomColor}
            onClose={() => setHighlightPaletteOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function ToolIcon({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-6 min-w-6 items-center justify-center rounded-[5px] border border-[#cfd6e3] bg-white px-1.5 text-[11px] font-bold text-[#303236] active:bg-[#eef2f8]"
    >
      {children}
    </button>
  );
}

function ColorPalette({
  baseColors,
  customColors,
  onNone,
  onPick,
  onAdd,
  onDelete,
  onClose,
}: {
  baseColors: string[];
  customColors: string[];
  onNone: () => void;
  onPick: (color: string) => void;
  onAdd: (color: string) => void;
  onDelete: (color: string) => void;
  onClose: () => void;
}) {
  const [newColor, setNewColor] = useState("#000000");
  const colors = [...baseColors, ...customColors];

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
        aria-label="색상창 닫기"
      />

      <div className="absolute left-0 top-8 z-50 w-[220px] rounded-[12px] border border-[#cfd6e3] bg-white p-2 shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onNone();
              onClose();
            }}
            className="h-6 rounded-md border border-[#dce2ee] px-2 text-[10px] font-bold text-[#596275]"
          >
            없음
          </button>

          {colors.map((color) => {
            const isCustom = customColors.includes(color);

            return (
              <div key={color} className="relative">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(color);
                    onClose();
                  }}
                  className="h-6 w-6 rounded-[6px] border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"
                  style={{ backgroundColor: color }}
                  title={color}
                />

                {isCustom && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(color);
                    }}
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#111827] text-[9px] font-bold leading-none text-white"
                    aria-label="색상 삭제"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-7 w-8 rounded-md border border-[#dce2ee] bg-white"
          />

          <input
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            placeholder="#000000"
            maxLength={7}
            className="h-7 min-w-0 flex-1 rounded-md border border-[#dce2ee] px-2 text-[11px] font-bold text-[#596275] outline-none"
          />

          <button
            type="button"
            onClick={() => onAdd(newColor)}
            className="h-7 rounded-md bg-[#0f2a5f] px-2 text-[10px] font-bold text-white"
          >
            추가
          </button>
        </div>
      </div>
    </>
  );
}

function FolderTreeRows({
  folders,
  depth = 0,
  basePath,
  expandedIds,
  onToggle,
  onSelect,
  onOpenAction,
  longPressTimer,
  didLongPress,
}: {
  folders: Folder[];
  depth?: number;
  basePath: string[];
  expandedIds: string[];
  onToggle: (id: string) => void;
  onSelect: (path: string[]) => void;
  onOpenAction: (id: string) => void;
  longPressTimer: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  didLongPress: MutableRefObject<boolean>;
}) {
  return (
    <>
      {folders.map((folder, index) => {
        const hasChildren = folder.folders.length > 0;
        const open = expandedIds.includes(folder.id);
        const path = [...basePath, folder.id];

        return (
          <div
            key={folder.id}
            className={depth === 0 ? "overflow-hidden rounded-[16px] bg-white" : ""}
          >
            <div
              className={`flex h-[46px] items-center bg-white active:bg-[#f7f8fb] ${
                depth > 0 ? "border-t border-[#e5e7eb]" : ""
              }`}
              style={{ paddingLeft: 4 + depth * 18, paddingRight: 4 }}
            >
              <button
                onClick={() => {
                  if (didLongPress.current) {
                    didLongPress.current = false;
                    return;
                  }

                  onSelect(path);
                }}
                onPointerDown={() => {
                  didLongPress.current = false;

                  longPressTimer.current = setTimeout(() => {
                    didLongPress.current = true;
                    onOpenAction(folder.id);
                  }, 450);
                }}
                onPointerUp={() => {
                  if (longPressTimer.current) clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }}
                onPointerCancel={() => {
                  if (longPressTimer.current) clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }}
                onPointerLeave={() => {
                  if (longPressTimer.current) clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onOpenAction(folder.id);
                }}
                className="min-w-0 flex-1 touch-none select-none truncate text-left"
              >
                <span
                  className={`truncate tracking-[-0.03em] ${
                    depth === 0
                      ? "text-[15px] font-semibold text-[#303236]"
                      : "text-[14px] font-medium text-[#666a70]"
                  }`}
                >
                  {folder.title}
                </span>
              </button>

              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(folder.id);
                  }}
                  className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0f2a5f] text-white active:scale-95"
                >
                  <ChevronToggle open={open} />
                </button>
              ) : (
                <span className="ml-2 h-5 w-5 shrink-0" />
              )}
            </div>

            {hasChildren && open && (
              <FolderTreeRows
                folders={folder.folders}
                depth={depth + 1}
                basePath={path}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onSelect={onSelect}
                onOpenAction={onOpenAction}
                longPressTimer={longPressTimer}
                didLongPress={didLongPress}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function MenuFolderTree({
  folder,
  path,
  depth,
  selectedPath,
  expandedIds,
  onToggle,
  onSelect,
}: {
  folder: Folder;
  path: string[];
  depth: number;
  selectedPath: string[];
  expandedIds: string[];
  onToggle: (folderId: string) => void;
  onSelect: (path: string[]) => void;
}) {
  const children = folder.folders;

  const isOpen = expandedIds.includes(folder.id);
  const isSelected =
    selectedPath.length === path.length &&
    selectedPath.every((id, index) => id === path[index]);

  const canSelect = true;
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className={`flex w-full items-center rounded-xl px-2.5 py-2 ${
          isSelected ? "bg-[#f8fbff] text-[#0f2a5f]" : "text-[#111827]"
        }`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
      >
        <button
          type="button"
          disabled={!canSelect}
          onClick={() => onSelect(path)}
          className={`min-w-0 flex-1 text-left ${
            canSelect ? "" : "cursor-default"
          }`}
        >
          <p
            className={`truncate ${
              depth === 0
                ? "text-[13px] font-bold"
                : "text-[12px] font-semibold"
            }`}
          >
            {folder.title}
          </p>

          {hasChildren && (
            <p className="mt-0.5 text-[9px] font-medium text-[#a3abb8]">
              하위폴더 {children.length}개
            </p>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            if (hasChildren) onToggle(folder.id);
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-[13px] text-[#8a94a6]"
        >
          {hasChildren ? (isOpen ? "⌃" : "⌄") : isSelected ? "✓" : ""}
        </button>
      </div>

      {isOpen && hasChildren && (
        <div className="mt-1 space-y-1">
          {children.map((child) => (
            <MenuFolderTree
              key={child.id}
              folder={child}
              path={[...path, child.id]}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronToggle({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
