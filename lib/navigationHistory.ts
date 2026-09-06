export type Screen = {
  step: "book" | "day" | "wordList" | "study";
  selectedBookId: string;
  folderPath: string[];
  selectedDayId: string;
  wordIndex: number;
};

export function mainScreen(value: Omit<Partial<Screen>, "step"> & { step?: string }): Screen {
  const path = Array.isArray(value.folderPath) ? value.folderPath : [];
  const step = ["book", "day", "wordList", "study"].includes(value.step || "")
    ? value.step as Screen["step"] : value.selectedDayId ? "wordList" : path.length ? "day" : "book";
  return {
    step,
    selectedBookId: step === "book" ? "" : path[0] || value.selectedBookId || "",
    folderPath: step === "book" ? [] : path,
    selectedDayId: step === "wordList" || step === "study" ? value.selectedDayId || "" : "",
    wordIndex: step === "study" ? Math.max(0, value.wordIndex || 0) : 0,
  };
}

export function screenKey(screen: Screen) {
  return JSON.stringify([screen.step, screen.folderPath, screen.selectedDayId]);
}

export function hierarchy(screen: Screen): Screen[] {
  const trail = [mainScreen({ step: "book" })];
  if (screen.step === "book") return trail;
  screen.folderPath.forEach((_, index) => trail.push(mainScreen({ ...screen, step: "day", folderPath: screen.folderPath.slice(0, index + 1) })));
  if (screen.step === "wordList" || screen.step === "study") trail.push(mainScreen({ ...screen, step: "wordList" }));
  if (screen.step === "study") trail.push(screen);
  return trail;
}

export type NavigationEntry = { vocaHistoryVersion: 3; screen: Screen; trail: Screen[] };
export function isNavigationEntry(value: unknown): value is NavigationEntry {
  const entry = value as NavigationEntry | null;
  return entry?.vocaHistoryVersion === 3 && Array.isArray(entry.trail) && entry.trail.length > 0 && !!entry.screen && ["book", "day", "wordList", "study"].includes(entry.screen.step);
}

type HistoryPort = {
  state: unknown;
  replaceState: (data: unknown, unused: string) => void;
  pushState: (data: unknown, unused: string) => void;
  go: (delta: number) => void;
};

/** Browser history contains exactly the ancestors of the active screen. */
export class NavigationHistory {
  private pending: Screen | null = null;
  constructor(private history: HistoryPort, private restore: (screen: Screen) => void) {}

  private write(trail: Screen[], replace: boolean) {
    const data: NavigationEntry = { vocaHistoryVersion: 3, screen: trail[trail.length - 1], trail };
    const state = { ...(this.history.state as object || {}), ...data };
    if (replace) this.history.replaceState(state, "");
    else this.history.pushState(state, "");
  }

  sync(screen: Screen) {
    if (this.pending) { this.pending = screen; return; }
    const desired = hierarchy(screen);
    if (!isNavigationEntry(this.history.state)) {
      this.write(desired.slice(0, 1), true);
      for (let length = 2; length <= desired.length; length++) this.write(desired.slice(0, length), false);
      return;
    }
    const current = this.history.state;
    if (screenKey(current.screen) === screenKey(screen)) {
      this.write([...current.trail.slice(0, -1), screen], true);
      return;
    }
    let common = 0;
    while (common < current.trail.length && common < desired.length && screenKey(current.trail[common]) === screenKey(desired[common])) common++;
    if (common < current.trail.length) {
      this.pending = screen;
      this.history.go(common - current.trail.length);
      return;
    }
    for (let length = common + 1; length <= desired.length; length++) this.write(desired.slice(0, length), false);
  }

  pop(state: unknown) {
    if (!isNavigationEntry(state)) return;
    if (this.pending) {
      const target = this.pending;
      this.pending = null;
      this.sync(target);
      if (!this.pending) this.restore(target);
    } else this.restore(state.screen);
  }
}
