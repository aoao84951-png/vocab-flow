# iOS palette verification — 2026-09-20

Environment: iPhone 17 Pro simulator, iOS 26.5, Korean software keyboard.
Tested Safari and an installed standalone home-screen web app. This is an iOS
simulator result, not a physical iPhone result.

The initial reproduction used the real MobileApp → word edit → learning points
screen, adding five unsaved examples. Repeated checks used the same actual AddWord,
RichTextField, MobileSelectionToolbar and MobileEditorActions components with five
fixed example strings on a temporary local-only page; saving was disabled.
Temporary pages and event recording endpoints were removed after verification.
No test edits were saved to the user's vocabulary database.

## Reproduced before correction

- Double-tapping a word in the fifth example moved it under the format toolbar.
- Measured iOS viewport height: 377, offsetTop: 337. Range rect: 241–258.
  The old comparison used offsetTop + 16 as the rect-space top and scrolled down
  by 112 pixels even though the selection was already visible.
- Closing the palette reopened the keyboard, then the document scroll reverted
  from 1399 to 1062. The selected caret ended at 578–595, below a 377px viewport.
- Standalone mode also produced delayed page panning after temporary formatting
  focus, which can move the target behind the palette after the command returns.

## Verified after correction using native iOS UI

- Double-tap a word in the fifth example: the selected word and format toolbar
  remain visible and separate from the native edit menu.
- Open the palette: the native menu disappears; the target preview remains above
  the palette.
- Apply red to `laptop`, close, reselect `computer`, apply blue and bold, close:
  correct fragments are changed; keyboard returns with the edited text visible.
- Repeat opening and closing in standalone home-screen mode, changing red to
  blue: the target remains visible after the delayed native pan has settled.
- The Safari and standalone keyboard transitions were observed on screen and
  checked against viewport/selection event logs.

## Limits

- Native Cut/Copy/Paste still appears on initial iOS text selection. The existing
  CSS/contextmenu suppression does not fully disable this system menu. Do not
  describe this as complete native-menu suppression.
- The automation's simulated drag emitted a tap without touchmove events, so
  physical finger scrolling/selection-handle dragging was not verified.
- No physical device or other iOS version was available for this run.

Automated follow-ups:
`node --test tests/mobile-editor-viewport.cjs tests/rich-text.cjs tests/selection-toolbar-position.cjs`
and `node tests/mobile-palette.cjs`.
