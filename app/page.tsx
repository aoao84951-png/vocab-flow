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
  title: string;
  description: string;
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
};

type Day = {
  id: string;
  title: string;
  words: Word[];
};

type Book = {
  id: string;
  title: string;
  desc: string;
  days: Day[];
};

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [step, setStep] = useState<
    | "book"
    | "day"
    | "wordList"
    | "study"
    | "addBook"
    | "editBook"
    | "addDay"
    | "addWord"
    | "editWord"
  >("book");

  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedDayId, setSelectedDayId] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookDropdownOpen, setBookDropdownOpen] = useState(false);
  const [actionWordIndex, setActionWordIndex] = useState<number | null>(null);
  const [actionDayId, setActionDayId] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const isHistoryMoving = useRef(false);
  const isFirstHistoryState = useRef(true);

  const selectedBook = books.find((book) => book.id === selectedBookId);
  const selectedDay = selectedBook?.days.find((day) => day.id === selectedDayId);
  const words = selectedDay?.words ?? [];
  const currentWord = words[wordIndex];

  useEffect(() => {
    const state = {
      step,
      selectedBookId,
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
  }, [step, selectedBookId, selectedDayId, wordIndex]);
  
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
  
      if (!state) return;
  
      isHistoryMoving.current = true;
  
      setStep(state.step);
      setSelectedBookId(state.selectedBookId || "");
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
        selectedDayId,
        wordIndex,
      })
    );
  }, [step, selectedBookId, selectedDayId, wordIndex]);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  
    setIsStandalone(standalone);
  }, []);
  
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
      setBooks(data.data as Book[]);
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
    setSelectedDayId("");
    setWordIndex(0);
    setShowMeaning(false);
    setMenuOpen(false);
    setBookDropdownOpen(false);
    setActionWordIndex(null);
    setActionDayId(null);
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

  const deleteWord = (targetIndex: number) => {
    if (!confirm("이 단어를 삭제할까?")) return;

    saveBooks((prev) =>
      prev.map((book) =>
        book.id === selectedBookId
          ? {
              ...book,
              days: book.days.map((day) =>
                day.id === selectedDayId
                  ? { ...day, words: day.words.filter((_, i) => i !== targetIndex) }
                  : day
              ),
            }
          : book
      )
    );

    setWordIndex(0);
    setShowMeaning(false);
    setActionWordIndex(null);
    setStep("wordList");
  };

  const toggleMemorized = (targetIndex: number) => {
    saveBooks((prev) =>
      prev.map((book) =>
        book.id === selectedBookId
          ? {
              ...book,
              days: book.days.map((day) =>
                day.id === selectedDayId
                  ? {
                      ...day,
                      words: day.words.map((word, i) =>
                        i === targetIndex ? { ...word, memorized: !word.memorized } : word
                      ),
                    }
                  : day
              ),
            }
          : book
      )
    );

    setShowMeaning(false);
  };

  const deleteDay = (targetDayId: string) => {
    if (!confirm("이 Day를 삭제할까? 안에 있는 단어도 같이 삭제돼.")) return;

    saveBooks((prev) =>
      prev.map((book) =>
        book.id === selectedBookId
          ? { ...book, days: book.days.filter((day) => day.id !== targetDayId) }
          : book
      )
    );

    if (selectedDayId === targetDayId) {
      setSelectedDayId("");
      setWordIndex(0);
      setShowMeaning(false);
      setStep("day");
    }

    setActionDayId(null);
  };

  

  return (
    <main className="min-h-[100svh] bg-white text-[#111827]">
      <section className="mx-auto min-h-[100svh] w-full max-w-[430px] bg-white">
        {step === "book" && (
          <div className="min-h-dvh px-5 pt-8 pb-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-semibold text-[#8a94a6]">VOCAB FLOW</p>
                <h1 className="mt-2 text-[28px] font-bold tracking-tight text-[#0f2a5f]">
                  단어장
                </h1>
              </div>

              <button
                onClick={() => setStep("addBook")}
                className="rounded-full bg-[#0f2a5f] px-4 py-2 text-[12px] font-bold text-white"
              >
                + 추가
              </button>
            </div>

            <div className="mt-7 space-y-3">
              {books.length === 0 ? (
                <Empty text="아직 단어장이 없어. 먼저 단어장을 추가해줘." />
              ) : (
                books.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => goDay(book)}
                    className="w-full rounded-[22px] border border-[#e4e8f0] bg-[#fbfcfe] p-4 text-left active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[18px] font-bold">{book.title}</p>
                        {book.desc && (
                          <p className="mt-1 truncate text-[12px] text-[#8a94a6]">
                            {book.desc}
                          </p>
                        )}
                      </div>

                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBookId(book.id);
                          setStep("editBook");
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f6fa] text-[#8a94a6]"
                      >
                        ⋯
                      </span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <span className="rounded-full bg-[#eef2f8] px-3 py-1 text-[11px] text-[#0f2a5f]">
                        {book.days.length} Days
                      </span>
                      <span className="rounded-full bg-[#eef2f8] px-3 py-1 text-[11px] text-[#0f2a5f]">
                        {book.days.reduce((sum, day) => sum + day.words.length, 0)} words
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {step === "day" && selectedBook && (
          <div className="min-h-dvh px-5 pt-7 pb-6">
            <div className="flex items-center justify-between">
              <BackButton onClick={() => setStep("book")} label="단어장" />

              <button
                onClick={goHome}
                className="mr-1.5 text-[#8a94a6]"
                aria-label="홈"
              >
                <HomeIcon />
              </button>
            </div>

            <div className="mt-5 flex items-start justify-between">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight text-[#0f2a5f]">
                  {selectedBook.title}
                </h1>
              </div>

              <button
                onClick={() => setStep("addDay")}
                className="rounded-full bg-[#0f2a5f] px-4 py-2 text-[12px] font-bold text-white"
              >
                + Day
              </button>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              {selectedBook.days.map((day) => (
                <button
                  key={day.id}
                  onClick={() => goWordList(day.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setActionDayId(day.id);
                  }}
                  className="rounded-[20px] border border-[#dce2ee] bg-white p-4 text-left active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[16px] font-bold">{day.title}</p>
                      <p className="mt-2 text-[11px] text-[#8a94a6]">
                        {day.words.length} 단어
                      </p>
                    </div>

                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionDayId(day.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f5f6fa] text-[#8a94a6]"
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

              <button
                onClick={goHome}
                className="mr-1.5 text-[#8a94a6]"
                aria-label="홈"
              >
                <HomeIcon />
              </button>
            </div>

            <div className="mt-5 flex items-start justify-between">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight text-[#0f2a5f]">
                  {selectedDay.title}
                </h1>
                <p className="mt-2 text-[13px] text-[#8a94a6]">
                  단어를 선택하면 그 단어부터 학습해.
                </p>
              </div>

              <button
                onClick={() => setStep("addWord")}
                className="rounded-full bg-[#0f2a5f] px-4 py-2 text-[12px] font-bold text-white"
              >
                + 단어
              </button>
            </div>

            <div className="mt-7 space-y-2">
              {selectedDay.words.length === 0 ? (
                <Empty text="이 Day에는 아직 단어가 없어." />
              ) : (
                selectedDay.words.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => startStudy(index)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActionWordIndex(index);
                    }}
                    className="w-full rounded-[18px] border border-[#e4e8f0] bg-white px-4 py-4 text-left active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={`truncate text-[17px] font-bold ${
                            item.memorized
                              ? "text-[#b0b7c3] line-through decoration-[#b0b7c3]"
                              : "text-[#0f2a5f]"
                          }`}
                        >
                          {item.word}
                        </p>
                        <p
                          className={`mt-1 truncate text-[12px] ${
                            item.memorized ? "text-[#c3c8d0] line-through" : "text-[#8a94a6]"
                          }`}
                        >
                          {item.meanings[0]?.items?.join(", ") || "뜻 없음"}
                        </p>
                      </div>

                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionWordIndex(index);
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f6fa] text-[#8a94a6]"
                      >
                        ⋯
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

          {step === "study" && selectedBook && selectedDay && (
            <div
              onClick={() => currentWord && setShowMeaning((prev) => !prev)}
              className="flex min-h-[100svh] flex-col px-4 pt-4 pb-[76px]"
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
                {selectedBook.title} 〉 {selectedDay.title} 〉{" "}
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
                  <h2 className="text-[44px] font-bold tracking-tight text-[#0f2a5f]">
                    {currentWord.word}
                  </h2>
                </section>

                <section
                  className={`mt-4 min-h-0 flex-1 overflow-hidden transition-opacity duration-200 ${
                    showMeaning ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  <div className="h-full overflow-y-auto px-3 pb-4">
                    <Block title="뜻">
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
                      <Block title="예시문장">
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
                      <Block title="학습 포인트">
                        <div className="space-y-3">
                          {(currentWord.studyPoints ?? []).map((point, index) => (
                            <div key={index} className="rounded-2xl bg-[#f5f6fa] px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-[#e7ecf5] px-2 py-1 text-[10px] font-bold text-[#0f2a5f]">
                                  {point.category}
                                </span>

                                {point.title && (
                                  <p className="text-[13px] font-bold text-[#111827]">
                                    {point.title}
                                  </p>
                                )}
                              </div>

                              {point.description && (
                                <p className="mt-2 text-[12px] leading-relaxed text-[#596275]">
                                  {point.description}
                                </p>
                              )}

                              {point.exampleEn && (
                                <div className="mt-3 rounded-xl bg-white px-3 py-3">
                                  <p className="text-[12px] leading-relaxed">
                                    <HighlightedText
                                      text={point.exampleEn}
                                      keyword={currentWord.word}
                                    />
                                  </p>

                                  {point.exampleKo && (
                                    <p className="mt-1 text-[11px] text-[#8a94a6]">
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

                <footer
                  onClick={(e) => e.stopPropagation()}
                  className={`study-footer fixed left-1/2 z-10 w-full max-w-[430px] -translate-x-1/2 bg-white/95 px-4 pt-2 backdrop-blur ${
                    isStandalone
                      ? "bottom-[34px] pb-2"
                      : "bottom-0 pb-[calc(12px+env(safe-area-inset-bottom))]"
                  }`}
                >
                  <div className="grid grid-cols-[0.9fr_1.1fr_0.9fr] gap-2">
                    <button
                      onClick={prevWord}
                      className="h-10 rounded-full border border-[#dce2ee] text-[12px] text-[#596275]"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <ChevronLeft />
                        <span>이전</span>
                      </div>
                    </button>

                    <button
                      onClick={() => toggleMemorized(wordIndex)}
                      className={`h-10 rounded-full text-[12px] font-bold ${
                        currentWord.memorized
                          ? "bg-[#eef2f8] text-[#0f2a5f]"
                          : "bg-[#0f2a5f] text-white"
                      }`}
                    >
                      {currentWord.memorized ? "암기 취소" : "암기 완료"}
                    </button>

                    <button
                      onClick={nextWord}
                      className="h-10 rounded-full border border-[#dce2ee] text-[12px] text-[#596275]"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>다음</span>
                        <ChevronRight />
                      </div>
                    </button>
                  </div>
                </footer>
              </>
            )}
          </div>
        )}

        {step === "addBook" && (
          <AddBook
            onBack={() => setStep("book")}
            onSave={(book) => {
              saveBooks((prev) => [...prev, book]);
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

        {step === "addDay" && selectedBook && (
          <AddDay
            defaultTitle={`Day ${selectedBook.days.length + 1}`}
            onBack={() => setStep("day")}
            onSave={(title) => {
              saveBooks((prev) =>
                prev.map((book) =>
                  book.id === selectedBook.id
                    ? {
                        ...book,
                        days: [...book.days, { id: crypto.randomUUID(), title, words: [] }],
                      }
                    : book
                )
              );
              setStep("day");
            }}
          />
        )}

        {step === "addWord" && selectedBook && (
          <AddWord
            book={selectedBook}
            defaultDayId={selectedDayId || selectedBook.days[0]?.id || ""}
            onBack={() => setStep(selectedDayId ? "wordList" : "day")}
            onSave={(dayId, word) => {
              saveBooks((prev) =>
                prev.map((book) =>
                  book.id === selectedBook.id
                    ? {
                        ...book,
                        days: book.days.map((day) =>
                          day.id === dayId ? { ...day, words: [...day.words, word] } : day
                        ),
                      }
                    : book
                )
              );

              setSelectedDayId(dayId);
              setWordIndex(0);
              setShowMeaning(false);
              setStep("wordList");
            }}
          />
        )}

        {step === "editWord" && selectedBook && currentWord && (
          <AddWord
            book={selectedBook}
            defaultDayId={selectedDayId}
            initialWord={currentWord}
            onBack={() => setStep("study")}
            onSave={(dayId, editedWord) => {
              const movedToOtherDay = dayId !== selectedDayId;

              saveBooks((prev) =>
                prev.map((book) =>
                  book.id === selectedBook.id
                    ? {
                        ...book,
                        days: book.days.map((day) => {
                          if (day.id === selectedDayId && day.id === dayId) {
                            return {
                              ...day,
                              words: day.words.map((word, i) =>
                                i === wordIndex ? editedWord : word
                              ),
                            };
                          }

                          if (day.id === selectedDayId) {
                            return {
                              ...day,
                              words: day.words.filter((_, i) => i !== wordIndex),
                            };
                          }

                          if (day.id === dayId) {
                            return { ...day, words: [...day.words, editedWord] };
                          }

                          return day;
                        }),
                      }
                    : book
                )
              );

              setSelectedDayId(dayId);
              setShowMeaning(false);
              setStep(movedToOtherDay ? "wordList" : "study");
            }}
          />
        )}

        {menuOpen && selectedBook && (
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
                  <span>{selectedBook.title}</span>
                  <span className="text-[12px]">{bookDropdownOpen ? "⌃" : "⌄"}</span>
                </button>

                {bookDropdownOpen && (
                  <div className="absolute left-0 right-0 top-[68px] z-30 rounded-[22px] border border-[#e6e9f0] bg-white/95 p-2 shadow-[0_18px_55px_rgba(15,23,42,0.16)] backdrop-blur">
                    <div className="max-h-[270px] overflow-y-auto py-1">
                      {books.map((book) => (
                        <button
                          key={book.id}
                          onClick={() => {
                            setSelectedBookId(book.id);
                            setSelectedDayId("");
                            setWordIndex(0);
                            setShowMeaning(false);
                            setBookDropdownOpen(false);
                            setMenuOpen(false);
                            setStep("day");
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] text-[#111827]"
                        >
                          <span className="w-4 text-[13px] text-[#0f2a5f]">
                            {book.id === selectedBookId ? "✓" : ""}
                          </span>
                          <span>{book.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-7">
                <p className="mb-3 text-[11px] font-bold text-[#8a94a6]">Day 변경</p>

                <div className="space-y-2">
                  {selectedBook.days.map((day) => (
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

        {actionDayId !== null && selectedBook && (
          <div
            onClick={() => setActionDayId(null)}
            className="fixed inset-0 z-30 flex items-end bg-black/25"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="mx-auto w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
            >
              <p className="text-[16px] font-bold text-[#111827]">
                {selectedBook.days.find((day) => day.id === actionDayId)?.title}
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
            category: "문법/용법",
            title: "",
            description: "",
            exampleEn: "",
            exampleKo: "",
          },
        ]
  );

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
        category: "기타",
        title: "",
        description: "",
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
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f5f6fa] text-[15px] text-[#8a94a6]"
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
                      value={point.category}
                      onChange={(e) => updateStudyPoint(index, "category", e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-[#dce2ee] px-3 pr-9 text-[13px] outline-none"
                    >
                      <option value="문법/용법">문법/용법</option>
                      <option value="표현/패턴">표현/패턴</option>
                      <option value="혼동주의">혼동주의</option>
                      <option value="cf.">cf.</option>
                      <option value="시험포인트">시험포인트</option>
                      <option value="기타">기타</option>
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

                <input
                  value={point.title}
                  onChange={(e) => updateStudyPoint(index, "title", e.target.value)}
                  placeholder="제목 예: 후치수식 가능 / respond to / readership"
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
                  category: point.category,
                  title: point.title.trim(),
                  description: point.description.trim(),
                  exampleEn: point.exampleEn.trim(),
                  exampleKo: point.exampleKo.trim(),
                }))
                .filter(
                  (point) => point.title || point.description || point.exampleEn || point.exampleKo
                ),
              memorized: initialWord?.memorized || false,
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

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[68px_1fr] gap-3 border-b border-[#eef1f5] py-3 last:border-b-0">
      <p className="pt-[1px] text-[12px] font-bold text-[#111827]">{title}</p>
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
  if (!keyword.trim()) return <>{text}</>;

  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedKeyword})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === keyword.toLowerCase() ? (
          <strong key={index} className="font-bold text-[#d92d20]">
            {part}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}