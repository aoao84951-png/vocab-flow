type SelectionBounds = { left: number; right: number; top: number; bottom: number };
type ViewportBounds = { left: number; top: number; width: number; height: number };

export function selectionToolbarPosition(selection: SelectionBounds, viewport: ViewportBounds, width: number, height: number) {
  const gap = 8;
  const above = Math.max(0, selection.top - viewport.top - gap * 2);
  const below = Math.max(0, viewport.top + viewport.height - selection.bottom - gap * 2);
  const useAbove = above >= height || (below < height && above >= below);
  const maxHeight = Math.min(height, useAbove ? above : below);
  return {
    left: Math.max(viewport.left + gap, Math.min((selection.left + selection.right - width) / 2, viewport.left + viewport.width - width - gap)),
    top: useAbove ? selection.top - gap - maxHeight : selection.bottom + gap,
    maxHeight,
  };
}
