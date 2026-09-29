export type ContentsDay = { id: string; title: string; words: unknown[]; supplementTo?: string };
export type ContentsFolder = {
  id: string;
  title: string;
  desc?: string;
  icon?: string;
  coverImage?: string; isBook?: boolean;
  folders: ContentsFolder[];
  days: ContentsDay[];
};

export function isBookFolder(folder: { isBook?: boolean; coverImage?: string }) {
  return folder.isBook ?? Boolean(folder.coverImage);
}

// Resolve against live data, including moving/deleting a folder while it is open.
export function resolveContentsPath(books: ContentsFolder[], requested: string[]) {
  const find = (nodes: ContentsFolder[], id: string, parent: ContentsFolder[] = []): ContentsFolder[] | undefined => {
    for (const node of nodes) {
      const path = [...parent, node];
      if (node.id === id) return path;
      const nested = find(node.folders, id, path);
      if (nested) return nested;
    }
  };
  for (let i = requested.length - 1; i >= 0; i--) {
    const path = find(books, requested[i]);
    if (path) return path;
  }
  return [];
}

export function toggleContentsChapter(open: Record<string, string>, parentId: string, id: string) {
  return { ...open, [parentId]: open[parentId] === id ? "" : id };
}

// Each level is a selector; Days on intermediate levels remain reachable too.
export function getFocusedContents(book: ContentsFolder, open: Record<string, string>) {
  const levels: { folder: ContentsFolder; selectedId: string }[] = [];
  const folders = [book];
  let current = book;
  while (current.folders.length) {
    const requested = open[current.id];
    const selected = requested === current.id && current.days.length
      ? undefined
      : current.folders.find(folder => folder.id === requested) ?? (current.days.length ? undefined : current.folders[0]);
    levels.push({ folder: current, selectedId: selected?.id ?? current.id });
    if (!selected) break;
    folders.push(selected);
    current = selected;
  }
  return { levels, folders, current };
}

// Reopen the containing book and reveal the selected branch in place.
export function getContentsEntry(books: ContentsFolder[], requested: string[], selectedDayId?: string) {
  const chain = resolveContentsPath(books, requested);
  const bookIndex = Math.max(0, chain.findIndex(isBookFolder));
  const path = chain.slice(0, bookIndex + 1).map(folder => folder.id);
  const open: Record<string, string> = {};
  for (let i = bookIndex; i < chain.length - 1; i++) open[chain[i].id] = chain[i + 1].id;
  const selectedFolder = chain.at(-1);
  if (selectedFolder?.days.some(day => day.id === selectedDayId)) open[selectedFolder.id] = selectedFolder.id;
  return { path, open };
}
