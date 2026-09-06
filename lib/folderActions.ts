export type FolderAction = { kind: "edit" | "add"; id: string; title: string; icon: string; desc: string } | { kind: "delete"; id: string } | { kind: "move"; id: string; destination: string };
type Node = { id: string; title: string; icon?: string; desc?: string; folders: Node[]; days: unknown[] };
export function applyFolderAction<T extends Node>(items: T[], action: FolderAction): T[] {
  const find = (nodes: Node[], id: string): Node | undefined => { for (const node of nodes) { if (node.id === id) return node; const child = find(node.folders, id); if (child) return child; } };
  const source = find(items, action.id);
  if (!source) return items;
  if (action.kind === "move" && (action.destination && !find(items, action.destination) || find([source], action.destination))) return items;
  const walk = (nodes: Node[]): Node[] => nodes.filter(node => !((action.kind === "delete" || action.kind === "move") && node.id === action.id)).map(node => {
    let result = { ...node, folders: walk(node.folders) };
    if (node.id === action.id && action.kind === "edit") result = { ...result, title: action.title, icon: action.icon, desc: action.desc };
    if (node.id === action.id && action.kind === "add") result.folders = [...result.folders, { id: crypto.randomUUID(), title: action.title, icon: action.icon, desc: action.desc, folders: [], days: [] }];
    if (action.kind === "move" && node.id === action.destination) result.folders = [...result.folders, source];
    return result;
  });
  const next = walk(items);
  if (action.kind === "move" && !action.destination) next.push(source);
  return next as T[];
}
