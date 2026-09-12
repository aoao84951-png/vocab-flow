export type FolderAction = { kind: "edit" | "add"; id: string; title: string; icon: string; desc: string } | { kind: "delete"; id: string } | { kind: "move"; id: string; destination: string; relativeTo?: string; placement?: "before" | "after" };
type Node = { id: string; title: string; icon?: string; desc?: string; folders: Node[]; days: unknown[] };
export function applyFolderAction<T extends Node>(items: T[], action: FolderAction): T[] {
  const find = (nodes: Node[], id: string): Node | undefined => { for (const node of nodes) { if (node.id === id) return node; const child = find(node.folders, id); if (child) return child; } };
  const source = find(items, action.id);
  if (!source) return items;
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
    if (node.id === action.id && action.kind === "edit") result = { ...result, title: action.title, icon: action.icon, desc: action.desc };
    if (node.id === action.id && action.kind === "add") result.folders = [...result.folders, { id: crypto.randomUUID(), title: action.title, icon: action.icon, desc: action.desc, folders: [], days: [] }];
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
