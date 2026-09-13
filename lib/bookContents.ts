export type ContentsDay = { id: string; title: string; words: unknown[] };
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

// Reopen the containing book and reveal the selected branch in place.
export function getContentsEntry(books: ContentsFolder[], requested: string[]) {
  const chain = resolveContentsPath(books, requested);
  const bookIndex = Math.max(0, chain.findIndex(isBookFolder));
  const path = chain.slice(0, bookIndex + 1).map(folder => folder.id);
  const open: Record<string, string> = {};
  for (let i = bookIndex; i < chain.length - 1; i++) open[chain[i].id] = chain[i + 1].id;
  return { path, open };
}
