# Summer Symbols compatibility variant

`aa-summer-symbols-v3.woff2` is derived from `aa-summer-symbols-v2.woff2`
by removing only the `SVG ` table. All 39 SVG glyphs also have COLR v0
layers, so their existing color layers and palette remain available through
COLR/CPAL. Character mappings, outlines, and metrics are retained.

This avoids selecting the OpenType-SVG rendering path when investigating
invisible symbols reported after an iPadOS update. It is a compatibility
workaround, not confirmation of an iPadOS bug. Verify on the affected iPad
after deployment, including Safari, Chrome, and the installed web app.

The new filename prevents reuse of a cached v2 font. Keep v2 as the source
and for older cached stylesheets.

To regenerate from the repository root with Python and `fonttools[woff]`:

```python
from fontTools.ttLib import TTFont

font = TTFont("public/fonts/aa-summer-symbols-v2.woff2", recalcTimestamp=False)
for document in font["SVG "].docList:
    for glyph_id in range(document.startGlyphID, document.endGlyphID + 1):
        assert font.getGlyphName(glyph_id) in font["COLR"].ColorLayers
del font["SVG "]
font.save("public/fonts/aa-summer-symbols-v3.woff2")
```
