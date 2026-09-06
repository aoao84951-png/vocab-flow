"use client";

import { useLayoutEffect, useRef } from "react";
import { mainScreen, NavigationHistory, type Screen } from "@/lib/navigationHistory";

export default function useNavigationHistory(ready: boolean, screen: Omit<Screen, "step"> & { step: string }, restore: (screen: Screen) => void) {
  const restoreRef = useRef(restore);
  const controller = useRef<NavigationHistory | null>(null);
  useLayoutEffect(() => { restoreRef.current = restore; });
  useLayoutEffect(() => {
    controller.current = new NavigationHistory(window.history, (next) => restoreRef.current(next));
    const pop = (event: PopStateEvent) => controller.current?.pop(event.state);
    window.addEventListener("popstate", pop);
    return () => { window.removeEventListener("popstate", pop); controller.current = null; };
  }, []);
  useLayoutEffect(() => {
    if (ready && ["book", "day", "wordList", "study"].includes(screen.step)) controller.current?.sync(mainScreen(screen as Screen));
  }, [ready, screen.step, screen.selectedBookId, screen.folderPath, screen.selectedDayId, screen.wordIndex]);
}
