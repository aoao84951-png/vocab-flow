export type FolderAction = { kind: "edit" | "add"; id: string; title: string; icon: string; desc: string; coverImage?: string; isBook?: boolean } | { kind: "add-day"; id: string; title: string } | { kind: "edit-day"; id: string; dayId: string; title: string } | { kind: "move-day"; id: string; dayId: string; relativeTo: string; placement: "before" | "after" } | { kind: "delete"; id: string } | { kind: "move"; id: string; destination: string; relativeTo?: string; placement?: "before" | "after" };
type Node = { id: string; title: string; icon?: string; desc?: string; coverImage?: string; isBook?: boolean; folders: Node[]; days: { id: string; title?: string; words?: unknown[] }[] };
export function applyFolderAction<T extends Node>(items: T[], action: FolderAction): T[] {
  const find = (nodes: Node[], id: string): Node | undefined => { for (const node of nodes) { if (node.id === id) return node; const child = find(node.folders, id); if (child) return child; } };
  if (action.kind === "add" && !action.id) return [...items, { id: crypto.randomUUID(), title: action.title, icon: action.icon, desc: action.desc, coverImage: action.coverImage ?? "", isBook: action.isBook ?? false, folders: [], days: [] }] as T[];
  const source = find(items, action.id);
  if (!source) return items;
  if (action.kind === "edit-day" || action.kind === "move-day") {
    const day = source.days.find(item => item.id === action.dayId);
    if (!day) return items;
    let days = source.days;
    if (action.kind === "edit-day") {
      if (!action.title.trim()) return items;
      days = days.map(item => item.id === day.id ? { ...item, title: action.title.trim() } : item);
    } else {
      if (action.relativeTo === day.id || !days.some(item => item.id === action.relativeTo)) return items;
      days = days.filter(item => item.id !== day.id);
      const index = days.findIndex(item => item.id === action.relativeTo);
      days.splice(index + (action.placement === "after" ? 1 : 0), 0, day);
    }
    const update = (nodes: Node[]): Node[] => nodes.map(node => node.id === source.id ? { ...node, days } : { ...node, folders: update(node.folders) });
    return update(items) as T[];
  }

  if (action.kind === "move" && (action.destination && !find(items, action.destination) || find([source], action.destination))) return items;
  if (action.kind === "move" && action.relativeTo) {
    const siblings = action.destination ? find(items, action.destination)?.folders : items;
    if (action.relativeTo === action.id || !siblings?.some(node => node.id === action.relativeTo)) return items;
  }
  const insert = (nodes: Node[]): Node[] => {
    if (action.kind !== "move") return nodes;
    const next = [...nodes];
    const index = action.relativeTo ? next.findIndex(node => node.id === action.relativeTo) : -1;
    next.splice(index < 0 ? next.length : index + (action.placement === "after" ? 1 : 0), 0, source);
    return next;
  };
  const walk = (nodes: Node[]): Node[] => nodes.filter(node => !((action.kind === "delete" || action.kind === "move") && node.id === action.id)).map(node => {
    let result = { ...node, folders: walk(node.folders) };
    if (node.id === action.id && action.kind === "add-day") result.days = [...result.days, { id: crypto.randomUUID(), title: action.title, words: [] }];
    if (node.id === action.id && action.kind === "edit") result = { ...result, title: action.title, icon: action.icon, desc: action.desc, ...(action.isBook !== undefined ? { isBook: action.isBook } : {}), ...(action.coverImage !== undefined ? { coverImage: action.coverImage } : {}) };
    if (node.id === action.id && action.kind === "add") result.folders = [...result.folders, { id: crypto.randomUUID(), title: action.title, icon: action.icon, desc: action.desc, ...(action.isBook !== undefined ? { isBook: action.isBook } : {}), ...(action.coverImage ? { coverImage: action.coverImage } : {}), folders: [], days: [] }];
    if (action.kind === "move" && node.id === action.destination) result.folders = insert(result.folders);
    return result;
  });
  let next = walk(items);
  if (action.kind === "move" && !action.destination) next = insert(next);
  return next as T[];
}

export function findFolderPath(items: Node[], id: string): string[] | undefined {
  for (const item of items) {
    if (item.id === id) return [item.id];
    const child = findFolderPath(item.folders, id);
    if (child) return [item.id, ...child];
  }
}
