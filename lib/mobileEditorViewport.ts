type VerticalRect = { top: number; bottom: number };

// Derive the viewport origin from a bottom-anchored element's DOM rect. iOS
// keyboard panning and other browsers do not report rects in the same origin.
export function mobileEditorScrollDelta(target: VerticalRect, viewportBottom: number, viewportHeight: number, obstructionTop = viewportBottom) {
  const top = viewportBottom - viewportHeight + 16;
  const bottom = obstructionTop - 16;
  return target.bottom > bottom
    ? Math.min(target.bottom - bottom, target.top - top)
    : Math.min(0, target.top - top);
}
