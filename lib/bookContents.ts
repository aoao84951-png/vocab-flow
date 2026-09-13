export type ContentsDay = { id: string; title: string; words: unknown[] };
export type ContentsFolder = {
  id: string;
  title: string;
  desc?: string;
  icon?: string;
  coverImage?: string;
  folders: ContentsFolder[];
  days: ContentsDay[];
};

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
