"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type Meaning = {
  pos: string;
  items: string[];
  numbered: boolean;
};

type StudyPoint = {
  category: string;
  expression: string;
  description: string;
  related: string;
  exampleEn: string;
  exampleKo: string;
};

type Word = {
  id: string;
  word: string;
  meanings: Meaning[];
  examples: { en: string; ko: string }[];
  synonyms: string[];
  antonyms: string[];
  studyPoints?: StudyPoint[];
  memorized?: boolean;
  highlightColor?: "red" | "blue" | "yellow" | "green" | "purple" | "";
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

type Book = Folder;

export default function Home() {
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
  const folderLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressFolder = useRef(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [wordSortOrder, setWordSortOrder] = useState<"latest" | "oldest">("oldest");

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

  useEffect(() => {
    const state = {
      step,
      selectedBookId,
      folderPath,
      selectedDayId,
      wordIndex,
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

  const startStudy = (index: number) => {
    setWordIndex(index);
    setShowMeaning(false);
    setActionWordIndex(null);
    setStep("study");
  };

  const nextWord = () => {
    setWordIndex((prev) => Math.min(prev + 1, Math.max(words.length - 1, 0)));
  };
  
  const prevWord = () => {
    setWordIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleStudyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    studyTapStart.current = { x: e.clientX, y: e.clientY };
  };
  
  const handleStudyPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!studyTapStart.current) return;
  
    const target = e.target as HTMLElement;
  
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("select")
    ) {
      studyTapStart.current = null;
      return;
    }
  
    const movedX = Math.abs(e.clientX - studyTapStart.current.x);
    const movedY = Math.abs(e.clientY - studyTapStart.current.y);
  
    if (movedX > 10 || movedY > 10) {
      studyTapStart.current = null;
      return;
    }
  
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
  
    if (y < 58) {
      studyTapStart.current = null;
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
  
    studyTapStart.current = null;
  };

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

  return `${percent}% (${memorized}/${total})`;
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
                            setSelectedBookId(book.id);
                            setFolderPath([book.id, folder.id]);
                            setSelectedDayId("");
                            setWordIndex(0);
                            setShowMeaning(false);
                            setStep("day");
                          }}
                          className="flex h-[50px] w-full items-center border-b border-[#e5e7eb] pl-[45px] text-left active:bg-[#fafafa]"
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
              onClick={() => {
                setStep("book");
                setFolderPath([]);
                setSelectedBookId("");
              }}
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
              {activeFolder.folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => {
                    if (didLongPressFolder.current) {
                      didLongPressFolder.current = false;
                      return;
                    }
                
                    setFolderPath((prev) => [...prev, folder.id]);
                  }}
                  onPointerDown={(e) => {
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
                  className="w-full touch-none select-none rounded-[18px] border border-[#e4e8f0] bg-[#f8fafc] px-4 py-4 text-left active:scale-[0.99]"
                >
                  <p className="text-[17px] font-bold text-[#111827]">
                    {folder.title}
                  </p>
                  <div className="mt-1 flex gap-1.5">
                    {folder.folders.length > 0 && (
                      <span className="text-[10px] text-[#a3abb8]">
                        하위 폴더 {folder.folders.length}개
                      </span>
                    )}

                    {folder.days.length > 0 && (
                      <span className="text-[10px] text-[#a3abb8]">
                        Day {folder.days.length}개
                      </span>
                    )}
                  </div>
                </button>
              ))}

              {activeFolder.days.map((day) => (
                <button
                  key={day.id}
                  onClick={() => goWordList(day.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setActionDayId(day.id);
                  }}
                  className="w-full rounded-[16px] px-3 py-3 text-left active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <p className="truncate text-[17px] font-bold text-[#111827]">
                        {day.title}
                      </p>

                      <span className="shrink-0 pt-[1px] text-[11px] font-medium tracking-[-0.015em] text-[#d1d5db]">
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

            <div className="mt-5 flex items-start justify-between">
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

            <div className="mt-7 space-y-2">
              {selectedDay.words.length === 0 ? (
                <Empty text="이 Day에는 아직 단어가 없어." />
              ) : (
                sortedWords.map(({ word: item, originalIndex }) => (
                  <div key={item.id} className="relative overflow-hidden rounded-[18px] bg-[#f1f3f6]">
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
                      className="relative z-10 w-full rounded-[18px] border border-[#e4e8f0] bg-white px-4 py-4 text-left shadow-[0_3px_10px_rgba(15,23,42,0.04)] transition-transform active:scale-[0.99]"
                      style={{ transform: `translateX(${getSwipeX(originalIndex)}px)` }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
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
                
                          <p className="mt-1 truncate text-[12px] text-[#8a94a6]">
                            {item.meanings[0]?.items?.join(", ") || "뜻 없음"}
                          </p>
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
              className="relative flex min-h-[100svh] flex-col px-4 pt-4 pb-6"
              onPointerDown={handleStudyPointerDown}
              onPointerUp={handleStudyPointerUp}
            >
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
                {words.length ? wordIndex + 1 : 0} / {words.length}
              </p>

              <div className="flex items-center gap-1">
            

                <button
                  onClick={() => setStep("editWord")}
                  className="h-9 rounded-full bg-[#eef2f8] px-3 text-[12px] font-bold text-[#0f2a5f]"
                >
                  수정
                </button>

                <button
                  onClick={() => deleteWord(wordIndex)}
                  className="h-9 rounded-full px-2 text-[12px] font-bold text-[#b42318]"
                >
                  삭제
                </button>
              </div>
            </header>

            {!currentWord ? (
              <Empty text="이 Day에는 아직 단어가 없어." />
            ) : (
              <>
                <section className="relative mt-3 flex h-[155px] shrink-0 items-center justify-center rounded-[22px] border border-[#dce2ee] bg-white">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMemorized(wordIndex);
                  }}
                  className={`absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
                    currentWord.memorized
                      ? "border-[#0f2a5f] bg-[#0f2a5f] shadow-[0_6px_14px_rgba(15,42,95,0.22)]"
                      : "border-[#dce2ee] bg-[#f8fafc]"
                  }`}
                  aria-label="암기완료"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5.5 12.5L10 17L18.8 7.5"
                      stroke={currentWord.memorized ? "white" : "#9aa3b2"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                  <h2
                    className={`text-[44px] font-bold tracking-tight ${
                      currentWord.memorized
                        ? "text-[#b0b7c3] line-through decoration-[#b0b7c3]"
                        : "text-[#0f2a5f]"
                    }`}
                  >
                    {currentWord.word}
                  </h2>
                </section>

                <section
                  className={`relative z-[2] mt-4 min-h-0 flex-1 overflow-hidden transition-opacity duration-200 ${
                    showMeaning ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  <div
                    className="h-full overflow-y-auto px-3 pb-4"
                  >
                    <Block>
                      <div className="space-y-2">
                        {currentWord.meanings.map((group) => (
                          <div
                            key={`${group.pos}-${group.items.join("")}`}
                            className="flex items-start gap-2 text-[14px] leading-relaxed"
                          >
                            <span className="mt-[2px] inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] bg-[#0f2a5f] text-[11px] font-bold text-white">
                              {group.pos}
                            </span>

                            <div className="min-w-0 flex-1">
                              {group.numbered ? (
                                <div className="flex flex-wrap items-center gap-x-[7px] gap-y-1">
                                  {group.items.map((item, index) => (
                                    <span key={item} className="inline-flex items-center gap-[3px]">
                                      <span className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-full bg-[#9aa3b2] text-[9px] font-bold text-white">
                                        {index + 1}
                                      </span>
                                      <span>{item}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="break-keep">{group.items.join(", ")}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Block>

                    {currentWord.examples.length > 0 && (
                      <Block title="예문">
                        <div className="max-h-[190px] space-y-3 overflow-y-auto pr-1">
                          {currentWord.examples.map((ex, i) => (
                            <div key={`${ex.en}-${i}`} className="pl-[2px]">
                              <p className="text-[13px] leading-relaxed">
                                <HighlightedText text={ex.en} keyword={currentWord.word} />
                              </p>
                              {ex.ko && (
                                <p className="mt-0.5 text-[11px] leading-relaxed text-[#8a94a6]">
                                  {ex.ko}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </Block>
                    )}

                    {currentWord.synonyms.length > 0 && (
                      <Block title="동의어">
                        <ChipList items={currentWord.synonyms} />
                      </Block>
                    )}

                    {currentWord.antonyms.length > 0 && (
                      <Block title="반의어">
                        <ChipList items={currentWord.antonyms} tone="red" />
                      </Block>
                    )}
                    {(currentWord.studyPoints ?? []).length > 0 && (
                      <Block>
                        <div className="space-y-3">
                          {(currentWord.studyPoints ?? []).map((point, index) => (
                            <div key={index} className="rounded-2xl bg-[#f5f6fa] px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-[#e7ecf5] px-2 py-1 text-[10px] font-bold text-[#0f2a5f]">
                                  {point.category}
                                </span>

                                {point.expression && (
                                  <p className="text-[13px] font-bold text-[#111827]">
                                    {point.expression}
                                  </p>
                                )}
                              </div>

                              {point.description && (
                                <p className="mt-2 text-[12px] leading-relaxed text-[#596275]">
                                  {point.description}
                                </p>
                              )}

                              {point.related && (
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-[4px] bg-[#4b6cb7] px-[3px] text-[8px] font-bold text-white">
                                    유
                                  </span>

                                  <p className="text-[12px] font-bold tracking-[-0.01em] text-[#4b6cb7]">
                                    {point.related}
                                  </p>
                                </div>
                              )}

                              {(point.exampleEn || point.exampleKo) && (
                                <div className="mt-3 border-l-2 border-[#d7ddea] pl-3">
                                  {point.exampleEn && (
                                    <p className="text-[12px] leading-relaxed text-[#596275]">
                                      <HighlightedText
                                        text={point.exampleEn}
                                        keyword={currentWord.word}
                                      />
                                    </p>
                                  )}

                                  {point.exampleKo && (
                                    <p className={`${point.exampleEn ? "mt-1" : ""} text-[11px] leading-relaxed text-[#8a94a6]`}>
                                      {point.exampleKo}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </Block>
                    )}
                  </div>
                </section>
              </>
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
            defaultTitle={`Day ${activeFolder.days.length + 1}`}
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

        {actionDayId !== null && actionDayId !== "__sort__" && activeFolder && (
          <div
            onClick={() => setActionDayId(null)}
            className="fixed inset-0 z-30 flex items-end bg-black/25"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="mx-auto w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
            >
              <p className="text-[16px] font-bold text-[#111827]">
                {activeFolder?.days.find((day) => day.id === actionDayId)?.title}
              </p>

              <div className="mt-5 space-y-2">
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
              <div className="space-y-2">
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
                  title: `Day ${i + 1}`,
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
                      title: `Day ${i + 1}`,
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
  defaultTitle,
  onBack,
  onSave,
}: {
  defaultTitle: string;
  onBack: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);

  return (
    <div className="min-h-dvh px-5 pt-7 pb-6">
      <BackButton onClick={onBack} label="뒤로" />

      <h1 className="mt-5 text-[28px] font-bold text-[#0f2a5f]">Day 추가</h1>

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

  const [synonyms, setSynonyms] = useState(initialWord?.synonyms.join(", ") || "");
  const [antonyms, setAntonyms] = useState(initialWord?.antonyms.join(", ") || "");
  const [studyPoints, setStudyPoints] = useState<StudyPoint[]>(
    initialWord?.studyPoints?.length
      ? initialWord.studyPoints
      : [
          {
            category: "",
            expression: "",
            description: "",
            related: "",
            exampleEn: "",
            exampleKo: "",
          },
        ]
  );

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
        category: "",
        expression: "",
        description: "",
        related: "",
        exampleEn: "",
        exampleKo: "",
      },
    ]);
  };

  const updateStudyPoint = (index: number, key: keyof StudyPoint, value: string) => {
    setStudyPoints((prev) =>
      prev.map((point, i) => (i === index ? { ...point, [key]: value } : point))
    );
  };

  const removeStudyPoint = (index: number) => {
    setStudyPoints((prev) => prev.filter((_, i) => i !== index));
  };

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
                    <input
                      key={itemIndex}
                      value={item}
                      onChange={(e) => updateMeaningItem(groupIndex, itemIndex, e.target.value)}
                      placeholder={group.numbered ? `${itemIndex + 1}번째 뜻` : "뜻 입력"}
                      className="h-11 w-full rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                    />
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

        <TextArea
          label="동의어"
          value={synonyms}
          onChange={setSynonyms}
          placeholder="rank, emphasize, focus on"
          rows={2}
        />

        <TextArea
          label="반의어"
          value={antonyms}
          onChange={setAntonyms}
          placeholder="ignore, neglect"
          rows={2}
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

                <textarea
                  value={point.description}
                  onChange={(e) => updateStudyPoint(index, "description", e.target.value)}
                  placeholder="설명"
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-[#dce2ee] px-3 py-3 text-[13px] outline-none"
                />

                <input
                  value={point.related}
                  onChange={(e) => updateStudyPoint(index, "related", e.target.value)}
                  placeholder="유사 표현/동의어 예: on request, reply to, react to"
                  className="mt-2 h-11 w-full rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                />

                <input
                  value={point.exampleEn}
                  onChange={(e) => updateStudyPoint(index, "exampleEn", e.target.value)}
                  placeholder="영어 예시"
                  className="mt-2 h-11 w-full rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                />

                <input
                  value={point.exampleKo}
                  onChange={(e) => updateStudyPoint(index, "exampleKo", e.target.value)}
                  placeholder="한국어 해석"
                  className="mt-2 h-11 w-full rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                />
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

            onSave(dayId, {
              id: initialWord?.id || crypto.randomUUID(),
              word: word.trim(),
              meanings: cleanedMeanings,
              examples: cleanedExamples,
              synonyms: splitComma(synonyms),
              antonyms: splitComma(antonyms),
              studyPoints: studyPoints
              .map((point) => ({
                category: point.category.trim(),
                expression: point.expression.trim(),
                description: point.description.trim(),
                related: point.related.trim(),
                exampleEn: point.exampleEn.trim(),
                exampleKo: point.exampleKo.trim(),
              }))
              .filter(
                (point) =>
                  point.category ||
                  point.expression ||
                  point.description ||
                  point.related ||
                  point.exampleEn ||
                  point.exampleKo
              ),
              memorized: initialWord?.memorized ?? false,
              highlightColor: initialWord?.highlightColor || "",
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

function splitComma(value: string) {
  return value
    .split(",")
    .map((v: string) => v.trim())
    .filter(Boolean);
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
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="py-3">
      {title && (
        <p
        className={`mb-2 text-[11px] font-bold tracking-[-0.01em] text-[#8a94a6] ${
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

function ChipList({ items, tone = "blue" }: { items: string[]; tone?: "blue" | "red" }) {
  const className =
    tone === "red"
      ? "rounded-full bg-[#fdeeee] px-3 py-1 text-[11px] text-[#b42318]"
      : "rounded-full bg-[#eef2f8] px-3 py-1 text-[11px] text-[#0f2a5f]";

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={className}>
          {item}
        </span>
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